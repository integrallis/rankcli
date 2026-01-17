// Comprehensive SEO Audit Module - 200+ checks

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
