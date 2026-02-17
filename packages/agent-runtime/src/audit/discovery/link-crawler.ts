/**
 * Link Crawler Module
 *
 * Discovers pages from a website by following internal links from the homepage.
 * Prioritizes important pages like /pricing, /about, /features, etc.
 */

export interface DiscoveredPage {
  url: string;
  source: 'homepage' | 'sitemap' | 'internal-link';
  priority: number; // 1-10, higher = more important
}

// Priority patterns - pages we want to audit first
const HIGH_PRIORITY_PATTERNS = [
  /^\/(pricing|about|features|contact|demo|signup|login|blog)\/?$/i,
  /^\/(products?|services?|solutions?|plans?)\/?$/i,
  /^\/(docs?|documentation|help|support|faq)\/?$/i,
  /^\/(careers?|jobs?|team|company)\/?$/i,
];

const MEDIUM_PRIORITY_PATTERNS = [
  /^\/(privacy|terms|legal|security)\/?$/i,
  /^\/[a-z0-9-]+\/?$/i, // Top-level pages
];

// Patterns to exclude
const EXCLUDE_PATTERNS = [
  /\.(png|jpg|jpeg|gif|svg|webp|ico|pdf|zip|tar|gz)$/i, // Images & archives
  /\.(json|xml|txt|webmanifest|rss|atom)$/i, // Data files (not HTML)
  /^(mailto:|tel:|javascript:|#)/i, // Non-HTTP
  /\/(api|_next|static|assets|cdn)\//i, // Technical paths
  /[?&](utm_|ref=|source=)/i, // Tracking params
];

/**
 * Extract all internal links from HTML content
 */
function extractLinks(html: string, baseUrl: string): string[] {
  const base = new URL(baseUrl);
  const links: Set<string> = new Set();

  // Match all href attributes
  const hrefRegex = /href=["']([^"']+)["']/gi;
  let match;

  while ((match = hrefRegex.exec(html)) !== null) {
    try {
      const href = match[1];

      // Skip excluded patterns
      if (EXCLUDE_PATTERNS.some(pattern => pattern.test(href))) {
        continue;
      }

      // Parse the URL
      let url: URL;
      if (href.startsWith('http://') || href.startsWith('https://')) {
        url = new URL(href);
      } else if (href.startsWith('/')) {
        url = new URL(href, base);
      } else {
        continue; // Skip relative paths that don't start with /
      }

      // Only include same-domain links
      if (url.hostname !== base.hostname) {
        continue;
      }

      // Normalize the URL
      const normalized = normalizeUrl(url);
      if (normalized) {
        links.add(normalized);
      }
    } catch {
      // Invalid URL, skip
    }
  }

  return Array.from(links);
}

/**
 * Normalize a URL for deduplication
 */
function normalizeUrl(url: URL): string | null {
  // Remove hash
  url.hash = '';

  // Remove common tracking parameters
  const paramsToRemove = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'source'];
  for (const param of paramsToRemove) {
    url.searchParams.delete(param);
  }

  // Remove trailing slash for consistency
  let pathname = url.pathname;
  if (pathname.length > 1 && pathname.endsWith('/')) {
    pathname = pathname.slice(0, -1);
  }

  // Skip root (we already have it)
  if (pathname === '' || pathname === '/') {
    return null;
  }

  return `${url.protocol}//${url.hostname}${pathname}${url.search}`;
}

/**
 * Calculate priority score for a URL
 */
function calculatePriority(url: string): number {
  try {
    const pathname = new URL(url).pathname;

    // High priority pages (8-10)
    for (const pattern of HIGH_PRIORITY_PATTERNS) {
      if (pattern.test(pathname)) {
        return 9;
      }
    }

    // Medium priority pages (5-7)
    for (const pattern of MEDIUM_PRIORITY_PATTERNS) {
      if (pattern.test(pathname)) {
        return 6;
      }
    }

    // Lower priority for deep paths (2-4)
    const depth = (pathname.match(/\//g) || []).length;
    if (depth >= 3) {
      return 2;
    }
    if (depth === 2) {
      return 4;
    }

    // Default priority for other pages
    return 5;
  } catch {
    return 1;
  }
}

/**
 * Discover pages from HTML content
 *
 * @param baseUrl - The base URL of the site
 * @param html - The HTML content of the homepage
 * @param maxPages - Maximum number of pages to return
 * @returns Array of discovered pages sorted by priority
 */
export function discoverPagesFromLinks(
  baseUrl: string,
  html: string,
  maxPages: number = 5
): DiscoveredPage[] {
  const links = extractLinks(html, baseUrl);

  // Score and sort links
  const pages: DiscoveredPage[] = links.map(url => ({
    url,
    source: 'internal-link' as const,
    priority: calculatePriority(url),
  }));

  // Sort by priority (descending) and take top N
  pages.sort((a, b) => b.priority - a.priority);

  return pages.slice(0, maxPages);
}

/**
 * Parse sitemap XML to extract URLs
 */
export function parseSitemap(xml: string, baseUrl: string): DiscoveredPage[] {
  const pages: DiscoveredPage[] = [];
  const base = new URL(baseUrl);

  // Simple regex-based XML parsing for <loc> tags
  const locRegex = /<loc>([^<]+)<\/loc>/gi;
  let match;

  while ((match = locRegex.exec(xml)) !== null) {
    try {
      const url = new URL(match[1]);

      // Only include same-domain URLs
      if (url.hostname !== base.hostname) {
        continue;
      }

      // Skip excluded patterns
      if (EXCLUDE_PATTERNS.some(pattern => pattern.test(url.pathname))) {
        continue;
      }

      pages.push({
        url: url.href,
        source: 'sitemap',
        priority: calculatePriority(url.href),
      });
    } catch {
      // Invalid URL, skip
    }
  }

  return pages;
}

/**
 * Merge pages from multiple sources, deduplicating by URL
 */
export function mergePages(
  ...pageSets: DiscoveredPage[][]
): DiscoveredPage[] {
  const seen = new Map<string, DiscoveredPage>();

  for (const pages of pageSets) {
    for (const page of pages) {
      const existing = seen.get(page.url);
      if (!existing || page.priority > existing.priority) {
        seen.set(page.url, page);
      }
    }
  }

  return Array.from(seen.values())
    .sort((a, b) => b.priority - a.priority);
}
