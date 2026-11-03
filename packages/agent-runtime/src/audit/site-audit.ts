/**
 * The site audit: the pipeline behind `rankcli audit`, `fix` and `apply`, the GitHub Action
 * and anything else that audits a site rather than one page. Discover pages (the sitemap
 * first, links from the homepage to fill up), audit them in parallel, merge the findings.
 *
 * Progress is reported through a callback; nothing here writes to stdout.
 */
import { runFullAudit } from './engine.js';
import { discoverPagesFromLinks, type DiscoveredPage } from './discovery/link-crawler.js';
import { discoverPagesFromSitemap } from './discovery/sitemap.js';
import { metaRefreshTarget } from './meta-refresh.js';
import { detectFramework, getFrameworkDisplayName } from '../frameworks/index.js';
import { installRequestDefaults } from './ci/request-defaults.js';
import { serveDirectory } from './static-site.js';
import type { AuditReport, AuditIssue } from './types.js';

export type DiscoverySource = 'sitemap' | 'links' | 'none';

export interface SiteAuditOptions {
  url: string;
  /** Pages to audit, counting the URL itself; 1 audits the URL alone. */
  maxPages: number;
  /** Verify link targets (broken links, hreflang reciprocity): real requests, so opt-in. */
  checkLinks?: boolean;
  /** Passed through to the engine (280 runs every check). */
  checksLimit?: number;
  /** 'sitemap' (default): the sitemap seeds the page list and homepage links fill the rest. 'links': homepage links only. */
  discovery?: 'sitemap' | 'links';
  /** The pages come from a build directory served locally: checks of the host are skipped. Implied by `dir`. */
  staticBuild?: boolean;
  /**
   * A build directory to audit instead of the live site: served on 127.0.0.1 for the length
   * of the audit, with `url` naming the site it is built for (canonical and sitemap checks
   * compare against it). Checks of the host are skipped.
   */
  dir?: string;
  /** Sent with every request to the site (and its www. twin), never to other hosts. */
  headers?: Record<string, string>;
  /** Paths in `files` are made relative to this directory (default: the current directory). */
  relativeTo?: string;
  onProgress?: (event: SiteAuditProgress) => void;
}

export type SiteAuditProgress =
  | { phase: 'discovery'; status: 'start' }
  | { phase: 'discovery'; status: 'done'; pages: number; source: DiscoverySource; framework: string | null; homepageFetched: boolean }
  | { phase: 'audit'; status: 'start'; pages: number }
  | { phase: 'audit'; status: 'progress'; done: number; total: number }
  | { phase: 'audit'; status: 'done'; audited: number; total: number; ms: number; pageFailure?: AuditIssue };

/** One audited page, for the per-page breakdown in the report. */
export interface PageSummary {
  url: string;
  score: number;
  errors: number;
  warnings: number;
  notices: number;
  /** Clicks from the homepage over the audited pages' HTML links; absent when not reachable within them. */
  depth?: number;
}

/**
 * The site's link graph as a crawler without JavaScript sees it, built from the audited
 * pages' HTML. The write-up this comes from ("Google indexed 258 of my 406 pages") found the
 * content server-rendered and the navigation not, by crawling with scripts off and drawing
 * the graph; the sitemap was never the problem.
 */
export interface LinkGraph {
  /** Internal links in the homepage's HTML before any JavaScript runs. */
  homepageLinks: number;
  /** Shortest number of clicks from the homepage, over the audited pages' links. */
  depth: Record<string, number>;
  /** Audited pages no audited page links to, the homepage aside. */
  unreachable: string[];
  /** Sitemap pages no audited page links to; only known when every sitemap page was audited. */
  orphans?: string[];
  coverage: { audited: number; sitemap: number; complete: boolean };
}

export interface SiteAuditResult {
  /** The report for the URL itself; the scores come from here. */
  primaryReport: AuditReport;
  /** Every audited page's issues, merged by code: what gets printed, gated and fixed. */
  issues: AuditIssue[];
  /** Each audited page with its own score and counts. */
  pages: PageSummary[];
  score: number;
  pagesAudited: number;
  pagesDiscovered: number;
  discovery: { source: DiscoverySource; sitemapUrl?: string };
  /** Present when the engine reported each page's links. */
  linkGraph?: LinkGraph;
  framework: string | null;
  /** Set when the URL itself could not be audited (unreachable, or an error status). */
  pageFailure?: AuditIssue;
  checksRun: number;
  /** Wall time of the page audits. */
  auditMs: number;
  /** With `dir`: the file behind each page URL that has findings, relative to `relativeTo`. */
  files?: Record<string, string>;
}

// 'critical' and 'info' exist in the runtime's severity type as well.
const SEVERITY_RANK: Record<string, number> = { critical: 4, error: 3, warning: 2, notice: 1, info: 1 };

/**
 * Fetch a page's HTML, following an instant meta refresh the way the engine does, so page
 * discovery starts from the real page and not from an 80-byte redirect stub.
 */
export async function fetchHtml(url: string, timeout = 10000): Promise<string | null> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    let html: string | null;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      const response = await fetch(current, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'RankCLI-Bot/1.0 (+https://rankcli.dev/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        },
      });
      clearTimeout(timeoutId);
      if (!response.ok) return null;
      html = await response.text();
    } catch {
      return null;
    }
    const target = metaRefreshTarget(html, current);
    if (!target) return html;
    current = target;
  }
  return null;
}

/**
 * Merge issues from several pages, aggregating affected URLs. When pages report the same
 * code at different severities (noindex is an error on the audited root, a warning elsewhere)
 * the most severe wins.
 */
export function mergeIssues(issueArrays: AuditIssue[][]): AuditIssue[] {
  const issueMap = new Map<string, AuditIssue>();
  for (const issues of issueArrays) {
    for (const issue of issues) {
      const existing = issueMap.get(issue.code);
      if (existing) {
        const urls = new Set([...(existing.affectedUrls || []), ...(issue.affectedUrls || [])]);
        existing.affectedUrls = Array.from(urls);
        if ((SEVERITY_RANK[issue.severity] ?? 0) > (SEVERITY_RANK[existing.severity] ?? 0)) {
          existing.severity = issue.severity;
        }
      } else {
        issueMap.set(issue.code, { ...issue });
      }
    }
  }
  return Array.from(issueMap.values());
}

const samePage = (a: string, b: string): boolean => {
  const key = (u: string) => {
    try {
      const x = new URL(u);
      return x.origin + (x.pathname.replace(/\/+$/, '') || '/') + x.search;
    } catch {
      return u;
    }
  };
  return key(a) === key(b);
};

/**
 * Audit a site. Returns null when no page could be analyzed.
 */
/** One spelling per page for the graph: no hash, no tracking parameters, no trailing slash. */
export function canonicalPageUrl(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = '';
    for (const p of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'source']) u.searchParams.delete(p);
    // /index.html and / are one page; a site whose brand link points at index.html must
    // key its homepage the way the sitemap and the entry URL spell it (rankcli #23).
    const path = u.pathname.replace(/\/index\.html?$/i, '/').replace(/\/+$/, '') || '/';
    return `${u.protocol}//${u.hostname.toLowerCase()}${path}${u.search}`;
  } catch {
    return null;
  }
}

/**
 * Depth, reachability and orphans over the audited pages' JavaScript-free links. Orphans are
 * only declared when every sitemap page was audited: with five of four hundred pages fetched,
 * "no audited page links to it" is not evidence of anything.
 */
export function buildLinkGraph(
  homeUrl: string,
  audited: Map<string, string[]>,
  sitemap: { urls: string[]; complete: boolean }
): LinkGraph {
  const canonicalHome = canonicalPageUrl(homeUrl) ?? homeUrl;
  // The entry URL is the homepage; if the crawl keyed it another way, the first audited page is.
  const home = audited.has(canonicalHome) ? canonicalHome : ([...audited.keys()][0] ?? canonicalHome);
  const depth: Record<string, number> = { [home]: 0 };
  const queue = [home];
  while (queue.length > 0) {
    const page = queue.shift()!;
    for (const link of audited.get(page) ?? []) {
      if (!audited.has(link) || link in depth) continue;
      depth[link] = depth[page] + 1;
      queue.push(link);
    }
  }
  const unreachable = [...audited.keys()].filter(page => page !== home && !(page in depth));
  const sitemapPages = [...new Set(sitemap.urls.map(canonicalPageUrl).filter((u): u is string => !!u && u !== home))];
  const complete = sitemap.complete && sitemapPages.length > 0 && sitemapPages.every(page => audited.has(page));
  const graph: LinkGraph = {
    homepageLinks: new Set((audited.get(home) ?? []).filter(link => link !== home)).size,
    depth,
    unreachable,
    coverage: { audited: audited.size, sitemap: sitemapPages.length, complete },
  };
  if (complete) {
    const linked = new Set<string>();
    for (const links of audited.values()) for (const link of links) linked.add(link);
    graph.orphans = sitemapPages.filter(page => !linked.has(page));
  }
  return graph;
}

/** The findings the graph supports: no navigation in the HTML, orphans, pages buried deep. */
export function linkGraphIssues(homeUrl: string, graph: LinkGraph): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const { coverage } = graph;

  if (graph.homepageLinks <= 2 && (coverage.sitemap >= 10 || coverage.audited >= 5)) {
    const n = graph.homepageLinks;
    issues.push({
      code: 'NAV_NOT_IN_HTML',
      severity: 'warning',
      category: 'crawlability',
      title: `The homepage links to ${n} page${n === 1 ? '' : 's'} in its HTML`,
      description: `Before any JavaScript runs, the homepage's HTML links to ${n} internal page${n === 1 ? '' : 's'}, while the site has ${coverage.sitemap >= 10 ? `${coverage.sitemap} pages in its sitemap` : `at least ${coverage.audited} pages`}. A crawler that does not execute the scripts sees the content and no way to the rest of the site. "The content was server-rendered. The navigation was not."`,
      impact:
        'Pages reached only through client-rendered navigation are discovered late or not at all. The write-up this check comes from had 258 of 406 pages indexed, and the sitemap was never the problem.',
      howToFix:
        'Render the navigation and the in-content links in the HTML: server-render the nav component, or ship a plain <nav> of <a href> links that the client enhances.',
      affectedUrls: [homeUrl],
      details: { homepageLinks: n, coverage },
    });
  }

  if (graph.orphans && graph.orphans.length > 0) {
    const n = graph.orphans.length;
    const m = coverage.sitemap;
    issues.push({
      code: 'ORPHAN_PAGES',
      severity: n / m >= 0.25 ? 'warning' : 'notice',
      category: 'crawlability',
      title: `${n} of ${m} sitemap pages have no incoming link`,
      description: `Every page in the sitemap was audited, and these have no link from any of them in the HTML, before JavaScript: ${graph.orphans.slice(0, 10).join(', ')}${n > 10 ? ` and ${n - 10} more` : ''}.`,
      impact: 'A page only the sitemap knows about is crawled late and ranks as the dead end it is; nothing on the site vouches for it.',
      howToFix: 'Link each one from a related page or a hub. A page not worth a link may not be worth a sitemap entry either.',
      affectedUrls: graph.orphans,
      details: { orphans: graph.orphans, coverage },
    });
  }

  if (coverage.complete) {
    const deep = Object.entries(graph.depth).filter(([, d]) => d >= 4).map(([page]) => page);
    if (deep.length > 0) {
      issues.push({
        code: 'DEEP_PAGES',
        severity: 'notice',
        category: 'crawlability',
        title: `${deep.length} page${deep.length === 1 ? ' is' : 's are'} four or more clicks from the homepage`,
        description: `Over the links in the HTML, the shortest path from the homepage to ${deep.slice(0, 10).join(', ')}${deep.length > 10 ? ` and ${deep.length - 10} more` : ''} is four clicks or longer.`,
        impact: 'Crawl depth is a priority signal: pages far from the homepage are crawled less often and treated as less important.',
        howToFix: 'Link important pages from the homepage or a hub page so that every page is within three clicks.',
        affectedUrls: deep,
        details: { depth: Object.fromEntries(deep.map(page => [page, graph.depth[page]])), coverage },
      });
    }
  }

  return issues;
}

export async function auditSite(options: SiteAuditOptions): Promise<SiteAuditResult | null> {
  const { url } = options;
  const cleanups: Array<() => void | Promise<void>> = [];
  try {
    let fileFor: ((pageUrl: string) => Promise<string | undefined>) | undefined;
    if (options.dir) {
      const site = await serveDirectory(options.dir, { relativeTo: options.relativeTo });
      cleanups.push(() => site.close());
      cleanups.push(installRequestDefaults({ origin: new URL(url).origin, headers: options.headers, rewriteTo: site.origin }));
      fileFor = site.fileFor;
    } else if (options.headers && Object.keys(options.headers).length > 0) {
      cleanups.push(installRequestDefaults({ origin: new URL(url).origin, headers: options.headers }));
    }
    const result = await auditPages({ ...options, staticBuild: options.staticBuild || !!options.dir });
    if (result && fileFor) {
      const files: Record<string, string> = {};
      for (const issue of result.issues) {
        for (const pageUrl of issue.affectedUrls ?? [url]) {
          if (pageUrl in files) continue;
          const file = await fileFor(pageUrl);
          if (file) files[pageUrl] = file;
        }
      }
      result.files = files;
    }
    return result;
  } finally {
    for (const cleanup of cleanups.reverse()) await cleanup();
  }
}

async function auditPages(options: SiteAuditOptions): Promise<SiteAuditResult | null> {
  const { url, onProgress } = options;
  const maxPages = Math.max(1, options.maxPages);
  const checksLimit = options.checksLimit ?? 280;
  const progress = (event: SiteAuditProgress) => onProgress?.(event);

  // ===== Discover pages =====
  progress({ phase: 'discovery', status: 'start' });
  let pagesToAudit: string[] = [url];
  let source: DiscoverySource = 'none';
  let sitemapUrl: string | undefined;
  let sitemapRead: { urls: string[]; complete: boolean } = { urls: [], complete: false };
  const homepageHtml = await fetchHtml(url, 10000);
  let detectedFramework = detectFramework({});

  if (homepageHtml) {
    detectedFramework = detectFramework({ html: homepageHtml });
    if (maxPages > 1) {
      const wanted = maxPages - 1;
      const found: DiscoveredPage[] = [];
      if (options.discovery !== 'links') {
        const sitemap = await discoverPagesFromSitemap(url, wanted);
        sitemapUrl = sitemap.sitemapUrl;
        sitemapRead = { urls: sitemap.urls ?? [], complete: !!sitemap.complete };
        found.push(...sitemap.pages);
        if (sitemap.pages.length > 0) source = 'sitemap';
      }
      if (found.length < wanted) {
        for (const page of discoverPagesFromLinks(url, homepageHtml, wanted)) {
          if (found.length >= wanted) break;
          if (!found.some(p => samePage(p.url, page.url))) found.push(page);
        }
        if (source === 'none' && found.length > 0) source = 'links';
      }
      pagesToAudit = [url, ...found.map(p => p.url).filter(u => !samePage(u, url))];
    }
  }
  const framework = detectedFramework.framework !== 'unknown'
    ? getFrameworkDisplayName(detectedFramework.framework)
    : null;
  progress({ phase: 'discovery', status: 'done', pages: pagesToAudit.length, source, framework, homepageFetched: !!homepageHtml });

  // ===== Audit pages in parallel =====
  progress({ phase: 'audit', status: 'start', pages: pagesToAudit.length });
  let done = 0;
  const auditPage = async (pageUrl: string): Promise<AuditReport | null> => {
    try {
      const report = await runFullAudit({
        url: pageUrl,
        auditRootUrl: url,
        maxPages: 1,
        checkBrokenLinks: options.checkLinks || false,
        // Bundled with checkLinks: both mean "verify actual link targets, which costs real requests".
        checkHreflangUrls: options.checkLinks || false,
        checksLimit,
        staticBuild: options.staticBuild,
      });
      done++;
      progress({ phase: 'audit', status: 'progress', done, total: pagesToAudit.length });
      return report;
    } catch {
      return null;
    }
  };

  const started = Date.now();
  const results = await Promise.allSettled(pagesToAudit.map(pageUrl => auditPage(pageUrl)));
  const auditMs = Date.now() - started;

  const allIssues: AuditIssue[][] = [];
  const pages: PageSummary[] = [];
  let primaryReport: AuditReport | null = null;
  let pagesAudited = 0;
  // The link graph, when the engine reported each page's links (older mocks and reports do not).
  const audited = new Map<string, string[]>();
  let linksReported = true;
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      const report = result.value;
      allIssues.push(report.issues);
      if (i === 0) primaryReport = report;
      pagesAudited++;
      const links = report.pages[0]?.internalLinks;
      if (links) {
        const page = canonicalPageUrl(pagesToAudit[i]);
        if (page) audited.set(page, links.map(canonicalPageUrl).filter((u): u is string => !!u));
      } else {
        linksReported = false;
      }
      const count = (...severities: string[]) => report.issues.filter(x => severities.includes(x.severity)).length;
      pages.push({
        url: pagesToAudit[i],
        score: report.healthScore?.overall || 0,
        errors: count('error', 'critical'),
        warnings: count('warning'),
        notices: count('notice', 'info'),
      });
    }
  });

  if (!primaryReport) {
    progress({ phase: 'audit', status: 'done', audited: 0, total: pagesToAudit.length, ms: auditMs });
    return null;
  }
  const primary: AuditReport = primaryReport;

  // The engine reports an unreachable page (FETCH_ERROR) or an error status (HTTP_ERROR_STATUS)
  // as an issue and zeroes the score. That's a result worth printing, but not a completed audit.
  const pageFailure = primary.issues.find(i => i.code === 'FETCH_ERROR' || i.code === 'HTTP_ERROR_STATUS');
  progress({ phase: 'audit', status: 'done', audited: pagesAudited, total: pagesToAudit.length, ms: auditMs, pageFailure });

  const checksRun = (primary.summary?.passed || 0) + (primary.summary?.errors || 0) + (primary.summary?.warnings || 0) || 200;

  let linkGraph: LinkGraph | undefined;
  if (linksReported && audited.size > 0 && !pageFailure) {
    linkGraph = buildLinkGraph(url, audited, sitemapRead);
    allIssues.push(linkGraphIssues(url, linkGraph));
    for (const page of pages) {
      const key = canonicalPageUrl(page.url);
      if (key && key in linkGraph.depth) page.depth = linkGraph.depth[key];
    }
  }

  return {
    primaryReport: primary,
    issues: mergeIssues(allIssues),
    pages,
    linkGraph,
    score: primary.healthScore?.overall || 0,
    pagesAudited,
    pagesDiscovered: pagesToAudit.length,
    discovery: { source, sitemapUrl },
    framework,
    pageFailure,
    checksRun,
    auditMs,
  };
}
