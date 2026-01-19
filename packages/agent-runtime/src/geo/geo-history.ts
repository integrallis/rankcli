/**
 * GEO History Module
 *
 * Tracks LLM visibility over time, detects changes, generates reports,
 * and compares against competitors.
 */

import { GEOResult, LLMProvider, Sentiment } from './geo-tracker.js';

export type GEOAlertType =
  | 'new_mention'
  | 'lost_mention'
  | 'position_improved'
  | 'position_dropped'
  | 'sentiment_changed'
  | 'score_improved'
  | 'score_dropped';

export type TrendDirection = 'improving' | 'declining' | 'stable' | 'unknown';

export interface GEOHistory {
  brandName?: string;
  results: GEOResult[];
  maxResults?: number;
}

export interface GEOHistoryOptions {
  brandName?: string;
  maxResults?: number;
}

export interface GEOTrend {
  direction: TrendDirection;
  averageScore: number;
  mentionRate: number;
  dataPoints: number;
  firstScore?: number;
  lastScore?: number;
}

export interface GEOAlert {
  type: GEOAlertType;
  message: string;
  provider: LLMProvider;
  keyword: string;
  previousValue?: any;
  currentValue?: any;
  timestamp: string;
}

export interface GEOReport {
  brandName?: string;
  totalQueries: number;
  mentionRate: number;
  averageScore: number;
  byProvider: Record<string, ProviderStats>;
  byKeyword: Record<string, KeywordStats>;
  generatedAt: string;
}

export interface ProviderStats {
  queries: number;
  mentions: number;
  mentionRate: number;
  averageScore: number;
  averagePosition: number | null;
}

export interface KeywordStats {
  queries: number;
  mentions: number;
  mentionRate: number;
  averageScore: number;
}

export interface CompetitorComparison {
  brand: string;
  competitor: string;
  brandMentionRate: number;
  competitorMentionRate: number;
  brandAverageScore: number;
  competitorAverageScore: number;
  brandAveragePosition: number | null;
  competitorAveragePosition: number | null;
  winner: string;
}

/**
 * Create a new GEO history instance
 */
export function createGEOHistory(options: GEOHistoryOptions = {}): GEOHistory {
  return {
    brandName: options.brandName,
    results: [],
    maxResults: options.maxResults,
  };
}

/**
 * Add a tracking result to history
 */
export function addTrackingResult(
  history: GEOHistory,
  result: GEOResult
): GEOHistory {
  const newResults = [...history.results, result];

  // Sort by timestamp
  newResults.sort((a, b) =>
    new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  );

  // Limit size if maxResults is set
  let finalResults = newResults;
  if (history.maxResults && newResults.length > history.maxResults) {
    // Keep most recent results
    finalResults = newResults.slice(-history.maxResults);
  }

  return {
    ...history,
    results: finalResults,
  };
}

/**
 * Get visibility trend for a specific provider and keyword
 */
export function getVisibilityTrend(
  history: GEOHistory,
  provider: LLMProvider,
  keyword: string
): GEOTrend {
  const filtered = history.results.filter(
    r => r.provider === provider && r.keyword === keyword
  );

  if (filtered.length === 0) {
    return {
      direction: 'unknown',
      averageScore: 0,
      mentionRate: 0,
      dataPoints: 0,
    };
  }

  const scores = filtered.map(r => r.score);
  const mentions = filtered.filter(r => r.mentioned).length;
  const averageScore = scores.reduce((a, b) => a + b, 0) / scores.length;
  const mentionRate = (mentions / filtered.length) * 100;

  // Calculate trend direction based on score progression
  const direction = calculateTrendDirection(scores);

  return {
    direction,
    averageScore,
    mentionRate,
    dataPoints: filtered.length,
    firstScore: scores[0],
    lastScore: scores[scores.length - 1],
  };
}

/**
 * Calculate trend direction from scores
 */
function calculateTrendDirection(scores: number[]): TrendDirection {
  if (scores.length < 2) {
    return 'unknown';
  }

  // Compare first half average to second half average
  const mid = Math.floor(scores.length / 2);
  const firstHalf = scores.slice(0, mid);
  const secondHalf = scores.slice(mid);

  const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
  const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;

  const diff = secondAvg - firstAvg;
  const threshold = 10; // 10 point change threshold

  if (diff > threshold) {
    return 'improving';
  } else if (diff < -threshold) {
    return 'declining';
  }
  return 'stable';
}

/**
 * Detect visibility changes between history and new result
 */
export function detectVisibilityChanges(
  history: GEOHistory,
  newResult: GEOResult
): GEOAlert[] {
  const alerts: GEOAlert[] = [];

  // Get recent results for same provider/keyword
  const recentResults = history.results.filter(
    r => r.provider === newResult.provider && r.keyword === newResult.keyword
  );

  if (recentResults.length === 0) {
    return alerts;
  }

  const lastResult = recentResults[recentResults.length - 1];

  // Check for new mention
  if (!lastResult.mentioned && newResult.mentioned) {
    alerts.push({
      type: 'new_mention',
      message: `${newResult.provider} now mentions your brand for "${newResult.keyword}"`,
      provider: newResult.provider,
      keyword: newResult.keyword,
      previousValue: false,
      currentValue: true,
      timestamp: newResult.timestamp,
    });
  }

  // Check for lost mention
  if (lastResult.mentioned && !newResult.mentioned) {
    alerts.push({
      type: 'lost_mention',
      message: `${newResult.provider} no longer mentions your brand for "${newResult.keyword}"`,
      provider: newResult.provider,
      keyword: newResult.keyword,
      previousValue: true,
      currentValue: false,
      timestamp: newResult.timestamp,
    });
  }

  // Check for position changes (only if both mentioned)
  if (lastResult.mentioned && newResult.mentioned &&
      lastResult.position !== null && newResult.position !== null) {
    const positionDiff = lastResult.position - newResult.position;

    if (positionDiff >= 2) {
      alerts.push({
        type: 'position_improved',
        message: `Position improved from ${lastResult.position} to ${newResult.position} on ${newResult.provider}`,
        provider: newResult.provider,
        keyword: newResult.keyword,
        previousValue: lastResult.position,
        currentValue: newResult.position,
        timestamp: newResult.timestamp,
      });
    } else if (positionDiff <= -2) {
      alerts.push({
        type: 'position_dropped',
        message: `Position dropped from ${lastResult.position} to ${newResult.position} on ${newResult.provider}`,
        provider: newResult.provider,
        keyword: newResult.keyword,
        previousValue: lastResult.position,
        currentValue: newResult.position,
        timestamp: newResult.timestamp,
      });
    }
  }

  // Check for sentiment changes
  if (lastResult.sentiment && newResult.sentiment &&
      lastResult.sentiment !== newResult.sentiment) {
    alerts.push({
      type: 'sentiment_changed',
      message: `Sentiment changed from ${lastResult.sentiment} to ${newResult.sentiment} on ${newResult.provider}`,
      provider: newResult.provider,
      keyword: newResult.keyword,
      previousValue: lastResult.sentiment,
      currentValue: newResult.sentiment,
      timestamp: newResult.timestamp,
    });
  }

  return alerts;
}

/**
 * Generate a summary report from history
 */
export function generateGEOReport(history: GEOHistory): GEOReport {
  const results = history.results;

  if (results.length === 0) {
    return {
      brandName: history.brandName,
      totalQueries: 0,
      mentionRate: 0,
      averageScore: 0,
      byProvider: {},
      byKeyword: {},
      generatedAt: new Date().toISOString(),
    };
  }

  // Calculate overall stats
  const mentions = results.filter(r => r.mentioned).length;
  const mentionRate = (mentions / results.length) * 100;
  const averageScore = results.reduce((a, b) => a + b.score, 0) / results.length;

  // Group by provider
  const byProvider: Record<string, ProviderStats> = {};
  const providerGroups = groupBy(results, r => r.provider);

  for (const [provider, providerResults] of Object.entries(providerGroups)) {
    const providerMentions = providerResults.filter(r => r.mentioned).length;
    const positions = providerResults
      .filter(r => r.position !== null)
      .map(r => r.position as number);

    byProvider[provider] = {
      queries: providerResults.length,
      mentions: providerMentions,
      mentionRate: (providerMentions / providerResults.length) * 100,
      averageScore: providerResults.reduce((a, b) => a + b.score, 0) / providerResults.length,
      averagePosition: positions.length > 0
        ? positions.reduce((a, b) => a + b, 0) / positions.length
        : null,
    };
  }

  // Group by keyword
  const byKeyword: Record<string, KeywordStats> = {};
  const keywordGroups = groupBy(results, r => r.keyword);

  for (const [keyword, keywordResults] of Object.entries(keywordGroups)) {
    const keywordMentions = keywordResults.filter(r => r.mentioned).length;

    byKeyword[keyword] = {
      queries: keywordResults.length,
      mentions: keywordMentions,
      mentionRate: (keywordMentions / keywordResults.length) * 100,
      averageScore: keywordResults.reduce((a, b) => a + b.score, 0) / keywordResults.length,
    };
  }

  return {
    brandName: history.brandName,
    totalQueries: results.length,
    mentionRate,
    averageScore,
    byProvider,
    byKeyword,
    generatedAt: new Date().toISOString(),
  };
}

/**
 * Compare brand visibility against a competitor
 */
export function compareCompetitorVisibility(
  brandHistory: GEOHistory,
  competitorName: string,
  competitorResults: GEOResult[]
): CompetitorComparison {
  const brandResults = brandHistory.results;

  // Brand stats
  const brandMentions = brandResults.filter(r => r.mentioned).length;
  const brandMentionRate = brandResults.length > 0
    ? (brandMentions / brandResults.length) * 100
    : 0;
  const brandAvgScore = brandResults.length > 0
    ? brandResults.reduce((a, b) => a + b.score, 0) / brandResults.length
    : 0;
  const brandPositions = brandResults
    .filter(r => r.position !== null)
    .map(r => r.position as number);
  const brandAvgPosition = brandPositions.length > 0
    ? brandPositions.reduce((a, b) => a + b, 0) / brandPositions.length
    : null;

  // Competitor stats
  const compMentions = competitorResults.filter(r => r.mentioned).length;
  const compMentionRate = competitorResults.length > 0
    ? (compMentions / competitorResults.length) * 100
    : 0;
  const compAvgScore = competitorResults.length > 0
    ? competitorResults.reduce((a, b) => a + b.score, 0) / competitorResults.length
    : 0;
  const compPositions = competitorResults
    .filter(r => r.position !== null)
    .map(r => r.position as number);
  const compAvgPosition = compPositions.length > 0
    ? compPositions.reduce((a, b) => a + b, 0) / compPositions.length
    : null;

  // Determine winner
  let winner = brandHistory.brandName || 'Brand';
  if (compMentionRate > brandMentionRate) {
    winner = competitorName;
  } else if (compMentionRate === brandMentionRate) {
    // Tie-breaker: average position (lower is better)
    if (compAvgPosition !== null && brandAvgPosition !== null) {
      if (compAvgPosition < brandAvgPosition) {
        winner = competitorName;
      }
    } else if (compAvgScore > brandAvgScore) {
      winner = competitorName;
    }
  }

  return {
    brand: brandHistory.brandName || 'Brand',
    competitor: competitorName,
    brandMentionRate,
    competitorMentionRate: compMentionRate,
    brandAverageScore: brandAvgScore,
    competitorAverageScore: compAvgScore,
    brandAveragePosition: brandAvgPosition,
    competitorAveragePosition: compAvgPosition,
    winner,
  };
}

/**
 * Helper: Group array by key
 */
function groupBy<T>(array: T[], keyFn: (item: T) => string): Record<string, T[]> {
  return array.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}
