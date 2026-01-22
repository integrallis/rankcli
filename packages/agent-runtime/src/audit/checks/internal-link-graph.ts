// Internal Link Graph Analysis
// Advanced internal linking analysis: hub/authority detection, link depth, PageRank sculpting
// Based on advanced SEO research

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface InternalLink {
  source: string;
  target: string;
  anchor: string;
  context: 'navigation' | 'content' | 'footer' | 'sidebar';
  isEditorial: boolean;
}

export interface PageLinkStats {
  url: string;
  inboundLinks: number;
  outboundLinks: number;
  hubScore: number; // Pages that link to many others
  authorityScore: number; // Pages that receive many links
  depth: number; // Clicks from homepage
}

export interface InternalLinkGraphData {
  totalInternalLinks: number;
  orphanPages: string[];
  deepPages: string[]; // More than 3 clicks deep
  hubPages: string[];
  authorityPages: string[];
  linkDistribution: { url: string; links: number }[];
  firstLinkAnchors: Map<string, string>;
  contextualLinkRatio: number;
  navigationVsContentRatio: number;
}

/**
 * Extract internal links from HTML with context analysis
 */
export function extractInternalLinks(html: string, pageUrl: string): InternalLink[] {
  const $ = cheerio.load(html);
  const links: InternalLink[] = [];
  const baseUrl = new URL(pageUrl);

  $('a[href]').each((_, el) => {
    const $el = $(el);
    const href = $el.attr('href') || '';
    const anchor = $el.text().trim();

    // Skip empty, javascript:, and fragment links
    if (!href || href.startsWith('javascript:') || href.startsWith('#')) {
      return;
    }

    // Resolve relative URLs
    let targetUrl: URL;
    try {
      targetUrl = new URL(href, pageUrl);
    } catch {
      return; // Invalid URL
    }

    // Check if internal link
    if (targetUrl.hostname !== baseUrl.hostname) {
      return; // External link
    }

    // Determine link context
    let context: 'navigation' | 'content' | 'footer' | 'sidebar' = 'content';

    const parents = $el.parents();
    for (let i = 0; i < parents.length; i++) {
      const parent = parents.eq(i);
      const tagName = parent.prop('tagName')?.toLowerCase() || '';
      const className = parent.attr('class')?.toLowerCase() || '';
      const id = parent.attr('id')?.toLowerCase() || '';

      if (
        tagName === 'nav' ||
        className.includes('nav') ||
        className.includes('menu') ||
        id.includes('nav') ||
        id.includes('menu')
      ) {
        context = 'navigation';
        break;
      }
      if (
        tagName === 'footer' ||
        className.includes('footer') ||
        id.includes('footer')
      ) {
        context = 'footer';
        break;
      }
      if (
        tagName === 'aside' ||
        className.includes('sidebar') ||
        className.includes('widget') ||
        id.includes('sidebar')
      ) {
        context = 'sidebar';
        break;
      }
    }

    // Determine if editorial (appears to be within content with surrounding text)
    let isEditorial = context === 'content';
    if (isEditorial) {
      const parent = $el.parent();
      const parentText = parent.text().trim();
      // Editorial links usually have surrounding text beyond just the anchor
      isEditorial = parentText.length > anchor.length + 10;
    }

    links.push({
      source: pageUrl,
      target: targetUrl.href.split('#')[0], // Remove fragment
      anchor,
      context,
      isEditorial,
    });
  });

  return links;
}

/**
 * Analyze link depth from homepage
 */
export function calculateLinkDepth(
  links: InternalLink[],
  homepageUrl: string
): Map<string, number> {
  const depths = new Map<string, number>();
  depths.set(homepageUrl, 0);

  // BFS to calculate depths
  const queue = [homepageUrl];
  const visited = new Set([homepageUrl]);

  while (queue.length > 0) {
    const current = queue.shift()!;
    const currentDepth = depths.get(current) || 0;

    // Find all links from current page
    const outbound = links.filter((l) => l.source === current);

    for (const link of outbound) {
      if (!visited.has(link.target)) {
        visited.add(link.target);
        depths.set(link.target, currentDepth + 1);
        queue.push(link.target);
      }
    }
  }

  return depths;
}

/**
 * Calculate simplified hub/authority scores (similar to HITS algorithm)
 */
export function calculateHubAuthority(
  links: InternalLink[],
  iterations: number = 10
): { hubs: Map<string, number>; authorities: Map<string, number> } {
  // Get all unique URLs
  const urls = new Set<string>();
  for (const link of links) {
    urls.add(link.source);
    urls.add(link.target);
  }

  // Initialize scores
  const hubs = new Map<string, number>();
  const authorities = new Map<string, number>();

  for (const url of urls) {
    hubs.set(url, 1);
    authorities.set(url, 1);
  }

  // Build adjacency lists
  const outbound = new Map<string, string[]>();
  const inbound = new Map<string, string[]>();

  for (const link of links) {
    const out = outbound.get(link.source) || [];
    out.push(link.target);
    outbound.set(link.source, out);

    const inb = inbound.get(link.target) || [];
    inb.push(link.source);
    inbound.set(link.target, inb);
  }

  // Iterative calculation
  for (let i = 0; i < iterations; i++) {
    // Update authority scores (sum of hub scores of pages linking to it)
    const newAuthorities = new Map<string, number>();
    for (const url of urls) {
      const sources = inbound.get(url) || [];
      let score = 0;
      for (const source of sources) {
        score += hubs.get(source) || 0;
      }
      newAuthorities.set(url, score);
    }

    // Update hub scores (sum of authority scores of pages it links to)
    const newHubs = new Map<string, number>();
    for (const url of urls) {
      const targets = outbound.get(url) || [];
      let score = 0;
      for (const target of targets) {
        score += newAuthorities.get(target) || 0;
      }
      newHubs.set(url, score);
    }

    // Normalize
    const maxAuth = Math.max(...newAuthorities.values(), 1);
    const maxHub = Math.max(...newHubs.values(), 1);

    for (const url of urls) {
      authorities.set(url, (newAuthorities.get(url) || 0) / maxAuth);
      hubs.set(url, (newHubs.get(url) || 0) / maxHub);
    }
  }

  return { hubs, authorities };
}

/**
 * Detect orphan pages (no internal links pointing to them)
 */
export function detectOrphanPages(
  links: InternalLink[],
  knownUrls: string[]
): string[] {
  const linkedUrls = new Set(links.map((l) => l.target));
  return knownUrls.filter((url) => !linkedUrls.has(url));
}

/**
 * Analyze first link to each page (first link priority)
 */
export function analyzeFirstLinkPriority(
  links: InternalLink[]
): Map<string, { anchor: string; context: string }> {
  const firstLinks = new Map<string, { anchor: string; context: string }>();

  for (const link of links) {
    if (!firstLinks.has(link.target)) {
      firstLinks.set(link.target, {
        anchor: link.anchor,
        context: link.context,
      });
    }
  }

  return firstLinks;
}

/**
 * Check for link hoarding (pages with few outbound internal links)
 */
export function detectLinkHoarding(
  links: InternalLink[],
  threshold: number = 3
): string[] {
  const outboundCount = new Map<string, number>();

  for (const link of links) {
    outboundCount.set(link.source, (outboundCount.get(link.source) || 0) + 1);
  }

  // Find pages with very few outbound links
  return [...outboundCount.entries()]
    .filter(([_, count]) => count < threshold)
    .map(([url]) => url);
}

/**
 * Analyze PageRank sinks (pages that receive links but don't link out)
 */
export function detectPageRankSinks(links: InternalLink[]): string[] {
  const outboundPages = new Set(links.map((l) => l.source));
  const inboundPages = new Set(links.map((l) => l.target));

  // Sinks: pages that receive links but don't link out
  return [...inboundPages].filter((url) => !outboundPages.has(url));
}

/**
 * Main function: Analyze internal link structure
 */
export function analyzeInternalLinkGraph(
  html: string,
  url: string
): { issues: AuditIssue[]; data: Partial<InternalLinkGraphData> } {
  const issues: AuditIssue[] = [];
  const links = extractInternalLinks(html, url);

  // Count link types
  const navigationLinks = links.filter((l) => l.context === 'navigation').length;
  const contentLinks = links.filter((l) => l.context === 'content').length;
  const footerLinks = links.filter((l) => l.context === 'footer').length;
  const editorialLinks = links.filter((l) => l.isEditorial).length;

  const totalLinks = links.length;
  const contextualLinkRatio = totalLinks > 0 ? contentLinks / totalLinks : 0;
  const navigationVsContentRatio = contentLinks > 0 ? navigationLinks / contentLinks : 0;

  // Check for issues on single page
  if (contentLinks === 0 && totalLinks > 0) {
    issues.push({
      code: 'NO_CONTEXTUAL_INTERNAL_LINKS',
      severity: 'warning',
      category: 'links',
      title: 'No contextual internal links',
      description: 'All internal links are in navigation/footer. No editorial links in content.',
      impact: 'Editorial links in content pass more SEO value than navigational links.',
      howToFix: 'Add relevant internal links within your main content to related pages.',
      affectedUrls: [url],
      details: { navigationLinks, contentLinks, footerLinks },
    });
  }

  if (editorialLinks < 2 && contentLinks > 0) {
    issues.push({
      code: 'LOW_EDITORIAL_LINKS',
      severity: 'notice',
      category: 'links',
      title: 'Few editorial internal links',
      description: `Only ${editorialLinks} editorial (in-content) internal links found.`,
      impact: 'Editorial links with surrounding context provide stronger topical signals.',
      howToFix: 'Add 2-5 relevant internal links within your body content.',
      affectedUrls: [url],
    });
  }

  // Analyze first link anchors
  const firstLinks = analyzeFirstLinkPriority(links);

  // Check for generic anchor texts in first links
  const genericAnchors = ['click here', 'read more', 'learn more', 'here', 'this'];
  for (const [target, linkInfo] of firstLinks) {
    if (genericAnchors.some((g) => linkInfo.anchor.toLowerCase().includes(g))) {
      issues.push({
        code: 'FIRST_LINK_GENERIC_ANCHOR',
        severity: 'notice',
        category: 'links',
        title: 'First link uses generic anchor text',
        description: `First link to ${target} uses generic anchor "${linkInfo.anchor}".`,
        impact: 'Google may prioritize first link anchor for topic signals.',
        howToFix: 'Use descriptive, keyword-relevant anchor text for internal links.',
        affectedUrls: [url],
        details: { target, anchor: linkInfo.anchor },
      });
    }
  }

  // Check for link distribution (too many links)
  if (totalLinks > 100) {
    issues.push({
      code: 'TOO_MANY_INTERNAL_LINKS',
      severity: 'warning',
      category: 'links',
      title: 'Excessive internal links',
      description: `Page has ${totalLinks} internal links, which may dilute PageRank distribution.`,
      impact: 'Too many links reduce the value passed to each linked page.',
      howToFix: 'Reduce internal links to the most important and relevant pages.',
      affectedUrls: [url],
      details: { totalLinks, navigationLinks, contentLinks, footerLinks },
    });
  }

  // Check for no internal links at all
  if (totalLinks === 0) {
    issues.push({
      code: 'NO_INTERNAL_LINKS',
      severity: 'error',
      category: 'links',
      title: 'No internal links found',
      description: 'Page has no internal links to other pages on the site.',
      impact: 'Creates a dead end for users and search engine crawlers.',
      howToFix: 'Add relevant internal links to related content.',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      totalInternalLinks: totalLinks,
      contextualLinkRatio,
      navigationVsContentRatio,
      firstLinkAnchors: new Map(
        [...firstLinks.entries()].map(([k, v]) => [k, v.anchor])
      ),
      linkDistribution: [{ url, links: totalLinks }],
    },
  };
}

/**
 * Multi-page analysis for topic clusters and pillar pages
 */
export function analyzeTopicClusters(
  links: InternalLink[]
): { pillarPages: string[]; clusters: Map<string, string[]> } {
  // Calculate hub/authority scores
  const { hubs, authorities } = calculateHubAuthority(links);

  // Pillar pages have high hub scores (link to many cluster pages)
  const pillarThreshold = 0.7;
  const pillarPages = [...hubs.entries()]
    .filter(([_, score]) => score >= pillarThreshold)
    .map(([url]) => url);

  // Group pages by their primary pillar (page they link to most with highest authority)
  const clusters = new Map<string, string[]>();

  for (const pillar of pillarPages) {
    const clusterPages = links
      .filter((l) => l.target === pillar || l.source === pillar)
      .map((l) => (l.source === pillar ? l.target : l.source))
      .filter((url) => !pillarPages.includes(url));

    clusters.set(pillar, [...new Set(clusterPages)]);
  }

  return { pillarPages, clusters };
}
