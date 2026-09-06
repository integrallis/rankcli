/**
 * GEO (Generative Engine Optimization) Tracker
 *
 * Tracks brand visibility in LLM responses to understand how AI models
 * recommend or mention your brand for relevant queries.
 */

import { GOOGLE_ENDPOINT, OPENAI_FLAGSHIP } from '../models.js';

export type MentionType = 'brand' | 'domain' | 'alternative';
export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'perplexity';
export type Sentiment = 'positive' | 'negative' | 'neutral';

export interface BrandConfig {
  brandName: string;
  domains: string[];
  alternativeNames?: string[];
}

export interface Mention {
  type: MentionType;
  text: string;
  position: number;
  context: string;
}

export interface GEOQuery {
  keyword: string;
  brand: BrandConfig;
  providers: LLMProvider[];
}

export interface GEOResult {
  provider: LLMProvider;
  keyword: string;
  mentioned: boolean;
  position: number | null;
  sentiment: Sentiment | null;
  score: number;
  timestamp: string;
  contextSnippet?: string;
  error?: string;
}

export interface ParsedResponse {
  mentioned: boolean;
  position: number | null;
  sentiment: Sentiment | null;
  contextSnippet: string | null;
}

export interface TrackingOptions {
  fetch?: typeof fetch;
}

/**
 * Detects brand mentions in text
 */
export function detectMentions(text: string, config: BrandConfig): Mention[] {
  const mentions: Mention[] = [];
  const lowerText = text.toLowerCase();

  // Track found positions to avoid duplicates
  const foundPositions = new Set<number>();

  // Check for exact brand name (case-insensitive)
  const brandLower = config.brandName.toLowerCase();
  let searchIndex = 0;
  while (true) {
    const idx = lowerText.indexOf(brandLower, searchIndex);
    if (idx === -1) break;

    if (!foundPositions.has(idx)) {
      foundPositions.add(idx);
      const position = calculatePosition(text, idx);
      mentions.push({
        type: 'brand',
        text: text.substring(idx, idx + config.brandName.length),
        position,
        context: extractContext(text, idx),
      });
    }
    searchIndex = idx + 1;
  }

  // Check for domain mentions
  for (const domain of config.domains) {
    const domainLower = domain.toLowerCase();
    searchIndex = 0;
    while (true) {
      const idx = lowerText.indexOf(domainLower, searchIndex);
      if (idx === -1) break;

      if (!foundPositions.has(idx)) {
        foundPositions.add(idx);
        const position = calculatePosition(text, idx);
        mentions.push({
          type: 'domain',
          text: text.substring(idx, idx + domain.length),
          position,
          context: extractContext(text, idx),
        });
      }
      searchIndex = idx + 1;
    }
  }

  // Check for alternative names
  if (config.alternativeNames) {
    for (const altName of config.alternativeNames) {
      const altLower = altName.toLowerCase();
      searchIndex = 0;
      while (true) {
        const idx = lowerText.indexOf(altLower, searchIndex);
        if (idx === -1) break;

        if (!foundPositions.has(idx)) {
          foundPositions.add(idx);
          const position = calculatePosition(text, idx);
          mentions.push({
            type: 'alternative',
            text: text.substring(idx, idx + altName.length),
            position,
            context: extractContext(text, idx),
          });
        }
        searchIndex = idx + 1;
      }
    }
  }

  // Sort by position in text
  mentions.sort((a, b) => a.position - b.position);

  return mentions;
}

/**
 * Calculate position (1-indexed) based on list context or sentence order
 */
function calculatePosition(text: string, charIndex: number): number {
  // Check if we're in a numbered list
  const beforeText = text.substring(0, charIndex);
  const lines = beforeText.split('\n');
  const currentLineStart = beforeText.lastIndexOf('\n') + 1;
  const currentLine = text.substring(currentLineStart).split('\n')[0];

  // Check for numbered list pattern (e.g., "1.", "2.", etc.)
  const listMatch = currentLine.match(/^(\d+)\./);
  if (listMatch) {
    return parseInt(listMatch[1], 10);
  }

  // Count sentences/items before this mention
  const sentences = beforeText.split(/[.!?]\s+/);
  return Math.max(1, sentences.length);
}

/**
 * Extract surrounding context for a mention
 */
function extractContext(text: string, charIndex: number): string {
  const contextRadius = 100;
  const start = Math.max(0, charIndex - contextRadius);
  const end = Math.min(text.length, charIndex + contextRadius);
  return text.substring(start, end).trim();
}

/**
 * Score a mention based on position, type, and context
 */
export function scoreMention(mention: Mention | null): number {
  if (!mention) return 0;

  let score = 0;

  // Position scoring (first position = highest score)
  // Position 1 = 50 points, position 2 = 40, position 3 = 30, etc.
  score += Math.max(0, 60 - mention.position * 10);

  // Type scoring
  if (mention.type === 'brand') {
    score += 30;
  } else if (mention.type === 'alternative') {
    score += 20;
  } else if (mention.type === 'domain') {
    score += 15;
  }

  // Context scoring - boost for recommendation language
  const recommendWords = ['recommend', 'best', 'excellent', 'great', 'suggest', 'top choice', 'top pick'];
  const contextLower = mention.context.toLowerCase();
  for (const word of recommendWords) {
    // Use word boundary matching to avoid false positives (e.g., "top" in "Autopilot")
    const wordRegex = new RegExp(`\\b${word}\\b`, 'i');
    if (wordRegex.test(contextLower)) {
      score += 10;
      break;
    }
  }

  return score;
}

/**
 * Parse an LLM response to extract mention details
 */
export function parseGEOResponse(
  response: string,
  config: BrandConfig
): ParsedResponse {
  const mentions = detectMentions(response, config);

  if (mentions.length === 0) {
    return {
      mentioned: false,
      position: null,
      sentiment: null,
      contextSnippet: null,
    };
  }

  // Get the first (most prominent) mention
  const primaryMention = mentions[0];

  // Determine sentiment from context
  const sentiment = analyzeSentiment(primaryMention.context);

  // Extract context snippet (max 200 chars)
  let contextSnippet = primaryMention.context;
  if (contextSnippet.length > 200) {
    contextSnippet = contextSnippet.substring(0, 197) + '...';
  }

  return {
    mentioned: true,
    position: primaryMention.position,
    sentiment,
    contextSnippet,
  };
}

/**
 * Simple sentiment analysis based on keyword matching
 */
function analyzeSentiment(text: string): Sentiment {
  const lowerText = text.toLowerCase();

  const positiveWords = [
    'excellent',
    'great',
    'best',
    'recommend',
    'top',
    'amazing',
    'fantastic',
    'highly',
    'love',
    'perfect',
    'outstanding',
  ];

  const negativeWords = [
    'limitation',
    'limitations',
    'limited',
    'not suitable',
    'not be suitable',
    'may not',
    'poor',
    'bad',
    'avoid',
    'issue',
    'problem',
    'difficult',
    'complicated',
    'expensive',
    'lack',
    'lacking',
    'drawback',
    'downside',
  ];

  let positiveScore = 0;
  let negativeScore = 0;

  for (const word of positiveWords) {
    if (lowerText.includes(word)) positiveScore++;
  }

  for (const word of negativeWords) {
    if (lowerText.includes(word)) negativeScore++;
  }

  if (positiveScore > negativeScore) return 'positive';
  if (negativeScore > positiveScore) return 'negative';
  return 'neutral';
}

/**
 * Get the API endpoint for a provider
 */
function getProviderEndpoint(provider: LLMProvider): string {
  switch (provider) {
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
    case 'google':
      return GOOGLE_ENDPOINT;
    case 'perplexity':
      return 'https://api.perplexity.ai/chat/completions';
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

/**
 * Query a single LLM provider
 */
async function queryProvider(
  provider: LLMProvider,
  keyword: string,
  fetchFn: typeof fetch
): Promise<string> {
  const endpoint = getProviderEndpoint(provider);

  const response = await fetchFn(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: provider === 'openai' ? OPENAI_FLAGSHIP : undefined,
      messages: [
        {
          role: 'user',
          content: keyword,
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data = await response.json();

  // Handle OpenAI/Perplexity response format
  if (data.choices && data.choices[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  // Handle Anthropic response format
  if (data.content && data.content[0]?.text) {
    return data.content[0].text;
  }

  // Handle Google response format
  if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) {
    return data.candidates[0].content.parts[0].text;
  }

  throw new Error('Unexpected response format');
}

/**
 * Track LLM visibility for a brand across multiple providers
 */
export async function trackLLMVisibility(
  query: GEOQuery,
  options: TrackingOptions = {}
): Promise<GEOResult[]> {
  const fetchFn = options.fetch || fetch;
  const timestamp = new Date().toISOString();

  // Query all providers in parallel
  const results = await Promise.all(
    query.providers.map(async (provider): Promise<GEOResult> => {
      try {
        const response = await queryProvider(provider, query.keyword, fetchFn);
        const parsed = parseGEOResponse(response, query.brand);
        const mentions = detectMentions(response, query.brand);
        const score = mentions.length > 0 ? scoreMention(mentions[0]) : 0;

        return {
          provider,
          keyword: query.keyword,
          mentioned: parsed.mentioned,
          position: parsed.position,
          sentiment: parsed.sentiment,
          score,
          timestamp,
          contextSnippet: parsed.contextSnippet || undefined,
        };
      } catch (error) {
        return {
          provider,
          keyword: query.keyword,
          mentioned: false,
          position: null,
          sentiment: null,
          score: 0,
          timestamp,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    })
  );

  return results;
}
