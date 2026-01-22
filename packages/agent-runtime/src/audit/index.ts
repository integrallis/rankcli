// Comprehensive SEO Audit Module - 280+ checks

// Types
export * from './types.js';

// Main engine
export { runFullAudit, formatReport } from './engine.js';
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

// 2026 SEO checks (Nathan Gotch & Neil Patel research)
export { analyzeConversionElements } from './checks/conversion-elements.js';
export { analyzeKeywordPlacement } from './checks/keyword-placement.js';
export { analyzeTopicalClusters } from './checks/topical-clusters.js';
export { analyzePlatformPresence } from './checks/platform-presence.js';
// Advanced SEO Tips 2026 & React SEO
export { analyzeInteractiveTools } from './checks/interactive-tools.js';
export { analyzeFunnelIntent } from './checks/funnel-intent.js';
// Cutting-edge differentiating checks (Google leak, Entity SEO, QDF)
export { analyzeNavBoostSignals } from './checks/navboost-signals.js';
export { analyzeEntitySEO } from './checks/entity-seo.js';
export { analyzeFreshnessSignals } from './checks/freshness-signals.js';

// Fix generators
export * from './fixes/index.js';

// High-level runner
export * from './runner.js';
