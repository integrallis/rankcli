// Google Autocomplete Keyword Scraper (Free)

import axios from 'axios';
import type { KeywordData } from '../types.js';

const AUTOCOMPLETE_URL = 'https://suggestqueries.google.com/complete/search';

export interface AutocompleteOptions {
  language?: string;
  country?: string;
}

export async function getAutocompleteSuggestions(
  seedKeyword: string,
  options: AutocompleteOptions = {}
): Promise<KeywordData[]> {
  const { language = 'en', country = 'us' } = options;

  try {
    const response = await axios.get(AUTOCOMPLETE_URL, {
      params: {
        client: 'firefox', // Returns JSON
        q: seedKeyword,
        hl: language,
        gl: country,
      },
      timeout: 5000,
    });

    // Response format: [query, [suggestions], ...]
    const suggestions: string[] = response.data[1] || [];

    return suggestions.map((suggestion) => ({
      keyword: suggestion,
      searchVolume: 0, // Autocomplete doesn't provide volume
      keywordDifficulty: 0, // Need to estimate or fetch separately
      source: 'autocomplete' as const,
    }));
  } catch (error) {
    console.error('Autocomplete fetch failed:', error);
    return [];
  }
}

// Get expanded suggestions using alphabet soup technique
export async function getExpandedSuggestions(
  seedKeyword: string,
  options: AutocompleteOptions = {}
): Promise<KeywordData[]> {
  const allSuggestions: KeywordData[] = [];
  const seen = new Set<string>();

  // Base query
  const baseSuggestions = await getAutocompleteSuggestions(seedKeyword, options);
  for (const kw of baseSuggestions) {
    if (!seen.has(kw.keyword.toLowerCase())) {
      seen.add(kw.keyword.toLowerCase());
      allSuggestions.push(kw);
    }
  }

  // Alphabet soup: append each letter
  const letters = 'abcdefghijklmnopqrstuvwxyz'.split('');

  // Limit concurrent requests
  const batchSize = 5;
  for (let i = 0; i < letters.length; i += batchSize) {
    const batch = letters.slice(i, i + batchSize);
    const promises = batch.map((letter) =>
      getAutocompleteSuggestions(`${seedKeyword} ${letter}`, options)
    );

    const results = await Promise.all(promises);
    for (const suggestions of results) {
      for (const kw of suggestions) {
        if (!seen.has(kw.keyword.toLowerCase())) {
          seen.add(kw.keyword.toLowerCase());
          allSuggestions.push(kw);
        }
      }
    }

    // Small delay to avoid rate limiting
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  // Question modifiers
  const questionPrefixes = ['how to', 'what is', 'why', 'when', 'where', 'best'];
  for (const prefix of questionPrefixes) {
    const suggestions = await getAutocompleteSuggestions(`${prefix} ${seedKeyword}`, options);
    for (const kw of suggestions) {
      if (!seen.has(kw.keyword.toLowerCase())) {
        seen.add(kw.keyword.toLowerCase());
        allSuggestions.push(kw);
      }
    }
  }

  return allSuggestions;
}

// Estimate keyword difficulty based on SERP analysis
export function estimateKeywordDifficulty(keyword: string): number {
  // Basic heuristics (can be improved with actual SERP data)
  const wordCount = keyword.split(' ').length;

  // Longer keywords tend to be less competitive
  if (wordCount >= 5) return 5;
  if (wordCount >= 4) return 10;
  if (wordCount >= 3) return 20;
  if (wordCount >= 2) return 30;

  return 50; // Single word = high competition
}

// Estimate search volume based on keyword characteristics
export function estimateSearchVolume(keyword: string): number {
  // This is a rough estimate - real data should come from APIs
  const wordCount = keyword.split(' ').length;

  // Longer tail = lower volume typically
  if (wordCount >= 5) return 50;
  if (wordCount >= 4) return 100;
  if (wordCount >= 3) return 300;
  if (wordCount >= 2) return 500;

  return 1000; // Single word = high volume
}

// Add estimates to keywords without data
export function enrichKeywordsWithEstimates(keywords: KeywordData[]): KeywordData[] {
  return keywords.map((kw) => ({
    ...kw,
    keywordDifficulty: kw.keywordDifficulty || estimateKeywordDifficulty(kw.keyword),
    searchVolume: kw.searchVolume || estimateSearchVolume(kw.keyword),
  }));
}
