// Keyword Cannibalization Detection
// Based on Nathan Gotch's SEO technique: Detecting when multiple pages target the same keyword
// This causes pages to compete against each other in search results

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface PageKeywordData {
  url: string;
  title: string;
  h1: string[];
  metaDescription: string;
  primaryKeywords: string[];
  keywordDensity: Map<string, number>;
}

export interface CannibalizationIssue {
  keyword: string;
  pages: string[];
  similarity: number;
}

export interface KeywordCannibalizationData {
  pagesAnalyzed: number;
  potentialIssues: CannibalizationIssue[];
  pageKeywords: PageKeywordData[];
}

/**
 * Extract primary keywords from a page
 */
export function extractPageKeywords(html: string, url: string): PageKeywordData {
  const $ = cheerio.load(html);

  // Get title
  const title = $('title').text().trim() || '';

  // Get H1s
  const h1s: string[] = [];
  $('h1').each((_, el) => {
    h1s.push($(el).text().trim());
  });

  // Get meta description
  const metaDescription = $('meta[name="description"]').attr('content')?.trim() || '';

  // Extract text content
  $('script, style, nav, footer, header').remove();
  const bodyText = $('body').text().toLowerCase();

  // Tokenize and count words
  const words = bodyText
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Count word frequency
  const wordCount = new Map<string, number>();
  for (const word of words) {
    wordCount.set(word, (wordCount.get(word) || 0) + 1);
  }

  // Calculate keyword density
  const totalWords = words.length;
  const keywordDensity = new Map<string, number>();
  for (const [word, count] of wordCount) {
    keywordDensity.set(word, count / totalWords);
  }

  // Extract primary keywords from title and H1 (most important signals)
  const titleWords = title
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  const h1Words = h1s
    .join(' ')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3);

  // Primary keywords are those appearing in both title and H1, or high density
  const primaryKeywords: string[] = [];
  const seen = new Set<string>();

  // Words in both title and H1 are likely primary keywords
  for (const word of titleWords) {
    if (h1Words.includes(word) && !seen.has(word)) {
      primaryKeywords.push(word);
      seen.add(word);
    }
  }

  // Also include high-density words from title
  for (const word of titleWords) {
    const density = keywordDensity.get(word) || 0;
    if (density > 0.01 && !seen.has(word)) {
      primaryKeywords.push(word);
      seen.add(word);
    }
  }

  return {
    url,
    title,
    h1: h1s,
    metaDescription,
    primaryKeywords,
    keywordDensity,
  };
}

/**
 * Extract 2-word and 3-word phrases (n-grams) for better cannibalization detection
 */
export function extractKeyPhrases(html: string): string[] {
  const $ = cheerio.load(html);

  const title = $('title').text().trim().toLowerCase();
  const h1s = $('h1')
    .map((_, el) => $(el).text().trim().toLowerCase())
    .get()
    .join(' ');
  const metaDesc = ($('meta[name="description"]').attr('content') || '').toLowerCase();

  const combinedText = `${title} ${h1s} ${metaDesc}`;

  // Extract 2-word and 3-word phrases
  const words = combinedText.replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
  const phrases: string[] = [];

  // 2-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length > 2 && words[i + 1].length > 2) {
      phrases.push(`${words[i]} ${words[i + 1]}`);
    }
  }

  // 3-word phrases
  for (let i = 0; i < words.length - 2; i++) {
    if (words[i].length > 2 && words[i + 1].length > 2 && words[i + 2].length > 2) {
      phrases.push(`${words[i]} ${words[i + 1]} ${words[i + 2]}`);
    }
  }

  return phrases;
}

/**
 * Calculate Jaccard similarity between two sets of keywords
 */
export function calculateKeywordSimilarity(keywords1: string[], keywords2: string[]): number {
  if (keywords1.length === 0 || keywords2.length === 0) return 0;

  const set1 = new Set(keywords1);
  const set2 = new Set(keywords2);

  const intersection = new Set([...set1].filter((x) => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Detect potential keyword cannibalization between pages
 * This is used when crawling multiple pages
 */
export function detectCannibalization(pages: PageKeywordData[]): CannibalizationIssue[] {
  const issues: CannibalizationIssue[] = [];
  const keywordToPages = new Map<string, string[]>();

  // Build a map of keywords to pages
  for (const page of pages) {
    for (const keyword of page.primaryKeywords) {
      const existing = keywordToPages.get(keyword) || [];
      existing.push(page.url);
      keywordToPages.set(keyword, existing);
    }
  }

  // Find keywords targeting multiple pages
  for (const [keyword, urls] of keywordToPages) {
    if (urls.length > 1) {
      // Calculate similarity between all pairs
      let maxSimilarity = 0;

      for (let i = 0; i < urls.length; i++) {
        for (let j = i + 1; j < urls.length; j++) {
          const page1 = pages.find((p) => p.url === urls[i]);
          const page2 = pages.find((p) => p.url === urls[j]);

          if (page1 && page2) {
            const similarity = calculateKeywordSimilarity(page1.primaryKeywords, page2.primaryKeywords);
            maxSimilarity = Math.max(maxSimilarity, similarity);
          }
        }
      }

      // Only flag if similarity is above threshold (0.5 = 50% overlap)
      if (maxSimilarity > 0.5) {
        issues.push({
          keyword,
          pages: urls,
          similarity: maxSimilarity,
        });
      }
    }
  }

  return issues;
}

/**
 * Analyze a single page for cannibalization signals
 * Used for single-page audits to detect potential self-cannibalization patterns
 */
export function analyzeKeywordCannibalizationSinglePage(
  html: string,
  url: string
): { issues: AuditIssue[]; data: PageKeywordData } {
  const issues: AuditIssue[] = [];
  const pageData = extractPageKeywords(html, url);

  // Check for duplicate/similar H1 and title (common cannibalization signal)
  if (pageData.h1.length > 1) {
    const h1Texts = pageData.h1.map((h) => h.toLowerCase().trim());
    const uniqueH1s = new Set(h1Texts);

    if (uniqueH1s.size < h1Texts.length) {
      issues.push({
        code: 'INTERNAL_CANNIBALIZATION_SIGNAL',
        severity: 'warning',
        category: 'content',
        title: 'Duplicate H1 tags on page',
        description: `Page has ${h1Texts.length} H1 tags with duplicates, which can dilute keyword focus.`,
        impact: 'Multiple similar H1s can confuse search engines about page topic.',
        howToFix: 'Use a single, unique H1 that clearly defines the page topic.',
        affectedUrls: [url],
        details: { h1s: pageData.h1 },
      });
    }
  }

  // Check if title and H1 are targeting completely different keywords
  const titleKeywords = new Set(
    pageData.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  const h1Keywords = new Set(
    pageData.h1
      .join(' ')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 3)
  );

  // Calculate overlap
  const intersection = new Set([...titleKeywords].filter((x) => h1Keywords.has(x)));

  if (titleKeywords.size > 0 && h1Keywords.size > 0 && intersection.size === 0) {
    issues.push({
      code: 'TITLE_H1_KEYWORD_MISMATCH',
      severity: 'warning',
      category: 'on-page',
      title: 'Title and H1 target different keywords',
      description: 'The title tag and H1 heading have no overlapping keywords.',
      impact: 'Search engines may be confused about the primary topic of the page.',
      howToFix: 'Align title and H1 to target the same primary keyword or topic.',
      affectedUrls: [url],
      details: {
        titleKeywords: [...titleKeywords],
        h1Keywords: [...h1Keywords],
      },
    });
  }

  return { issues, data: pageData };
}

/**
 * Full cannibalization analysis for multi-page crawls
 */
export function analyzeKeywordCannibalization(
  pagesHtml: Map<string, string>
): { issues: AuditIssue[]; data: KeywordCannibalizationData } {
  const issues: AuditIssue[] = [];
  const pageKeywords: PageKeywordData[] = [];

  // Extract keywords from all pages
  for (const [url, html] of pagesHtml) {
    const { data } = analyzeKeywordCannibalizationSinglePage(html, url);
    pageKeywords.push(data);
  }

  // Detect cannibalization issues
  const cannibalizationIssues = detectCannibalization(pageKeywords);

  // Create audit issues for each cannibalization problem
  for (const issue of cannibalizationIssues) {
    issues.push({
      code: 'KEYWORD_CANNIBALIZATION',
      severity: 'warning',
      category: 'content',
      title: `Keyword cannibalization: "${issue.keyword}"`,
      description: `Multiple pages (${issue.pages.length}) are targeting the same keyword "${issue.keyword}" with ${Math.round(issue.similarity * 100)}% keyword overlap.`,
      impact: 'These pages compete against each other in search results, potentially hurting all their rankings.',
      howToFix:
        'Consolidate pages into one comprehensive page, differentiate keyword targeting, or use canonical tags to indicate the preferred version.',
      affectedUrls: issue.pages,
      details: {
        keyword: issue.keyword,
        similarity: issue.similarity,
        pageCount: issue.pages.length,
      },
    });
  }

  return {
    issues,
    data: {
      pagesAnalyzed: pagesHtml.size,
      potentialIssues: cannibalizationIssues,
      pageKeywords,
    },
  };
}

/**
 * Check for URL-level cannibalization signals
 * (e.g., /chicago-lawyer and /chicago-attorney targeting same intent)
 */
export function detectUrlCannibalizationPatterns(urls: string[]): string[][] {
  const patterns: string[][] = [];
  const synonymPairs = [
    ['lawyer', 'attorney'],
    ['best', 'top'],
    ['guide', 'tutorial', 'how-to'],
    ['review', 'reviews'],
    ['buy', 'purchase', 'shop'],
    ['cheap', 'affordable', 'budget'],
    ['vs', 'versus', 'compared'],
  ];

  // Group URLs by base path (ignoring synonyms)
  const urlGroups = new Map<string, string[]>();

  for (const url of urls) {
    try {
      const parsed = new URL(url);
      let normalizedPath = parsed.pathname.toLowerCase();

      // Replace synonyms with canonical version
      for (const synonymSet of synonymPairs) {
        for (let i = 1; i < synonymSet.length; i++) {
          normalizedPath = normalizedPath.replace(
            new RegExp(`\\b${synonymSet[i]}\\b`, 'g'),
            synonymSet[0]
          );
        }
      }

      const existing = urlGroups.get(normalizedPath) || [];
      existing.push(url);
      urlGroups.set(normalizedPath, existing);
    } catch {
      // Invalid URL, skip
    }
  }

  // Find groups with multiple URLs (potential cannibalization)
  for (const [, group] of urlGroups) {
    if (group.length > 1) {
      patterns.push(group);
    }
  }

  return patterns;
}
