/**
 * WASM Adapter
 *
 * This file creates the global RankCLI object that the WASM wrapper expects.
 * It adapts the async runFullAudit to a sync-compatible interface for VM execution.
 *
 * When this code is embedded in WASM and executed in a Node.js VM:
 * - The VM has limited async capabilities
 * - We provide a sync interface that queues work for the host
 */

import * as cheerio from 'cheerio';
import { analyzeOnPage } from './audit/checks/on-page.js';
import { analyzeStructuredData } from './audit/checks/structured-data.js';
import { analyzeMobile } from './audit/checks/mobile.js';
import { analyzeSocialMeta } from './audit/checks/social-meta.js';
import { analyzeSERPPreview } from './audit/checks/serp-preview.js';
import { analyzeDOMStructure } from './audit/checks/dom-analysis.js';
import { detectTechnologies } from './audit/checks/tech-detection.js';
import { analyzeKeywords } from './audit/checks/keyword-analysis.js';
import { analyzeDomSize } from './audit/checks/dom-size.js';
import { analyzeImageDimensions } from './audit/checks/image-dimensions.js';
import { analyzeUrlSafety } from './audit/checks/url-safety.js';
import { detectSoft404 } from './audit/checks/soft-404.js';
import { analyzePagination } from './audit/checks/pagination.js';
// Extended checks
import { analyzeAnchorText } from './audit/checks/anchor-text.js';
import { analyzeLocalSEO } from './audit/checks/local-seo.js';
import { analyzeModernImages } from './audit/checks/modern-images.js';
import { analyzeResourceHints } from './audit/checks/resource-hints.js';
import { analyzeTrackerBloat } from './audit/checks/tracker-bloat.js';
import { analyzeClientRendering } from './audit/checks/client-rendering.js';
import { analyzeResponsiveImages } from './audit/checks/responsive-images.js';
import { analyzeColorContrast } from './audit/checks/color-contrast.js';
import { analyzePageResources } from './audit/checks/page-resources.js';
// Premium checks - the whole point of this file is to bundle these for
// AES-256 encryption (build.rs) and embedding in the CLI's WASM binary.
// Sourced from the private, never-published premium package - see
// packages/agent-runtime-premium/package.json.
import {
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
} from '@rankcli/agent-runtime-premium';
import type { AuditIssue } from './audit/types.js';

interface SyncAuditResult {
  success: boolean;
  score: number;
  issues: AuditIssue[];
  checksRun: number;
  tier: string;
}

/**
 * Synchronous audit function for VM execution
 * Only runs checks that don't require network requests
 */
function runSyncAudit(url: string, html: string, checksLimit: number): SyncAuditResult {
  const allIssues: AuditIssue[] = [];
  const headers: Record<string, string> = {};

  // Determine tier
  const tier = checksLimit > 100 ? 'paid' : checksLimit > 50 ? 'registered' : 'free';
  const runExtended = checksLimit > 50;
  const runPremium = checksLimit > 100;

  // ===== CORE CHECKS (all tiers) =====
  try {
    const onPage = analyzeOnPage(html, url);
    allIssues.push(...onPage.issues);
  } catch (e) { /* ignore */ }

  try {
    const structured = analyzeStructuredData(html, url);
    allIssues.push(...structured.issues);
  } catch (e) { /* ignore */ }

  try {
    const mobile = analyzeMobile(html, url);
    allIssues.push(...mobile.issues);
  } catch (e) { /* ignore */ }

  try {
    const social = analyzeSocialMeta(html, url);
    allIssues.push(...social.issues);
  } catch (e) { /* ignore */ }

  try {
    const serp = analyzeSERPPreview(html, url);
    allIssues.push(...serp.issues);
  } catch (e) { /* ignore */ }

  try {
    const dom = analyzeDOMStructure(html, url);
    allIssues.push(...dom.issues);
  } catch (e) { /* ignore */ }

  try {
    const tech = detectTechnologies(html, url, headers);
    allIssues.push(...tech.issues);
  } catch (e) { /* ignore */ }

  try {
    const keywords = analyzeKeywords(html, url);
    allIssues.push(...keywords.issues);
  } catch (e) { /* ignore */ }

  try {
    const domSize = analyzeDomSize(html, url);
    allIssues.push(...domSize.issues);
  } catch (e) { /* ignore */ }

  try {
    const imageDims = analyzeImageDimensions(html, url);
    allIssues.push(...imageDims.issues);
  } catch (e) { /* ignore */ }

  try {
    const urlSafety = analyzeUrlSafety(url);
    allIssues.push(...urlSafety.issues);
  } catch (e) { /* ignore */ }

  try {
    const soft404 = detectSoft404(html, url, 200);
    allIssues.push(...soft404.issues);
  } catch (e) { /* ignore */ }

  let coreChecks = 12;

  // ===== EXTENDED CHECKS (registered + paid) =====
  if (runExtended) {
    try {
      const anchor = analyzeAnchorText(html, url);
      allIssues.push(...anchor.issues);
    } catch (e) { /* ignore */ }

    try {
      const local = analyzeLocalSEO(html, url);
      allIssues.push(...local.issues);
    } catch (e) { /* ignore */ }

    try {
      const modern = analyzeModernImages(html, url);
      allIssues.push(...modern.issues);
    } catch (e) { /* ignore */ }

    try {
      const hints = analyzeResourceHints(html, url);
      allIssues.push(...hints.issues);
    } catch (e) { /* ignore */ }

    try {
      const tracker = analyzeTrackerBloat(html, url);
      allIssues.push(...tracker.issues);
    } catch (e) { /* ignore */ }

    try {
      const csr = analyzeClientRendering(html, url);
      allIssues.push(...csr.issues);
    } catch (e) { /* ignore */ }

    try {
      const responsive = analyzeResponsiveImages(html, url);
      allIssues.push(...responsive.issues);
    } catch (e) { /* ignore */ }

    try {
      const contrast = analyzeColorContrast(html, url);
      allIssues.push(...contrast.issues);
    } catch (e) { /* ignore */ }

    try {
      const resources = analyzePageResources(html, url);
      allIssues.push(...resources.issues);
    } catch (e) { /* ignore */ }

    coreChecks += 9;
  }

  // ===== PREMIUM CHECKS (paid only) =====
  if (runPremium) {
    try {
      const snippet = analyzeFeaturedSnippet(html, url);
      allIssues.push(...snippet.issues);
    } catch (e) { /* ignore */ }

    try {
      const linkGraph = analyzeInternalLinkGraph(html, url);
      allIssues.push(...linkGraph.issues);
    } catch (e) { /* ignore */ }

    try {
      const eeat = analyzeEEATSignals(html, url);
      allIssues.push(...eeat.issues);
    } catch (e) { /* ignore */ }

    try {
      const content = analyzeContentScience(html, url);
      allIssues.push(...content.issues);
    } catch (e) { /* ignore */ }

    try {
      const cannibalization = analyzeKeywordCannibalizationSinglePage(html, url);
      allIssues.push(...cannibalization.issues);
    } catch (e) { /* ignore */ }

    try {
      const conversion = analyzeConversionElements(html, url);
      allIssues.push(...conversion.issues);
    } catch (e) { /* ignore */ }

    try {
      const placement = analyzeKeywordPlacement(html, url);
      allIssues.push(...placement.issues);
    } catch (e) { /* ignore */ }

    try {
      const clusters = analyzeTopicalClusters(html, url);
      allIssues.push(...clusters.issues);
    } catch (e) { /* ignore */ }

    try {
      const platform = analyzePlatformPresence(html, url);
      allIssues.push(...platform.issues);
    } catch (e) { /* ignore */ }

    try {
      const tools = analyzeInteractiveTools(html, url);
      allIssues.push(...tools.issues);
    } catch (e) { /* ignore */ }

    try {
      const funnel = analyzeFunnelIntent(html, url);
      allIssues.push(...funnel.issues);
    } catch (e) { /* ignore */ }

    try {
      const navboost = analyzeNavBoostSignals(html, url);
      allIssues.push(...navboost.issues);
    } catch (e) { /* ignore */ }

    try {
      const entity = analyzeEntitySEO(html, url);
      allIssues.push(...entity.issues);
    } catch (e) { /* ignore */ }

    try {
      const freshness = analyzeFreshnessSignals(html, url);
      allIssues.push(...freshness.issues);
    } catch (e) { /* ignore */ }

    try {
      const aiContent = analyzeAIContentStructure(html, url);
      allIssues.push(...aiContent.issues);
    } catch (e) { /* ignore */ }

    try {
      const ragChunk = analyzeRAGChunkReadiness(html, url);
      allIssues.push(...ragChunk.issues);
    } catch (e) { /* ignore */ }

    try {
      const citation = analyzeCitationQuality(html, url);
      allIssues.push(...citation.issues);
    } catch (e) { /* ignore */ }

    try {
      const answer = analyzeAnswerConciseness(html, url);
      allIssues.push(...answer.issues);
    } catch (e) { /* ignore */ }

    try {
      const brand = analyzeBrandMentionOptimization(html, url);
      allIssues.push(...brand.issues);
    } catch (e) { /* ignore */ }

    try {
      const worthiness = analyzeAICitationWorthiness(html, url);
      allIssues.push(...worthiness.issues);
    } catch (e) { /* ignore */ }

    try {
      const review = analyzeReviewEcosystem(html, url);
      allIssues.push(...review.issues);
    } catch (e) { /* ignore */ }

    coreChecks += 21;
  }

  // Calculate score
  const errors = allIssues.filter(i => i.severity === 'error').length;
  const warnings = allIssues.filter(i => i.severity === 'warning').length;
  const score = Math.max(0, Math.min(100, 100 - (errors * 10) - (warnings * 3)));

  return {
    success: true,
    score,
    issues: allIssues,
    checksRun: coreChecks,
    tier,
  };
}

// Create global RankCLI object for VM execution. Individual premium check
// functions are exposed directly (not just the combined runSyncAudit) so
// wasm-engine.ts's getPremiumChecks() can call each one separately and
// feed the results into engine.ts's runFullAudit({ premiumChecks })
// injection point - matching PremiumChecks in premium-checks.types.ts
// exactly, rather than recomputing core+extended checks a second time.
declare const globalThis: {
  RankCLI?: {
    runAudit: typeof runSyncAudit;
    version: string;
    analyzeFeaturedSnippet: typeof analyzeFeaturedSnippet;
    analyzeInternalLinkGraph: typeof analyzeInternalLinkGraph;
    analyzeEEATSignals: typeof analyzeEEATSignals;
    analyzeContentScience: typeof analyzeContentScience;
    analyzeKeywordCannibalizationSinglePage: typeof analyzeKeywordCannibalizationSinglePage;
    analyzeConversionElements: typeof analyzeConversionElements;
    analyzeKeywordPlacement: typeof analyzeKeywordPlacement;
    analyzeTopicalClusters: typeof analyzeTopicalClusters;
    analyzePlatformPresence: typeof analyzePlatformPresence;
    analyzeInteractiveTools: typeof analyzeInteractiveTools;
    analyzeFunnelIntent: typeof analyzeFunnelIntent;
    analyzeNavBoostSignals: typeof analyzeNavBoostSignals;
    analyzeEntitySEO: typeof analyzeEntitySEO;
    analyzeFreshnessSignals: typeof analyzeFreshnessSignals;
    analyzeAIContentStructure: typeof analyzeAIContentStructure;
    analyzeRAGChunkReadiness: typeof analyzeRAGChunkReadiness;
    analyzeCitationQuality: typeof analyzeCitationQuality;
    analyzeAnswerConciseness: typeof analyzeAnswerConciseness;
    analyzeBrandMentionOptimization: typeof analyzeBrandMentionOptimization;
    analyzeAICitationWorthiness: typeof analyzeAICitationWorthiness;
    analyzeReviewEcosystem: typeof analyzeReviewEcosystem;
  };
};

if (typeof globalThis !== 'undefined') {
  globalThis.RankCLI = {
    runAudit: runSyncAudit,
    version: '0.1.0',
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
}

export { runSyncAudit };
