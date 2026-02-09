// Free Keyword Data Sources
// Prioritize these over paid APIs

import { httpGet } from '../../utils/http.js';
import * as cheerio from 'cheerio';
import type { KeywordData } from '../types.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

// 1. Google "People Also Ask" Scraper
export async function getPeopleAlsoAsk(query: string): Promise<string[]> {
  try {
    const response = await httpGet<string>('https://www.google.com/search', {
      params: { q: query },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const questions: string[] = [];

    // PAA boxes have specific data attributes
    $('[data-sgrd]').each((_, el) => {
      const text = $(el).text().trim();
      if (text.endsWith('?') && text.length > 10) {
        questions.push(text);
      }
    });

    // Alternative selector
    $('div[jsname="Cpkphb"]').each((_, el) => {
      const text = $(el).text().trim();
      if (text.length > 10 && text.length < 200) {
        questions.push(text);
      }
    });

    return [...new Set(questions)].slice(0, 10);
  } catch {
    return [];
  }
}

// 2. Google Related Searches Scraper
export async function getRelatedSearches(query: string): Promise<string[]> {
  try {
    const response = await httpGet<string>('https://www.google.com/search', {
      params: { q: query },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const related: string[] = [];

    // Related searches at bottom of SERP
    $('div[data-ved] a').each((_, el) => {
      const href = $(el).attr('href');
      if (href?.includes('/search?q=')) {
        const text = $(el).text().trim();
        if (text.length > 3 && text.length < 100 && !text.includes('http')) {
          related.push(text);
        }
      }
    });

    return [...new Set(related)].slice(0, 8);
  } catch {
    return [];
  }
}

// 3. Wikipedia Topics for Long-Tail Ideas
export async function getWikipediaTopics(query: string): Promise<string[]> {
  try {
    const response = await httpGet<[string, string[], string[], string[]]>('https://en.wikipedia.org/w/api.php', {
      params: {
        action: 'opensearch',
        search: query,
        limit: 10,
        namespace: 0,
        format: 'json',
      },
      timeout: 5000,
    });

    // Response: [query, [titles], [descriptions], [urls]]
    return response.data[1] || [];
  } catch {
    return [];
  }
}

// 4. AnswerThePublic-style Question Generator
export function generateQuestions(keyword: string): string[] {
  const questionPrefixes = [
    'what is', 'what are', 'what does',
    'how to', 'how do', 'how does', 'how can',
    'why is', 'why do', 'why does', 'why are',
    'when to', 'when should', 'when do',
    'where to', 'where can', 'where do',
    'which', 'who', 'can you', 'is it',
    'are there', 'does', 'do',
  ];

  const questions: string[] = [];

  for (const prefix of questionPrefixes) {
    questions.push(`${prefix} ${keyword}`);
  }

  return questions;
}

// 5. Modifier-based Keyword Expansion
export function expandWithModifiers(keyword: string): string[] {
  const modifiers = {
    commercial: ['best', 'top', 'review', 'comparison', 'vs', 'alternative', 'pricing'],
    informational: ['how to', 'what is', 'guide', 'tutorial', 'examples', 'tips'],
    temporal: ['2024', '2025', 'new', 'latest', 'updated'],
    intent: ['free', 'online', 'cheap', 'premium', 'professional'],
    action: ['download', 'buy', 'get', 'create', 'make', 'build', 'use'],
  };

  const expanded: string[] = [];

  for (const [, mods] of Object.entries(modifiers)) {
    for (const mod of mods) {
      expanded.push(`${mod} ${keyword}`);
      expanded.push(`${keyword} ${mod}`);
    }
  }

  return expanded;
}

// 6. Competitor Title Analyzer (from SERP)
export async function analyzeCompetitorTitles(query: string): Promise<{ titles: string[]; keywords: string[] }> {
  try {
    const response = await httpGet<string>('https://www.google.com/search', {
      params: { q: query, num: 10 },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const titles: string[] = [];
    const keywords: Set<string> = new Set();

    // Extract titles from search results
    $('h3').each((_, el) => {
      const title = $(el).text().trim();
      if (title.length > 10 && title.length < 100) {
        titles.push(title);

        // Extract potential keywords from titles
        const words = title.toLowerCase().split(/[\s\-|:]+/);
        words.filter(w => w.length > 3).forEach(w => keywords.add(w));
      }
    });

    return {
      titles: titles.slice(0, 10),
      keywords: Array.from(keywords).slice(0, 20),
    };
  } catch {
    return { titles: [], keywords: [] };
  }
}

// 7. Combine All Free Sources
export async function getAllFreeKeywordIdeas(
  seedKeyword: string,
  options: { includeQuestions?: boolean; includeModifiers?: boolean } = {}
): Promise<KeywordData[]> {
  const { includeQuestions = true, includeModifiers = true } = options;

  const allKeywords: string[] = [];
  const seen = new Set<string>();

  const addKeyword = (kw: string) => {
    const normalized = kw.toLowerCase().trim();
    if (!seen.has(normalized) && normalized.length > 2) {
      seen.add(normalized);
      allKeywords.push(kw);
    }
  };

  // Run sources in parallel where possible
  console.log('  → Fetching from Google autocomplete...');
  const [paa, related, wiki, competitors] = await Promise.all([
    getPeopleAlsoAsk(seedKeyword).catch(() => []),
    getRelatedSearches(seedKeyword).catch(() => []),
    getWikipediaTopics(seedKeyword).catch(() => []),
    analyzeCompetitorTitles(seedKeyword).catch(() => ({ titles: [], keywords: [] })),
  ]);

  // Add PAA questions
  paa.forEach(addKeyword);

  // Add related searches
  related.forEach(addKeyword);

  // Add Wikipedia topics
  wiki.forEach(addKeyword);

  // Add competitor keywords
  competitors.keywords.forEach(addKeyword);

  // Add generated questions
  if (includeQuestions) {
    generateQuestions(seedKeyword).forEach(addKeyword);
  }

  // Add modifier expansions
  if (includeModifiers) {
    expandWithModifiers(seedKeyword).forEach(addKeyword);
  }

  // Convert to KeywordData format
  return allKeywords.map((kw) => ({
    keyword: kw,
    searchVolume: 0, // Will be estimated
    keywordDifficulty: 0, // Will be estimated
    source: 'autocomplete' as const,
  }));
}

// 8. Estimate metrics based on keyword characteristics
export function estimateMetrics(keyword: string): { volume: number; difficulty: number } {
  const words = keyword.split(' ').length;
  const hasQuestion = /^(how|what|why|when|where|who|which|can|is|are|do|does)/i.test(keyword);
  const hasCommercial = /\b(best|top|review|buy|price|cheap|free|vs|alternative)\b/i.test(keyword);
  const hasYear = /\b20\d{2}\b/.test(keyword);

  // Base estimates
  let volume = 500;
  let difficulty = 30;

  // Adjust based on word count (longer = less volume, less competition)
  if (words >= 5) {
    volume = 50;
    difficulty = 10;
  } else if (words >= 4) {
    volume = 150;
    difficulty = 15;
  } else if (words >= 3) {
    volume = 300;
    difficulty = 20;
  } else if (words === 2) {
    volume = 800;
    difficulty = 35;
  } else {
    volume = 2000;
    difficulty = 50;
  }

  // Adjust for question keywords (usually lower competition)
  if (hasQuestion) {
    difficulty -= 5;
    volume *= 0.8;
  }

  // Adjust for commercial intent (usually higher competition)
  if (hasCommercial) {
    difficulty += 10;
    volume *= 1.2;
  }

  // Year keywords are often seasonal
  if (hasYear) {
    volume *= 1.5;
  }

  return {
    volume: Math.round(Math.max(10, volume)),
    difficulty: Math.round(Math.max(1, Math.min(100, difficulty))),
  };
}

// 9. Apply estimates to keyword list
export function applyEstimates(keywords: KeywordData[]): KeywordData[] {
  return keywords.map((kw) => {
    if (kw.searchVolume === 0 || kw.keywordDifficulty === 0) {
      const estimates = estimateMetrics(kw.keyword);
      return {
        ...kw,
        searchVolume: kw.searchVolume || estimates.volume,
        keywordDifficulty: kw.keywordDifficulty || estimates.difficulty,
      };
    }
    return kw;
  });
}
