// Comprehensive SEO Audit Module - 280+ checks

// Types
export * from './types.js';

// Main engine
export { runFullAudit, formatReport } from './engine.js';
export { metaRefreshTarget } from './meta-refresh.js';
export { dedupeIssues, REDUNDANT_WHEN_PRESENT } from './dedupe.js';
export type { AuditOptions } from './engine.js';

// Individual check modules (for granular use)
export { runCrawlabilityChecks, checkRobotsTxt, checkSitemap, checkRedirects } from './checks/crawlability.js';
export { analyzeOnPage } from './checks/on-page.js';
export { analyzeLinks } from './checks/links.js';
export { analyzeImages } from './checks/images.js';
export { analyzePerformance, fetchCoreWebVitals } from './checks/performance.js';
export { analyzeSecurity, checkCertificate } from './checks/security.js';
export { analyzeStructuredData, suggestSchemaTypes } from './checks/structured-data.js';
export { analyzeMobile, checkMobileResources } from './checks/mobile.js';

// Advanced check modules
export { analyzeHreflang } from './checks/hreflang.js';
export { analyzeSocialMeta } from './checks/social-meta.js';
export { detectSoft404 } from './checks/soft-404.js';
export { analyzeAnchorText } from './checks/anchor-text.js';
export { analyzeCanonicalAdvanced } from './checks/canonical-advanced.js';
export { extractContentHash, detectDuplicates, generateDuplicateIssues } from './checks/duplicate-content.js';
export { analyzePagination } from './checks/pagination.js';
export { analyzeRedirects, checkInternalRedirects } from './checks/redirect-analysis.js';

// New competitor-parity check modules
export { runAIReadinessChecks, checkLlmsTxt, checkAIBotBlocking, checkJSRenderingRatio } from './checks/ai-readiness.js';
export { analyzeSERPPreview } from './checks/serp-preview.js';
export { analyzeLocalSEO } from './checks/local-seo.js';
export { analyzeSecurityHeaders } from './checks/security-headers.js';
export { analyzeContentFreshness } from './checks/content-freshness.js';
export { analyzeDOMStructure } from './checks/dom-analysis.js';
export { analyzeModernImages } from './checks/modern-images.js';
export { detectTechnologies } from './checks/tech-detection.js';
export { analyzeKeywords } from './checks/keyword-analysis.js';
export { runAdditionalChecks, checkAdsTxt, checkDMARC, checkSPF, checkAMP, checkPlaintextEmails, checkAppleTouchIcon } from './checks/additional-checks.js';

// Checks from Technical SEO for Developers & Best SEO Strategies 2025
export { analyzeTrackerBloat } from './checks/tracker-bloat.js';
export { analyzeClientRendering } from './checks/client-rendering.js';
export { analyzeRedirectChain } from './checks/redirect-chain.js';
export { analyzeResponsiveImages } from './checks/responsive-images.js';

// The checks that used to be encrypted into the CLI (every plan runs them; see
// premium-checks.ts).
export * from './premium-checks.js';
export type { PremiumChecks, PremiumCheckFn } from './premium-checks.types.js';

// URL Safety (local hash database - Google Safe Browsing style)
export { analyzeUrlSafety, urlSafetyDatabase } from './checks/url-safety.js';

// Page discovery (multi-page crawling)
export { discoverPagesFromLinks, parseSitemap, mergePages } from './discovery/link-crawler.js';
export { discoverRoutesFromRepo, detectFramework, routesToUrls } from './discovery/repo-routes.js';
export type { DiscoveredPage } from './discovery/link-crawler.js';
export type { RouteInfo } from './discovery/repo-routes.js';

// Fix generators
export * from './fixes/index.js';

// High-level runner
export * from './runner.js';
