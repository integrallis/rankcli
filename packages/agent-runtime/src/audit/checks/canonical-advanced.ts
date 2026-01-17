import * as cheerio from 'cheerio';
import axios from 'axios';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface CanonicalData {
  canonical?: string;
  isSelfReferencing: boolean;
  isCrossDomain: boolean;
  canonicalChain?: string[];
  finalCanonical?: string;
}

export async function analyzeCanonicalAdvanced(
  html: string,
  url: string,
  options: { checkChain?: boolean; sitemapUrls?: string[] } = {}
): Promise<{ issues: AuditIssue[]; data: CanonicalData }> {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  const canonicalLink = $('link[rel="canonical"]').attr('href');
  const baseUrl = new URL(url);

  const data: CanonicalData = {
    canonical: canonicalLink,
    isSelfReferencing: false,
    isCrossDomain: false,
  };

  if (!canonicalLink) {
    return { issues, data };
  }

  // Resolve canonical URL
  let canonicalUrl: URL;
  try {
    canonicalUrl = new URL(canonicalLink, url);
  } catch {
    return { issues, data };
  }

  // Check if self-referencing
  const normalizedUrl = normalizeUrl(url);
  const normalizedCanonical = normalizeUrl(canonicalUrl.href);
  data.isSelfReferencing = normalizedUrl === normalizedCanonical;

  // Check for cross-domain canonical
  if (canonicalUrl.hostname !== baseUrl.hostname) {
    data.isCrossDomain = true;
    issues.push({
      ...ISSUE_DEFINITIONS.CANONICAL_CROSS_DOMAIN,
      affectedUrls: [url],
      details: {
        canonical: canonicalUrl.href,
        sourceDomain: baseUrl.hostname,
        targetDomain: canonicalUrl.hostname,
      },
    });
  }

  // Check for canonical chain if enabled
  if (options.checkChain && !data.isSelfReferencing) {
    const chain = await followCanonicalChain(canonicalUrl.href, [url]);
    if (chain.length > 2) {
      data.canonicalChain = chain;
      data.finalCanonical = chain[chain.length - 1];
      issues.push({
        ...ISSUE_DEFINITIONS.CANONICAL_CHAIN,
        affectedUrls: [url],
        details: {
          chain,
          depth: chain.length,
        },
      });
    }
  }

  // Check if canonical matches sitemap
  if (options.sitemapUrls && options.sitemapUrls.length > 0) {
    const sitemapNormalized = options.sitemapUrls.map(normalizeUrl);
    const urlInSitemap = sitemapNormalized.includes(normalizedUrl);
    const canonicalInSitemap = sitemapNormalized.includes(normalizedCanonical);

    if (urlInSitemap && !canonicalInSitemap && !data.isSelfReferencing) {
      issues.push({
        ...ISSUE_DEFINITIONS.CANONICAL_MISMATCH_SITEMAP,
        affectedUrls: [url],
        details: {
          pageUrl: url,
          canonical: canonicalUrl.href,
          message: 'Page is in sitemap but its canonical URL is not',
        },
      });
    }
  }

  return { issues, data };
}

async function followCanonicalChain(
  url: string,
  chain: string[] = [],
  maxDepth: number = 5
): Promise<string[]> {
  if (chain.length >= maxDepth) return chain;

  try {
    const response = await axios.get(url, {
      timeout: 5000,
      maxRedirects: 5,
      validateStatus: (status) => status < 400,
    });

    const $ = cheerio.load(response.data);
    const nextCanonical = $('link[rel="canonical"]').attr('href');

    if (!nextCanonical) {
      return [...chain, url];
    }

    const resolvedCanonical = new URL(nextCanonical, url).href;
    const normalizedCurrent = normalizeUrl(url);
    const normalizedNext = normalizeUrl(resolvedCanonical);

    // Self-referencing, end of chain
    if (normalizedCurrent === normalizedNext) {
      return [...chain, url];
    }

    // Circular reference detection
    if (chain.some(u => normalizeUrl(u) === normalizedNext)) {
      return [...chain, url, resolvedCanonical + ' (circular)'];
    }

    return followCanonicalChain(resolvedCanonical, [...chain, url], maxDepth);
  } catch {
    return [...chain, url];
  }
}

function normalizeUrl(urlStr: string): string {
  try {
    const parsed = new URL(urlStr);
    // Remove trailing slash, lowercase hostname
    return `${parsed.protocol}//${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, '')}`;
  } catch {
    return urlStr.toLowerCase().replace(/\/$/, '');
  }
}
