// Rank Tracker - Manages keyword tracking and history

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  TrackedKeyword,
  RankingResult,
  RankHistory,
  KeywordTrend,
  RankCheckResult,
} from './types.js';
import { SerpClient, type SerpClientConfig } from './serp-client.js';

export interface TrackerConfig {
  supabase: SupabaseClient;
  serpConfig: SerpClientConfig;
}

export class RankTracker {
  private supabase: SupabaseClient;
  private serpClient: SerpClient;

  constructor(config: TrackerConfig) {
    this.supabase = config.supabase;
    this.serpClient = new SerpClient(config.serpConfig);
  }

  /**
   * Add keywords to track for a project
   */
  async addKeywords(
    projectId: string,
    keywords: string[],
    options?: {
      searchEngine?: 'google' | 'bing';
      country?: string;
      language?: string;
      trackUrl?: string;
    }
  ): Promise<TrackedKeyword[]> {
    const keywordRecords = keywords.map(keyword => ({
      project_id: projectId,
      keyword: keyword.toLowerCase().trim(),
      search_engine: options?.searchEngine || 'google',
      country: options?.country || 'US',
      language: options?.language || 'en',
      track_url: options?.trackUrl,
      is_active: true,
    }));

    const { data, error } = await this.supabase
      .from('keywords')
      .upsert(keywordRecords, {
        onConflict: 'project_id,keyword',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      throw new Error(`Failed to add keywords: ${error.message}`);
    }

    return (data || []).map(this.mapKeyword);
  }

  /**
   * Remove keywords from tracking
   */
  async removeKeywords(projectId: string, keywords: string[]): Promise<void> {
    const normalizedKeywords = keywords.map(k => k.toLowerCase().trim());

    const { error } = await this.supabase
      .from('keywords')
      .update({ is_active: false })
      .eq('project_id', projectId)
      .in('keyword', normalizedKeywords);

    if (error) {
      throw new Error(`Failed to remove keywords: ${error.message}`);
    }
  }

  /**
   * Get all tracked keywords for a project
   */
  async getKeywords(projectId: string, includeInactive = false): Promise<TrackedKeyword[]> {
    let query = this.supabase
      .from('keywords')
      .select('*')
      .eq('project_id', projectId);

    if (!includeInactive) {
      query = query.eq('is_active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get keywords: ${error.message}`);
    }

    return (data || []).map(this.mapKeyword);
  }

  /**
   * Check rankings for all active keywords in a project
   */
  async checkRankings(projectId: string, domain: string): Promise<RankingResult[]> {
    // Get active keywords
    const keywords = await this.getKeywords(projectId);
    
    if (keywords.length === 0) {
      return [];
    }

    // Group by search engine and country for efficiency
    const groups = this.groupKeywords(keywords);
    const results: RankingResult[] = [];

    for (const group of groups) {
      const checkResults = await this.serpClient.checkRank({
        keywords: group.keywords.map(k => k.keyword),
        domain,
        searchEngine: group.searchEngine,
        country: group.country,
        language: group.language,
      });

      // Process results
      for (const result of checkResults) {
        const keyword = group.keywords.find(k => k.keyword === result.keyword);
        if (!keyword) continue;

        // Save to database
        await this.saveRanking(keyword.id, result);

        results.push({
          keywordId: keyword.id,
          keyword: result.keyword,
          position: result.position,
          url: result.url,
          serpFeatures: result.serpFeatures,
          competitorUrls: result.topResults,
          checkedAt: result.checkedAt,
        });
      }
    }

    // Update project last check time
    await this.supabase
      .from('projects')
      .update({ last_rank_check_at: new Date().toISOString() })
      .eq('id', projectId);

    return results;
  }

  /**
   * Save a ranking result to the database
   */
  private async saveRanking(keywordId: string, result: RankCheckResult): Promise<void> {
    // Get current position to set as previous
    const { data: currentKeyword } = await this.supabase
      .from('keywords')
      .select('current_position, best_position')
      .eq('id', keywordId)
      .single();

    const previousPosition = currentKeyword?.current_position;
    const bestPosition = currentKeyword?.best_position;
    const newBestPosition = result.position !== null && 
      (bestPosition === null || result.position < bestPosition) 
      ? result.position 
      : bestPosition;

    // Update keyword with new position
    const { error: updateError } = await this.supabase
      .from('keywords')
      .update({
        previous_position: previousPosition,
        current_position: result.position,
        best_position: newBestPosition,
        last_checked: result.checkedAt.toISOString(),
      })
      .eq('id', keywordId);

    if (updateError) {
      console.error(`Failed to save ranking for ${result.keyword}:`, updateError);
    }
  }

  /**
   * Get ranking history for a keyword
   * Note: Full history requires keyword_ranking_history table with keyword_ranking_id
   * For now, returns current state as single history entry
   */
  async getHistory(keywordId: string, _days = 30): Promise<RankHistory[]> {
    const { data, error } = await this.supabase
      .from('keywords')
      .select('current_position, target_url, last_checked')
      .eq('id', keywordId)
      .single();

    if (error || !data) {
      return [];
    }

    // Return current position as single history entry
    return [{
      position: data.current_position,
      url: data.target_url,
      serpFeatures: [],
      recordedAt: data.last_checked ? new Date(data.last_checked) : new Date(),
    }];
  }

  /**
   * Get keyword trends for a project
   */
  async getTrends(projectId: string): Promise<KeywordTrend[]> {
    const { data, error } = await this.supabase
      .from('keyword_rank_trends')
      .select('*')
      .eq('project_id', projectId);

    if (error) {
      // View might not exist, fall back to manual calculation
      return this.calculateTrends(projectId);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (data || []).map((row: any) => ({
      keywordId: row.keyword_id,
      keyword: row.keyword,
      currentPosition: row.current_position,
      bestPosition: row.best_position,
      positionChange: row.position_change || 0,
      avgPosition: row.avg_position || 0,
      dataPoints: row.data_points || 0,
    }));
  }

  /**
   * Manual trend calculation fallback
   */
  private async calculateTrends(projectId: string): Promise<KeywordTrend[]> {
    const keywords = await this.getKeywords(projectId);
    const trends: KeywordTrend[] = [];

    for (const keyword of keywords) {
      const history = await this.getHistory(keyword.id, 30);
      
      if (history.length === 0) {
        trends.push({
          keywordId: keyword.id,
          keyword: keyword.keyword,
          currentPosition: keyword.currentPosition,
          bestPosition: keyword.bestPosition,
          positionChange: 0,
          avgPosition: keyword.currentPosition || 0,
          dataPoints: 0,
        });
        continue;
      }

      const positions = history
        .filter(h => h.position !== null)
        .map(h => h.position!);

      const avgPosition = positions.length > 0
        ? positions.reduce((a, b) => a + b, 0) / positions.length
        : 0;

      const positionChange = keyword.previousPosition && keyword.currentPosition
        ? keyword.previousPosition - keyword.currentPosition
        : 0;

      trends.push({
        keywordId: keyword.id,
        keyword: keyword.keyword,
        currentPosition: keyword.currentPosition,
        bestPosition: keyword.bestPosition,
        positionChange,
        avgPosition,
        dataPoints: history.length,
      });
    }

    return trends;
  }

  /**
   * Export ranking data as CSV
   */
  async exportCSV(projectId: string, days = 30): Promise<string> {
    const keywords = await this.getKeywords(projectId);
    const rows: string[] = ['Keyword,Current Position,Best Position,Last Checked,Trend'];

    for (const keyword of keywords) {
      const history = await this.getHistory(keyword.id, days);
      const trend = this.calculatePositionTrend(history);
      
      rows.push([
        `"${keyword.keyword}"`,
        keyword.currentPosition?.toString() || 'N/A',
        keyword.bestPosition?.toString() || 'N/A',
        keyword.lastChecked?.toISOString() || 'Never',
        trend,
      ].join(','));
    }

    return rows.join('\n');
  }

  /**
   * Calculate position trend from history
   */
  private calculatePositionTrend(history: RankHistory[]): string {
    if (history.length < 2) return '→';

    const recent = history[0]?.position;
    const older = history[history.length - 1]?.position;

    if (recent === null || older === null) return '→';
    if (recent < older) return '↑';
    if (recent > older) return '↓';
    return '→';
  }

  /**
   * Group keywords by search engine and country
   */
  private groupKeywords(keywords: TrackedKeyword[]): Array<{
    searchEngine: 'google' | 'bing';
    country: string;
    language: string;
    keywords: TrackedKeyword[];
  }> {
    const groups = new Map<string, TrackedKeyword[]>();

    for (const keyword of keywords) {
      const key = `${keyword.searchEngine}:${keyword.country}:${keyword.language}`;
      if (!groups.has(key)) {
        groups.set(key, []);
      }
      groups.get(key)!.push(keyword);
    }

    return Array.from(groups.entries()).map(([key, keywords]) => {
      const [searchEngine, country, language] = key.split(':');
      return {
        searchEngine: searchEngine as 'google' | 'bing',
        country,
        language,
        keywords,
      };
    });
  }

  /**
   * Map database row to TrackedKeyword
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private mapKeyword(row: any): TrackedKeyword {
    return {
      id: row.id as string,
      projectId: row.project_id as string,
      keyword: row.keyword as string,
      searchEngine: (row.search_engine as 'google' | 'bing') || 'google',
      country: (row.country as string) || 'US',
      language: (row.language as string) || 'en',
      currentPosition: row.current_position as number | null,
      previousPosition: row.previous_position as number | null,
      bestPosition: row.best_position as number | null,
      trackUrl: row.track_url as string | undefined,
      isActive: row.is_active as boolean,
      lastChecked: row.last_checked ? new Date(row.last_checked as string) : null,
      createdAt: new Date(row.created_at as string),
    };
  }
}
