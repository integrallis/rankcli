import axios from 'axios';
import type { AuditIssue, PageData } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

const USER_AGENT = 'SEO-Autopilot/1.0 (+https://seo-autopilot.dev)';

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
}

export async function checkRobotsTxt(baseUrl: string): Promise<{ issues: AuditIssue[]; data: RobotsTxtResult }> {
  const issues: AuditIssue[] = [];
  const url = new URL('/robots.txt', baseUrl).href;

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
      validateStatus: () => true,
    });

    if (response.status === 404) {
      issues.push({
        ...ISSUE_DEFINITIONS.ROBOTS_TXT_MISSING,
        affectedUrls: [url],
      });
      return {
        issues,
        data: { exists: false, blocksAll: false, hasSitemap: false, sitemapUrls: [] }
      };
    }

    const content = response.data as string;
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
  const sitemapUrls = robotsData.sitemapUrls.length > 0
    ? robotsData.sitemapUrls
    : [
        new URL('/sitemap.xml', baseUrl).href,
        new URL('/sitemap_index.xml', baseUrl).href,
      ];

  for (const sitemapUrl of sitemapUrls) {
    try {
      const response = await axios.get(sitemapUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000,
        validateStatus: () => true,
      });

      if (response.status === 200 && (response.data as string).includes('<urlset') || (response.data as string).includes('<sitemapindex')) {
        // Count URLs in sitemap
        const content = response.data as string;
        const urlMatches = content.match(/<loc>/g);
        const urlCount = urlMatches ? urlMatches.length : 0;

        // Check if sitemap is referenced in robots.txt
        if (!robotsData.hasSitemap) {
          issues.push({
            ...ISSUE_DEFINITIONS.SITEMAP_NOT_IN_ROBOTS,
            affectedUrls: [sitemapUrl],
          });
        }

        return {
          issues,
          data: { exists: true, url: sitemapUrl, urlCount, errors: [] }
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
      const response = await axios.get(currentUrl, {
        headers: { 'User-Agent': USER_AGENT },
        timeout: 10000,
        maxRedirects: 0,
        validateStatus: () => true,
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers['location'];
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
