// Main Keyword Research Engine

import * as cheerio from 'cheerio';
import { httpGet } from '../utils/http.js';
import type {
  SiteProfile,
  KeywordData,
  KeywordResearchResult,
} from './types.js';
import { prioritizeKeywords } from './prioritizer.js';
import {
  getExpandedSuggestions,
  enrichKeywordsWithEstimates,
} from './sources/autocomplete.js';
import {
  getAllFreeKeywordIdeas,
  applyEstimates,
} from './sources/free-sources.js';
import {
  getKeywordSuggestions,
  getRelatedKeywords,
  type DataForSEOCredentials,
} from './sources/dataforseo.js';

const USER_AGENT = 'SEO-Autopilot/1.0 (+https://seo-autopilot.dev)';

export interface KeywordResearchOptions {
  seedKeywords: string[];
  siteProfile: SiteProfile;
  url?: string; // To fetch current meta for suggestions
  dataForSEOCredentials?: DataForSEOCredentials;
  maxKeywords?: number;
}

export interface PageMeta {
  title?: string;
  description?: string;
  h1?: string;
  url: string;
}

export async function runKeywordResearch(
  options: KeywordResearchOptions
): Promise<KeywordResearchResult> {
  const {
    seedKeywords,
    siteProfile,
    url,
    dataForSEOCredentials,
    maxKeywords = 50,
  } = options;

  console.log('\n🔍 Starting keyword research...\n');

  // Fetch current page meta if URL provided
  let pageMeta: PageMeta | undefined;
  if (url) {
    console.log('📥 Fetching current page meta...');
    pageMeta = await fetchPageMeta(url);
  }

  // Collect keywords from different sources
  let allKeywords: KeywordData[] = [];

  // Source 1: Free Sources (Autocomplete, PAA, Related, Wikipedia, Competitors)
  console.log('🔤 Getting keyword ideas from free sources...');
  for (const seed of seedKeywords) {
    // Expanded autocomplete (alphabet soup technique)
    const autocompleteSuggestions = await getExpandedSuggestions(seed, {
      language: 'en',
      country: siteProfile.targetGeo === 'us' ? 'us' : siteProfile.targetGeo,
    });
    allKeywords.push(...autocompleteSuggestions);

    // All other free sources (PAA, Related, Wikipedia, Modifiers)
    const freeIdeas = await getAllFreeKeywordIdeas(seed, {
      includeQuestions: true,
      includeModifiers: true,
    });
    allKeywords.push(...freeIdeas);
  }

  // Source 2: DataForSEO (Premium - only if credentials provided)
  if (dataForSEOCredentials) {
    console.log('💎 Getting premium keyword data from DataForSEO...');
    try {
      for (const seed of seedKeywords) {
        const suggestions = await getKeywordSuggestions(
          seed,
          dataForSEOCredentials,
          2840, // US
          30
        );
        allKeywords.push(...suggestions);

        const related = await getRelatedKeywords(
          seed,
          dataForSEOCredentials,
          2840,
          20
        );
        allKeywords.push(...related);
      }
    } catch (error) {
      console.log('⚠️  DataForSEO fetch failed, using free estimates');
    }
  }

  // Remove duplicates
  const uniqueKeywords = deduplicateKeywords(allKeywords);

  // Enrich keywords without data with estimates (free estimation)
  const enrichedKeywords = applyEstimates(enrichKeywordsWithEstimates(uniqueKeywords));

  // Filter to relevant keywords
  const relevantKeywords = filterRelevantKeywords(enrichedKeywords, seedKeywords);

  // Limit to max keywords
  const limitedKeywords = relevantKeywords.slice(0, maxKeywords);

  console.log(`\n📋 Found ${limitedKeywords.length} keyword opportunities\n`);

  // Prioritize and categorize
  const result = prioritizeKeywords(
    limitedKeywords,
    siteProfile,
    pageMeta
      ? {
          title: pageMeta.title,
          description: pageMeta.description,
          h1: pageMeta.h1,
        }
      : undefined
  );

  return result;
}

async function fetchPageMeta(url: string): Promise<PageMeta> {
  try {
    const response = await httpGet<string>(url, {
      
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    return {
      url,
      title: $('title').text().trim() || undefined,
      description: $('meta[name="description"]').attr('content')?.trim() || undefined,
      h1: $('h1').first().text().trim() || undefined,
    };
  } catch {
    return { url };
  }
}

function deduplicateKeywords(keywords: KeywordData[]): KeywordData[] {
  const seen = new Map<string, KeywordData>();

  for (const kw of keywords) {
    const key = kw.keyword.toLowerCase().trim();
    const existing = seen.get(key);

    // Keep the one with more data (higher volume or from better source)
    if (!existing || kw.searchVolume > existing.searchVolume) {
      seen.set(key, kw);
    }
  }

  return Array.from(seen.values());
}

function filterRelevantKeywords(
  keywords: KeywordData[],
  seedKeywords: string[]
): KeywordData[] {
  const seeds = seedKeywords.map((s) => s.toLowerCase());

  return keywords.filter((kw) => {
    const kwLower = kw.keyword.toLowerCase();

    // Keep if contains any seed keyword
    if (seeds.some((seed) => kwLower.includes(seed) || seed.includes(kwLower))) {
      return true;
    }

    // Keep if related to common patterns
    const relatedPatterns = [
      'how to',
      'best',
      'free',
      'online',
      'tool',
      'app',
      'software',
      'tutorial',
      'guide',
    ];

    return relatedPatterns.some((pattern) => kwLower.includes(pattern));
  });
}

// Format results for console output
export function formatKeywordReport(result: KeywordResearchResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(70));
  lines.push('  KEYWORD RESEARCH REPORT');
  lines.push('═'.repeat(70));
  lines.push('');

  // Site profile summary
  lines.push('📋 SITE PROFILE');
  lines.push('─'.repeat(70));
  lines.push(`  Domain:    ${result.siteProfile.domain}`);
  lines.push(`  Age:       ${result.siteProfile.domainAge}`);
  lines.push(`  Backlinks: ${result.siteProfile.backlinkCount}`);
  lines.push(`  Goal:      ${result.siteProfile.businessGoal}`);
  lines.push(`  Max KD:    ${result.maxKdThreshold} (based on your profile)`);
  lines.push('');

  // Quick wins
  if (result.quickWins.length > 0) {
    lines.push('🟢 QUICK WINS (Target First!)');
    lines.push('─'.repeat(70));
    lines.push('  These keywords have low competition and you can rank quickly.');
    lines.push('');

    const table = formatKeywordTable(result.quickWins.slice(0, 10));
    lines.push(table);
    lines.push('');
  }

  // Medium term
  if (result.mediumTerm.length > 0) {
    lines.push('🟡 MEDIUM TERM OPPORTUNITIES');
    lines.push('─'.repeat(70));
    lines.push('  Build some authority first, then target these keywords.');
    lines.push('');

    const table = formatKeywordTable(result.mediumTerm.slice(0, 5));
    lines.push(table);
    lines.push('');
  }

  // Long term
  if (result.longTerm.length > 0) {
    lines.push('🔴 LONG TERM (High Competition)');
    lines.push('─'.repeat(70));
    lines.push('  Save these for when you have more domain authority.');
    lines.push('');

    const table = formatKeywordTable(result.longTerm.slice(0, 3));
    lines.push(table);
    lines.push('');
  }

  // Recommendations
  if (result.recommendations.length > 0) {
    lines.push('💡 RECOMMENDATIONS');
    lines.push('─'.repeat(70));
    for (const rec of result.recommendations) {
      lines.push(`  • ${rec}`);
    }
    lines.push('');
  }

  // Top actions
  const topActions = result.quickWins
    .slice(0, 3)
    .filter((kw) => kw.suggestedAction.suggestedValue);

  if (topActions.length > 0) {
    lines.push('🎯 SUGGESTED CHANGES');
    lines.push('─'.repeat(70));

    for (const kw of topActions) {
      lines.push(`  Keyword: "${kw.keyword}"`);
      lines.push(`  Action:  ${kw.suggestedAction.description}`);
      if (kw.suggestedAction.currentValue) {
        lines.push(`  Current: ${kw.suggestedAction.currentValue}`);
      }
      if (kw.suggestedAction.suggestedValue) {
        lines.push(`  Suggest: ${kw.suggestedAction.suggestedValue}`);
      }
      lines.push('');
    }
  }

  lines.push('═'.repeat(70));

  return lines.join('\n');
}

function formatKeywordTable(keywords: KeywordData[]): string {
  const lines: string[] = [];

  // Header
  lines.push('  Keyword                           Vol    KD   Score  Action');
  lines.push('  ' + '─'.repeat(65));

  for (const kw of keywords) {
    const keyword = kw.keyword.substring(0, 30).padEnd(32);
    const volume = String(kw.searchVolume).padStart(6);
    const kd = String(kw.keywordDifficulty).padStart(4);
    const score = 'priorityScore' in kw ? String((kw as any).priorityScore).padStart(5) : '  -  ';
    const action =
      'suggestedAction' in kw
        ? (kw as any).suggestedAction.type.substring(0, 15)
        : '';

    lines.push(`  ${keyword} ${volume} ${kd} ${score}  ${action}`);
  }

  return lines.join('\n');
}

// Extract seed keywords from page content
export async function extractSeedKeywords(url: string): Promise<string[]> {
  try {
    const response = await httpGet<string>(url, {
      
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);

    const seeds: Set<string> = new Set();

    // From title
    const title = $('title').text().toLowerCase();
    const titleWords = title.split(/[\s\-|:]+/).filter((w) => w.length > 3);
    titleWords.forEach((w) => seeds.add(w));

    // From H1
    const h1 = $('h1').first().text().toLowerCase();
    const h1Words = h1.split(/[\s\-|:]+/).filter((w) => w.length > 3);
    h1Words.forEach((w) => seeds.add(w));

    // From meta keywords (if present)
    const metaKeywords = $('meta[name="keywords"]').attr('content');
    if (metaKeywords) {
      metaKeywords.split(',').forEach((k) => seeds.add(k.trim().toLowerCase()));
    }

    // From description
    const desc = $('meta[name="description"]').attr('content')?.toLowerCase() || '';
    const descWords = desc.split(/\s+/).filter((w) => w.length > 5);
    descWords.slice(0, 5).forEach((w) => seeds.add(w));

    return Array.from(seeds).slice(0, 10);
  } catch {
    return [];
  }
}
