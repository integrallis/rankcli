import type { AuditIssue } from './types.js';

/** Shape every paid-tier check function shares: (html, url) -> issues + check-specific data. */
export type PremiumCheckFn = (html: string, url: string) => { issues: AuditIssue[]; data: unknown };

/**
 * Injected by the caller when premium checks are actually available -
 * audit-worker (first-party server, imports @rankcli/agent-runtime-premium
 * directly) or the CLI (after a valid license decrypts the WASM-embedded
 * bundle). This package never imports an implementation, only this type -
 * see docs/GEO_COVERAGE.md or packaging.test.ts for why.
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
