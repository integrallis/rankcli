/**
 * Site Crawler for Keyword Research
 *
 * Crawls an entire site to collect text content for AI analysis.
 * Used to understand what the site does and generate relevant keywords.
 */

import * as cheerio from 'cheerio';
import { httpGet } from '../utils/http.js';

export interface CrawledPage {
  url: string;
  title: string;
  description: string;
  h1: string;
  h2s: string[];
  mainContent: string;
  wordCount: number;
  internalLinks: string[];
  isProductPage: boolean;
  isPricingPage: boolean;
  isBlogPost: boolean;
  isFeaturePage: boolean;
}

export interface SiteCrawlResult {
  domain: string;
  pages: CrawledPage[];
  aggregatedContent: string;
  totalWordCount: number;
  uniqueHeadings: string[];
  detectedPageTypes: {
    product: number;
    pricing: number;
    blog: number;
    feature: number;
    other: number;
  };
  crawlStats: {
    attempted: number;
    succeeded: number;
    failed: number;
    duration: number;
  };
}

const EXCLUDED_PATHS = [
  '/cdn-cgi/',
  '/wp-admin/',
  '/wp-includes/',
  '/wp-json/',
  '/api/',
  '/admin/',
  '/_next/',
  '/static/',
  '/assets/',
  '.xml',
  '.json',
  '.pdf',
  '.zip',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.svg',
  '.ico',
  '.css',
  '.js',
];

const PAGE_TYPE_PATTERNS = {
  product: ['/product', '/features', '/solutions', '/platform', '/tour'],
  pricing: ['/pricing', '/plans', '/subscription'],
  blog: ['/blog', '/news', '/articles', '/posts', '/journal'],
  feature: ['/feature', '/capability', '/integration'],
};

/**
 * Crawl an entire site to collect text content
 */
export async function crawlSite(
  startUrl: string,
  options: {
    maxPages?: number;
    maxDepth?: number;
    timeout?: number;
  } = {}
): Promise<SiteCrawlResult> {
  const { maxPages = 30, maxDepth = 3, timeout = 10000 } = options;

  const startTime = Date.now();
  const parsedUrl = new URL(startUrl);
  const domain = parsedUrl.hostname;
  const baseUrl = `${parsedUrl.protocol}//${domain}`;

  const visited = new Set<string>();
  const toVisit: Array<{ url: string; depth: number }> = [{ url: startUrl, depth: 0 }];
  const pages: CrawledPage[] = [];
  let failed = 0;

  console.log(`🕷️  Crawling ${domain} (max ${maxPages} pages)...`);

  while (toVisit.length > 0 && pages.length < maxPages) {
    const { url, depth } = toVisit.shift()!;

    // Normalize URL
    const normalizedUrl = normalizeUrl(url, baseUrl);
    if (!normalizedUrl || visited.has(normalizedUrl)) continue;

    // Skip excluded paths
    if (EXCLUDED_PATHS.some((p) => normalizedUrl.includes(p))) continue;

    // Only crawl same domain
    try {
      const urlObj = new URL(normalizedUrl);
      if (urlObj.hostname !== domain) continue;
    } catch {
      continue;
    }

    visited.add(normalizedUrl);

    try {
      const page = await crawlPage(normalizedUrl, timeout);
      pages.push(page);

      // Add internal links to queue (if not at max depth)
      if (depth < maxDepth) {
        for (const link of page.internalLinks) {
          const normalizedLink = normalizeUrl(link, baseUrl);
          if (normalizedLink && !visited.has(normalizedLink)) {
            toVisit.push({ url: normalizedLink, depth: depth + 1 });
          }
        }
      }

      // Progress indicator
      if (pages.length % 5 === 0) {
        console.log(`   Crawled ${pages.length} pages...`);
      }
    } catch (error) {
      failed++;
    }
  }

  const duration = Date.now() - startTime;

  // Aggregate content
  const aggregatedContent = pages
    .map((p) => `# ${p.title}\n${p.description}\n${p.mainContent}`)
    .join('\n\n---\n\n');

  const totalWordCount = pages.reduce((sum, p) => sum + p.wordCount, 0);

  // Collect unique headings
  const allHeadings = new Set<string>();
  pages.forEach((p) => {
    if (p.h1) allHeadings.add(p.h1);
    p.h2s.forEach((h2) => allHeadings.add(h2));
  });

  // Count page types
  const detectedPageTypes = {
    product: pages.filter((p) => p.isProductPage).length,
    pricing: pages.filter((p) => p.isPricingPage).length,
    blog: pages.filter((p) => p.isBlogPost).length,
    feature: pages.filter((p) => p.isFeaturePage).length,
    other: pages.filter(
      (p) => !p.isProductPage && !p.isPricingPage && !p.isBlogPost && !p.isFeaturePage
    ).length,
  };

  console.log(`✅ Crawled ${pages.length} pages in ${(duration / 1000).toFixed(1)}s`);

  return {
    domain,
    pages,
    aggregatedContent,
    totalWordCount,
    uniqueHeadings: Array.from(allHeadings),
    detectedPageTypes,
    crawlStats: {
      attempted: visited.size,
      succeeded: pages.length,
      failed,
      duration,
    },
  };
}

/**
 * Crawl a single page
 */
async function crawlPage(url: string, timeout: number): Promise<CrawledPage> {
  const response = await httpGet<string>(url, {
    timeout,
    validateStatus: (status) => status === 200,
  });

  const html = response.data;
  const $ = cheerio.load(html);

  // Remove non-content elements
  $('script, style, noscript, iframe, nav, footer, header, aside, [role="navigation"]').remove();

  // Extract content
  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content')?.trim() || '';
  const h1 = $('h1').first().text().trim();
  const h2s = $('h2')
    .map((_, el) => $(el).text().trim())
    .get()
    .filter((h) => h.length > 0);

  // Get main content
  const mainSelectors = ['main', 'article', '[role="main"]', '.content', '#content', '.post-content'];
  let mainContent = '';

  for (const selector of mainSelectors) {
    const el = $(selector);
    if (el.length > 0) {
      mainContent = el.text().trim();
      break;
    }
  }

  // Fallback to body
  if (!mainContent) {
    mainContent = $('body').text().trim();
  }

  // Clean up whitespace
  mainContent = mainContent
    .replace(/\s+/g, ' ')
    .replace(/\n+/g, '\n')
    .trim();

  // Limit content length for AI processing
  if (mainContent.length > 5000) {
    mainContent = mainContent.substring(0, 5000) + '...';
  }

  const wordCount = mainContent.split(/\s+/).length;

  // Extract internal links
  const internalLinks: string[] = [];
  $('a[href]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && !href.startsWith('mailto:') && !href.startsWith('tel:') && !href.startsWith('#')) {
      internalLinks.push(href);
    }
  });

  // Detect page type
  const urlLower = url.toLowerCase();
  const isProductPage = PAGE_TYPE_PATTERNS.product.some((p) => urlLower.includes(p));
  const isPricingPage = PAGE_TYPE_PATTERNS.pricing.some((p) => urlLower.includes(p));
  const isBlogPost = PAGE_TYPE_PATTERNS.blog.some((p) => urlLower.includes(p));
  const isFeaturePage = PAGE_TYPE_PATTERNS.feature.some((p) => urlLower.includes(p));

  return {
    url,
    title,
    description,
    h1,
    h2s,
    mainContent,
    wordCount,
    internalLinks,
    isProductPage,
    isPricingPage,
    isBlogPost,
    isFeaturePage,
  };
}

/**
 * Normalize a URL
 */
function normalizeUrl(url: string, baseUrl: string): string | null {
  try {
    // Handle relative URLs
    const absoluteUrl = url.startsWith('http') ? url : new URL(url, baseUrl).href;

    // Remove hash and trailing slash
    const urlObj = new URL(absoluteUrl);
    urlObj.hash = '';
    let normalized = urlObj.href;

    // Remove trailing slash (except for root)
    if (normalized.endsWith('/') && normalized !== `${urlObj.origin}/`) {
      normalized = normalized.slice(0, -1);
    }

    return normalized;
  } catch {
    return null;
  }
}

/**
 * Extract key phrases from crawled content
 */
export function extractKeyPhrases(crawlResult: SiteCrawlResult): string[] {
  const phrases = new Set<string>();

  // From titles
  crawlResult.pages.forEach((page) => {
    if (page.title) {
      // Split on common separators
      const parts = page.title.split(/[|\-–—:]/).map((p) => p.trim());
      parts.forEach((part) => {
        if (part.length > 3 && part.length < 50) {
          phrases.add(part.toLowerCase());
        }
      });
    }
  });

  // From headings
  crawlResult.uniqueHeadings.forEach((heading) => {
    if (heading.length > 3 && heading.length < 50) {
      phrases.add(heading.toLowerCase());
    }
  });

  // From descriptions
  crawlResult.pages.forEach((page) => {
    if (page.description) {
      // Extract noun phrases (simplified - just multi-word sequences)
      const words = page.description.toLowerCase().split(/\s+/);
      for (let i = 0; i < words.length - 1; i++) {
        const bigram = `${words[i]} ${words[i + 1]}`;
        if (bigram.length > 5 && bigram.length < 40) {
          phrases.add(bigram);
        }
      }
    }
  });

  return Array.from(phrases).slice(0, 100);
}
