import { httpGet } from '../utils/http.js';
import type { AuditIssue, AuditReport, HealthScore, PageAudit } from './types.js';
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
import { analyzeFeaturedSnippet } from './checks/featured-snippet.js';
import { analyzeInternalLinkGraph } from './checks/internal-link-graph.js';
import { analyzeResourceHints } from './checks/resource-hints.js';
import { analyzeEEATSignals } from './checks/eeat-signals.js';
import { analyzeIndexNow } from './checks/indexnow.js';
import { analyzeContentScience } from './checks/content-science.js';
import { analyzeSiteMaturity } from './checks/site-maturity.js';
import { analyzeKeywordCannibalizationSinglePage } from './checks/keyword-cannibalization.js';
// New checks from Technical SEO for Developers & Best SEO Strategies 2025
import { analyzeTrackerBloat } from './checks/tracker-bloat.js';
import { analyzeClientRendering } from './checks/client-rendering.js';
import { analyzeRedirectChain } from './checks/redirect-chain.js';
import { analyzeResponsiveImages } from './checks/responsive-images.js';
// New checks from 2026 SEO transcripts (Nathan Gotch & Neil Patel)
import { analyzeConversionElements } from './checks/conversion-elements.js';
import { analyzeKeywordPlacement } from './checks/keyword-placement.js';
import { analyzeTopicalClusters } from './checks/topical-clusters.js';
import { analyzePlatformPresence } from './checks/platform-presence.js';
// Advanced SEO Tips 2026 & React SEO
import { analyzeInteractiveTools } from './checks/interactive-tools.js';
import { analyzeFunnelIntent } from './checks/funnel-intent.js';
// Cutting-edge differentiating checks (Google leak, Entity SEO, QDF)
import { analyzeNavBoostSignals } from './checks/navboost-signals.js';
import { analyzeEntitySEO } from './checks/entity-seo.js';
import { analyzeFreshnessSignals } from './checks/freshness-signals.js';
// AI Search Optimization checks (2026 - ChatGPT, AI Overviews)
import { analyzeBingOptimization } from './checks/bing-optimization.js';
import { analyzeAIContentStructure } from './checks/ai-content-structure.js';
import { analyzeCitationQuality } from './checks/citation-quality.js';
import { analyzeAnswerConciseness } from './checks/answer-conciseness.js';

export interface AuditOptions {
  url: string;
  checkBrokenLinks?: boolean;
  checkHreflangUrls?: boolean;
  checkCanonicalChain?: boolean;
  maxPages?: number;
  cruxApiKey?: string;
}

export async function runFullAudit(options: AuditOptions): Promise<AuditReport> {
  const { url, checkBrokenLinks = false, checkHreflangUrls = false, checkCanonicalChain = false, cruxApiKey } = options;
  const allIssues: AuditIssue[] = [];
  const pages: PageAudit[] = [];

  const parsedUrl = new URL(url);
  const domain = parsedUrl.hostname;

  console.log(`\n🔍 Running comprehensive SEO audit on ${url}...\n`);

  // ========== PHASE 1: CRAWLABILITY + FETCH (PARALLEL) ==========
  console.log('📋 Phase 1: Crawlability checks + page fetch (parallel)...');

  const [crawlabilityResult, fetchResult] = await Promise.all([
    runCrawlabilityChecks(url).catch(err => {
      console.error('Crawlability check failed:', err);
      return [] as AuditIssue[];
    }),
    httpGet<string>(url, {
      timeout: 30000,
      validateStatus: () => true,
    }).catch(err => {
      return { error: err, data: '', headers: {} as Record<string, string> };
    }),
  ]);

  allIssues.push(...crawlabilityResult);

  // Check if fetch failed
  if ('error' in fetchResult) {
    allIssues.push({
      code: 'FETCH_ERROR',
      severity: 'error',
      category: 'crawlability',
      title: 'Failed to fetch page',
      description: `Could not fetch the page: ${fetchResult.error instanceof Error ? fetchResult.error.message : 'Unknown error'}`,
      impact: 'Cannot perform full audit without page content.',
      howToFix: 'Ensure the URL is accessible and the server is responding.',
      affectedUrls: [url],
    });
    return createReport(url, domain, allIssues, pages);
  }

  const html = fetchResult.data;
  const headers = fetchResult.headers;

  // ========== PHASE 2: SYNCHRONOUS HTML CHECKS (PARALLEL) ==========
  console.log('📝 Phase 2: Running synchronous HTML checks (parallel)...');

  // These are all synchronous functions that only need html/url
  const onPageResult = analyzeOnPage(html, url);
  const structuredDataResult = analyzeStructuredData(html, url);
  const mobileResult = analyzeMobile(html, url);
  const mobileResourceIssues = checkMobileResources(html, url);
  const socialResult = analyzeSocialMeta(html, url);
  const soft404Result = detectSoft404(html, url, 200);
  const anchorResult = analyzeAnchorText(html, url);
  const serpResult = analyzeSERPPreview(html, url);
  const localSeoResult = analyzeLocalSEO(html, url);
  const domResult = analyzeDOMStructure(html, url);
  const modernImageResult = analyzeModernImages(html, url);
  const techResult = detectTechnologies(html, url, headers);
  const keywordResult = analyzeKeywords(html, url);
  const snippetResult = analyzeFeaturedSnippet(html, url);
  const linkGraphResult = analyzeInternalLinkGraph(html, url);
  const resourceHintResult = analyzeResourceHints(html, url);
  const eeatResult = analyzeEEATSignals(html, url);
  const contentScienceResult = analyzeContentScience(html, url);
  const cannibalizationResult = analyzeKeywordCannibalizationSinglePage(html, url);
  const trackerResult = analyzeTrackerBloat(html, url);
  const csrResult = analyzeClientRendering(html, url);
  const responsiveImgResult = analyzeResponsiveImages(html, url);
  const conversionResult = analyzeConversionElements(html, url);
  const keywordPlacementResult = analyzeKeywordPlacement(html, url);
  const clusterResult = analyzeTopicalClusters(html, url);
  const platformResult = analyzePlatformPresence(html, url);
  const toolResult = analyzeInteractiveTools(html, url);
  const funnelResult = analyzeFunnelIntent(html, url);
  const navboostResult = analyzeNavBoostSignals(html, url);
  const entityResult = analyzeEntitySEO(html, url);
  const qdfFreshnessResult = analyzeFreshnessSignals(html, url);
  // AI Search Optimization (2026)
  const aiContentStructureResult = analyzeAIContentStructure(html, url);
  const citationQualityResult = analyzeCitationQuality(html, url);
  const answerConcisenessResult = analyzeAnswerConciseness(html, url);

  // Pagination depends on onPageData.canonical
  const paginationResult = analyzePagination(html, url, onPageResult.data.canonical);

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
    ...citationQualityResult.issues,
    ...answerConcisenessResult.issues,
    ...paginationResult.issues,
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
  console.log('🔗 Phase 3: Running async checks (parallel)...');

  // Helper to safely run async checks with error handling
  const safeAsync = async <T>(
    name: string,
    fn: () => Promise<{ issues: AuditIssue[]; data: T }>,
  ): Promise<AuditIssue[]> => {
    try {
      const result = await fn();
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
  ): Promise<AuditIssue[]> => {
    try {
      return await fn();
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

  // Run all async checks in parallel
  const asyncResults = await Promise.all([
    safeAsync('Links', () => analyzeLinks(html, url, checkBrokenLinks)),
    safeAsync('Images', () => analyzeImages(html, url, checkBrokenLinks)),
    performancePromise,
    safeAsync('Security', () => analyzeSecurity(html, url, headers)),
    safeAsyncIssues('Certificate', async () => (await checkCertificate(url)).issues),
    safeAsync('Hreflang', () => analyzeHreflang(html, url, { validateUrls: checkHreflangUrls })),
    safeAsync('Canonical Advanced', () => analyzeCanonicalAdvanced(html, url, { checkChain: checkCanonicalChain })),
    safeAsync('Redirects', () => analyzeRedirects(url)),
    safeAsync('AI Readiness', () => runAIReadinessChecks(url, html)),
    safeAsync('Security Headers', () => analyzeSecurityHeaders(url)),
    safeAsync('Content Freshness', () => analyzeContentFreshness(url, html)),
    safeAsync('Additional Checks', () => runAdditionalChecks(url, html)),
    safeAsync('IndexNow', () => analyzeIndexNow(html, url, headers)),
    safeAsync('Site Maturity', () => analyzeSiteMaturity(html, url)),
    safeAsync('Redirect Chain', () => analyzeRedirectChain(url)),
    safeAsync('Bing Optimization', () => analyzeBingOptimization(html, url)),
    // Core Web Vitals (optional)
    cruxApiKey
      ? safeAsyncIssues('Core Web Vitals', async () => {
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
        })
      : Promise.resolve([]),
  ]);

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

  console.log('\n✅ Audit complete!\n');

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
  const totalPossibleChecks = 280; // Approximate number of checks (expanded with NavBoost, Entity SEO, QDF)
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
  const weights = { error: 10, warning: 3, notice: 1 };

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

  // Overall score is weighted average
  const overall = Math.round(
    (crawlability * 0.12 +
      indexability * 0.12 +
      onPage * 0.18 +
      content * 0.08 +
      links * 0.08 +
      performance * 0.12 +
      security * 0.12 +
      aiReadiness * 0.06 +
      social * 0.06 +
      localSeo * 0.06)
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
      const order = { error: 0, warning: 1, notice: 2 };
      return order[a.severity] - order[b.severity];
    });
  }

  return grouped;
}
