// Topical Cluster Analysis - Internal Linking for Topic Authority
// Reference: "4 Steps to Rank #1 in Google (2026 SEO Plan)" by Nathan Gotch
// "Create many supporting assets to train the algorithm to believe we're experts"
// "Cross-link these informational assets together to form a strong cluster"
// "Internally link back out to your commercial page from all these informational assets"

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface InternalLink {
  href: string;
  anchorText: string;
  context: 'navigation' | 'content' | 'footer' | 'sidebar';
  isDoFollow: boolean;
  destination: 'internal' | 'external' | 'anchor';
}

export interface TopicalClusterData {
  currentUrl: string;
  internalLinks: InternalLink[];
  externalLinks: InternalLink[];
  anchorLinks: InternalLink[];
  linkMetrics: {
    totalLinks: number;
    internalLinkCount: number;
    externalLinkCount: number;
    contentLinks: number; // Links within main content (not nav/footer)
    uniqueInternalDestinations: number;
    avgAnchorTextLength: number;
    hasExactMatchAnchors: boolean;
  };
  clusterSignals: {
    hasHubStructure: boolean; // Links to many related pages
    hasSpokeLinks: boolean; // Content links back to main topics
    hasBreadcrumbs: boolean;
    hasRelatedPosts: boolean;
    hasCategoryLinks: boolean;
    internalToExternalRatio: number;
  };
  orphanPageRisk: 'low' | 'medium' | 'high';
  recommendations: string[];
}

/**
 * Determine link context (nav, content, footer, sidebar)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getLinkContext($: cheerio.CheerioAPI, link: cheerio.Cheerio<any>): InternalLink['context'] {
  const parents = link.parents().toArray();

  for (const parent of parents) {
    const tagName = parent.tagName?.toLowerCase();
    const className = ($(parent).attr('class') || '').toLowerCase();
    const id = ($(parent).attr('id') || '').toLowerCase();

    // Navigation detection
    if (tagName === 'nav' ||
        className.includes('nav') ||
        className.includes('menu') ||
        id.includes('nav') ||
        id.includes('menu')) {
      return 'navigation';
    }

    // Footer detection
    if (tagName === 'footer' ||
        className.includes('footer') ||
        id.includes('footer')) {
      return 'footer';
    }

    // Sidebar detection
    if (tagName === 'aside' ||
        className.includes('sidebar') ||
        className.includes('widget') ||
        id.includes('sidebar')) {
      return 'sidebar';
    }

    // Main content detection
    if (tagName === 'main' ||
        tagName === 'article' ||
        className.includes('content') ||
        className.includes('post') ||
        className.includes('entry') ||
        id.includes('content')) {
      return 'content';
    }
  }

  return 'content'; // Default to content
}

/**
 * Determine if link is internal, external, or anchor
 */
function getLinkDestination(href: string, baseUrl: string): InternalLink['destination'] {
  if (!href || href.startsWith('#')) {
    return 'anchor';
  }

  try {
    const linkUrl = new URL(href, baseUrl);
    const currentUrl = new URL(baseUrl);

    if (linkUrl.hostname === currentUrl.hostname) {
      return 'internal';
    }
    return 'external';
  } catch {
    // Relative URL - internal
    if (href.startsWith('/') || href.startsWith('./') || href.startsWith('../')) {
      return 'internal';
    }
    return 'external';
  }
}

/**
 * Check if link is dofollow (no rel="nofollow")
 */
function isDoFollow(rel: string | undefined): boolean {
  if (!rel) return true;
  const relValues = rel.toLowerCase().split(/\s+/);
  return !relValues.includes('nofollow') && !relValues.includes('sponsored') && !relValues.includes('ugc');
}

/**
 * Extract all links from the page
 */
export function extractLinks(html: string, url: string): {
  internalLinks: InternalLink[];
  externalLinks: InternalLink[];
  anchorLinks: InternalLink[];
} {
  const $ = cheerio.load(html);
  const internalLinks: InternalLink[] = [];
  const externalLinks: InternalLink[] = [];
  const anchorLinks: InternalLink[] = [];

  $('a[href]').each((_, element) => {
    const $link = $(element);
    const href = $link.attr('href') || '';
    const anchorText = $link.text().trim();
    const rel = $link.attr('rel');

    const destination = getLinkDestination(href, url);
    const context = getLinkContext($, $link);
    const doFollow = isDoFollow(rel);

    const link: InternalLink = {
      href: href,
      anchorText: anchorText,
      context,
      isDoFollow: doFollow,
      destination,
    };

    if (destination === 'internal') {
      internalLinks.push(link);
    } else if (destination === 'external') {
      externalLinks.push(link);
    } else {
      anchorLinks.push(link);
    }
  });

  return { internalLinks, externalLinks, anchorLinks };
}

/**
 * Detect cluster-related patterns
 */
export function detectClusterSignals($: cheerio.CheerioAPI): TopicalClusterData['clusterSignals'] {
  // Breadcrumbs detection
  const hasBreadcrumbs = $(
    '[class*="breadcrumb"], [id*="breadcrumb"], nav[aria-label*="breadcrumb"], ' +
    '[itemtype*="BreadcrumbList"], .breadcrumbs'
  ).length > 0;

  // Related posts section
  const hasRelatedPosts = $(
    '[class*="related"], [class*="similar"], [class*="recommended"], ' +
    '[id*="related"], h2:contains("Related"), h3:contains("Related"), ' +
    'h2:contains("You might also"), h2:contains("Similar")'
  ).length > 0;

  // Category/tag links
  const hasCategoryLinks = $(
    '[class*="categor"], [class*="tag-"], [rel="tag"], ' +
    'a[href*="/category/"], a[href*="/tag/"], a[href*="/topic/"]'
  ).length > 0;

  return {
    hasHubStructure: false, // Calculated later
    hasSpokeLinks: false, // Calculated later
    hasBreadcrumbs,
    hasRelatedPosts,
    hasCategoryLinks,
    internalToExternalRatio: 0, // Calculated later
  };
}

/**
 * Calculate orphan page risk based on internal linking
 */
function calculateOrphanRisk(
  contentLinks: number,
  uniqueDestinations: number,
  clusterSignals: TopicalClusterData['clusterSignals']
): TopicalClusterData['orphanPageRisk'] {
  let score = 0;

  // Content links to other pages
  if (contentLinks >= 5) score += 3;
  else if (contentLinks >= 2) score += 2;
  else if (contentLinks >= 1) score += 1;

  // Unique destinations (not just linking to homepage)
  if (uniqueDestinations >= 5) score += 2;
  else if (uniqueDestinations >= 2) score += 1;

  // Cluster signals
  if (clusterSignals.hasBreadcrumbs) score += 1;
  if (clusterSignals.hasRelatedPosts) score += 2;
  if (clusterSignals.hasCategoryLinks) score += 1;

  if (score >= 6) return 'low';
  if (score >= 3) return 'medium';
  return 'high';
}

/**
 * Main function: Analyze topical cluster structure
 */
export function analyzeTopicalClusters(
  html: string,
  url: string
): { issues: AuditIssue[]; data: TopicalClusterData } {
  const $ = cheerio.load(html);
  const issues: AuditIssue[] = [];

  // Extract all links
  const { internalLinks, externalLinks, anchorLinks } = extractLinks(html, url);

  // Content-only links (not in nav/footer)
  const contentInternalLinks = internalLinks.filter(l => l.context === 'content');
  const contentExternalLinks = externalLinks.filter(l => l.context === 'content');

  // Calculate unique internal destinations
  const uniqueInternalHrefs = new Set(
    internalLinks.map(l => {
      try {
        return new URL(l.href, url).pathname;
      } catch {
        return l.href;
      }
    })
  );

  // Calculate average anchor text length
  const anchorTexts = internalLinks.filter(l => l.anchorText.length > 0);
  const avgAnchorTextLength = anchorTexts.length > 0
    ? anchorTexts.reduce((sum, l) => sum + l.anchorText.length, 0) / anchorTexts.length
    : 0;

  // Check for exact match anchor text patterns (over-optimization)
  const hasExactMatchAnchors = internalLinks.some(l => {
    const text = l.anchorText.toLowerCase();
    return text.split(' ').length >= 3 && l.context === 'content';
  });

  // Detect cluster signals
  const clusterSignals = detectClusterSignals($);

  // Calculate internal to external ratio
  const totalContentLinks = contentInternalLinks.length + contentExternalLinks.length;
  clusterSignals.internalToExternalRatio = totalContentLinks > 0
    ? contentInternalLinks.length / totalContentLinks
    : 1;

  // Hub structure: many internal links from content
  clusterSignals.hasHubStructure = contentInternalLinks.length >= 5;

  // Spoke links: has related posts or category links
  clusterSignals.hasSpokeLinks = clusterSignals.hasRelatedPosts || clusterSignals.hasCategoryLinks;

  // Calculate orphan risk
  const orphanPageRisk = calculateOrphanRisk(
    contentInternalLinks.length,
    uniqueInternalHrefs.size,
    clusterSignals
  );

  // Generate recommendations
  const recommendations: string[] = [];

  if (contentInternalLinks.length < 3) {
    recommendations.push('Add more contextual internal links within your content');
  }

  if (!clusterSignals.hasBreadcrumbs) {
    recommendations.push('Add breadcrumb navigation for better site structure');
  }

  if (!clusterSignals.hasRelatedPosts) {
    recommendations.push('Add a "Related Posts" or "Similar Articles" section');
  }

  if (!clusterSignals.hasCategoryLinks) {
    recommendations.push('Link to category or topic pages to strengthen clusters');
  }

  if (clusterSignals.internalToExternalRatio < 0.5) {
    recommendations.push('Balance your link profile - add more internal links');
  }

  // Generate issues

  // No internal links in content
  if (contentInternalLinks.length === 0) {
    issues.push({
      code: 'NO_CONTENT_INTERNAL_LINKS',
      severity: 'warning',
      category: 'on-page',
      title: 'No internal links in page content',
      description: 'The main content area has no links to other pages on your site.',
      impact: 'Internal links help search engines discover pages and understand site structure. They also pass PageRank.',
      howToFix: 'Add 3-5 contextual internal links within your content to related pages.',
      affectedUrls: [url],
    });
  } else if (contentInternalLinks.length < 3) {
    issues.push({
      code: 'FEW_CONTENT_INTERNAL_LINKS',
      severity: 'notice',
      category: 'on-page',
      title: 'Few internal links in content',
      description: `Only ${contentInternalLinks.length} internal link(s) in the main content area.`,
      impact: 'More contextual internal links strengthen topical clusters and help users discover content.',
      howToFix: 'Add relevant internal links where they naturally fit in your content.',
      affectedUrls: [url],
      details: {
        currentCount: contentInternalLinks.length,
        recommended: '3-5 minimum',
      },
    });
  }

  // No breadcrumbs
  if (!clusterSignals.hasBreadcrumbs) {
    issues.push({
      code: 'NO_BREADCRUMBS',
      severity: 'notice',
      category: 'on-page',
      title: 'No breadcrumb navigation detected',
      description: 'Page lacks breadcrumb navigation for hierarchical context.',
      impact: 'Breadcrumbs improve UX, help search engines understand site structure, and can appear in SERPs.',
      howToFix: 'Add breadcrumb navigation with Schema.org BreadcrumbList markup.',
      affectedUrls: [url],
    });
  }

  // No related content section
  if (!clusterSignals.hasRelatedPosts && !clusterSignals.hasCategoryLinks) {
    issues.push({
      code: 'NO_RELATED_CONTENT',
      severity: 'notice',
      category: 'on-page',
      title: 'No related content section',
      description: 'Page has no "Related Posts" or similar content discovery section.',
      impact: 'Related content sections reduce bounce rate, increase pageviews, and strengthen topic clusters.',
      howToFix: 'Add a section linking to related articles, products, or category pages.',
      affectedUrls: [url],
    });
  }

  // High orphan page risk
  if (orphanPageRisk === 'high') {
    issues.push({
      code: 'HIGH_ORPHAN_RISK',
      severity: 'warning',
      category: 'on-page',
      title: 'Page may be an orphan page',
      description: 'This page has very few internal links, making it hard to discover.',
      impact: 'Orphan pages are difficult for search engines to find and may not get indexed.',
      howToFix: 'Ensure this page is linked from navigation, category pages, or related content.',
      affectedUrls: [url],
      details: {
        contentLinks: contentInternalLinks.length,
        uniqueDestinations: uniqueInternalHrefs.size,
      },
    });
  }

  // Too many external links relative to internal
  if (contentExternalLinks.length > contentInternalLinks.length * 2 && contentExternalLinks.length >= 5) {
    issues.push({
      code: 'EXTERNAL_LINK_HEAVY',
      severity: 'notice',
      category: 'on-page',
      title: 'More external links than internal links',
      description: `${contentExternalLinks.length} external links vs ${contentInternalLinks.length} internal links in content.`,
      impact: 'While citing sources is good, heavy external linking may dilute PageRank passed to your own pages.',
      howToFix: 'Balance external citations with internal links to your own related content.',
      affectedUrls: [url],
      details: {
        externalLinks: contentExternalLinks.length,
        internalLinks: contentInternalLinks.length,
        ratio: clusterSignals.internalToExternalRatio.toFixed(2),
      },
    });
  }

  return {
    issues,
    data: {
      currentUrl: url,
      internalLinks,
      externalLinks,
      anchorLinks,
      linkMetrics: {
        totalLinks: internalLinks.length + externalLinks.length + anchorLinks.length,
        internalLinkCount: internalLinks.length,
        externalLinkCount: externalLinks.length,
        contentLinks: contentInternalLinks.length,
        uniqueInternalDestinations: uniqueInternalHrefs.size,
        avgAnchorTextLength: Math.round(avgAnchorTextLength),
        hasExactMatchAnchors,
      },
      clusterSignals,
      orphanPageRisk,
      recommendations,
    },
  };
}
