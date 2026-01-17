// DataForSEO API Integration (Budget-Friendly Paid Option)
// Pricing: ~$0.002 per request, $50 minimum deposit

import axios from 'axios';
import type { KeywordData } from '../types.js';

const DATAFORSEO_BASE_URL = 'https://api.dataforseo.com/v3';

export interface DataForSEOCredentials {
  login: string;
  password: string;
}

export interface DataForSEOKeywordResult {
  keyword: string;
  search_volume: number;
  keyword_difficulty: number;
  cpc: number;
  competition: number;
  competition_level: string;
  monthly_searches?: Array<{ month: string; search_volume: number }>;
}

// Get keyword data with search volume and difficulty
export async function getKeywordData(
  keywords: string[],
  credentials: DataForSEOCredentials,
  location: number = 2840 // US
): Promise<KeywordData[]> {
  const auth = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

  try {
    const response = await axios.post(
      `${DATAFORSEO_BASE_URL}/keywords_data/google_ads/search_volume/live`,
      [
        {
          keywords,
          location_code: location,
          language_code: 'en',
        },
      ],
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const results: DataForSEOKeywordResult[] = response.data?.tasks?.[0]?.result || [];

    return results.map((r) => ({
      keyword: r.keyword,
      searchVolume: r.search_volume || 0,
      keywordDifficulty: r.keyword_difficulty || estimateKdFromCompetition(r.competition),
      cpc: r.cpc,
      source: 'dataforseo' as const,
    }));
  } catch (error) {
    console.error('DataForSEO API error:', error);
    throw new Error(`DataForSEO API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get keyword suggestions from seed keyword
export async function getKeywordSuggestions(
  seedKeyword: string,
  credentials: DataForSEOCredentials,
  location: number = 2840,
  limit: number = 100
): Promise<KeywordData[]> {
  const auth = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

  try {
    const response = await axios.post(
      `${DATAFORSEO_BASE_URL}/dataforseo_labs/google/keyword_suggestions/live`,
      [
        {
          keyword: seedKeyword,
          location_code: location,
          language_code: 'en',
          include_seed_keyword: true,
          limit,
        },
      ],
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const results = response.data?.tasks?.[0]?.result?.[0]?.items || [];

    return results.map((item: { keyword_data: DataForSEOKeywordResult }) => ({
      keyword: item.keyword_data.keyword,
      searchVolume: item.keyword_data.search_volume || 0,
      keywordDifficulty: item.keyword_data.keyword_difficulty || 0,
      cpc: item.keyword_data.cpc,
      source: 'dataforseo' as const,
    }));
  } catch (error) {
    console.error('DataForSEO suggestions error:', error);
    throw new Error(`DataForSEO API failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Get related keywords
export async function getRelatedKeywords(
  seedKeyword: string,
  credentials: DataForSEOCredentials,
  location: number = 2840,
  limit: number = 50
): Promise<KeywordData[]> {
  const auth = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

  try {
    const response = await axios.post(
      `${DATAFORSEO_BASE_URL}/dataforseo_labs/google/related_keywords/live`,
      [
        {
          keyword: seedKeyword,
          location_code: location,
          language_code: 'en',
          limit,
        },
      ],
      {
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        timeout: 30000,
      }
    );

    const results = response.data?.tasks?.[0]?.result?.[0]?.items || [];

    return results.map((item: { keyword_data: DataForSEOKeywordResult }) => ({
      keyword: item.keyword_data.keyword,
      searchVolume: item.keyword_data.search_volume || 0,
      keywordDifficulty: item.keyword_data.keyword_difficulty || 0,
      cpc: item.keyword_data.cpc,
      source: 'dataforseo' as const,
    }));
  } catch (error) {
    console.error('DataForSEO related keywords error:', error);
    return [];
  }
}

// Estimate KD from competition value (0-1)
function estimateKdFromCompetition(competition: number): number {
  // Competition is Google Ads competition (0-1)
  // Map to KD scale (0-100)
  return Math.round(competition * 100);
}

// Location codes reference
export const LOCATION_CODES = {
  US: 2840,
  UK: 2826,
  CA: 2124,
  AU: 2036,
  DE: 2276,
  FR: 2250,
  ES: 2724,
  IT: 2380,
  BR: 2076,
  IN: 2356,
  JP: 2392,
};

// Check API balance
export async function checkBalance(credentials: DataForSEOCredentials): Promise<number> {
  const auth = Buffer.from(`${credentials.login}:${credentials.password}`).toString('base64');

  try {
    const response = await axios.get(
      `${DATAFORSEO_BASE_URL}/appendix/user_data`,
      {
        headers: {
          Authorization: `Basic ${auth}`,
        },
      }
    );

    return response.data?.tasks?.[0]?.result?.[0]?.money?.balance || 0;
  } catch {
    return 0;
  }
}
