import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface AnchorTextData {
  totalLinks: number;
  internalLinks: number;
  externalLinks: number;
  emptyAnchors: number;
  genericAnchors: number;
  anchorDistribution: Record<string, number>;
  topAnchors: { text: string; count: number }[];
}

// Generic anchor text patterns
const GENERIC_ANCHORS = new Set([
  'click here',
  'click',
  'here',
  'read more',
  'more',
  'learn more',
  'see more',
  'view more',
  'continue',
  'continue reading',
  'link',
  'this',
  'this link',
  'go',
  'details',
  'more details',
  'more info',
  'info',
  'read',
  'view',
  'see',
  'download',
  'get it',
  'get',
]);

export function analyzeAnchorText(
  html: string,
  url: string
): { issues: AuditIssue[]; data: AnchorTextData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  const baseUrl = new URL(url);
  const anchorCounts: Record<string, number> = {};
  let totalLinks = 0;
  let internalLinks = 0;
  let externalLinks = 0;
  let emptyAnchors = 0;
  let genericAnchors = 0;
  const emptyAnchorUrls: string[] = [];
  const genericAnchorExamples: string[] = [];

  $('a[href]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const text = $(el).text().trim().toLowerCase();
    const ariaLabel = $(el).attr('aria-label')?.trim();
    const title = $(el).attr('title')?.trim();

    // Skip non-navigation links
    if (href.startsWith('#') || href.startsWith('javascript:') || href.startsWith('mailto:') || href.startsWith('tel:')) {
      return;
    }

    totalLinks++;

    // Determine if internal or external
    try {
      const linkUrl = new URL(href, url);
      if (linkUrl.hostname === baseUrl.hostname) {
        internalLinks++;
      } else {
        externalLinks++;
      }
    } catch {
      internalLinks++; // Relative URLs are internal
    }

    // Check for empty anchor text
    const hasAccessibleText = text.length > 0 || ariaLabel || title;
    if (!hasAccessibleText) {
      emptyAnchors++;
      if (emptyAnchorUrls.length < 5) {
        emptyAnchorUrls.push(href);
      }
      return;
    }

    // Check for generic anchor text
    if (GENERIC_ANCHORS.has(text)) {
      genericAnchors++;
      if (genericAnchorExamples.length < 5) {
        genericAnchorExamples.push(text);
      }
    }

    // Track anchor text distribution
    if (text.length > 0) {
      anchorCounts[text] = (anchorCounts[text] || 0) + 1;
    }
  });

  // Calculate top anchors
  const topAnchors = Object.entries(anchorCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([text, count]) => ({ text, count }));

  const data: AnchorTextData = {
    totalLinks,
    internalLinks,
    externalLinks,
    emptyAnchors,
    genericAnchors,
    anchorDistribution: anchorCounts,
    topAnchors,
  };

  // ==================== Issue Detection ====================

  // Empty anchors
  if (emptyAnchors > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.ANCHOR_TEXT_EMPTY,
      affectedUrls: [url],
      details: {
        count: emptyAnchors,
        examples: emptyAnchorUrls,
      },
    });
  }

  // Generic anchors (only flag if significant portion)
  const genericRatio = totalLinks > 0 ? genericAnchors / totalLinks : 0;
  if (genericAnchors >= 3 && genericRatio > 0.2) {
    issues.push({
      ...ISSUE_DEFINITIONS.ANCHOR_TEXT_GENERIC,
      affectedUrls: [url],
      details: {
        count: genericAnchors,
        ratio: `${(genericRatio * 100).toFixed(1)}%`,
        examples: genericAnchorExamples,
      },
    });
  }

  // Over-optimized anchor text detection
  // Check if any single anchor text is used too frequently
  const overOptimizedAnchors: string[] = [];
  for (const [text, count] of Object.entries(anchorCounts)) {
    // Exclude very short or very long texts
    if (text.length < 3 || text.length > 50) continue;
    // Exclude common navigation items
    if (['home', 'about', 'contact', 'blog', 'services', 'products'].includes(text)) continue;

    // Flag if same anchor used more than 5 times and represents >15% of links
    if (count > 5 && count / internalLinks > 0.15) {
      overOptimizedAnchors.push(`"${text}" (${count} times)`);
    }
  }

  if (overOptimizedAnchors.length > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.ANCHOR_TEXT_OVER_OPTIMIZED,
      affectedUrls: [url],
      details: {
        overOptimized: overOptimizedAnchors,
      },
    });
  }

  return { issues, data };
}
