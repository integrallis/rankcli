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
  results.forEach((result, i) => {
    if (result.status === 'fulfilled' && result.value) {
      const report = result.value;
      allIssues.push(report.issues);
      if (i === 0) primaryReport = report;
      pagesAudited++;
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

  return {
    primaryReport: primary,
    issues: mergeIssues(allIssues),
    pages,
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
