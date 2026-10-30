/**
 * The 21 checks that used to live in a private package, encrypted into the CLI's WASM
 * binary and decrypted with a passphrase that shipped in the same tarball. Every plan runs
 * every check, so they are ordinary checks now: `runFullAudit` runs them by default and
 * `premiumChecks` is exported for callers that want to run or replace them individually.
 */
import type { PremiumChecks } from './premium-checks.types.js';
import { analyzeFeaturedSnippet } from './checks/featured-snippet.js';
import { analyzeInternalLinkGraph } from './checks/internal-link-graph.js';
import { analyzeEEATSignals } from './checks/eeat-signals.js';
import { analyzeContentScience } from './checks/content-science.js';
import { analyzeKeywordCannibalizationSinglePage } from './checks/keyword-cannibalization.js';
import { analyzeConversionElements } from './checks/conversion-elements.js';
import { analyzeKeywordPlacement } from './checks/keyword-placement.js';
import { analyzeTopicalClusters } from './checks/topical-clusters.js';
import { analyzePlatformPresence } from './checks/platform-presence.js';
import { analyzeInteractiveTools } from './checks/interactive-tools.js';
import { analyzeFunnelIntent } from './checks/funnel-intent.js';
import { analyzeNavBoostSignals } from './checks/navboost-signals.js';
import { analyzeEntitySEO } from './checks/entity-seo.js';
import { analyzeFreshnessSignals } from './checks/freshness-signals.js';
import { analyzeAIContentStructure } from './checks/ai-content-structure.js';
import { analyzeRAGChunkReadiness } from './checks/rag-chunk-readiness.js';
import { analyzeCitationQuality } from './checks/citation-quality.js';
import { analyzeAnswerConciseness } from './checks/answer-conciseness.js';
import { analyzeBrandMentionOptimization } from './checks/brand-mention-optimization.js';
import { analyzeAICitationWorthiness } from './checks/ai-citation-worthiness.js';
import { analyzeReviewEcosystem } from './checks/review-ecosystem.js';

export {
  analyzeFeaturedSnippet,
  analyzeInternalLinkGraph,
  analyzeEEATSignals,
  analyzeContentScience,
  analyzeKeywordCannibalizationSinglePage,
  analyzeConversionElements,
  analyzeKeywordPlacement,
  analyzeTopicalClusters,
  analyzePlatformPresence,
  analyzeInteractiveTools,
  analyzeFunnelIntent,
  analyzeNavBoostSignals,
  analyzeEntitySEO,
  analyzeFreshnessSignals,
  analyzeAIContentStructure,
  analyzeRAGChunkReadiness,
  analyzeCitationQuality,
  analyzeAnswerConciseness,
  analyzeBrandMentionOptimization,
  analyzeAICitationWorthiness,
  analyzeReviewEcosystem,
};

/** What `runFullAudit` runs when no `premiumChecks` option is given. */
export const premiumChecks: PremiumChecks = {
  analyzeFeaturedSnippet,
  analyzeInternalLinkGraph,
  analyzeEEATSignals,
  analyzeContentScience,
  analyzeKeywordCannibalizationSinglePage,
  analyzeConversionElements,
  analyzeKeywordPlacement,
  analyzeTopicalClusters,
  analyzePlatformPresence,
  analyzeInteractiveTools,
  analyzeFunnelIntent,
  analyzeNavBoostSignals,
  analyzeEntitySEO,
  analyzeFreshnessSignals,
  analyzeAIContentStructure,
  analyzeRAGChunkReadiness,
  analyzeCitationQuality,
  analyzeAnswerConciseness,
  analyzeBrandMentionOptimization,
  analyzeAICitationWorthiness,
  analyzeReviewEcosystem,
};
