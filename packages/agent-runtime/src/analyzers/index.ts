/**
 * RankCLI Analyzers
 * 
 * Industry-leading SEO analysis suite.
 * Includes traditional SEO, Core Web Vitals, GEO (AI Search), and more.
 */

// GEO (Generative Engine Optimization) - AI Search
export {
  analyzeGEO,
  analyzeRobotsTxtForAI,
  detectRenderingMode,
  analyzeContentStructure,
  analyzeCitationReadiness,
  analyzeEntityExtraction,
  calculateLLMSignals,
  generateAIFriendlyRobotsTxt,
  AI_CRAWLERS_INFO,
  type GEOAnalysisResult,
  type AIAccessResult,
  type ContentStructureResult,
  type CitationResult,
  type EntityResult,
  type LLMSignalResult,
} from './geo-analyzer.js';

// Core Web Vitals
export {
  analyzeCoreWebVitals,
  type CoreWebVitalsEstimate,
} from './core-web-vitals-analyzer.js';

// Security Headers
export {
  analyzeSecurityHeaders,
  generateSecurityHeaders,
  type SecurityHeadersResult,
} from './security-headers-analyzer.js';

// Structured Data / Schema.org
export {
  analyzeStructuredData,
  generateSchemaTemplate,
  type StructuredDataResult,
  type SchemaItem,
} from './structured-data-analyzer.js';

// Image Optimization
export {
  analyzeImages,
  generateResponsiveImage,
  type ImageAnalysisResult,
  type ImageInfo,
} from './image-optimization-analyzer.js';

// Internal Linking
export {
  analyzeInternalLinking,
  suggestInternalLinks,
  type InternalLinkingResult,
  type LinkInfo,
  type AnchorTextStats,
} from './internal-linking-analyzer.js';

// Mobile SEO
export {
  analyzeMobileSEO,
  type MobileSEOResult,
  type ViewportAnalysis,
  type TouchTargetAnalysis,
  type FontSizeAnalysis,
  type ContentWidthAnalysis,
  type MobileSpecificAnalysis,
} from './mobile-seo-analyzer.js';

/**
 * Comprehensive SEO Analysis
 * 
 * Runs all analyzers and produces a unified report.
 */
export interface ComprehensiveSEOResult {
  url: string;
  timestamp: string;
  overallScore: number;
  grades: {
    geo: number;
    coreWebVitals: number;
    security: string;
    structuredData: number;
    images: number;
    internalLinking: number;
    mobile: number;
  };
  geo: import('./geo-analyzer.js').GEOAnalysisResult;
  coreWebVitals: import('./core-web-vitals-analyzer.js').CoreWebVitalsEstimate;
  security: import('./security-headers-analyzer.js').SecurityHeadersResult;
  structuredData: import('./structured-data-analyzer.js').StructuredDataResult;
  images: import('./image-optimization-analyzer.js').ImageAnalysisResult;
  internalLinking: import('./internal-linking-analyzer.js').InternalLinkingResult;
  mobile: import('./mobile-seo-analyzer.js').MobileSEOResult;
  allIssues: import('../audit/types.js').AuditIssue[];
  prioritizedRecommendations: string[];
}

/**
 * Run comprehensive SEO analysis
 */
export async function analyzeComprehensive(
  html: string,
  url: string,
  options: {
    robotsTxt?: string;
    headers?: Record<string, string>;
  } = {}
): Promise<ComprehensiveSEOResult> {
  const { robotsTxt, headers } = options;
  
  // Import analyzers
  const { analyzeGEO } = await import('./geo-analyzer.js');
  const { analyzeCoreWebVitals } = await import('./core-web-vitals-analyzer.js');
  const { analyzeSecurityHeaders } = await import('./security-headers-analyzer.js');
  const { analyzeStructuredData } = await import('./structured-data-analyzer.js');
  const { analyzeImages } = await import('./image-optimization-analyzer.js');
  const { analyzeInternalLinking } = await import('./internal-linking-analyzer.js');
  const { analyzeMobileSEO } = await import('./mobile-seo-analyzer.js');
  
  // Run all analyzers
  const geo = await analyzeGEO(html, url, robotsTxt);
  const coreWebVitals = analyzeCoreWebVitals(html, url, headers);
  const security = analyzeSecurityHeaders(headers || {}, url);
  const structuredData = analyzeStructuredData(html, url);
  const images = analyzeImages(html, url);
  const internalLinking = analyzeInternalLinking(html, url);
  const mobile = analyzeMobileSEO(html, url);
  
  // Collect all issues
  const allIssues = [
    ...geo.issues,
    ...coreWebVitals.issues,
    ...security.issues,
    ...structuredData.issues,
    ...images.issues,
    ...internalLinking.issues,
    ...mobile.issues,
  ];
  
  // Sort by severity
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  allIssues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
  
  // Calculate overall score (weighted average)
  const weights = {
    geo: 0.20,        // AI search is crucial
    cwv: 0.20,        // Core Web Vitals
    security: 0.10,   // Security headers
    schema: 0.15,     // Structured data
    images: 0.10,     // Image optimization
    links: 0.10,      // Internal linking
    mobile: 0.15,     // Mobile SEO
  };
  
  const securityScore = 
    security.grade === 'A+' ? 100 :
    security.grade === 'A' ? 90 :
    security.grade === 'B' ? 75 :
    security.grade === 'C' ? 55 :
    security.grade === 'D' ? 35 : 20;
  
  const overallScore = Math.round(
    (geo.score * weights.geo) +
    (coreWebVitals.overallScore * weights.cwv) +
    (securityScore * weights.security) +
    (structuredData.score * weights.schema) +
    (images.score * weights.images) +
    (internalLinking.score * weights.links) +
    (mobile.score * weights.mobile)
  );
  
  // Prioritize recommendations
  const prioritizedRecommendations: string[] = [];
  
  // Critical GEO issues first
  if (geo.aiCrawlerAccess.blockedCrawlers.length > 0) {
    prioritizedRecommendations.push('🚨 URGENT: Unblock AI crawlers (GPTBot, PerplexityBot) in robots.txt');
  }
  if (geo.aiCrawlerAccess.jsRenderingRequired && !geo.aiCrawlerAccess.hasPrerendering) {
    prioritizedRecommendations.push('🚨 URGENT: Implement SSR - AI crawlers cannot see your JS-rendered content');
  }
  
  // CWV critical issues
  const criticalCWV = coreWebVitals.issues.filter(i => i.severity === 'critical');
  criticalCWV.forEach(i => prioritizedRecommendations.push(`⚡ ${i.title}`));
  
  // Security critical
  if (!security.https.enabled) {
    prioritizedRecommendations.push('🔒 Enable HTTPS immediately');
  }
  
  // Mobile critical
  if (!mobile.viewport.hasViewport) {
    prioritizedRecommendations.push('📱 Add viewport meta tag for mobile rendering');
  }
  
  // Add top recommendations from each analyzer
  geo.recommendations.slice(0, 2).forEach(r => prioritizedRecommendations.push(r));
  structuredData.recommendations.slice(0, 2).forEach(r => prioritizedRecommendations.push(r));
  images.recommendations.slice(0, 2).forEach(r => prioritizedRecommendations.push(r));
  internalLinking.recommendations.slice(0, 2).forEach(r => prioritizedRecommendations.push(r));
  
  return {
    url,
    timestamp: new Date().toISOString(),
    overallScore,
    grades: {
      geo: geo.score,
      coreWebVitals: coreWebVitals.overallScore,
      security: security.grade,
      structuredData: structuredData.score,
      images: images.score,
      internalLinking: internalLinking.score,
      mobile: mobile.score,
    },
    geo,
    coreWebVitals,
    security,
    structuredData,
    images,
    internalLinking,
    mobile,
    allIssues,
    prioritizedRecommendations,
  };
}
