import axios from 'axios';
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

const USER_AGENT = 'RankCLI/1.0 (+https://rankcli.dev)';

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

  // ========== PHASE 1: CRAWLABILITY ==========
  console.log('📋 Checking crawlability...');
  const crawlabilityIssues = await runCrawlabilityChecks(url);
  allIssues.push(...crawlabilityIssues);

  // ========== PHASE 2: FETCH PAGE ==========
  console.log('📥 Fetching page content...');
  let html = '';
  let headers: Record<string, string> = {};

  try {
    const response = await axios.get(url, {
      headers: { 'User-Agent': USER_AGENT },
      timeout: 30000,
      validateStatus: () => true,
    });
    html = response.data;
    headers = response.headers as Record<string, string>;
  } catch (error) {
    allIssues.push({
      code: 'FETCH_ERROR',
      severity: 'error',
      category: 'crawlability',
      title: 'Failed to fetch page',
      description: `Could not fetch the page: ${error instanceof Error ? error.message : 'Unknown error'}`,
      impact: 'Cannot perform full audit without page content.',
      howToFix: 'Ensure the URL is accessible and the server is responding.',
      affectedUrls: [url],
    });

    return createReport(url, domain, allIssues, pages);
  }

  // ========== PHASE 3: ON-PAGE SEO ==========
  console.log('📝 Analyzing on-page SEO...');
  const { issues: onPageIssues, data: onPageData } = analyzeOnPage(html, url);
  allIssues.push(...onPageIssues);

  // ========== PHASE 4: LINKS ==========
  console.log('🔗 Analyzing links...');
  const { issues: linkIssues, data: linkData } = await analyzeLinks(html, url, checkBrokenLinks);
  allIssues.push(...linkIssues);

  // ========== PHASE 5: IMAGES ==========
  console.log('🖼️  Analyzing images...');
  const { issues: imageIssues, data: imageData } = await analyzeImages(html, url, checkBrokenLinks);
  allIssues.push(...imageIssues);

  // ========== PHASE 6: PERFORMANCE ==========
  console.log('⚡ Analyzing performance...');
  const { issues: perfIssues, data: perfData } = await analyzePerformance(url);
  allIssues.push(...perfIssues);

  // Fetch Core Web Vitals if API key provided
  if (cruxApiKey) {
    console.log('📊 Fetching Core Web Vitals...');
    const cwv = await fetchCoreWebVitals(url, cruxApiKey);
    if (cwv) {
      if (cwv.lcp?.rating === 'poor') {
        allIssues.push({
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
        allIssues.push({
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
  }

  // ========== PHASE 7: SECURITY ==========
  console.log('🔒 Analyzing security...');
  const { issues: securityIssues } = await analyzeSecurity(html, url, headers);
  allIssues.push(...securityIssues);

  // Check SSL certificate
  const certResult = await checkCertificate(url);
  allIssues.push(...certResult.issues);

  // ========== PHASE 8: STRUCTURED DATA ==========
  console.log('📋 Analyzing structured data...');
  const { issues: schemaIssues, data: schemaData } = analyzeStructuredData(html, url);
  allIssues.push(...schemaIssues);

  // Suggest schema types if none found
  if (!schemaData.hasSchema) {
    const suggestions = suggestSchemaTypes(html, url);
    if (suggestions.length > 0) {
      allIssues[allIssues.length - 1].details = {
        ...allIssues[allIssues.length - 1].details,
        suggestedTypes: suggestions,
      };
    }
  }

  // ========== PHASE 9: MOBILE ==========
  console.log('📱 Analyzing mobile friendliness...');
  const { issues: mobileIssues, data: mobileData } = analyzeMobile(html, url);
  allIssues.push(...mobileIssues);

  const mobileResourceIssues = checkMobileResources(html, url);
  allIssues.push(...mobileResourceIssues);

  // ========== PHASE 10: SOCIAL META (OG/Twitter) ==========
  console.log('📣 Analyzing social meta tags...');
  const { issues: socialIssues, data: socialData } = analyzeSocialMeta(html, url);
  allIssues.push(...socialIssues);

  // ========== PHASE 11: SOFT 404 DETECTION ==========
  console.log('🔍 Detecting soft 404s...');
  const { issues: soft404Issues, data: soft404Data } = detectSoft404(html, url, 200);
  allIssues.push(...soft404Issues);

  // ========== PHASE 12: ANCHOR TEXT ANALYSIS ==========
  console.log('⚓ Analyzing anchor text...');
  const { issues: anchorIssues, data: anchorData } = analyzeAnchorText(html, url);
  allIssues.push(...anchorIssues);

  // ========== PHASE 13: HREFLANG VALIDATION ==========
  console.log('🌍 Analyzing hreflang tags...');
  const { issues: hreflangIssues, data: hreflangData } = await analyzeHreflang(html, url, {
    validateUrls: checkHreflangUrls,
  });
  allIssues.push(...hreflangIssues);

  // ========== PHASE 14: ADVANCED CANONICAL ==========
  console.log('🔗 Analyzing canonical chains...');
  const { issues: canonicalAdvIssues, data: canonicalAdvData } = await analyzeCanonicalAdvanced(html, url, {
    checkChain: checkCanonicalChain,
  });
  allIssues.push(...canonicalAdvIssues);

  // ========== PHASE 15: PAGINATION ANALYSIS ==========
  console.log('📄 Analyzing pagination...');
  const { issues: paginationIssues, data: paginationData } = analyzePagination(html, url, onPageData.canonical);
  allIssues.push(...paginationIssues);

  // ========== PHASE 16: REDIRECT ANALYSIS ==========
  console.log('↪️  Analyzing redirects...');
  const { issues: redirectIssues, data: redirectData } = await analyzeRedirects(url);
  allIssues.push(...redirectIssues);

  // ========== PHASE 17: AI/LLM READINESS ==========
  console.log('🤖 Checking AI/LLM readiness...');
  const { issues: aiIssues, data: aiData } = await runAIReadinessChecks(url, html);
  allIssues.push(...aiIssues);

  // ========== PHASE 18: SERP PREVIEW & PIXEL MEASUREMENTS ==========
  console.log('🔍 Analyzing SERP preview...');
  const { issues: serpIssues, data: serpData } = analyzeSERPPreview(html, url);
  allIssues.push(...serpIssues);

  // ========== PHASE 19: LOCAL SEO ==========
  console.log('📍 Checking local SEO...');
  const { issues: localSeoIssues, data: localSeoData } = analyzeLocalSEO(html, url);
  allIssues.push(...localSeoIssues);

  // ========== PHASE 20: SECURITY HEADERS ==========
  console.log('🛡️  Analyzing security headers...');
  const { issues: secHeaderIssues, data: secHeaderData } = await analyzeSecurityHeaders(url);
  allIssues.push(...secHeaderIssues);

  // ========== PHASE 21: CONTENT FRESHNESS ==========
  console.log('📅 Checking content freshness...');
  const { issues: freshnessIssues, data: freshnessData } = await analyzeContentFreshness(url, html);
  allIssues.push(...freshnessIssues);

  // ========== PHASE 22: DOM ANALYSIS ==========
  console.log('🏗️  Analyzing DOM structure...');
  const { issues: domIssues, data: domData } = analyzeDOMStructure(html, url);
  allIssues.push(...domIssues);

  // ========== PHASE 23: MODERN IMAGE FORMATS ==========
  console.log('🖼️  Checking modern image formats...');
  const { issues: modernImageIssues, data: modernImageData } = analyzeModernImages(html, url);
  allIssues.push(...modernImageIssues);

  // ========== PHASE 24: TECHNOLOGY DETECTION ==========
  console.log('🔧 Detecting technologies...');
  const { issues: techIssues, data: techData } = detectTechnologies(html, url, headers);
  allIssues.push(...techIssues);

  // ========== PHASE 25: KEYWORD ANALYSIS ==========
  console.log('🔑 Analyzing keywords...');
  const { issues: keywordIssues, data: keywordData } = analyzeKeywords(html, url);
  allIssues.push(...keywordIssues);

  // ========== PHASE 26: ADDITIONAL CHECKS ==========
  console.log('📋 Running additional checks (ads.txt, DMARC, AMP, etc.)...');
  const { issues: additionalIssues, data: additionalData } = await runAdditionalChecks(url, html);
  allIssues.push(...additionalIssues);

  // ========== PHASE 27: FEATURED SNIPPET OPTIMIZATION ==========
  console.log('🎯 Analyzing featured snippet optimization...');
  const { issues: snippetIssues, data: snippetData } = analyzeFeaturedSnippet(html, url);
  allIssues.push(...snippetIssues);

  // ========== PHASE 28: INTERNAL LINK GRAPH ==========
  console.log('🕸️  Analyzing internal link structure...');
  const { issues: linkGraphIssues, data: linkGraphData } = analyzeInternalLinkGraph(html, url);
  allIssues.push(...linkGraphIssues);

  // ========== PHASE 29: RESOURCE HINTS ==========
  console.log('⚡ Analyzing resource hints (preconnect, preload)...');
  const { issues: resourceHintIssues, data: resourceHintData } = analyzeResourceHints(html, url);
  allIssues.push(...resourceHintIssues);

  // ========== PHASE 30: E-E-A-T SIGNALS ==========
  console.log('👤 Analyzing E-E-A-T signals (Author, Expertise, Trust)...');
  const { issues: eeatIssues, data: eeatData } = analyzeEEATSignals(html, url);
  allIssues.push(...eeatIssues);

  // ========== PHASE 31: INDEXNOW PROTOCOL ==========
  console.log('📡 Checking IndexNow implementation...');
  const { issues: indexNowIssues, data: indexNowData } = await analyzeIndexNow(html, url, headers);
  allIssues.push(...indexNowIssues);

  // ========== PHASE 32: CONTENT SCIENCE (NOVEL CHECKS) ==========
  console.log('🔬 Running content science analysis (Zipf, Entropy, BM25)...');
  const { issues: contentScienceIssues, data: contentScienceData } = analyzeContentScience(html, url);
  allIssues.push(...contentScienceIssues);

  // ========== PHASE 33: SITE MATURITY & STRATEGY ==========
  console.log('📊 Analyzing site maturity and recommending strategy...');
  const { issues: maturityIssues, data: maturityData } = await analyzeSiteMaturity(html, url);
  allIssues.push(...maturityIssues);

  // ========== PHASE 34: KEYWORD CANNIBALIZATION ==========
  console.log('🎭 Checking for keyword cannibalization signals...');
  const { issues: cannibalizationIssues, data: cannibalizationData } = analyzeKeywordCannibalizationSinglePage(html, url);
  allIssues.push(...cannibalizationIssues);

  // ========== PHASE 35: TRACKER BLOAT ==========
  console.log('📊 Analyzing third-party trackers...');
  const { issues: trackerIssues, data: trackerData } = analyzeTrackerBloat(html, url);
  allIssues.push(...trackerIssues);

  // ========== PHASE 36: CLIENT-SIDE RENDERING DETECTION ==========
  console.log('🖥️  Detecting client-side rendering patterns...');
  const { issues: csrIssues, data: csrData } = analyzeClientRendering(html, url);
  allIssues.push(...csrIssues);

  // ========== PHASE 37: REDIRECT CHAIN ANALYSIS ==========
  console.log('↩️  Analyzing redirect chains...');
  const { issues: redirectChainIssues, data: redirectChainData } = await analyzeRedirectChain(url);
  allIssues.push(...redirectChainIssues);

  // ========== PHASE 38: RESPONSIVE IMAGES ==========
  console.log('📱 Analyzing responsive image best practices...');
  const { issues: responsiveImgIssues, data: responsiveImgData } = analyzeResponsiveImages(html, url);
  allIssues.push(...responsiveImgIssues);

  // ========== PHASE 39: CONVERSION ELEMENTS (2026 SEO) ==========
  console.log('💰 Analyzing conversion elements (above-the-fold, social proof)...');
  const { issues: conversionIssues, data: conversionData } = analyzeConversionElements(html, url);
  allIssues.push(...conversionIssues);

  // ========== PHASE 40: KEYWORD PLACEMENT (2026 SEO) ==========
  console.log('🎯 Analyzing keyword placement (title match score, first paragraph)...');
  const { issues: keywordPlacementIssues, data: keywordPlacementData } = analyzeKeywordPlacement(html, url);
  allIssues.push(...keywordPlacementIssues);

  // ========== PHASE 41: TOPICAL CLUSTERS (2026 SEO) ==========
  console.log('🕸️  Analyzing topical cluster structure...');
  const { issues: clusterIssues, data: clusterData } = analyzeTopicalClusters(html, url);
  allIssues.push(...clusterIssues);

  // ========== PHASE 42: PLATFORM PRESENCE (Search Everywhere Optimization) ==========
  console.log('🌐 Analyzing cross-platform presence (Search Everywhere Optimization)...');
  const { issues: platformIssues, data: platformData } = analyzePlatformPresence(html, url);
  allIssues.push(...platformIssues);

  // ========== PHASE 43: INTERACTIVE TOOLS (Dwell Time Optimization) ==========
  console.log('🛠️  Analyzing interactive tools (calculators, quizzes, free tools)...');
  const { issues: toolIssues, data: toolData } = analyzeInteractiveTools(html, url);
  allIssues.push(...toolIssues);

  // ========== PHASE 44: FUNNEL INTENT ANALYSIS ==========
  console.log('🎯 Analyzing search funnel intent (TOFU/MOFU/BOFU)...');
  const { issues: funnelIssues, data: funnelData } = analyzeFunnelIntent(html, url);
  allIssues.push(...funnelIssues);

  // ========== PHASE 45: NAVBOOST SIGNALS (Google Algorithm Leak) ==========
  console.log('📈 Analyzing NavBoost signals (CTR, engagement, dwell time)...');
  const { issues: navboostIssues, data: navboostData } = analyzeNavBoostSignals(html, url);
  allIssues.push(...navboostIssues);

  // ========== PHASE 46: ENTITY SEO (Knowledge Graph Optimization) ==========
  console.log('🔗 Analyzing Entity SEO (Knowledge Graph, sameAs, entity clarity)...');
  const { issues: entityIssues, data: entityData } = analyzeEntitySEO(html, url);
  allIssues.push(...entityIssues);

  // ========== PHASE 47: FRESHNESS SIGNALS (QDF Optimization) ==========
  console.log('📅 Analyzing freshness signals (QDF, dateModified, AI citation)...');
  const { issues: qdfFreshnessIssues, data: qdfFreshnessData } = analyzeFreshnessSignals(html, url);
  allIssues.push(...qdfFreshnessIssues);

  // ========== CREATE PAGE AUDIT ==========
  pages.push({
    url,
    statusCode: 200,
    title: onPageData.title,
    description: onPageData.description,
    canonical: onPageData.canonical,
    h1: onPageData.h1s,
    wordCount: onPageData.wordCount,
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
