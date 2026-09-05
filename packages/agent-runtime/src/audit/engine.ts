import { httpGet } from '../utils/http.js';
import type { AuditIssue, AuditReport, HealthScore, PageAudit } from './types.js';
import type { PremiumChecks } from './premium-checks.types.js';
import { detectFramework } from '../frameworks/detector.js';
import { getFrameworkIssues } from '../frameworks/suggestion-engine.js';
import { runCrawlabilityChecks } from './checks/crawlability.js';
import { analyzeOnPage } from './checks/on-page.js';
import { analyzeLinks } from './checks/links.js';
import { analyzeImages } from './checks/images.js';
import { analyzePerformance, fetchCoreWebVitals } from './checks/performance.js';
import { analyzeSecurity, checkCertificate } from './checks/security.js';
import { analyzeStructuredData, suggestSchemaTypes } from './checks/structured-data.js';
import { analyzeMobile, checkMobileResources } from './checks/mobile.js';
// Advanced checks
import { analyzeHreflang } from './checks/hreflang.js';
import { analyzeSocialMeta } from './checks/social-meta.js';
import { detectSoft404 } from './checks/soft-404.js';
import { analyzeAnchorText } from './checks/anchor-text.js';
import { analyzeCanonicalAdvanced } from './checks/canonical-advanced.js';
import { analyzePagination } from './checks/pagination.js';
import { analyzeRedirects } from './checks/redirect-analysis.js';
// New competitor-parity checks
import { runAIReadinessChecks } from './checks/ai-readiness.js';
import { analyzeSERPPreview } from './checks/serp-preview.js';
import { analyzeLocalSEO } from './checks/local-seo.js';
import { analyzeSecurityHeaders } from './checks/security-headers.js';
import { analyzeContentFreshness } from './checks/content-freshness.js';
import { analyzeDOMStructure } from './checks/dom-analysis.js';
import { analyzeModernImages } from './checks/modern-images.js';
import { detectTechnologies } from './checks/tech-detection.js';
import { analyzeKeywords } from './checks/keyword-analysis.js';
import { runAdditionalChecks } from './checks/additional-checks.js';
// Advanced checks from SEO research
import { analyzeResourceHints } from './checks/resource-hints.js';
import { analyzeIndexNow } from './checks/indexnow.js';
import { analyzeSiteMaturity } from './checks/site-maturity.js';
// New checks from Technical SEO for Developers & Best SEO Strategies 2025
import { analyzeTrackerBloat } from './checks/tracker-bloat.js';
import { analyzeClientRendering } from './checks/client-rendering.js';
import { analyzeRedirectChain } from './checks/redirect-chain.js';
import { analyzeResponsiveImages } from './checks/responsive-images.js';
// AI Search Optimization checks (2026 - ChatGPT, AI Overviews)
import { analyzeBingOptimization } from './checks/bing-optimization.js';
// Competitor-parity checks (from missing-checks.md analysis)
import { validateRobotsTxt } from './checks/robots-validation.js';
import { analyzeLlmsTxt } from './checks/llms-txt.js';
import { analyzeHtmlCompliance } from './checks/html-compliance.js';
import { analyzeCanonicalDomain } from './checks/canonical-domain.js';
import { analyzeCachingHeaders } from './checks/caching-headers.js';
import { analyzeDomSize } from './checks/dom-size.js';
import { analyzeImageDimensions } from './checks/image-dimensions.js';
import { analyzeColorContrast } from './checks/color-contrast.js';
// New checks from Rank Math analysis
import { analyzeAssetMinification } from './checks/asset-minification.js';
import { analyzePageResources } from './checks/page-resources.js';
import { analyzeResponsiveCss } from './checks/responsive-css.js';
import { analyzeDirectoryListing } from './checks/directory-listing.js';
import { analyzeUrlSafety } from './checks/url-safety.js';
import { analyzeTrackingVerification } from './checks/tracking-verification.js';

export interface AuditOptions {
  url: string;
  checkBrokenLinks?: boolean;
  checkHreflangUrls?: boolean;
  checkCanonicalChain?: boolean;
  maxPages?: number;
  cruxApiKey?: string;
  /**
   * Maximum number of checks to run. Used for tier enforcement:
   * - 50: Free unregistered users (core checks only)
   * - 100: Free registered users (core + some premium checks)
   * - 280+: Paid users (all checks)
   */
  checksLimit?: number;
  /**
   * Paid-tier check implementations, supplied by the caller. This package
   * never bundles them itself (see premium-checks.types.ts) - without this,
   * checksLimit alone cannot unlock premium checks, regardless of its value.
   */
  premiumChecks?: PremiumChecks;
}

export async function runFullAudit(options: AuditOptions): Promise<AuditReport> {
  const { url, checkBrokenLinks = false, checkHreflangUrls = false, checkCanonicalChain = false, cruxApiKey, checksLimit = 280, premiumChecks } = options;
  const allIssues: AuditIssue[] = [];
  const pages: PageAudit[] = [];

  // Determine tier based on checksLimit
  // Free unregistered: 50, Free registered: 100, Paid: 280+
  const tier = checksLimit <= 50 ? 'free' : checksLimit <= 100 ? 'registered' : 'paid';
  const runPremiumChecks = tier === 'paid' && !!premiumChecks;
  const runExtendedChecks = tier !== 'free'; // registered + paid

  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname;

  // Progress messages go to stderr, not stdout: stdout is reserved for the
  // audit's actual JSON output (`rankcli audit --output json > file.json`),
  // and printing progress via console.log here corrupts that redirect.
  console.error(`\n🔍 Running comprehensive SEO audit on ${url}...\n`);

  // ========== PHASE 1: CRAWLABILITY + FETCH (PARALLEL) ==========
  console.error('📋 Phase 1: Crawlability checks + page fetch (parallel)...');

  const [crawlabilityResult, fetchResult] = await Promise.all([
    runCrawlabilityChecks(url).catch(err => {
      console.error('Crawlability check failed:', err);
      return [] as AuditIssue[];
    }),
    httpGet<string>(url, {
      timeout: 30000,
      validateStatus: () => true,
    }).catch(err => {
      console.error('Main page fetch failed:', err instanceof Error ? { message: err.message, cause: (err as NodeJS.ErrnoException).cause } : err);
      return { error: err, data: '', headers: {} as Record<string, string> };
    }),
  ]);

  allIssues.push(...crawlabilityResult);

  // Check if fetch failed
  if ('error' in fetchResult) {
    const err = fetchResult.error;
    const errorMsg = err instanceof Error ? err.message : 'Unknown error';
    const errorCause = err instanceof Error && (err as NodeJS.ErrnoException).cause 
      ? ` (${String((err as NodeJS.ErrnoException).cause)})` 
      : '';
    allIssues.push({
      code: 'FETCH_ERROR',
      severity: 'error',
      category: 'indexability', // Not crawlability - robots/sitemap checks may have succeeded
      title: 'Page fetch failed',
      description: `Could not load page content: ${errorMsg}${errorCause}. Only robots.txt and sitemap checks were performed.`,
      impact: 'Cannot perform full SEO audit without page HTML content.',
      howToFix: 'Verify the URL is accessible, the server is responding, and there are no firewall/geo blocks.',
      affectedUrls: [url],
      details: { error: errorMsg, cause: errorCause || undefined },
    });
    return createReport(url, domain, allIssues, pages);
  }

  // cheerio (htmlparser2) treats <noscript> contents as opaque text, not
  // parseable markup - so a legitimate <noscript> fallback (which sites
  // add specifically for non-JS clients/crawlers) is invisible to every
  // check below, and a CSR page with a real, complete noscript fallback
  // gets scored as if it has no title/H1/links at all. Strip just the
  // wrapper tags (keeping their inner markup in place) so the fallback
  // content is credited like any other real HTML on the page.
  const html = fetchResult.data.replace(/<\/?noscript[^>]*>/gi, '');
  const headers = fetchResult.headers;

  // ========== PHASE 2: SYNCHRONOUS HTML CHECKS (PARALLEL) ==========
  console.error(`📝 Phase 2: Running synchronous HTML checks (tier: ${tier}, limit: ${checksLimit})...`);

  // ===== CORE CHECKS (all tiers) =====
  const onPageResult = analyzeOnPage(html, url);
  const structuredDataResult = analyzeStructuredData(html, url);
  const mobileResult = analyzeMobile(html, url);
  const mobileResourceIssues = checkMobileResources(html, url);
  const socialResult = analyzeSocialMeta(html, url);
  const soft404Result = detectSoft404(html, url, 200);
  const serpResult = analyzeSERPPreview(html, url);
  const domResult = analyzeDOMStructure(html, url);
  const techResult = detectTechnologies(html, url, headers);
  const keywordResult = analyzeKeywords(html, url);
  // Pagination depends on onPageData.canonical
  const paginationResult = analyzePagination(html, url, onPageResult.data.canonical);
  // URL Safety check (local hash database - like Google Safe Browsing)
  const urlSafetyResult = analyzeUrlSafety(url);
  // Competitor-parity checks (sync) - important for all users
  const domSizeResult = analyzeDomSize(html, url);
  const imageDimensionsResult = analyzeImageDimensions(html, url);
  // Tracking & verification checks (GA4, GSC, Bing, Schema.org)
  const trackingResult = analyzeTrackingVerification(html, url);

  // ===== EXTENDED CHECKS (registered + paid tiers) =====
  const anchorResult = runExtendedChecks ? analyzeAnchorText(html, url) : { issues: [], data: {} };
  const localSeoResult = runExtendedChecks ? analyzeLocalSEO(html, url) : { issues: [], data: {} };
  const modernImageResult = runExtendedChecks ? analyzeModernImages(html, url) : { issues: [], data: {} };
  const resourceHintResult = runExtendedChecks ? analyzeResourceHints(html, url) : { issues: [], data: {} };
  const trackerResult = runExtendedChecks ? analyzeTrackerBloat(html, url) : { issues: [], data: {} };
  const csrResult = runExtendedChecks ? analyzeClientRendering(html, url) : { issues: [], data: {} };
  const responsiveImgResult = runExtendedChecks ? analyzeResponsiveImages(html, url) : { issues: [], data: {} };
  const colorContrastResult = runExtendedChecks ? analyzeColorContrast(html, url) : { issues: [], data: {} };
  const pageResourcesResult = runExtendedChecks ? analyzePageResources(html, url) : { issues: [], data: {} };

  // ===== PREMIUM CHECKS (paid tier only) =====
  const snippetResult = runPremiumChecks ? premiumChecks!.analyzeFeaturedSnippet(html, url) : { issues: [], data: {} };
  const linkGraphResult = runPremiumChecks ? premiumChecks!.analyzeInternalLinkGraph(html, url) : { issues: [], data: {} };
  const eeatResult = runPremiumChecks ? premiumChecks!.analyzeEEATSignals(html, url) : { issues: [], data: {} };
  const contentScienceResult = runPremiumChecks ? premiumChecks!.analyzeContentScience(html, url) : { issues: [], data: {} };
  const cannibalizationResult = runPremiumChecks ? premiumChecks!.analyzeKeywordCannibalizationSinglePage(html, url) : { issues: [], data: {} };
  const conversionResult = runPremiumChecks ? premiumChecks!.analyzeConversionElements(html, url) : { issues: [], data: {} };
  const keywordPlacementResult = runPremiumChecks ? premiumChecks!.analyzeKeywordPlacement(html, url) : { issues: [], data: {} };
  const clusterResult = runPremiumChecks ? premiumChecks!.analyzeTopicalClusters(html, url) : { issues: [], data: {} };
  const platformResult = runPremiumChecks ? premiumChecks!.analyzePlatformPresence(html, url) : { issues: [], data: {} };
  const toolResult = runPremiumChecks ? premiumChecks!.analyzeInteractiveTools(html, url) : { issues: [], data: {} };
  const funnelResult = runPremiumChecks ? premiumChecks!.analyzeFunnelIntent(html, url) : { issues: [], data: {} };
  const navboostResult = runPremiumChecks ? premiumChecks!.analyzeNavBoostSignals(html, url) : { issues: [], data: {} };
  const entityResult = runPremiumChecks ? premiumChecks!.analyzeEntitySEO(html, url) : { issues: [], data: {} };
  const qdfFreshnessResult = runPremiumChecks ? premiumChecks!.analyzeFreshnessSignals(html, url) : { issues: [], data: {} };
  // AI Search Optimization (2026) - Premium only
  const aiContentStructureResult = runPremiumChecks ? premiumChecks!.analyzeAIContentStructure(html, url) : { issues: [], data: {} };
  const ragChunkReadinessResult = runPremiumChecks ? premiumChecks!.analyzeRAGChunkReadiness(html, url) : { issues: [], data: {} };
  const citationQualityResult = runPremiumChecks ? premiumChecks!.analyzeCitationQuality(html, url) : { issues: [], data: {} };
  const answerConcisenessResult = runPremiumChecks ? premiumChecks!.analyzeAnswerConciseness(html, url) : { issues: [], data: {} };
  // AI SEO Skills - Premium only
  const brandMentionResult = runPremiumChecks ? premiumChecks!.analyzeBrandMentionOptimization(html, url) : { issues: [], data: {} };
  const citationWorthinessResult = runPremiumChecks ? premiumChecks!.analyzeAICitationWorthiness(html, url) : { issues: [], data: {} };
  const reviewEcosystemResult = runPremiumChecks ? premiumChecks!.analyzeReviewEcosystem(html, url) : { issues: [], data: {} };

  // Collect all sync check issues
  allIssues.push(
    ...onPageResult.issues,
    ...structuredDataResult.issues,
    ...mobileResult.issues,
    ...mobileResourceIssues,
    ...socialResult.issues,
    ...soft404Result.issues,
    ...anchorResult.issues,
    ...serpResult.issues,
    ...localSeoResult.issues,
    ...domResult.issues,
    ...modernImageResult.issues,
    ...techResult.issues,
    ...keywordResult.issues,
    ...snippetResult.issues,
    ...linkGraphResult.issues,
    ...resourceHintResult.issues,
    ...eeatResult.issues,
    ...contentScienceResult.issues,
    ...cannibalizationResult.issues,
    ...trackerResult.issues,
    ...csrResult.issues,
    ...responsiveImgResult.issues,
    ...conversionResult.issues,
    ...keywordPlacementResult.issues,
    ...clusterResult.issues,
    ...platformResult.issues,
    ...toolResult.issues,
    ...funnelResult.issues,
    ...navboostResult.issues,
    ...entityResult.issues,
    ...qdfFreshnessResult.issues,
    ...aiContentStructureResult.issues,
    ...ragChunkReadinessResult.issues,
    ...citationQualityResult.issues,
    ...answerConcisenessResult.issues,
    ...brandMentionResult.issues,
    ...citationWorthinessResult.issues,
    ...reviewEcosystemResult.issues,
    ...domSizeResult.issues,
    ...imageDimensionsResult.issues,
    ...colorContrastResult.issues,
    ...pageResourcesResult.issues,
    ...urlSafetyResult.issues,
    ...paginationResult.issues,
    ...trackingResult.issues,
  );

  // Suggest schema types if none found
  if (!structuredDataResult.data.hasSchema) {
    const suggestions = suggestSchemaTypes(html, url);
    if (suggestions.length > 0 && structuredDataResult.issues.length > 0) {
      const lastSchemaIssue = structuredDataResult.issues[structuredDataResult.issues.length - 1];
      lastSchemaIssue.details = {
        ...lastSchemaIssue.details,
        suggestedTypes: suggestions,
      };
    }
  }

  // ========== PHASE 3: ASYNC CHECKS (PARALLEL) ==========
  console.error('🔗 Phase 3: Running async checks (parallel)...');

  // Helper to safely run async checks with error handling and timeout
  const safeAsync = async <T>(
    name: string,
    fn: () => Promise<{ issues: AuditIssue[]; data: T }>,
    timeoutMs: number = 10000, // 10 second default timeout per check
  ): Promise<AuditIssue[]> => {
    try {
      const resultPromise = fn();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timed out`)), timeoutMs)
      );
      const result = await Promise.race([resultPromise, timeoutPromise]);
      return result.issues;
    } catch (err) {
      console.error(`${name} failed:`, err);
      return [];
    }
  };

  // Helper for async checks that only return issues
  const safeAsyncIssues = async (
    name: string,
    fn: () => Promise<AuditIssue[]>,
    timeoutMs: number = 10000,
  ): Promise<AuditIssue[]> => {
    try {
      const resultPromise = fn();
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`${name} timed out`)), timeoutMs)
      );
      return await Promise.race([resultPromise, timeoutPromise]);
    } catch (err) {
      console.error(`${name} failed:`, err);
      return [];
    }
  };

  // Run performance separately to capture data for page audit
  let perfData = { loadTime: 0 };
  const performancePromise = analyzePerformance(url)
    .then(result => {
      perfData = result.data;
      return result.issues;
    })
    .catch(err => {
      console.error('Performance check failed:', err);
      return [] as AuditIssue[];
    });

  // Run all async checks in parallel (respecting tier limits)
  const asyncChecks: Promise<AuditIssue[]>[] = [];

  // ===== CORE ASYNC CHECKS (all tiers) =====
  asyncChecks.push(safeAsync('Links', () => analyzeLinks(html, url, checkBrokenLinks)));
  asyncChecks.push(safeAsync('Images', () => analyzeImages(html, url, checkBrokenLinks)));
  asyncChecks.push(performancePromise);
  asyncChecks.push(safeAsync('Security', () => analyzeSecurity(html, url, headers)));
  asyncChecks.push(safeAsyncIssues('Certificate', async () => (await checkCertificate(url)).issues));
  asyncChecks.push(safeAsync('Redirects', () => analyzeRedirects(url)));
  asyncChecks.push(safeAsync('Robots Validation', () => validateRobotsTxt(url)));
  asyncChecks.push(safeAsync('Canonical Domain', () => analyzeCanonicalDomain(url)));
  // Framework-specific checks (React/Next.js/WordPress/etc recipes) - this
  // was previously CLI-only (packages/cli/src/commands/audit.ts ran it as
  // its own separate "Phase 2.5" on top of runFullAudit's results); every
  // server-side audit (free-audit, run-audit, webhook-triggered CI audits)
  // never got framework-specific issues at all.
  asyncChecks.push(safeAsyncIssues('Framework Detection', async () => {
    const frameworkInfo = detectFramework({ html, headers });
    if (frameworkInfo.framework === 'unknown') return [];
    return getFrameworkIssues(frameworkInfo, html, url);
  }));

  // ===== EXTENDED ASYNC CHECKS (registered + paid tiers) =====
  if (runExtendedChecks) {
    asyncChecks.push(safeAsync('Hreflang', () => analyzeHreflang(html, url, { validateUrls: checkHreflangUrls })));
    asyncChecks.push(safeAsync('Canonical Advanced', () => analyzeCanonicalAdvanced(html, url, { checkChain: checkCanonicalChain })));
    asyncChecks.push(safeAsync('Security Headers', () => analyzeSecurityHeaders(url)));
    asyncChecks.push(safeAsync('Caching Headers', () => analyzeCachingHeaders(url, headers)));
    asyncChecks.push(safeAsync('HTML Compliance', () => analyzeHtmlCompliance(html, url, headers)));
    asyncChecks.push(safeAsync('Redirect Chain', () => analyzeRedirectChain(url)));
    asyncChecks.push(safeAsync('Asset Minification', () => analyzeAssetMinification(html, url)));
    asyncChecks.push(safeAsync('Responsive CSS', () => analyzeResponsiveCss(html, url)));
    asyncChecks.push(safeAsync('Directory Listing', () => analyzeDirectoryListing(url)));
  }

  // ===== PREMIUM ASYNC CHECKS (paid tier only) =====
  if (runPremiumChecks) {
    asyncChecks.push(safeAsync('AI Readiness', () => runAIReadinessChecks(url, html)));
    asyncChecks.push(safeAsync('Content Freshness', () => analyzeContentFreshness(url, html)));
    asyncChecks.push(safeAsync('Additional Checks', () => runAdditionalChecks(url, html)));
    asyncChecks.push(safeAsync('IndexNow', () => analyzeIndexNow(html, url, headers)));
    asyncChecks.push(safeAsync('Site Maturity', () => analyzeSiteMaturity(html, url)));
    asyncChecks.push(safeAsync('Bing Optimization', () => analyzeBingOptimization(html, url)));
    asyncChecks.push(safeAsync('LLMs.txt', () => analyzeLlmsTxt(url)));
    // Core Web Vitals (optional, premium only)
    if (cruxApiKey) {
      asyncChecks.push(safeAsyncIssues('Core Web Vitals', async () => {
        const cwv = await fetchCoreWebVitals(url, cruxApiKey);
        const issues: AuditIssue[] = [];
        if (cwv) {
          if (cwv.lcp?.rating === 'poor') {
            issues.push({
              code: 'LCP_POOR',
              severity: 'error',
              category: 'performance',
              title: 'Poor Largest Contentful Paint (LCP)',
              description: `LCP is ${cwv.lcp.value}ms (should be under 2500ms)`,
              impact: 'Direct Core Web Vitals ranking factor.',
              howToFix: 'Optimize hero images, preload critical resources, improve server response time.',
              affectedUrls: [url],
              details: { lcp: cwv.lcp },
            });
          }
          if (cwv.cls?.rating === 'poor') {
            issues.push({
              code: 'CLS_POOR',
              severity: 'error',
              category: 'performance',
              title: 'Poor Cumulative Layout Shift (CLS)',
              description: `CLS is ${cwv.cls.value} (should be under 0.1)`,
              impact: 'Direct Core Web Vitals ranking factor.',
              howToFix: 'Set image dimensions, avoid inserting content above existing content.',
              affectedUrls: [url],
              details: { cls: cwv.cls },
            });
          }
        }
        return issues;
      }));
    }
  }

  const asyncResults = await Promise.all(asyncChecks);

  // Collect all async issues
  for (const issues of asyncResults) {
    allIssues.push(...issues);
  }

  // ========== CREATE PAGE AUDIT ==========
  pages.push({
    url,
    statusCode: 200,
    title: onPageResult.data.title,
    description: onPageResult.data.description,
    canonical: onPageResult.data.canonical,
    h1: onPageResult.data.h1s,
    wordCount: onPageResult.data.wordCount,
    loadTime: perfData.loadTime,
    issues: allIssues.map(i => i.code),
  });

  console.error('\n✅ Audit complete!\n');

  return createReport(url, domain, allIssues, pages);
}

function createReport(url: string, domain: string, issues: AuditIssue[], pages: PageAudit[]): AuditReport {
  // Calculate health score
  const healthScore = calculateHealthScore(issues);

  // Count issues by severity
  const errors = issues.filter(i => i.severity === 'error').length;
  const warnings = issues.filter(i => i.severity === 'warning').length;
  const notices = issues.filter(i => i.severity === 'notice').length;

  // Calculate passed checks (rough estimate based on possible checks)
  const totalPossibleChecks = 310; // Approximate number of checks (expanded with Rank Math parity + URL safety checks)
  const passed = Math.max(0, totalPossibleChecks - errors - warnings);

  return {
    url,
    domain,
    timestamp: new Date().toISOString(),
    crawlStats: {
      totalUrls: 1,
      crawledUrls: 1,
      errorUrls: 0,
      redirectUrls: 0,
      blockedUrls: 0,
    },
    healthScore,
    issues,
    pages,
    summary: {
      errors,
      warnings,
      notices,
      passed,
    },
  };
}

function calculateHealthScore(issues: AuditIssue[]): HealthScore {
  // Weight issues by severity
  const weights: Record<string, number> = { critical: 15, error: 10, warning: 3, info: 1, notice: 1 };

  // Calculate deductions per category
  const categoryDeductions: Record<string, number> = {
    crawlability: 0,
    indexability: 0,
    'on-page': 0,
    content: 0,
    links: 0,
    images: 0,
    'structured-data': 0,
    performance: 0,
    security: 0,
    mobile: 0,
    international: 0,
    'ai-readiness': 0,
    'social': 0,
    'local-seo': 0,
    'accessibility': 0,
  };

  for (const issue of issues) {
    const deduction = weights[issue.severity];
    categoryDeductions[issue.category] = (categoryDeductions[issue.category] || 0) + deduction;
  }

  // Calculate scores (100 - deductions, min 0)
  const crawlability = Math.max(0, 100 - categoryDeductions.crawlability * 5);
  const indexability = Math.max(0, 100 - categoryDeductions.indexability * 5);
  const onPage = Math.max(0, 100 - categoryDeductions['on-page'] * 3);
  const content = Math.max(0, 100 - categoryDeductions.content * 3);
  const links = Math.max(0, 100 - categoryDeductions.links * 3);
  const performance = Math.max(0, 100 - categoryDeductions.performance * 4);
  const security = Math.max(0, 100 - categoryDeductions.security * 5);
  const aiReadiness = Math.max(0, 100 - categoryDeductions['ai-readiness'] * 3);
  const social = Math.max(0, 100 - categoryDeductions.social * 2);
  const localSeo = Math.max(0, 100 - categoryDeductions['local-seo'] * 2);
  const accessibility = Math.max(0, 100 - categoryDeductions.accessibility * 4);

  // Overall score is weighted average
  const overall = Math.round(
    (crawlability * 0.11 +
      indexability * 0.11 +
      onPage * 0.16 +
      content * 0.07 +
      links * 0.07 +
      performance * 0.11 +
      security * 0.11 +
      aiReadiness * 0.06 +
      social * 0.05 +
      localSeo * 0.05 +
      accessibility * 0.10)
  );

  return {
    overall,
    crawlability,
    indexability,
    onPage,
    content,
    links,
    performance,
    security,
    aiReadiness,
    social,
    localSeo,
    accessibility,
  };
}

// Format the report for console output
export function formatReport(report: AuditReport): string {
  const lines: string[] = [];

  lines.push('');
  lines.push('═'.repeat(70));
  lines.push('  SEO AUDIT REPORT');
  lines.push('═'.repeat(70));
  lines.push(`  URL: ${report.url}`);
  lines.push(`  Domain: ${report.domain}`);
  lines.push(`  Time: ${report.timestamp}`);
  lines.push('═'.repeat(70));
  lines.push('');

  // Health Score
  lines.push('📊 HEALTH SCORE');
  lines.push('─'.repeat(70));
  lines.push(`  Overall: ${report.healthScore.overall}/100 ${getScoreEmoji(report.healthScore.overall)}`);
  lines.push('');
  lines.push('  Category Scores:');
  lines.push(`    Crawlability:  ${report.healthScore.crawlability}/100`);
  lines.push(`    Indexability:  ${report.healthScore.indexability}/100`);
  lines.push(`    On-Page SEO:   ${report.healthScore.onPage}/100`);
  lines.push(`    Content:       ${report.healthScore.content}/100`);
  lines.push(`    Links:         ${report.healthScore.links}/100`);
  lines.push(`    Performance:   ${report.healthScore.performance}/100`);
  lines.push(`    Security:      ${report.healthScore.security}/100`);
  lines.push(`    AI Readiness:  ${report.healthScore.aiReadiness}/100`);
  lines.push(`    Social:        ${report.healthScore.social}/100`);
  lines.push(`    Local SEO:     ${report.healthScore.localSeo}/100`);
  lines.push(`    Accessibility: ${report.healthScore.accessibility}/100`);
  lines.push('');

  // Summary
  lines.push('📋 SUMMARY');
  lines.push('─'.repeat(70));
  lines.push(`  ❌ Errors:   ${report.summary.errors}`);
  lines.push(`  ⚠️  Warnings: ${report.summary.warnings}`);
  lines.push(`  ℹ️  Notices:  ${report.summary.notices}`);
  lines.push(`  ✅ Passed:   ${report.summary.passed}`);
  lines.push('');

  // Issues by category
  const issuesByCategory = groupIssuesByCategory(report.issues);

  for (const [category, issues] of Object.entries(issuesByCategory)) {
    if (issues.length === 0) continue;

    lines.push(`📁 ${category.toUpperCase()}`);
    lines.push('─'.repeat(70));

    for (const issue of issues) {
      const icon = issue.severity === 'error' ? '❌' : issue.severity === 'warning' ? '⚠️' : 'ℹ️';
      lines.push(`  ${icon} ${issue.title}`);
      lines.push(`     ${issue.description}`);
      if (issue.howToFix) {
        lines.push(`     → ${issue.howToFix}`);
      }
      lines.push('');
    }
  }

  lines.push('═'.repeat(70));

  return lines.join('\n');
}

function getScoreEmoji(score: number): string {
  if (score >= 90) return '🟢 Excellent';
  if (score >= 70) return '🟡 Good';
  if (score >= 50) return '🟠 Needs Work';
  return '🔴 Poor';
}

function groupIssuesByCategory(issues: AuditIssue[]): Record<string, AuditIssue[]> {
  const grouped: Record<string, AuditIssue[]> = {};

  for (const issue of issues) {
    if (!grouped[issue.category]) {
      grouped[issue.category] = [];
    }
    grouped[issue.category].push(issue);
  }

  // Sort by severity within each category
  for (const category of Object.keys(grouped)) {
    grouped[category].sort((a, b) => {
      const order: Record<string, number> = { critical: 0, error: 1, warning: 2, info: 3, notice: 4 };
      return (order[a.severity] ?? 5) - (order[b.severity] ?? 5);
    });
  }

  return grouped;
}
