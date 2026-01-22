// Keyword Density Analysis
// Analyzes keyword usage and distribution across page elements

import * as cheerio from 'cheerio';
import type { AuditIssue } from '../types.js';
import { ISSUE_DEFINITIONS } from '../types.js';

// Common English stop words to filter out
const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with',
  'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been', 'be', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might', 'must',
  'can', 'this', 'that', 'these', 'those', 'it', 'its', 'they', 'them', 'their',
  'we', 'us', 'our', 'you', 'your', 'i', 'me', 'my', 'he', 'she', 'him', 'her', 'his',
  'not', 'no', 'nor', 'so', 'if', 'then', 'else', 'when', 'where', 'why', 'how', 'what',
  'who', 'which', 'all', 'each', 'every', 'both', 'few', 'more', 'most', 'other', 'some',
  'such', 'only', 'own', 'same', 'than', 'too', 'very', 'just', 'also', 'now', 'here',
  'there', 'about', 'after', 'before', 'above', 'below', 'between', 'into', 'through',
  'during', 'under', 'again', 'further', 'once', 'any', 'being', 'because', 'while',
]);

export interface KeywordInfo {
  word: string;
  count: number;
  density: number; // Percentage
  inTitle: boolean;
  inH1: boolean;
  inH2: boolean;
  inMetaDesc: boolean;
}

export interface KeywordPhraseInfo {
  phrase: string;
  count: number;
  wordCount: number;
}

export interface KeywordAnalysisData {
  totalWords: number;
  uniqueWords: number;
  topKeywords: KeywordInfo[];
  topPhrases: {
    twoWord: KeywordPhraseInfo[];
    threeWord: KeywordPhraseInfo[];
    fourWord: KeywordPhraseInfo[];
  };
  keywordDistribution: {
    title: string[];
    h1: string[];
    h2: string[];
    metaDesc: string[];
  };
  potentialStuffing: string[];
}

/**
 * Extract text content from an element
 */
function extractText($: cheerio.CheerioAPI, selector: string): string {
  return $(selector)
    .text()
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Tokenize text into words
 */
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word) && !/^\d+$/.test(word));
}

/**
 * Count word frequencies
 */
function countWords(words: string[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) || 0) + 1);
  }
  return counts;
}

/**
 * Extract n-grams (phrases)
 */
function extractNGrams(words: string[], n: number): Map<string, number> {
  const ngrams = new Map<string, number>();

  for (let i = 0; i <= words.length - n; i++) {
    const ngram = words.slice(i, i + n).join(' ');
    // Skip if any word is a stop word
    const ngramWords = ngram.split(' ');
    if (ngramWords.some((w) => STOP_WORDS.has(w))) continue;

    ngrams.set(ngram, (ngrams.get(ngram) || 0) + 1);
  }

  return ngrams;
}

/**
 * Analyze keyword density and distribution
 */
export function analyzeKeywords(html: string, url: string): { issues: AuditIssue[]; data: KeywordAnalysisData } {
  const issues: AuditIssue[] = [];
  const $ = cheerio.load(html);

  // Extract text from different elements
  const title = extractText($, 'title');
  const h1 = extractText($, 'h1');
  const h2 = extractText($, 'h2');
  const metaDesc = $('meta[name="description"]').attr('content')?.toLowerCase() || '';

  // Remove script and style content
  $('script, style, noscript').remove();
  const bodyText = extractText($, 'body');

  // Tokenize
  const bodyWords = tokenize(bodyText);
  const titleWords = tokenize(title);
  const h1Words = tokenize(h1);
  const h2Words = tokenize(h2);
  const metaDescWords = tokenize(metaDesc);

  // Count words
  const wordCounts = countWords(bodyWords);
  const totalWords = bodyWords.length;

  // Calculate keyword density
  const topKeywordsMap: KeywordInfo[] = [];

  for (const [word, count] of wordCounts) {
    const density = (count / totalWords) * 100;
    topKeywordsMap.push({
      word,
      count,
      density: Math.round(density * 100) / 100,
      inTitle: titleWords.includes(word),
      inH1: h1Words.includes(word),
      inH2: h2Words.includes(word),
      inMetaDesc: metaDescWords.includes(word),
    });
  }

  // Sort by count and take top 20
  topKeywordsMap.sort((a, b) => b.count - a.count);
  const topKeywords = topKeywordsMap.slice(0, 20);

  // Extract n-grams
  const twoWordPhrases = extractNGrams(bodyWords, 2);
  const threeWordPhrases = extractNGrams(bodyWords, 3);
  const fourWordPhrases = extractNGrams(bodyWords, 4);

  // Convert to sorted arrays
  const sortPhrases = (phrases: Map<string, number>, n: number): KeywordPhraseInfo[] => {
    return Array.from(phrases)
      .filter(([_, count]) => count >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phrase, count]) => ({ phrase, count, wordCount: n }));
  };

  // Check for keyword stuffing (density > 3%)
  const potentialStuffing = topKeywords.filter((k) => k.density > 3).map((k) => k.word);

  // Generate issues
  if (potentialStuffing.length > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.KEYWORD_STUFFING,
      affectedUrls: [url],
      details: {
        keywords: potentialStuffing,
        densities: potentialStuffing.map((k) => {
          const info = topKeywords.find((tk) => tk.word === k);
          return { word: k, density: info?.density };
        }),
      },
    });
  }

  // Check if top keywords are in title
  const topBodyKeywords = topKeywords.slice(0, 5).map((k) => k.word);
  const keywordsInTitle = topBodyKeywords.filter((k) => titleWords.includes(k));

  if (keywordsInTitle.length === 0 && topBodyKeywords.length > 0) {
    issues.push({
      ...ISSUE_DEFINITIONS.NO_KEYWORDS_IN_TITLE,
      affectedUrls: [url],
      details: {
        topKeywords: topBodyKeywords,
        title,
        recommendation: `Consider including "${topBodyKeywords[0]}" in your title`,
      },
    });
  }

  // Check if top keywords are in H1
  const keywordsInH1 = topBodyKeywords.filter((k) => h1Words.includes(k));

  if (keywordsInH1.length === 0 && topBodyKeywords.length > 0 && h1) {
    issues.push({
      ...ISSUE_DEFINITIONS.NO_KEYWORDS_IN_H1,
      affectedUrls: [url],
      details: {
        topKeywords: topBodyKeywords,
        h1,
        recommendation: `Consider including "${topBodyKeywords[0]}" in your H1`,
      },
    });
  }

  return {
    issues,
    data: {
      totalWords,
      uniqueWords: wordCounts.size,
      topKeywords,
      topPhrases: {
        twoWord: sortPhrases(twoWordPhrases, 2),
        threeWord: sortPhrases(threeWordPhrases, 3),
        fourWord: sortPhrases(fourWordPhrases, 4),
      },
      keywordDistribution: {
        title: titleWords,
        h1: h1Words,
        h2: h2Words,
        metaDesc: metaDescWords,
      },
      potentialStuffing,
    },
  };
}
