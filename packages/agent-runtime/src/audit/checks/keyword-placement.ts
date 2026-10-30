// Keyword Placement Analysis - Critical On-Page SEO Signals
// Reference: "4 Steps to Rank #1 in Google (2026 SEO Plan)" by Nathan Gotch
// "Google's leaked documents have a feature called title match score"
// "Include the primary keyword phrase in the first paragraph"

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';

export interface KeywordPlacementData {
  detectedKeywords: string[];
  urlAnalysis: {
    containsKeyword: boolean;
    keywordInUrl: string | null;
    urlSlug: string;
    isCleanUrl: boolean;
    hasDynamicParams: boolean;
  };
  titleAnalysis: {
    hasExactMatch: boolean;
    hasPartialMatch: boolean;
    titleMatchScore: number; // 0-100 estimated
    position: 'start' | 'middle' | 'end' | 'none';
  };
  h1Analysis: {
    hasExactMatch: boolean;
    hasPartialMatch: boolean;
    h1Text: string | null;
  };
  firstParagraphAnalysis: {
    hasKeyword: boolean;
    keywordPosition: number | null; // word position
    firstParagraphPreview: string;
    isWithinFirst100Words: boolean;
  };
  metaDescriptionAnalysis: {
    hasKeyword: boolean;
    position: 'start' | 'middle' | 'end' | 'none';
  };
  overallPlacementScore: number; // 0-100
}

/**
 * Extract likely target keywords from the page
 * Uses title, H1, and URL to infer the target keyword
 */
export function inferTargetKeywords(html: string, url: string): string[] {
  const $ = cheerio.load(html);
  const keywords: string[] = [];

  // Extract from title (most reliable signal)
  const title = $('title').text().trim();
  if (title) {
    // Remove brand name patterns (usually after | or -)
    const cleanTitle = title.split(/[|\-–—]/)[0]?.trim() || title;
    if (cleanTitle.length > 3 && cleanTitle.length < 100) {
      keywords.push(cleanTitle.toLowerCase());
    }
  }

  // Extract from H1
  const h1 = $('h1').first().text().trim();
  if (h1 && h1.length > 3 && h1.length < 100) {
    keywords.push(h1.toLowerCase());
  }

  // Extract from URL slug
  try {
    const urlPath = new URL(url).pathname;
    const slug = urlPath.split('/').filter(p => p.length > 0).pop();
    if (slug) {
      const cleanSlug = slug.replace(/[-_]/g, ' ').replace(/\.(html?|php|aspx?)$/i, '');
      if (cleanSlug.length > 3) {
        keywords.push(cleanSlug.toLowerCase());
      }
    }
  } catch {
    // Invalid URL
  }

  // Find common words across all sources to identify the core keyword
  const wordCounts = new Map<string, number>();
  for (const kw of keywords) {
    const words = kw.split(/\s+/).filter(w => w.length > 2);
    for (const word of words) {
      wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
    }
  }

  // Sort by frequency and return top keywords
  return [...new Set(keywords)].slice(0, 3);
}

/**
 * Analyze URL for keyword presence
 */
export function analyzeUrlKeyword(url: string, keywords: string[]): KeywordPlacementData['urlAnalysis'] {
  try {
    const parsedUrl = new URL(url);
    const urlSlug = parsedUrl.pathname.toLowerCase();
    const slugWords = urlSlug.replace(/[-_/]/g, ' ').trim();

    let containsKeyword = false;
    let keywordInUrl: string | null = null;

    for (const keyword of keywords) {
      const kwWords = keyword.toLowerCase().split(/\s+/);
      // Check if all significant words of the keyword are in the URL
      const significantWords = kwWords.filter(w => w.length > 2);
      const matchCount = significantWords.filter(w => slugWords.includes(w)).length;

      if (matchCount >= Math.ceil(significantWords.length * 0.7)) {
        containsKeyword = true;
        keywordInUrl = keyword;
        break;
      }
    }

    // Check for clean URL structure
    const isCleanUrl = !urlSlug.includes('?') &&
                       !urlSlug.includes('=') &&
                       !/\d{5,}/.test(urlSlug) && // No long ID numbers
                       urlSlug.length < 100;

    const hasDynamicParams = parsedUrl.search.length > 0;

    return {
      containsKeyword,
      keywordInUrl,
      urlSlug,
      isCleanUrl,
      hasDynamicParams,
    };
  } catch {
    return {
      containsKeyword: false,
      keywordInUrl: null,
      urlSlug: '',
      isCleanUrl: false,
      hasDynamicParams: false,
    };
  }
}

/**
 * Analyze title for keyword match (Title Match Score concept)
 */
export function analyzeTitleKeyword(html: string, keywords: string[]): KeywordPlacementData['titleAnalysis'] {
  const $ = cheerio.load(html);
  const title = $('title').text().trim().toLowerCase();

  if (!title) {
    return {
      hasExactMatch: false,
      hasPartialMatch: false,
      titleMatchScore: 0,
      position: 'none',
    };
  }

  let hasExactMatch = false;
  let hasPartialMatch = false;
  let position: 'start' | 'middle' | 'end' | 'none' = 'none';

  for (const keyword of keywords) {
    const kwLower = keyword.toLowerCase();

    // Exact match check
    if (title.includes(kwLower)) {
      hasExactMatch = true;

      // Determine position
      const index = title.indexOf(kwLower);
      if (index === 0 || index < 5) {
        position = 'start';
      } else if (index > title.length - kwLower.length - 10) {
        position = 'end';
      } else {
        position = 'middle';
      }
      break;
    }

    // Partial match (most words present)
    const kwWords = kwLower.split(/\s+/).filter(w => w.length > 2);
    const matchCount = kwWords.filter(w => title.includes(w)).length;
    if (matchCount >= Math.ceil(kwWords.length * 0.6)) {
      hasPartialMatch = true;
      position = 'middle';
    }
  }

  // Calculate title match score
  let titleMatchScore = 0;
  if (hasExactMatch) {
    titleMatchScore = position === 'start' ? 100 : position === 'middle' ? 80 : 60;
  } else if (hasPartialMatch) {
    titleMatchScore = 40;
  }

  return {
    hasExactMatch,
    hasPartialMatch,
    titleMatchScore,
    position,
  };
}

/**
 * Analyze H1 for keyword match
 */
export function analyzeH1Keyword(html: string, keywords: string[]): KeywordPlacementData['h1Analysis'] {
  const $ = cheerio.load(html);
  const h1 = $('h1').first().text().trim();
  const h1Lower = h1.toLowerCase();

  let hasExactMatch = false;
  let hasPartialMatch = false;

  for (const keyword of keywords) {
    const kwLower = keyword.toLowerCase();

    if (h1Lower.includes(kwLower)) {
      hasExactMatch = true;
      break;
    }

    const kwWords = kwLower.split(/\s+/).filter(w => w.length > 2);
    const matchCount = kwWords.filter(w => h1Lower.includes(w)).length;
    if (matchCount >= Math.ceil(kwWords.length * 0.6)) {
      hasPartialMatch = true;
    }
  }

  return {
    hasExactMatch,
    hasPartialMatch,
    h1Text: h1 || null,
  };
}

/**
 * Analyze first paragraph for keyword placement
 */
export function analyzeFirstParagraph(html: string, keywords: string[]): KeywordPlacementData['firstParagraphAnalysis'] {
  const $ = cheerio.load(html);

  // Find the first real paragraph (not in header/nav)
  const paragraphs = $('main p, article p, .content p, #content p, body > div p').toArray();
  let firstParagraph = '';

  for (const p of paragraphs) {
    const text = $(p).text().trim();
    if (text.length > 50) { // Skip very short paragraphs
      firstParagraph = text;
      break;
    }
  }

  // Fallback to first p tag
  if (!firstParagraph) {
    firstParagraph = $('p').first().text().trim();
  }

  const firstParagraphLower = firstParagraph.toLowerCase();
  const words = firstParagraphLower.split(/\s+/);

  let hasKeyword = false;
  let keywordPosition: number | null = null;

  for (const keyword of keywords) {
    const kwLower = keyword.toLowerCase();
    const kwWords = kwLower.split(/\s+/);

    // Find position of first keyword word
    for (let i = 0; i < words.length; i++) {
      if (kwWords.some(kw => words[i].includes(kw))) {
        hasKeyword = true;
        keywordPosition = i;
        break;
      }
    }

    if (hasKeyword) break;
  }

  return {
    hasKeyword,
    keywordPosition,
    firstParagraphPreview: firstParagraph.substring(0, 200) + (firstParagraph.length > 200 ? '...' : ''),
    isWithinFirst100Words: hasKeyword && keywordPosition !== null && keywordPosition < 100,
  };
}

/**
 * Analyze meta description for keyword
 */
export function analyzeMetaDescription(html: string, keywords: string[]): KeywordPlacementData['metaDescriptionAnalysis'] {
  const $ = cheerio.load(html);
  const metaDesc = $('meta[name="description"]').attr('content')?.trim().toLowerCase() || '';

  if (!metaDesc) {
    return { hasKeyword: false, position: 'none' };
  }

  let hasKeyword = false;
  let position: 'start' | 'middle' | 'end' | 'none' = 'none';

  for (const keyword of keywords) {
    const kwLower = keyword.toLowerCase();
    const kwWords = kwLower.split(/\s+/).filter(w => w.length > 2);
    const matchCount = kwWords.filter(w => metaDesc.includes(w)).length;

    if (matchCount >= Math.ceil(kwWords.length * 0.5)) {
      hasKeyword = true;

      // Find approximate position
      const firstMatch = kwWords.find(w => metaDesc.includes(w));
      if (firstMatch) {
        const index = metaDesc.indexOf(firstMatch);
        if (index < 30) {
          position = 'start';
        } else if (index > metaDesc.length - 50) {
          position = 'end';
        } else {
          position = 'middle';
        }
      }
      break;
    }
  }

  return { hasKeyword, position };
}

/**
 * Main function: Analyze keyword placement
 */
export function analyzeKeywordPlacement(
  html: string,
  url: string
): { issues: AuditIssue[]; data: KeywordPlacementData } {
  const issues: AuditIssue[] = [];

  // Infer target keywords
  const detectedKeywords = inferTargetKeywords(html, url);

  // Run all analyses
  const urlAnalysis = analyzeUrlKeyword(url, detectedKeywords);
  const titleAnalysis = analyzeTitleKeyword(html, detectedKeywords);
  const h1Analysis = analyzeH1Keyword(html, detectedKeywords);
  const firstParagraphAnalysis = analyzeFirstParagraph(html, detectedKeywords);
  const metaDescriptionAnalysis = analyzeMetaDescription(html, detectedKeywords);

  // Calculate overall placement score
  let overallPlacementScore = 0;
  if (urlAnalysis.containsKeyword) overallPlacementScore += 20;
  if (titleAnalysis.hasExactMatch) overallPlacementScore += 25;
  else if (titleAnalysis.hasPartialMatch) overallPlacementScore += 10;
  if (h1Analysis.hasExactMatch) overallPlacementScore += 20;
  else if (h1Analysis.hasPartialMatch) overallPlacementScore += 10;
  if (firstParagraphAnalysis.isWithinFirst100Words) overallPlacementScore += 20;
  else if (firstParagraphAnalysis.hasKeyword) overallPlacementScore += 10;
  if (metaDescriptionAnalysis.hasKeyword) overallPlacementScore += 15;

  // Generate issues

  // URL doesn't contain keyword
  if (!urlAnalysis.containsKeyword && urlAnalysis.urlSlug.length > 1) {
    issues.push({
      code: 'URL_MISSING_KEYWORD',
      severity: 'warning',
      category: 'on-page',
      title: 'URL does not contain target keyword',
      description: `The URL slug "${urlAnalysis.urlSlug}" doesn't include the apparent target keyword.`,
      impact: 'URLs with keywords help Google understand page relevance. This is a ranking signal.',
      howToFix: 'Include the primary keyword phrase in the URL (e.g., /keyword-phrase/ instead of /page123/).',
      affectedUrls: [url],
      details: {
        currentSlug: urlAnalysis.urlSlug,
        inferredKeywords: detectedKeywords,
      },
    });
  }

  // URL has dynamic parameters
  if (urlAnalysis.hasDynamicParams) {
    issues.push({
      code: 'URL_HAS_PARAMS',
      severity: 'notice',
      category: 'on-page',
      title: 'URL contains query parameters',
      description: 'The URL has query parameters which create a less clean URL structure.',
      impact: 'Clean, keyword-rich URLs are preferred by search engines and users.',
      howToFix: 'Use URL rewriting to create clean, parameter-free URLs where possible.',
      affectedUrls: [url],
    });
  }

  // Title doesn't have exact keyword match
  if (!titleAnalysis.hasExactMatch && detectedKeywords.length > 0) {
    issues.push({
      code: 'TITLE_KEYWORD_MISMATCH',
      severity: 'warning',
      category: 'on-page',
      title: 'Title tag missing exact keyword match',
      description: 'The title tag doesn\'t contain the exact target keyword phrase.',
      impact: 'Google\'s leaked documents reveal a "title match score" that measures keyword alignment.',
      howToFix: 'Include the exact target keyword phrase in the title, preferably near the beginning.',
      affectedUrls: [url],
      details: {
        titleMatchScore: titleAnalysis.titleMatchScore,
        position: titleAnalysis.position,
      },
    });
  }

  // Keyword not in first paragraph
  if (!firstParagraphAnalysis.hasKeyword) {
    issues.push({
      code: 'FIRST_PARA_NO_KEYWORD',
      severity: 'warning',
      category: 'on-page',
      title: 'Primary keyword not in first paragraph',
      description: 'The target keyword doesn\'t appear in the opening paragraph.',
      impact: 'Including keywords early in content signals relevance to search engines.',
      howToFix: 'Add the primary keyword naturally within the first 100 words of your content.',
      affectedUrls: [url],
      details: {
        preview: firstParagraphAnalysis.firstParagraphPreview,
      },
    });
  } else if (!firstParagraphAnalysis.isWithinFirst100Words) {
    issues.push({
      code: 'KEYWORD_TOO_FAR',
      severity: 'notice',
      category: 'on-page',
      title: 'Keyword appears late in first paragraph',
      description: `Keyword found at word position ${firstParagraphAnalysis.keywordPosition}, ideally should be in first 100 words.`,
      impact: 'Earlier keyword placement may slightly improve relevance signals.',
      howToFix: 'Move the keyword mention closer to the beginning of your content.',
      affectedUrls: [url],
    });
  }

  // H1 missing keyword
  if (!h1Analysis.hasExactMatch && !h1Analysis.hasPartialMatch && h1Analysis.h1Text) {
    issues.push({
      code: 'H1_MISSING_KEYWORD',
      severity: 'notice',
      category: 'on-page',
      title: 'H1 doesn\'t contain target keyword',
      description: `The H1 "${h1Analysis.h1Text}" doesn't include the target keyword.`,
      impact: 'H1 is a strong on-page signal for topic relevance.',
      howToFix: 'Include the primary keyword in your H1 headline.',
      affectedUrls: [url],
    });
  }

  return {
    issues,
    data: {
      detectedKeywords,
      urlAnalysis,
      titleAnalysis,
      h1Analysis,
      firstParagraphAnalysis,
      metaDescriptionAnalysis,
      overallPlacementScore,
    },
  };
}
