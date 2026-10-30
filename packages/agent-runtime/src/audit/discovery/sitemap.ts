/**
 * Sitemap-seeded discovery: the pages a site itself says matter, from the sitemaps named in
 * robots.txt or at the usual paths. A sitemap index is followed into its first few sitemaps.
 * A 200 with HTML at /sitemap.xml (a single-page app's catch-all) is no sitemap.
 */
import { httpGet, looksLikeHtmlFallback } from '../../utils/http.js';
import { parseSitemap, mergePages, type DiscoveredPage } from './link-crawler.js';

export interface SitemapDiscovery {
  pages: DiscoveredPage[];
  /** The first sitemap that answered with XML, if any. */
  sitemapUrl?: string;
  sitemapsRead: number;
}

const MAX_CHILD_SITEMAPS = 5;
const MAX_SITEMAP_BYTES = 2 * 1024 * 1024;

async function fetchText(url: string, timeout: number, maxBytes: number): Promise<string | null> {
  try {
    const response = await httpGet<string>(url, { timeout, validateStatus: () => true, maxBytes });
    if (response.status !== 200) return null;
    const body = typeof response.data === 'string' ? response.data : '';
    if (looksLikeHtmlFallback(body, response.headers['content-type'])) return null;
    return body;
  } catch {
    return null;
  }
}

async function sitemapsFromRobots(base: URL, timeout: number): Promise<string[]> {
  const robots = await fetchText(new URL('/robots.txt', base).href, timeout, 64 * 1024);
  if (!robots) return [];
  const urls: string[] = [];
  for (const line of robots.split('\n')) {
    const m = line.match(/^\s*sitemap:\s*(\S+)/i);
    if (!m) continue;
    try {
      urls.push(new URL(m[1], base).href);
    } catch {
      // not a URL; skip the line
    }
  }
  return urls;
}

function childSitemaps(xml: string): string[] {
  const urls: string[] = [];
  const re = /<loc>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) urls.push(m[1]);
  return urls;
}

const isSitemapXml = (xml: string): boolean => /<urlset|<sitemapindex/i.test(xml);

export async function discoverPagesFromSitemap(
  baseUrl: string,
  maxPages: number,
  options: { timeout?: number } = {},
): Promise<SitemapDiscovery> {
  const result: SitemapDiscovery = { pages: [], sitemapsRead: 0 };
  if (maxPages <= 0) return result;
  const timeout = options.timeout ?? 10000;
  const base = new URL(baseUrl);
  const candidates = [
    ...(await sitemapsFromRobots(base, timeout)),
    new URL('/sitemap.xml', base).href,
    new URL('/sitemap_index.xml', base).href,
    new URL('/sitemap-index.xml', base).href,
  ];
  const seen = new Set<string>();
  let pages: DiscoveredPage[] = [];

  for (const candidate of candidates) {
    if (seen.has(candidate)) continue;
    seen.add(candidate);
    const xml = await fetchText(candidate, timeout, MAX_SITEMAP_BYTES);
    if (!xml || !isSitemapXml(xml)) continue;
    result.sitemapsRead++;
    result.sitemapUrl ??= candidate;

    if (/<sitemapindex/i.test(xml)) {
      for (const child of childSitemaps(xml).slice(0, MAX_CHILD_SITEMAPS)) {
        if (seen.has(child)) continue;
        seen.add(child);
        const childXml = await fetchText(child, timeout, MAX_SITEMAP_BYTES);
        if (!childXml || !isSitemapXml(childXml)) continue;
        result.sitemapsRead++;
        pages = mergePages(pages, parseSitemap(childXml, baseUrl));
        if (pages.length >= maxPages) break;
      }
    } else {
      pages = mergePages(pages, parseSitemap(xml, baseUrl));
    }
    if (pages.length >= maxPages) break;
  }

  const pathOf = (url: string): string => {
    try {
      const u = new URL(url);
      return (u.pathname.replace(/\/+$/, '') || '/') + u.search;
    } catch {
      return url;
    }
  };
  const root = pathOf(baseUrl);
  result.pages = pages.filter(p => pathOf(p.url) !== root).slice(0, maxPages);
  return result;
}
