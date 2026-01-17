// Google Search Console Integration (Free - Your Own Data)

import type { KeywordData, GSCQueryData } from '../types.js';

// Note: GSC API requires OAuth2 authentication
// This module provides the structure and helpers for GSC integration

export interface GSCCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface GSCQueryOptions {
  siteUrl: string;
  startDate: string;
  endDate: string;
  dimensions?: string[];
  rowLimit?: number;
  startRow?: number;
}

// Transform GSC data to our KeywordData format
export function transformGSCData(gscData: GSCQueryData[]): KeywordData[] {
  return gscData.map((row) => ({
    keyword: row.query,
    searchVolume: estimateVolumeFromImpressions(row.impressions),
    keywordDifficulty: estimateKdFromPosition(row.position),
    source: 'gsc' as const,
    currentRanking: row.position,
    impressions: row.impressions,
    clicks: row.clicks,
    ctr: row.ctr,
  }));
}

// Estimate search volume from impressions
// If you're ranking #1-3, impressions ≈ 60-90% of total volume
// If you're ranking #4-10, impressions ≈ 10-30% of total volume
function estimateVolumeFromImpressions(impressions: number): number {
  // Rough estimate: multiply by factor based on assumed position
  // This is a simplified calculation
  return Math.round(impressions * 1.5);
}

// Estimate KD from current ranking position
// If you're already ranking, KD is within your reach
function estimateKdFromPosition(position: number): number {
  if (position <= 3) return 5; // Already ranking well = easy for you
  if (position <= 10) return 15; // First page = achievable
  if (position <= 20) return 25; // Second page = moderate
  if (position <= 50) return 35; // You're in the game
  return 45; // Need more effort
}

// Find keywords with high impressions but low clicks (optimization opportunities)
export function findCTROpportunities(gscData: GSCQueryData[]): GSCQueryData[] {
  return gscData
    .filter((row) => {
      // High impressions, low CTR, good position
      return row.impressions > 100 && row.ctr < 0.03 && row.position <= 20;
    })
    .sort((a, b) => b.impressions - a.impressions);
}

// Find keywords where you're close to page 1
export function findAlmostPage1Keywords(gscData: GSCQueryData[]): GSCQueryData[] {
  return gscData
    .filter((row) => row.position > 10 && row.position <= 20 && row.impressions > 50)
    .sort((a, b) => a.position - b.position);
}

// Find your best performing keywords
export function findTopPerformers(gscData: GSCQueryData[]): GSCQueryData[] {
  return gscData
    .filter((row) => row.position <= 10 && row.clicks > 10)
    .sort((a, b) => b.clicks - a.clicks);
}

// Generate GSC API request body
export function buildGSCRequest(options: GSCQueryOptions): object {
  return {
    startDate: options.startDate,
    endDate: options.endDate,
    dimensions: options.dimensions || ['query'],
    rowLimit: options.rowLimit || 1000,
    startRow: options.startRow || 0,
  };
}

// Parse date range for last N days
export function getDateRange(days: number = 28): { startDate: string; endDate: string } {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() - 3); // GSC data is delayed by ~3 days

  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - days);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

// Example response structure for reference
export const GSC_EXAMPLE_RESPONSE = {
  rows: [
    {
      keys: ['mermaid animation'],
      clicks: 45,
      impressions: 1200,
      ctr: 0.0375,
      position: 4.2,
    },
    {
      keys: ['animate diagrams'],
      clicks: 12,
      impressions: 800,
      ctr: 0.015,
      position: 8.5,
    },
  ],
};
