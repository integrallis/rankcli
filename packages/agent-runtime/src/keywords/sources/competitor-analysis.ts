// Competitor Keyword Analysis (SpyFu Kombat-style)
// Analyze competitor rankings to find keyword gaps and opportunities

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { KeywordData } from '../types.js';

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36';

export interface CompetitorKeywordResult {
  // Keywords all competitors rank for (high priority - proven market)
  coreKeywords: KeywordData[];
  // Keywords competitors rank for but you don't (opportunities)
  missingKeywords: KeywordData[];
  // Keywords only you rank for (potential advantages)
  uniqueKeywords: KeywordData[];
  // All keywords any competitor ranks for
  keywordUniverse: KeywordData[];
  // Overlap analysis
  competitorOverlap: CompetitorOverlap[];
}

export interface CompetitorOverlap {
  competitor: string;
  sharedKeywords: number;
  uniqueToThem: number;
  uniqueToYou: number;
}

export interface CompetitorData {
  domain: string;
  keywords: Set<string>;
  rankings: Map<string, number>; // keyword -> position
}

/**
 * Scrape competitor rankings from Google SERP for seed keywords
 * This discovers what keywords competitors appear for
 */
export async function discoverCompetitorKeywords(
  yourDomain: string,
  seedKeywords: string[],
  competitors?: string[]
): Promise<CompetitorKeywordResult> {
  const yourKeywords = new Set<string>();
  const competitorKeywordsMap = new Map<string, Set<string>>();
  const allKeywords = new Map<string, KeywordData>();

  // Initialize competitor tracking
  const discoveredCompetitors = new Set<string>(competitors || []);

  console.log('  → Analyzing SERP results for competitor keywords...');

  // For each seed keyword, check who ranks and for what related terms
  for (const seed of seedKeywords) {
    try {
      // Get SERP results
      const serpData = await analyzeSERP(seed);

      // Track who ranks for this keyword
      for (const result of serpData.results) {
        const domain = extractDomain(result.url);

        if (domain === yourDomain || domain.includes(yourDomain) || yourDomain.includes(domain)) {
          yourKeywords.add(seed);
        } else {
          // Discovered competitor
          discoveredCompetitors.add(domain);
          if (!competitorKeywordsMap.has(domain)) {
            competitorKeywordsMap.set(domain, new Set());
          }
          competitorKeywordsMap.get(domain)!.add(seed);
        }

        // Extract keywords from competitor titles/descriptions
        const extractedKeywords = extractKeywordsFromText(result.title + ' ' + result.description);
        for (const kw of extractedKeywords) {
          if (!allKeywords.has(kw)) {
            allKeywords.set(kw, {
              keyword: kw,
              searchVolume: 0,
              keywordDifficulty: 0,
              source: 'competitor' as const,
            });
          }

          // Track which domains have this keyword
          if (domain === yourDomain || domain.includes(yourDomain)) {
            yourKeywords.add(kw);
          } else {
            competitorKeywordsMap.get(domain)?.add(kw);
          }
        }
      }

      // Also get related searches for more keyword ideas
      for (const related of serpData.relatedSearches) {
        if (!allKeywords.has(related)) {
          allKeywords.set(related, {
            keyword: related,
            searchVolume: 0,
            keywordDifficulty: 0,
            source: 'competitor' as const,
          });
        }
      }

      // Avoid rate limiting
      await sleep(500);
    } catch (error) {
      // Continue with other seeds
    }
  }

  // Calculate keyword categories
  const coreKeywords: KeywordData[] = [];
  const missingKeywords: KeywordData[] = [];
  const uniqueKeywords: KeywordData[] = [];
  const keywordUniverse: KeywordData[] = [];

  // Analyze each keyword
  for (const [keyword, data] of allKeywords) {
    const competitorCount = countCompetitorsWithKeyword(keyword, competitorKeywordsMap);
    const youHaveIt = yourKeywords.has(keyword);

    keywordUniverse.push(data);

    if (competitorCount >= 2 && youHaveIt) {
      // Core keyword - everyone ranks
      coreKeywords.push(data);
    } else if (competitorCount >= 1 && !youHaveIt) {
      // Missing keyword - competitors have it, you don't
      missingKeywords.push(data);
    } else if (competitorCount === 0 && youHaveIt) {
      // Unique keyword - only you have it
      uniqueKeywords.push(data);
    }
  }

  // Calculate competitor overlap
  const competitorOverlap: CompetitorOverlap[] = [];
  for (const [domain, keywords] of competitorKeywordsMap) {
    const shared = [...keywords].filter(k => yourKeywords.has(k)).length;
    const uniqueToThem = [...keywords].filter(k => !yourKeywords.has(k)).length;
    const uniqueToYou = [...yourKeywords].filter(k => !keywords.has(k)).length;

    competitorOverlap.push({
      competitor: domain,
      sharedKeywords: shared,
      uniqueToThem,
      uniqueToYou,
    });
  }

  // Sort by number of keywords they have that you don't
  competitorOverlap.sort((a, b) => b.uniqueToThem - a.uniqueToThem);

  return {
    coreKeywords,
    missingKeywords,
    uniqueKeywords,
    keywordUniverse,
    competitorOverlap,
  };
}

interface SERPResult {
  url: string;
  title: string;
  description: string;
  position: number;
}

interface SERPData {
  results: SERPResult[];
  relatedSearches: string[];
  peopleAlsoAsk: string[];
}

async function analyzeSERP(query: string): Promise<SERPData> {
  try {
    const response = await axios.get('https://www.google.com/search', {
      params: { q: query, num: 20 },
      headers: { 'User-Agent': USER_AGENT },
      timeout: 10000,
    });

    const $ = cheerio.load(response.data);
    const results: SERPResult[] = [];
    const relatedSearches: string[] = [];
    const peopleAlsoAsk: string[] = [];

    // Extract search results
    let position = 1;
    $('div.g').each((_, el) => {
      const link = $(el).find('a').first();
      const url = link.attr('href');
      const title = $(el).find('h3').text().trim();
      const description = $(el).find('.VwiC3b').text().trim() ||
                         $(el).find('[data-content-feature]').text().trim();

      if (url && url.startsWith('http') && title) {
        results.push({ url, title, description, position });
        position++;
      }
    });

    // Extract related searches
    $('div[data-ved] a').each((_, el) => {
      const href = $(el).attr('href');
      if (href?.includes('/search?q=')) {
        const text = $(el).text().trim();
        if (text.length > 3 && text.length < 100 && !text.includes('http')) {
          relatedSearches.push(text);
        }
      }
    });

    // Extract People Also Ask
    $('[data-sgrd]').each((_, el) => {
      const text = $(el).text().trim();
      if (text.endsWith('?') && text.length > 10) {
        peopleAlsoAsk.push(text);
      }
    });

    return {
      results,
      relatedSearches: [...new Set(relatedSearches)],
      peopleAlsoAsk: [...new Set(peopleAlsoAsk)],
    };
  } catch {
    return { results: [], relatedSearches: [], peopleAlsoAsk: [] };
  }
}

function extractDomain(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}

function extractKeywordsFromText(text: string): string[] {
  // Extract 2-4 word phrases that could be keywords
  const words = text.toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length > 2);

  const keywords: string[] = [];

  // Single words (4+ chars)
  words.filter(w => w.length >= 4).forEach(w => keywords.push(w));

  // 2-word phrases
  for (let i = 0; i < words.length - 1; i++) {
    const phrase = `${words[i]} ${words[i + 1]}`;
    if (phrase.length >= 5 && phrase.length <= 50) {
      keywords.push(phrase);
    }
  }

  // 3-word phrases
  for (let i = 0; i < words.length - 2; i++) {
    const phrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
    if (phrase.length >= 8 && phrase.length <= 60) {
      keywords.push(phrase);
    }
  }

  return [...new Set(keywords)];
}

function countCompetitorsWithKeyword(
  keyword: string,
  competitorKeywordsMap: Map<string, Set<string>>
): number {
  let count = 0;
  for (const [, keywords] of competitorKeywordsMap) {
    if (keywords.has(keyword)) {
      count++;
    }
  }
  return count;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Format competitor analysis report
 */
export function formatCompetitorReport(result: CompetitorKeywordResult): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(70));
  lines.push('  COMPETITOR KEYWORD ANALYSIS');
  lines.push('═'.repeat(70));
  lines.push('');

  // Competitor overlap summary
  if (result.competitorOverlap.length > 0) {
    lines.push('📊 COMPETITOR OVERLAP');
    lines.push('─'.repeat(70));
    lines.push('  Domain                          Shared  Gaps  Your Wins');
    lines.push('  ' + '─'.repeat(60));

    for (const comp of result.competitorOverlap.slice(0, 5)) {
      const domain = comp.competitor.substring(0, 30).padEnd(32);
      const shared = String(comp.sharedKeywords).padStart(6);
      const gaps = String(comp.uniqueToThem).padStart(6);
      const wins = String(comp.uniqueToYou).padStart(8);
      lines.push(`  ${domain} ${shared} ${gaps} ${wins}`);
    }
    lines.push('');
  }

  // Missing keywords (opportunities)
  if (result.missingKeywords.length > 0) {
    lines.push('🔴 KEYWORD GAPS (Competitors Rank, You Don\'t)');
    lines.push('─'.repeat(70));
    lines.push('  These are high-priority opportunities - competitors have proven');
    lines.push('  these keywords work in your market.');
    lines.push('');

    for (const kw of result.missingKeywords.slice(0, 10)) {
      lines.push(`  • ${kw.keyword}`);
    }
    lines.push('');
  }

  // Core keywords
  if (result.coreKeywords.length > 0) {
    lines.push('🟢 CORE KEYWORDS (All Competitors Rank)');
    lines.push('─'.repeat(70));
    lines.push('  These keywords define your market. You should rank for these.');
    lines.push('');

    for (const kw of result.coreKeywords.slice(0, 10)) {
      lines.push(`  • ${kw.keyword}`);
    }
    lines.push('');
  }

  // Unique keywords
  if (result.uniqueKeywords.length > 0) {
    lines.push('🔵 YOUR UNIQUE KEYWORDS (Only You Rank)');
    lines.push('─'.repeat(70));
    lines.push('  Potential competitive advantages or niche opportunities.');
    lines.push('');

    for (const kw of result.uniqueKeywords.slice(0, 10)) {
      lines.push(`  • ${kw.keyword}`);
    }
    lines.push('');
  }

  // Summary stats
  lines.push('📈 SUMMARY');
  lines.push('─'.repeat(70));
  lines.push(`  Total Keywords Analyzed: ${result.keywordUniverse.length}`);
  lines.push(`  Core Keywords:          ${result.coreKeywords.length}`);
  lines.push(`  Keyword Gaps:           ${result.missingKeywords.length}`);
  lines.push(`  Your Unique Keywords:   ${result.uniqueKeywords.length}`);
  lines.push('');
  lines.push('═'.repeat(70));

  return lines.join('\n');
}
