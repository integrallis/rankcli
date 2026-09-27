/**
 * Deno-compatible entry point for the audit module.
 * This excludes Node-specific code and dependencies.
 */

// Side-effecting: registers every framework recipe's YAML content via
// embedRecipe() so runFullAudit's framework-issue check works in this
// bundle, where the recipes/*.yaml files themselves are never deployed.
import '../frameworks/embedded-recipes.generated.js';

// Types
export type { AuditIssue, AuditReport, HealthScore, PageAudit } from './types.js';
export { ISSUE_DEFINITIONS } from './types.js';

// Main engine
export { runFullAudit, formatReport } from './engine.js';
export type { AuditOptions } from './engine.js';

// Individual check modules (all use isomorphic fetch)
export { runCrawlabilityChecks, checkRobotsTxt, checkSitemap, checkRedirects } from './checks/crawlability.js';
export { analyzeOnPage } from './checks/on-page.js';
export { analyzeLinks } from './checks/links.js';
export { analyzeImages } from './checks/images.js';
export { analyzePerformance } from './checks/performance.js';
export { analyzeSecurity, checkCertificate } from './checks/security.js';
export { analyzeStructuredData, suggestSchemaTypes } from './checks/structured-data.js';
export { analyzeMobile, checkMobileResources } from './checks/mobile.js';

// Advanced checks
export { analyzeHreflang } from './checks/hreflang.js';
export { analyzeSocialMeta } from './checks/social-meta.js';
export { detectSoft404 } from './checks/soft-404.js';
export { analyzeAnchorText } from './checks/anchor-text.js';
export { analyzeCanonicalAdvanced } from './checks/canonical-advanced.js';
export { analyzePagination } from './checks/pagination.js';
export { analyzeRedirects } from './checks/redirect-analysis.js';

// New competitor-parity checks
export { runAIReadinessChecks, checkLlmsTxt, checkAIBotBlocking } from './checks/ai-readiness.js';
export { analyzeSERPPreview } from './checks/serp-preview.js';
export { analyzeLocalSEO } from './checks/local-seo.js';
export { analyzeSecurityHeaders } from './checks/security-headers.js';
export { analyzeContentFreshness } from './checks/content-freshness.js';
export { analyzeDOMStructure } from './checks/dom-analysis.js';
export { analyzeModernImages } from './checks/modern-images.js';
export { detectTechnologies } from './checks/tech-detection.js';
export { analyzeKeywords } from './checks/keyword-analysis.js';

// URL Safety (Google Safe Browsing-style local hash database)
export { urlSafetyDatabase, analyzeUrlSafety } from './checks/url-safety.js';

// Advanced SEO checks
export { analyzeTrackerBloat } from './checks/tracker-bloat.js';
export { analyzeClientRendering } from './checks/client-rendering.js';
export { analyzeRedirectChain } from './checks/redirect-chain.js';
export { analyzeResponsiveImages } from './checks/responsive-images.js';
// Paid-tier checks - re-exported from the private premium package (never
// published; only usable here because this bundle runs first-party,
// server-side in a Supabase edge function, not distributed to end users).
export {
  analyzeConversionElements,
  analyzeKeywordPlacement,
  analyzeTopicalClusters,
  analyzePlatformPresence,
  analyzeInteractiveTools,
  analyzeFunnelIntent,
  analyzeNavBoostSignals,
  analyzeEntitySEO,
  analyzeFreshnessSignals,
} from '@rankcli/agent-runtime-premium';

// Model-free SEO fixes: robots.txt, sitemap.xml, llms.txt and a JSON-LD block, all derived
// from the site's URL and name. What an account with no AI key gets.
export { buildDeterministicFixes } from '../fixer/deterministic.js';
export { findAppRoot } from '../fixer/app-root.js';
export { assessReplacement, describeConcerns } from '../fixer/safety.js';

// CI workflow generator. Pure string templates, no fs - shared with the CLI's
// `rankcli setup --github-action` so the workflow the dashboard button commits and the
// one the CLI writes are the same file, generated from one source.
export { generateWorkflow, generateSecretsDoc } from '../tracking/github-action-template.js';
export type { WorkflowConfig } from '../tracking/github-action-template.js';

// Page discovery (multi-page crawling)
export { discoverPagesFromLinks, parseSitemap, mergePages } from './discovery/link-crawler.js';
export { discoverRoutesFromRepo, detectFramework, routesToUrls } from './discovery/repo-routes.js';
export type { DiscoveredPage } from './discovery/link-crawler.js';
export type { RouteInfo } from './discovery/repo-routes.js';
