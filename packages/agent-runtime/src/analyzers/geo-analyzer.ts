/**
 * GEO (Generative Engine Optimization) Analyzer
 * 
 * Industry-first analyzer for AI search visibility.
 * Checks if your site is optimized for ChatGPT, Perplexity, Claude, and other AI search engines.
 * 
 * Features:
 * - AI crawler accessibility detection
 * - LLM-friendly content structure analysis
 * - Citation-optimized formatting
 * - Entity and fact extraction readiness
 * - AI search ranking factors
 */

import * as cheerio from 'cheerio';
import type { AuditIssue, IssueSeverity, IssueCategory } from '../audit/types.js';

export interface GEOAnalysisResult {
  score: number; // 0-100 GEO readiness score
  aiCrawlerAccess: AIAccessResult;
  contentStructure: ContentStructureResult;
  citationReadiness: CitationResult;
  entityExtraction: EntityResult;
  llmSignals: LLMSignalResult;
  issues: AuditIssue[];
  recommendations: string[];
}

export interface AIAccessResult {
  robotsTxtAllowsAI: boolean;
  blockedCrawlers: string[];
  allowedCrawlers: string[];
  hasPrerendering: boolean;
  jsRenderingRequired: boolean;
  serverSideRendered: boolean;
}

export interface ContentStructureResult {
  hasStructuredData: boolean;
  hasFAQSchema: boolean;
  hasHowToSchema: boolean;
  hasArticleSchema: boolean;
  hasProductSchema: boolean;
  hasBreadcrumbs: boolean;
  headingHierarchy: 'good' | 'needs-work' | 'poor';
  contentSections: number;
  listsAndTables: number;
}

export interface CitationResult {
  hasCitations: boolean;
  hasExternalLinks: boolean;
  hasStatistics: boolean;
  hasQuotes: boolean;
  hasAuthorInfo: boolean;
  hasPublishDate: boolean;
  hasLastModified: boolean;
  trustSignals: string[];
}

export interface EntityResult {
  namedEntities: string[];
  definedTerms: string[];
  hasDefinitions: boolean;
  hasComparisons: boolean;
  questionAnswerPairs: number;
}

export interface LLMSignalResult {
  contentClarity: number; // 0-100
  factDensity: number; // 0-100
  structureQuality: number; // 0-100
  citationQuality: number; // 0-100
  overallLLMFriendliness: number; // 0-100
}

// Known AI crawlers and their user agents
const AI_CRAWLERS = {
  // OpenAI
  GPTBot: { userAgent: 'GPTBot', company: 'OpenAI', purpose: 'ChatGPT training & browsing' },
  ChatGPTUser: { userAgent: 'ChatGPT-User', company: 'OpenAI', purpose: 'ChatGPT browsing feature' },
  OAI_SearchBot: { userAgent: 'OAI-SearchBot', company: 'OpenAI', purpose: 'OpenAI search features' },
  
  // Anthropic
  ClaudeBot: { userAgent: 'Claude-Web', company: 'Anthropic', purpose: 'Claude web access' },
  anthropic_ai: { userAgent: 'anthropic-ai', company: 'Anthropic', purpose: 'Claude training' },
  
  // Perplexity
  PerplexityBot: { userAgent: 'PerplexityBot', company: 'Perplexity', purpose: 'Perplexity AI search' },
  
  // Google AI
  GoogleOther: { userAgent: 'Google-Extended', company: 'Google', purpose: 'Bard/Gemini training' },
  
  // Microsoft/Bing
  Bingbot: { userAgent: 'bingbot', company: 'Microsoft', purpose: 'Bing Chat/Copilot' },
  
  // Meta
  FacebookBot: { userAgent: 'FacebookBot', company: 'Meta', purpose: 'Meta AI features' },
  MetaAI: { userAgent: 'meta-externalagent', company: 'Meta', purpose: 'Meta AI training' },
  
  // Apple
  Applebot: { userAgent: 'Applebot-Extended', company: 'Apple', purpose: 'Apple Intelligence' },
  
  // Amazon
  Amazonbot: { userAgent: 'Amazonbot', company: 'Amazon', purpose: 'Alexa/Amazon AI' },
  
  // Others
  YouBot: { userAgent: 'YouBot', company: 'You.com', purpose: 'You.com AI search' },
  CCBot: { userAgent: 'CCBot', company: 'Common Crawl', purpose: 'Training data' },
  cohere_ai: { userAgent: 'cohere-ai', company: 'Cohere', purpose: 'Cohere training' },
};

/**
 * Analyze robots.txt for AI crawler permissions
 */
export function analyzeRobotsTxtForAI(robotsTxt: string): { 
  allowed: string[]; 
  blocked: string[]; 
  recommendations: string[];
} {
  const allowed: string[] = [];
  const blocked: string[] = [];
  const recommendations: string[] = [];
  
  const lines = robotsTxt.split('\n').map(l => l.trim().toLowerCase());
  let currentAgent = '*';
  
  for (const line of lines) {
    if (line.startsWith('user-agent:')) {
      currentAgent = line.replace('user-agent:', '').trim();
    } else if (line.startsWith('disallow:')) {
      const path = line.replace('disallow:', '').trim();
      if (path === '/' || path === '/*') {
        // Check if this applies to AI crawlers
        for (const [name, info] of Object.entries(AI_CRAWLERS)) {
          if (currentAgent === '*' || currentAgent.includes(info.userAgent.toLowerCase())) {
            if (!blocked.includes(name)) blocked.push(name);
          }
        }
      }
    } else if (line.startsWith('allow:')) {
      for (const [name, info] of Object.entries(AI_CRAWLERS)) {
        if (currentAgent === '*' || currentAgent.includes(info.userAgent.toLowerCase())) {
          if (!allowed.includes(name)) allowed.push(name);
        }
      }
    }
  }
  
  // Check for explicit AI crawler rules
  for (const [name, info] of Object.entries(AI_CRAWLERS)) {
    const hasExplicitRule = lines.some(l => 
      l.includes(info.userAgent.toLowerCase())
    );
    
    if (!hasExplicitRule && !blocked.includes(name) && !allowed.includes(name)) {
      // No explicit rule, defaults to allowed
      allowed.push(name);
    }
  }
  
  // Generate recommendations
  if (blocked.includes('GPTBot')) {
    recommendations.push('⚠️ GPTBot is blocked - your content won\'t appear in ChatGPT responses');
  }
  if (blocked.includes('PerplexityBot')) {
    recommendations.push('⚠️ PerplexityBot is blocked - missing Perplexity AI search visibility');
  }
  if (blocked.includes('ClaudeBot')) {
    recommendations.push('⚠️ Claude-Web is blocked - no visibility in Claude AI responses');
  }
  
  if (allowed.length === 0) {
    recommendations.push('🚨 All AI crawlers appear to be blocked - zero AI search visibility');
  }
  
  return { allowed, blocked, recommendations };
}

/**
 * Detect if page is server-side rendered or requires JS
 */
export function detectRenderingMode(html: string): {
  serverSideRendered: boolean;
  jsRenderingRequired: boolean;
  hasPrerendering: boolean;
  contentInHTML: boolean;
  signals: string[];
} {
  const $ = cheerio.load(html);
  const signals: string[] = [];
  
  // Check for SSR/SSG indicators
  const hasNextData = html.includes('__NEXT_DATA__');
  const hasNuxtData = html.includes('__NUXT__');
  const hasGatsbyData = html.includes('___gatsby');
  const hasAstroIsland = html.includes('astro-island');
  
  // Check for SPA indicators (minimal server content)
  const bodyText = $('body').text().replace(/\s+/g, ' ').trim();
  const hasMinimalContent = bodyText.length < 200;
  const hasRootDiv = $('#root, #app, #__next, #__nuxt').length > 0;
  const hasReactRoot = $('[data-reactroot]').length > 0;
  
  // Check for prerender hints
  const hasPrerender = $('meta[name="prerender-status-code"]').length > 0 ||
                       $('meta[name="fragment"]').attr('content') === '!';
  
  // Check for actual content
  const paragraphs = $('p').length;
  const headings = $('h1, h2, h3, h4, h5, h6').length;
  const hasSubstantialContent = paragraphs > 2 || headings > 2;
  
  // Determine rendering mode
  let serverSideRendered = false;
  let jsRenderingRequired = false;
  
  if (hasNextData || hasNuxtData || hasGatsbyData || hasAstroIsland) {
    serverSideRendered = true;
    signals.push('Meta-framework SSR detected');
  }
  
  if (hasMinimalContent && hasRootDiv) {
    jsRenderingRequired = true;
    signals.push('SPA with minimal server content detected');
  }
  
  if (hasSubstantialContent) {
    serverSideRendered = true;
    signals.push('Substantial HTML content present');
  }
  
  if (hasReactRoot && !hasNextData && hasMinimalContent) {
    jsRenderingRequired = true;
    signals.push('Client-side React app detected');
  }
  
  return {
    serverSideRendered,
    jsRenderingRequired,
    hasPrerendering: hasPrerender,
    contentInHTML: hasSubstantialContent,
    signals,
  };
}

/**
 * Analyze content structure for LLM consumption
 */
export function analyzeContentStructure(html: string): ContentStructureResult {
  const $ = cheerio.load(html);
  
  // Check for structured data
  const jsonLdScripts = $('script[type="application/ld+json"]');
  let hasStructuredData = jsonLdScripts.length > 0;
  let hasFAQSchema = false;
  let hasHowToSchema = false;
  let hasArticleSchema = false;
  let hasProductSchema = false;
  
  jsonLdScripts.each((_, el) => {
    try {
      const content = $(el).html() || '';
      if (content.includes('"FAQPage"') || content.includes('"@type":"FAQPage"')) {
        hasFAQSchema = true;
      }
      if (content.includes('"HowTo"') || content.includes('"@type":"HowTo"')) {
        hasHowToSchema = true;
      }
      if (content.includes('"Article"') || content.includes('"BlogPosting"') || 
          content.includes('"NewsArticle"')) {
        hasArticleSchema = true;
      }
      if (content.includes('"Product"')) {
        hasProductSchema = true;
      }
    } catch {}
  });
  
  // Check breadcrumbs
  const hasBreadcrumbs = $('[itemtype*="BreadcrumbList"], .breadcrumb, .breadcrumbs, nav[aria-label*="breadcrumb"]').length > 0 ||
                         html.includes('"BreadcrumbList"');
  
  // Analyze heading hierarchy
  const h1Count = $('h1').length;
  const h2Count = $('h2').length;
  const h3Count = $('h3').length;
  
  let headingHierarchy: 'good' | 'needs-work' | 'poor' = 'poor';
  if (h1Count === 1 && h2Count >= 2 && h3Count >= 0) {
    headingHierarchy = 'good';
  } else if (h1Count === 1 && h2Count >= 1) {
    headingHierarchy = 'needs-work';
  }
  
  // Count content sections
  const contentSections = $('section, article, .section, [class*="section"]').length;
  
  // Count lists and tables (LLMs love these)
  const listsAndTables = $('ul, ol, table, dl').length;
  
  return {
    hasStructuredData,
    hasFAQSchema,
    hasHowToSchema,
    hasArticleSchema,
    hasProductSchema,
    hasBreadcrumbs,
    headingHierarchy,
    contentSections,
    listsAndTables,
  };
}

/**
 * Analyze citation readiness (trust signals for AI)
 */
export function analyzeCitationReadiness(html: string): CitationResult {
  const $ = cheerio.load(html);
  const bodyText = $('body').text();
  
  // Check for citations
  const hasCitations = $('cite, blockquote, [class*="citation"], [class*="reference"]').length > 0 ||
                       /\[\d+\]|\(\d{4}\)/.test(bodyText);
  
  // Check for external links (source references)
  const externalLinks = $('a[href^="http"]').filter((_, el) => {
    const href = $(el).attr('href') || '';
    return !href.includes(new URL(href).hostname);
  });
  const hasExternalLinks = externalLinks.length > 0;
  
  // Check for statistics
  const hasStatistics = /\d+%|\d+\s*(million|billion|thousand)|increased by \d+|decreased by \d+/i.test(bodyText);
  
  // Check for quotes
  const hasQuotes = $('blockquote, q').length > 0 || /"[^"]{20,}"/.test(bodyText);
  
  // Check for author info
  const hasAuthorInfo = $('[rel="author"], .author, [class*="author"], [itemtype*="Person"]').length > 0 ||
                        $('meta[name="author"]').length > 0;
  
  // Check for dates
  const hasPublishDate = $('time[datetime], meta[property="article:published_time"], .publish-date, .date').length > 0;
  const hasLastModified = $('meta[property="article:modified_time"], .updated, .modified').length > 0;
  
  // Collect trust signals
  const trustSignals: string[] = [];
  if (hasCitations) trustSignals.push('Citations present');
  if (hasExternalLinks) trustSignals.push('External source links');
  if (hasStatistics) trustSignals.push('Statistical data');
  if (hasQuotes) trustSignals.push('Expert quotes');
  if (hasAuthorInfo) trustSignals.push('Author attribution');
  if (hasPublishDate) trustSignals.push('Publish date');
  if (hasLastModified) trustSignals.push('Last modified date');
  
  return {
    hasCitations,
    hasExternalLinks,
    hasStatistics,
    hasQuotes,
    hasAuthorInfo,
    hasPublishDate,
    hasLastModified,
    trustSignals,
  };
}

/**
 * Extract entities and structured information
 */
export function analyzeEntityExtraction(html: string): EntityResult {
  const $ = cheerio.load(html);
  const bodyText = $('body').text();
  
  // Look for defined terms (using <dfn>, <abbr>, or definition patterns)
  const definedTerms: string[] = [];
  $('dfn, abbr[title]').each((_, el) => {
    const term = $(el).text().trim();
    if (term) definedTerms.push(term);
  });
  
  // Check for definition patterns
  const hasDefinitions = /is defined as|refers to|means that|is the process of/i.test(bodyText) ||
                         $('dfn, .definition, [class*="definition"]').length > 0;
  
  // Check for comparisons (great for LLM understanding)
  const hasComparisons = /compared to|versus|vs\.|unlike|similar to|difference between/i.test(bodyText) ||
                         $('table[class*="comparison"], .comparison, [class*="versus"]').length > 0;
  
  // Count Q&A pairs (excellent for AI)
  let questionAnswerPairs = 0;
  $('details, .faq-item, [class*="question"], [class*="accordion"]').each(() => {
    questionAnswerPairs++;
  });
  
  // Also check for question patterns in headings
  $('h2, h3, h4').each((_, el) => {
    const text = $(el).text();
    if (/^(what|how|why|when|where|who|which|can|does|is|are|should|will)\s/i.test(text) ||
        text.endsWith('?')) {
      questionAnswerPairs++;
    }
  });
  
  // Extract named entities (basic pattern matching)
  const namedEntities: string[] = [];
  
  // Look for proper nouns in strong/b tags (often company/product names)
  $('strong, b').each((_, el) => {
    const text = $(el).text().trim();
    if (text.length > 2 && text.length < 50 && /^[A-Z]/.test(text)) {
      if (!namedEntities.includes(text)) namedEntities.push(text);
    }
  });
  
  return {
    namedEntities: namedEntities.slice(0, 20), // Limit to top 20
    definedTerms,
    hasDefinitions,
    hasComparisons,
    questionAnswerPairs,
  };
}

/**
 * Calculate LLM-friendliness signals
 */
export function calculateLLMSignals(
  structure: ContentStructureResult,
  citation: CitationResult,
  entity: EntityResult,
  html: string
): LLMSignalResult {
  const $ = cheerio.load(html);
  
  // Content clarity (structure + readability)
  let contentClarity = 0;
  if (structure.headingHierarchy === 'good') contentClarity += 30;
  else if (structure.headingHierarchy === 'needs-work') contentClarity += 15;
  contentClarity += Math.min(structure.listsAndTables * 5, 25); // Lists help clarity
  contentClarity += Math.min(structure.contentSections * 5, 20);
  if (structure.hasBreadcrumbs) contentClarity += 10;
  contentClarity += entity.hasDefinitions ? 15 : 0;
  contentClarity = Math.min(contentClarity, 100);
  
  // Fact density (citations, stats, specifics)
  let factDensity = 0;
  if (citation.hasStatistics) factDensity += 25;
  if (citation.hasCitations) factDensity += 20;
  if (citation.hasExternalLinks) factDensity += 15;
  if (citation.hasQuotes) factDensity += 15;
  factDensity += Math.min(entity.questionAnswerPairs * 5, 25);
  factDensity = Math.min(factDensity, 100);
  
  // Structure quality (schema, hierarchy)
  let structureQuality = 0;
  if (structure.hasStructuredData) structureQuality += 25;
  if (structure.hasFAQSchema) structureQuality += 20;
  if (structure.hasArticleSchema) structureQuality += 15;
  if (structure.hasHowToSchema) structureQuality += 15;
  if (structure.hasProductSchema) structureQuality += 10;
  structureQuality += structure.headingHierarchy === 'good' ? 15 : 0;
  structureQuality = Math.min(structureQuality, 100);
  
  // Citation quality (trust signals)
  let citationQuality = 0;
  citationQuality += citation.trustSignals.length * 12;
  if (citation.hasAuthorInfo) citationQuality += 15;
  if (citation.hasPublishDate && citation.hasLastModified) citationQuality += 15;
  citationQuality = Math.min(citationQuality, 100);
  
  // Overall LLM friendliness
  const overallLLMFriendliness = Math.round(
    (contentClarity * 0.25) +
    (factDensity * 0.25) +
    (structureQuality * 0.30) +
    (citationQuality * 0.20)
  );
  
  return {
    contentClarity,
    factDensity,
    structureQuality,
    citationQuality,
    overallLLMFriendliness,
  };
}

/**
 * Generate GEO-specific issues
 */
export function generateGEOIssues(
  aiAccess: AIAccessResult,
  structure: ContentStructureResult,
  citation: CitationResult,
  entity: EntityResult,
  llmSignals: LLMSignalResult,
  url: string
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  
  // Critical: AI crawler access issues
  if (aiAccess.blockedCrawlers.length > 0) {
    issues.push({
      code: 'GEO_AI_CRAWLERS_BLOCKED',
      severity: 'critical',
      category: 'technical',
      title: `${aiAccess.blockedCrawlers.length} AI crawlers blocked in robots.txt`,
      description: `The following AI crawlers are blocked: ${aiAccess.blockedCrawlers.join(', ')}. This prevents your content from appearing in AI search results.`,
      impact: 'Your content will NOT appear in ChatGPT, Perplexity, or Claude responses',
      howToFix: `Update robots.txt to allow AI crawlers:\n\nUser-agent: GPTBot\nAllow: /\n\nUser-agent: PerplexityBot\nAllow: /\n\nUser-agent: Claude-Web\nAllow: /`,
      affectedUrls: [url],
    });
  }
  
  // Critical: JS rendering required without prerendering
  if (aiAccess.jsRenderingRequired && !aiAccess.hasPrerendering) {
    issues.push({
      code: 'GEO_JS_RENDERING_REQUIRED',
      severity: 'critical',
      category: 'technical',
      title: 'JavaScript rendering required - AI crawlers see blank page',
      description: 'Your site requires JavaScript to render content. Most AI crawlers (GPTBot, PerplexityBot) do not execute JavaScript and will see a blank page.',
      impact: 'Zero visibility in AI search - crawlers cannot access your content',
      howToFix: 'Implement Server-Side Rendering (SSR) or Static Site Generation (SSG). For React: use Next.js. For Vue: use Nuxt. Alternatively, implement a prerendering service.',
      affectedUrls: [url],
    });
  }
  
  // High: No structured data
  if (!structure.hasStructuredData) {
    issues.push({
      code: 'GEO_NO_STRUCTURED_DATA',
      severity: 'warning',
      category: 'technical',
      title: 'No JSON-LD structured data found',
      description: 'Structured data helps AI systems understand your content\'s context, entities, and relationships.',
      impact: 'AI systems may misunderstand or skip your content',
      howToFix: 'Add JSON-LD structured data. At minimum, include Organization, WebPage, and Article/Product schemas.',
      affectedUrls: [url],
    });
  }
  
  // High: No FAQ schema (great for AI)
  if (!structure.hasFAQSchema && entity.questionAnswerPairs > 0) {
    issues.push({
      code: 'GEO_MISSING_FAQ_SCHEMA',
      severity: 'warning',
      category: 'technical',
      title: 'Q&A content without FAQPage schema',
      description: `Found ${entity.questionAnswerPairs} question-answer pairs but no FAQPage schema. FAQ schema is excellent for AI search visibility.`,
      impact: 'Missing opportunity for featured snippets and AI citations',
      howToFix: 'Add FAQPage schema markup for your Q&A content. This dramatically increases chances of being cited by AI.',
      affectedUrls: [url],
    });
  }
  
  // Medium: Poor heading hierarchy
  if (structure.headingHierarchy === 'poor') {
    issues.push({
      code: 'GEO_POOR_HEADING_STRUCTURE',
      severity: 'warning',
      category: 'content',
      title: 'Poor heading hierarchy hurts AI understanding',
      description: 'AI systems use heading structure to understand content organization. Your page lacks a clear H1 → H2 → H3 hierarchy.',
      impact: 'AI may struggle to extract key topics and relationships',
      howToFix: 'Structure content with one H1 (main topic), multiple H2s (subtopics), and H3s (details). Use question-format headings where appropriate.',
      affectedUrls: [url],
    });
  }
  
  // Medium: No citations or sources
  if (!citation.hasCitations && !citation.hasExternalLinks) {
    issues.push({
      code: 'GEO_NO_CITATIONS',
      severity: 'warning',
      category: 'content',
      title: 'No citations or source references',
      description: 'AI systems prioritize content with verifiable sources and citations. Your page lacks external references.',
      impact: 'Lower trust score in AI ranking - may not be cited as authoritative',
      howToFix: 'Add citations, link to authoritative sources, include statistics with references, and add expert quotes.',
      affectedUrls: [url],
    });
  }
  
  // Medium: No author info
  if (!citation.hasAuthorInfo) {
    issues.push({
      code: 'GEO_NO_AUTHOR_INFO',
      severity: 'info',
      category: 'content',
      title: 'Missing author attribution',
      description: 'Author information helps establish E-E-A-T (Experience, Expertise, Authoritativeness, Trustworthiness) for AI systems.',
      impact: 'Lower credibility score in AI ranking algorithms',
      howToFix: 'Add author byline, link to author bio/profile, and consider adding author schema markup.',
      affectedUrls: [url],
    });
  }
  
  // Medium: No publish/update dates
  if (!citation.hasPublishDate || !citation.hasLastModified) {
    issues.push({
      code: 'GEO_NO_DATES',
      severity: 'info',
      category: 'content',
      title: 'Missing publish/update dates',
      description: 'AI systems consider content freshness. Pages without dates may be considered outdated.',
      impact: 'May be deprioritized for time-sensitive queries',
      howToFix: 'Add visible publish date and "last updated" date. Include datePublished and dateModified in schema.',
      affectedUrls: [url],
    });
  }
  
  // Low LLM friendliness
  if (llmSignals.overallLLMFriendliness < 40) {
    issues.push({
      code: 'GEO_LOW_LLM_SCORE',
      severity: 'warning',
      category: 'content',
      title: `Low AI-friendliness score: ${llmSignals.overallLLMFriendliness}/100`,
      description: 'Your content structure and signals are not optimized for AI consumption. AI systems may struggle to extract and cite your content.',
      impact: 'Significantly reduced chances of appearing in AI search results',
      howToFix: 'Improve content structure (clear headings, lists, tables), add citations and statistics, include FAQ sections, and add comprehensive schema markup.',
      affectedUrls: [url],
    });
  }
  
  return issues;
}

/**
 * Main GEO analysis function
 */
export async function analyzeGEO(
  html: string,
  url: string,
  robotsTxt?: string
): Promise<GEOAnalysisResult> {
  // Analyze AI crawler access
  let aiCrawlerAccess: AIAccessResult = {
    robotsTxtAllowsAI: true,
    blockedCrawlers: [],
    allowedCrawlers: Object.keys(AI_CRAWLERS),
    hasPrerendering: false,
    jsRenderingRequired: false,
    serverSideRendered: true,
  };
  
  if (robotsTxt) {
    const robotsAnalysis = analyzeRobotsTxtForAI(robotsTxt);
    aiCrawlerAccess.blockedCrawlers = robotsAnalysis.blocked;
    aiCrawlerAccess.allowedCrawlers = robotsAnalysis.allowed;
    aiCrawlerAccess.robotsTxtAllowsAI = robotsAnalysis.blocked.length === 0;
  }
  
  // Analyze rendering mode
  const renderingMode = detectRenderingMode(html);
  aiCrawlerAccess.hasPrerendering = renderingMode.hasPrerendering;
  aiCrawlerAccess.jsRenderingRequired = renderingMode.jsRenderingRequired;
  aiCrawlerAccess.serverSideRendered = renderingMode.serverSideRendered;
  
  // Analyze content structure
  const contentStructure = analyzeContentStructure(html);
  
  // Analyze citation readiness
  const citationReadiness = analyzeCitationReadiness(html);
  
  // Analyze entity extraction
  const entityExtraction = analyzeEntityExtraction(html);
  
  // Calculate LLM signals
  const llmSignals = calculateLLMSignals(
    contentStructure,
    citationReadiness,
    entityExtraction,
    html
  );
  
  // Generate issues
  const issues = generateGEOIssues(
    aiCrawlerAccess,
    contentStructure,
    citationReadiness,
    entityExtraction,
    llmSignals,
    url
  );
  
  // Generate recommendations
  const recommendations: string[] = [];
  
  if (aiCrawlerAccess.blockedCrawlers.length > 0) {
    recommendations.push('🚨 URGENT: Unblock AI crawlers in robots.txt');
  }
  if (aiCrawlerAccess.jsRenderingRequired) {
    recommendations.push('🚨 URGENT: Implement SSR/SSG for AI crawler access');
  }
  if (!contentStructure.hasFAQSchema && entityExtraction.questionAnswerPairs > 0) {
    recommendations.push('Add FAQPage schema for your Q&A content');
  }
  if (!contentStructure.hasStructuredData) {
    recommendations.push('Add JSON-LD structured data (Article, Organization)');
  }
  if (citationReadiness.trustSignals.length < 3) {
    recommendations.push('Add more trust signals: citations, statistics, author info');
  }
  if (contentStructure.listsAndTables < 2) {
    recommendations.push('Add lists and tables - AI loves structured content');
  }
  if (!entityExtraction.hasDefinitions) {
    recommendations.push('Add clear definitions for key terms');
  }
  if (entityExtraction.questionAnswerPairs < 3) {
    recommendations.push('Add FAQ section with common questions');
  }
  
  // Calculate overall GEO score
  let score = llmSignals.overallLLMFriendliness;
  
  // Penalties
  if (aiCrawlerAccess.blockedCrawlers.length > 0) {
    score -= aiCrawlerAccess.blockedCrawlers.length * 10;
  }
  if (aiCrawlerAccess.jsRenderingRequired && !aiCrawlerAccess.hasPrerendering) {
    score -= 30;
  }
  
  // Bonuses
  if (contentStructure.hasFAQSchema) score += 10;
  if (contentStructure.hasArticleSchema) score += 5;
  if (aiCrawlerAccess.robotsTxtAllowsAI) score += 10;
  
  score = Math.max(0, Math.min(100, score));
  
  return {
    score: Math.round(score),
    aiCrawlerAccess,
    contentStructure,
    citationReadiness,
    entityExtraction,
    llmSignals,
    issues,
    recommendations,
  };
}

/**
 * Generate AI-optimized robots.txt
 */
export function generateAIFriendlyRobotsTxt(siteUrl: string): string {
  return `# AI-Optimized robots.txt
# Generated by RankCLI - https://rankcli.dev

# Allow all standard crawlers
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/
Disallow: /_next/static/
Disallow: /private/

# === AI Search Crawlers ===
# OpenAI (ChatGPT)
User-agent: GPTBot
Allow: /

User-agent: ChatGPT-User
Allow: /

User-agent: OAI-SearchBot
Allow: /

# Anthropic (Claude)
User-agent: Claude-Web
Allow: /

User-agent: anthropic-ai
Allow: /

# Perplexity
User-agent: PerplexityBot
Allow: /

# Google AI (Gemini/Bard)
User-agent: Google-Extended
Allow: /

# Microsoft (Copilot)
User-agent: bingbot
Allow: /

# Apple Intelligence
User-agent: Applebot-Extended
Allow: /

# Meta AI
User-agent: meta-externalagent
Allow: /

# You.com
User-agent: YouBot
Allow: /

# Cohere
User-agent: cohere-ai
Allow: /

# Sitemap
Sitemap: ${siteUrl}/sitemap.xml
`;
}

export const AI_CRAWLERS_INFO = AI_CRAWLERS;
