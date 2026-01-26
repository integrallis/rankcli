/**
 * LLM Citation Checker
 *
 * Simplified interface for checking if a brand is mentioned/cited
 * by major LLM providers when asked recommendation queries.
 */

import {
  trackLLMVisibility,
  parseGEOResponse,
  type BrandConfig,
  type GEOResult,
  type LLMProvider,
  type TrackingOptions,
} from './geo-tracker.js';

export interface LLMCitationResult {
  provider: LLMProvider;
  providerName: string;
  mentioned: boolean;
  position: number | null;
  sentiment: 'positive' | 'neutral' | 'negative' | null;
  context: string | null;
  score: number;
  error?: string;
}

export interface CitationCheckOptions extends TrackingOptions {
  providers?: LLMProvider[];
  queries?: string[];
}

const PROVIDER_NAMES: Record<LLMProvider, string> = {
  openai: 'ChatGPT',
  anthropic: 'Claude',
  google: 'Gemini',
  perplexity: 'Perplexity',
};

const DEFAULT_PROVIDERS: LLMProvider[] = ['openai', 'anthropic', 'google', 'perplexity'];

/**
 * Generate recommendation queries for a brand
 */
export function generateRecommendationQueries(brand: string, industry?: string): string[] {
  const queries = [
    `What are the best ${brand.toLowerCase()} alternatives?`,
    `Can you recommend tools similar to ${brand}?`,
    `What do you think about ${brand}?`,
  ];

  if (industry) {
    queries.push(`What are the best ${industry} tools?`);
    queries.push(`Recommend a good ${industry} solution`);
  }

  return queries;
}

/**
 * Check if a brand is cited/mentioned across LLM providers
 */
export async function checkLLMCitations(
  brand: string,
  domain: string,
  options: CitationCheckOptions = {}
): Promise<LLMCitationResult[]> {
  const {
    providers = DEFAULT_PROVIDERS,
    queries = generateRecommendationQueries(brand),
    ...trackingOptions
  } = options;

  const brandConfig: BrandConfig = {
    brandName: brand,
    domains: [domain],
    alternativeNames: [brand.toLowerCase(), brand.toUpperCase()],
  };

  // Use the first query for the check
  const query = queries[0];

  const results = await trackLLMVisibility(
    {
      keyword: query,
      brand: brandConfig,
      providers,
    },
    trackingOptions
  );

  return results.map((result) => ({
    provider: result.provider,
    providerName: PROVIDER_NAMES[result.provider],
    mentioned: result.mentioned,
    position: result.position,
    sentiment: result.sentiment,
    context: result.contextSnippet || null,
    score: result.score,
    error: result.error,
  }));
}

/**
 * Calculate overall AI visibility score from citation results
 */
export function calculateAIVisibilityScore(results: LLMCitationResult[]): number {
  if (results.length === 0) return 0;

  const mentionedCount = results.filter((r) => r.mentioned && !r.error).length;
  const validResults = results.filter((r) => !r.error);

  if (validResults.length === 0) return 0;

  // Base score: 25 points per provider mention (out of 100 for 4 providers)
  let score = (mentionedCount / validResults.length) * 100;

  // Bonus for good positions (top 3)
  const topPositions = results.filter(
    (r) => r.mentioned && r.position !== null && r.position <= 3
  );
  if (topPositions.length > 0) {
    score = Math.min(100, score + 10);
  }

  // Bonus for positive sentiment
  const positiveResults = results.filter((r) => r.sentiment === 'positive');
  if (positiveResults.length > mentionedCount / 2) {
    score = Math.min(100, score + 5);
  }

  return Math.round(score);
}

/**
 * Get a summary of AI visibility across providers
 */
export function getAIVisibilitySummary(results: LLMCitationResult[]): {
  score: number;
  mentionedIn: string[];
  notMentionedIn: string[];
  bestPosition: number | null;
  overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null;
} {
  const score = calculateAIVisibilityScore(results);

  const mentionedIn = results
    .filter((r) => r.mentioned)
    .map((r) => r.providerName);

  const notMentionedIn = results
    .filter((r) => !r.mentioned && !r.error)
    .map((r) => r.providerName);

  const positions = results
    .filter((r) => r.position !== null)
    .map((r) => r.position as number);
  const bestPosition = positions.length > 0 ? Math.min(...positions) : null;

  // Calculate overall sentiment
  const sentiments = results
    .filter((r) => r.sentiment !== null)
    .map((r) => r.sentiment);

  let overallSentiment: 'positive' | 'neutral' | 'negative' | 'mixed' | null = null;
  if (sentiments.length > 0) {
    const positiveCount = sentiments.filter((s) => s === 'positive').length;
    const negativeCount = sentiments.filter((s) => s === 'negative').length;

    if (positiveCount > 0 && negativeCount > 0) {
      overallSentiment = 'mixed';
    } else if (positiveCount > negativeCount) {
      overallSentiment = 'positive';
    } else if (negativeCount > positiveCount) {
      overallSentiment = 'negative';
    } else {
      overallSentiment = 'neutral';
    }
  }

  return {
    score,
    mentionedIn,
    notMentionedIn,
    bestPosition,
    overallSentiment,
  };
}
