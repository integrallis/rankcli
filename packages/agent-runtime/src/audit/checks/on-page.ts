import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

export interface OnPageData {
  title?: string;
  titleLength: number;
  description?: string;
  descriptionLength: number;
  canonical?: string;
  h1s: string[];
  headings: { level: number; text: string }[];
  wordCount: number;
  textToHtmlRatio: number;
  hasNoindex: boolean;
  metaRobots?: string;
}

export function analyzeOnPage(html: string, url: string): { issues: AuditIssue[]; data: OnPageData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Extract data
  const title = $('title').text().trim();
  const description = $('meta[name="description"]').attr('content')?.trim();
  const canonical = $('link[rel="canonical"]').attr('href');
  const metaRobots = $('meta[name="robots"]').attr('content');

  // Check noindex
  const hasNoindex = metaRobots?.toLowerCase().includes('noindex') || false;

  // Extract headings
  const h1s: string[] = [];
  $('h1').each((_, el) => {
    h1s.push($(el).text().trim());
  });

  const headings: { level: number; text: string }[] = [];
  $('h1, h2, h3, h4, h5, h6').each((_, el) => {
    const level = parseInt(el.tagName.charAt(1), 10);
    headings.push({ level, text: $(el).text().trim() });
  });

  // Calculate word count (text content only)
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const wordCount = bodyText.split(/\s+/).filter(w => w.length > 0).length;

  // Calculate text-to-HTML ratio
  const textLength = bodyText.length;
  const htmlLength = html.length;
  const textToHtmlRatio = htmlLength > 0 ? (textLength / htmlLength) * 100 : 0;

  const data: OnPageData = {
    title: title || undefined,
    titleLength: title?.length || 0,
    description,
    descriptionLength: description?.length || 0,
    canonical,
    h1s,
    headings,
    wordCount,
    textToHtmlRatio,
    hasNoindex,
    metaRobots,
  };

  // ==================== TITLE CHECKS ====================
  if (!title) {
    issues.push({
      ...ISSUE_DEFINITIONS.TITLE_MISSING,
      affectedUrls: [url],
    });
  } else {
    if (title.length < 30) {
      issues.push({
        ...ISSUE_DEFINITIONS.TITLE_TOO_SHORT,
        affectedUrls: [url],
        details: { title, length: title.length },
      });
    } else if (title.length > 60) {
      issues.push({
        ...ISSUE_DEFINITIONS.TITLE_TOO_LONG,
        affectedUrls: [url],
        details: { title, length: title.length },
      });
    }
  }

  // ==================== META DESCRIPTION CHECKS ====================
  if (!description) {
    issues.push({
      ...ISSUE_DEFINITIONS.META_DESC_MISSING,
      affectedUrls: [url],
    });
  } else {
    if (description.length < 120) {
      issues.push({
        ...ISSUE_DEFINITIONS.META_DESC_TOO_SHORT,
        affectedUrls: [url],
        details: { description, length: description.length },
      });
    } else if (description.length > 160) {
      issues.push({
        ...ISSUE_DEFINITIONS.META_DESC_TOO_LONG,
        affectedUrls: [url],
        details: { description, length: description.length },
      });
    }
  }

  // ==================== CANONICAL CHECKS ====================
  if (!canonical) {
    issues.push({
      ...ISSUE_DEFINITIONS.CANONICAL_MISSING,
      affectedUrls: [url],
    });
  }

  // Check for multiple canonicals
  const canonicalCount = $('link[rel="canonical"]').length;
  if (canonicalCount > 1) {
    issues.push({
      ...ISSUE_DEFINITIONS.MULTIPLE_CANONICALS,
      affectedUrls: [url],
      details: { count: canonicalCount },
    });
  }

  // ==================== H1 CHECKS ====================
  if (h1s.length === 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.H1_MISSING,
      affectedUrls: [url],
    });
  } else if (h1s.length > 1) {
    issues.push({
      ...ISSUE_DEFINITIONS.H1_MULTIPLE,
      affectedUrls: [url],
      details: { h1s, count: h1s.length },
    });
  }

  // Check if H1 duplicates title
  if (h1s.length === 1 && title && h1s[0].toLowerCase() === title.toLowerCase()) {
    issues.push({
      ...ISSUE_DEFINITIONS.H1_DUPLICATE_OF_TITLE,
      affectedUrls: [url],
      details: { h1: h1s[0], title },
    });
  }

  // Check for missing H2 tags (important for content structure)
  const h2Count = headings.filter(h => h.level === 2).length;
  if (h2Count === 0 && wordCount > 100) {
    // Only warn if there's enough content to warrant H2 headings
    issues.push({
      code: 'H2_MISSING',
      severity: 'warning',
      category: 'on-page',
      title: 'No H2 headings found',
      description: 'No H2 tags were found on the page. H2 headings help structure content and improve readability.',
      impact: 'Without H2 headings, search engines and users may find it harder to understand content structure. H2s are important for featuring in search results.',
      howToFix: 'Break your content into logical sections using H2 headings. Include relevant keywords naturally in your H2 tags.',
      affectedUrls: [url],
    });
  }

  // Check heading hierarchy
  let previousLevel = 0;
  for (const heading of headings) {
    if (heading.level > previousLevel + 1 && previousLevel > 0) {
      issues.push({
        ...ISSUE_DEFINITIONS.HEADING_SKIP,
        affectedUrls: [url],
        details: { from: previousLevel, to: heading.level },
      });
      break; // Only report once
    }
    previousLevel = heading.level;
  }

  // ==================== CONTENT CHECKS ====================
  if (wordCount < 300) {
    issues.push({
      ...ISSUE_DEFINITIONS.THIN_CONTENT,
      affectedUrls: [url],
      details: { wordCount },
    });
  }

  if (textToHtmlRatio < 10) {
    issues.push({
      ...ISSUE_DEFINITIONS.LOW_TEXT_HTML_RATIO,
      affectedUrls: [url],
      details: { ratio: textToHtmlRatio.toFixed(1) + '%' },
    });
  }

  // ==================== NOINDEX CHECK ====================
  if (hasNoindex) {
    issues.push({
      ...ISSUE_DEFINITIONS.NOINDEX_TAG,
      affectedUrls: [url],
      details: { metaRobots },
    });
  }

  return { issues, data };
}
