// Rank Tracking Types

export interface TrackedKeyword {
  id: string;
  projectId: string;
  keyword: string;
  searchEngine: 'google' | 'bing' | 'duckduckgo';
  country: string;
  language: string;
  currentPosition: number | null;
  previousPosition: number | null;
  bestPosition: number | null;
  trackUrl?: string; // Specific URL to track
  isActive: boolean;
  lastChecked: Date | null;
  createdAt: Date;
}

export interface RankingResult {
  keywordId: string;
  keyword: string;
  position: number | null; // null = not in top 100
  url: string | null;
  serpFeatures: SerpFeature[];
  competitorUrls: CompetitorUrl[];
  checkedAt: Date;
}

export interface SerpFeature {
  type: 'featured_snippet' | 'people_also_ask' | 'local_pack' | 'knowledge_panel' | 
        'image_pack' | 'video_carousel' | 'top_stories' | 'shopping_results' | 
        'site_links' | 'faq_rich_result';
  position?: number; // Position where feature appears
  hasOwnSite?: boolean; // Whether your site is in this feature
}

export interface CompetitorUrl {
  position: number;
  url: string;
  domain: string;
  title?: string;
}

export interface RankHistory {
  position: number | null;
  url: string | null;
  serpFeatures: SerpFeature[];
  recordedAt: Date;
}

export interface KeywordTrend {
  keywordId: string;
  keyword: string;
  currentPosition: number | null;
  bestPosition: number | null;
  positionChange: number; // Positive = improved, negative = dropped
  avgPosition: number;
  dataPoints: number;
}

export interface SerpApiConfig {
  provider: 'valueserp' | 'serpapi' | 'scraper';
  apiKey?: string;
  rateLimit?: number; // Queries per minute
}

export interface RankCheckOptions {
  keywords: string[];
  domain: string;
  searchEngine?: 'google' | 'bing';
  country?: string;
  language?: string;
  device?: 'desktop' | 'mobile';
}

export interface RankCheckResult {
  keyword: string;
  position: number | null;
  url: string | null;
  serpFeatures: SerpFeature[];
  topResults: CompetitorUrl[];
  checkedAt: Date;
}

// Tier-based limits
export interface RankingTierLimits {
  maxKeywords: number;
  checksPerDay: number;
  serpFeatures: boolean;
  competitorTracking: boolean;
  historyDays: number;
}

export const TIER_LIMITS: Record<string, RankingTierLimits> = {
  free: {
    maxKeywords: 10,
    checksPerDay: 1,
    serpFeatures: false,
    competitorTracking: false,
    historyDays: 7,
  },
  solo: {
    maxKeywords: 100,
    checksPerDay: 1,
    serpFeatures: true,
    competitorTracking: false,
    historyDays: 30,
  },
  pro: {
    maxKeywords: 500,
    checksPerDay: 2,
    serpFeatures: true,
    competitorTracking: true,
    historyDays: 90,
  },
  agency: {
    maxKeywords: 2000,
    checksPerDay: 4,
    serpFeatures: true,
    competitorTracking: true,
    historyDays: 365,
  },
};
