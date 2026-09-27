import { httpGet, looksLikeHtmlFallback } from '../../utils/http.js';
import type { AuditIssue, PageData } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface RobotsTxtResult {
  exists: boolean;
  content?: string;
  blocksAll: boolean;
  hasSitemap: boolean;
  sitemapUrls: string[];
}

export interface SitemapResult {
  exists: boolean;
  url?: string;
  urlCount: number;
  errors: string[];
  lastmodCount?: number;
  invalidLastmodCount?: number;
}

// Sitemap protocol requires W3C Datetime (a subset of ISO 8601): full date,
// or full date plus time with a timezone. Reject anything else outright
// rather than relying on Date's lenient/inconsistent free-form parsing.
const LASTMOD_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2}))?$/;

export function validateLastmodValues(content: string): { count: number; invalidCount: number } {
  const matches = content.match(/<lastmod>([^<]*)<\/lastmod>/g) || [];
  let invalidCount = 0;
  const now = Date.now();

  for (const match of matches) {
    const value = match.replace(/<\/?lastmod>/g, '').trim();
    const parsed = LASTMOD_PATTERN.test(value) ? new Date(value) : null;
    if (!parsed || isNaN(parsed.getTime()) || parsed.getTime() > now) {
      invalidCount++;
    }
  }

  return { count: matches.length, invalidCount };
}

export async function checkRobotsTxt(baseUrl: string): Promise<{ issues: AuditIssue[]; data: RobotsTxtResult }> {
  const issues: AuditIssue[] = [];
  const url = new URL('/robots.txt', baseUrl).href;

  try {
    const response = await httpGet<string>(url, {
      timeout: 10000,
      validateStatus: () => true,
    });

    // Google's documented handling: 5xx and 429 mean "treat the whole site
    // as disallowed" until robots.txt answers properly; any other 4xx means
    // "there is no robots.txt" (crawl everything). Either way the body is an
    // error page, not robots rules, so it must not be parsed as one.
    if (response.status >= 500 || response.status === 429) {
      issues.push({
        ...ISSUE_DEFINITIONS.ROBOTS_TXT_SERVER_ERROR,
        affectedUrls: [url],
        details: { status: response.status },
      });
      return {
        issues,
        data: { exists: false, blocksAll: false, hasSitemap: false, sitemapUrls: [] }
      };
    }

    if (response.status >= 400) {
      issues.push({
        ...ISSUE_DEFINITIONS.ROBOTS_TXT_MISSING,
        affectedUrls: [url],
        ...(response.status !== 404 && { details: { status: response.status } }),
      });
      return {
        issues,
        data: { exists: false, blocksAll: false, hasSitemap: false, sitemapUrls: [] }
      };
    }

    const content = response.data as string;

    // Same SPA catch-all problem as llms.txt: HTML served at /robots.txt is not a robots.txt.
    // Parsed as one it yields no directives and no sitemap line, so the site looked like it
    // had a permissive robots.txt with nothing to say, instead of none at all.
    if (looksLikeHtmlFallback(content, response.headers?.['content-type'])) {
      issues.push({
        ...ISSUE_DEFINITIONS.ROBOTS_TXT_MISSING,
        affectedUrls: [url],
        details: { servedHtml: true },
      });
      return {
        issues,
        data: { exists: false, blocksAll: false, hasSitemap: false, sitemapUrls: [] },
      };
    }

    const lines = content.toLowerCase().split('\n');

    // Check if robots.txt blocks all crawlers
    let blocksAll = false;
    let currentUserAgent = '';
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('user-agent:')) {
        currentUserAgent = trimmed.split(':')[1].trim();
      }
      if (trimmed === 'disallow: /' && currentUserAgent === '*') {
        blocksAll = true;
      }
    }

    if (blocksAll) {
      issues.push({
        ...ISSUE_DEFINITIONS.ROBOTS_TXT_BLOCKS_ALL,
        affectedUrls: [url],
      });
    }

    // Check for sitemap references
    const sitemapUrls: string[] = [];
    for (const line of content.split('\n')) {
      const trimmed = line.trim().toLowerCase();
      if (trimmed.startsWith('sitemap:')) {
        const sitemapUrl = line.trim().substring(8).trim();
        sitemapUrls.push(sitemapUrl);
      }
    }

    return {
      issues,
      data: {
        exists: true,
        content,
        blocksAll,
        hasSitemap: sitemapUrls.length > 0,
        sitemapUrls,
      }
    };
  } catch (error) {
    issues.push({
      ...ISSUE_DEFINITIONS.ROBOTS_TXT_MISSING,
      affectedUrls: [url],
      details: { error: error instanceof Error ? error.message : 'Unknown error' },
    });
    return {
      issues,
      data: { exists: false, blocksAll: false, hasSitemap: false, sitemapUrls: [] }
    };
  }
}

export async function checkSitemap(baseUrl: string, robotsData: RobotsTxtResult): Promise<{ issues: AuditIssue[]; data: SitemapResult }> {
  const issues: AuditIssue[] = [];

  // Try sitemap URLs from robots.txt first, then standard locations
  // At most 3 candidates: large sites list dozens in robots.txt, 10s each.
  const sitemapUrls = robotsData.sitemapUrls.length > 0
    ? robotsData.sitemapUrls.slice(0, 3)
    : [
        new URL('/sitemap.xml', baseUrl).href,
        new URL('/sitemap_index.xml', baseUrl).href,
      ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await httpGet<string>(sitemapUrl, {
        timeout: 10000,
        validateStatus: () => true,
      });

      const content = response.data as string;
      if (response.status === 200 && (content.includes('<urlset') || content.includes('<sitemapindex'))) {
        // Count URLs in sitemap
        const urlMatches = content.match(/<loc>/g);
        const urlCount = urlMatches ? urlMatches.length : 0;

        // Check if sitemap is referenced in robots.txt
        if (!robotsData.hasSitemap) {
          issues.push({
            ...ISSUE_DEFINITIONS.SITEMAP_NOT_IN_ROBOTS,
            affectedUrls: [sitemapUrl],
          });
        }

        const { count: lastmodCount, invalidCount: invalidLastmodCount } = validateLastmodValues(content);

        if (lastmodCount === 0) {
          issues.push({
            ...ISSUE_DEFINITIONS.SITEMAP_LASTMOD_MISSING,
            affectedUrls: [sitemapUrl],
          });
        } else if (invalidLastmodCount > 0) {
          issues.push({
            ...ISSUE_DEFINITIONS.SITEMAP_LASTMOD_INVALID,
            affectedUrls: [sitemapUrl],
            details: { invalidCount: invalidLastmodCount, totalCount: lastmodCount },
          });
        }

        return {
          issues,
          data: { exists: true, url: sitemapUrl, urlCount, errors: [], lastmodCount, invalidLastmodCount }
        };
      }
    } catch {
      // Try next URL
    }
  }

  // No sitemap found
  issues.push({
    ...ISSUE_DEFINITIONS.SITEMAP_MISSING,
    affectedUrls: [new URL('/sitemap.xml', baseUrl).href],
  });

  return {
    issues,
    data: { exists: false, urlCount: 0, errors: ['No sitemap found'] }
  };
}

export async function checkRedirects(url: string): Promise<{ issues: AuditIssue[]; chain: string[]; finalUrl: string }> {
  const issues: AuditIssue[] = [];
  const chain: string[] = [url];
  let currentUrl = url;
  let maxRedirects = 10;

  while (maxRedirects > 0) {
    try {
      const response = await httpGet<string>(currentUrl, {
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.location;
        if (!location) break;

        const nextUrl = new URL(location, currentUrl).href;

        // Check for redirect loop
        if (chain.includes(nextUrl)) {
          issues.push({
            ...ISSUE_DEFINITIONS.REDIRECT_LOOP,
            affectedUrls: chain,
            details: { chain, loopTo: nextUrl },
          });
          break;
        }

        chain.push(nextUrl);
        currentUrl = nextUrl;
        maxRedirects--;
      } else {
        break;
      }
    } catch {
      break;
    }
  }

  // Check for redirect chain (more than 1 redirect)
  if (chain.length > 2) {
    issues.push({
      ...ISSUE_DEFINITIONS.REDIRECT_CHAIN,
      affectedUrls: chain,
      details: { chain, hops: chain.length - 1 },
    });
  }

  return { issues, chain, finalUrl: currentUrl };
}

export async function runCrawlabilityChecks(baseUrl: string): Promise<AuditIssue[]> {
  const allIssues: AuditIssue[] = [];

  // Check robots.txt
  const robotsResult = await checkRobotsTxt(baseUrl);
  allIssues.push(...robotsResult.issues);

  // Check sitemap
  const sitemapResult = await checkSitemap(baseUrl, robotsResult.data);
  allIssues.push(...sitemapResult.issues);

  // Check for redirects on the main URL
  const redirectResult = await checkRedirects(baseUrl);
  allIssues.push(...redirectResult.issues);

  return allIssues;
}
