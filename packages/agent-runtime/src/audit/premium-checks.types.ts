import type { AuditIssue } from './types.js';

/** Shape these checks share: (html, url) -> issues + check-specific data. */
export type PremiumCheckFn = (html: string, url: string) => { issues: AuditIssue[]; data: unknown };

/**
 * The checks `runFullAudit` runs through its `premiumChecks` option. The default is the
 * built-in set in premium-checks.ts; a caller can pass its own to replace or stub them.
 */
export interface PremiumChecks {
  analyzeFeaturedSnippet: PremiumCheckFn;
  analyzeInternalLinkGraph: PremiumCheckFn;
  analyzeEEATSignals: PremiumCheckFn;
  analyzeContentScience: PremiumCheckFn;
  analyzeKeywordCannibalizationSinglePage: PremiumCheckFn;
  analyzeConversionElements: PremiumCheckFn;
  analyzeKeywordPlacement: PremiumCheckFn;
  analyzeTopicalClusters: PremiumCheckFn;
  analyzePlatformPresence: PremiumCheckFn;
  analyzeInteractiveTools: PremiumCheckFn;
  analyzeFunnelIntent: PremiumCheckFn;
  analyzeNavBoostSignals: PremiumCheckFn;
  analyzeEntitySEO: PremiumCheckFn;
  analyzeFreshnessSignals: PremiumCheckFn;
  analyzeAIContentStructure: PremiumCheckFn;
  analyzeRAGChunkReadiness: PremiumCheckFn;
  analyzeCitationQuality: PremiumCheckFn;
  analyzeAnswerConciseness: PremiumCheckFn;
  analyzeBrandMentionOptimization: PremiumCheckFn;
  analyzeAICitationWorthiness: PremiumCheckFn;
  analyzeReviewEcosystem: PremiumCheckFn;
}
