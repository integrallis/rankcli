/**
 * AI-Powered Keyword Research Engine
 *
 * Tiered access:
 * - FREE: Basic keyword extraction + score teaser
 * - PAID: Full NLP, clustering, embeddings, competitive analysis
 *
 * Based on Bhanu's "Engineering as Marketing" strategy:
 * 1. Find low KD keywords (< 10)
 * 2. High volume (1000+)
 * 3. Relevant to product
 * 4. Easy to build free tools for
 */

import OpenAI from 'openai';
import { crawlSite, extractKeyPhrases, type SiteCrawlResult } from './site-crawler.js';
import { summarizeSite, generateUncertaintyQuestions, type SiteSummary } from './ai-summarizer.js';
import {
  runNLPAnalysis,
  calculateTFIDF,
  extractNgrams,
  tokenize,
  type NLPAnalysisResult,
} from './nlp-analysis.js';
import { getExpandedSuggestions, enrichKeywordsWithEstimates } from './sources/autocomplete.js';
import { getAllFreeKeywordIdeas, applyEstimates } from './sources/free-sources.js';
import type { KeywordData, SiteProfile } from './types.js';
import { prioritizeKeywords } from './prioritizer.js';
import {
  searchCompetitors,
  searchFormatConverters,
  searchHackerNews,
  type CompetitiveSearchResult,
  type CompetitorTool,
  type CompetitiveSearchOptions,
} from './sources/competitive-search.js';
import {
  evaluateAndEnhanceToolIdeas,
  type EnhancedToolIdea,
  type LLMJudgeOptions,
} from './llm-judge.js';

export type PlanTier = 'free' | 'solo' | 'pro' | 'agency';

export interface AIKeywordResearchOptions {
  url: string;
  tier: PlanTier;
  openaiApiKey?: string;
  maxPages?: number;
  userContext?: {
    productDescription?: string;
    targetAudience?: string;
    competitors?: string[];
    mainProblem?: string;
    differentiator?: string;
  };
  wizardResponses?: Array<{ id: string; answer: string }>;
  ciMode?: boolean;
  /** API keys for competitive search (optional but recommended) */
  competitiveSearchKeys?: {
    braveApiKey?: string;
    serperApiKey?: string;
    githubToken?: string;
  };
  /** Enable enhanced tool ideas with LLM judge (default: true for paid tiers) */
  enableEnhancedToolIdeas?: boolean;
}

export interface FreeKeywordResult {
  tier: 'free';
  /** Basic keyword suggestions (limited) */
  keywords: Array<{
    keyword: string;
    estimatedVolume: 'low' | 'medium' | 'high';
    estimatedDifficulty: 'low' | 'medium' | 'high';
    relevance: number;
  }>;
  /** Overall keyword opportunity score (teaser) */
  opportunityScore: number;
  /** Teaser message */
  teaserMessage: string;
  /** What they'd get with upgrade */
  upgradeFeatures: string[];
  /** Basic site understanding */
  siteCategory: string;
  /** Detected keywords count */
  totalKeywordsFound: number;
}

export interface PaidKeywordResult {
  tier: PlanTier;
  /** Site summary from AI */
  siteSummary: SiteSummary;
  /** Full keyword opportunities */
  opportunities: KeywordOpportunity[];
  /** NLP analysis results */
  nlpAnalysis: NLPAnalysisResult;
  /** Keyword clusters */
  clusters: Array<{
    name: string;
    keywords: string[];
    totalVolume: number;
    avgDifficulty: number;
  }>;
  /** Recommended free tools to build */
  freeToolIdeas: FreeToolIdea[];
  /** Competitive positioning */
  competitiveInsights?: CompetitiveInsight[];
  /** Uncertainty assessment */
  uncertainty: UncertaintyAssessment;
  /** Prioritized recommendations */
  recommendations: KeywordRecommendation[];
}

export interface KeywordOpportunity {
  keyword: string;
  volume: number;
  difficulty: number;
  relevance: number;
  opportunityScore: number;
  intent: 'informational' | 'commercial' | 'transactional' | 'navigational';
  suggestedContentType: 'free-tool' | 'landing-page' | 'blog-post' | 'comparison' | 'guide';
  suggestedCTA: string;
  rationale: string;
  cluster?: string;
}

export interface FreeToolIdea {
  keyword: string;
  toolName: string;
  toolDescription: string;
  estimatedEffort: 'low' | 'medium' | 'high';
  ctaConnection: string;
  volume: number;
  difficulty: number;
  priority: number;
  /** Enhanced fields from LLM judge */
  inputFormat?: string;
  outputFormat?: string;
  productTieIn?: string;
  ctaText?: string;
  deepLinkPattern?: string;
  competitors?: {
    hasFreeAlternative: boolean;
    topCompetitor?: string;
    ourAdvantage: string;
  };
  implementationHints?: {
    suggestedLibraries: string[];
    estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    canUseExistingOSS: boolean;
    ossLibrary?: string;
  };
  feasibilityScore?: {
    feasibility: number;
    specificity: number;
    productFit: number;
    marketOpportunity: number;
    overallScore: number;
    passes: boolean;
    reasoning: string;
  };
}

export interface CompetitiveInsight {
  competitor: string;
  theirFocus: 'broad' | 'niche';
  ourAdvantage?: string;
  keywordsTheyRankFor: string[];
  keywordsWeCanTarget: string[];
}

export interface UncertaintyAssessment {
  overallConfidence: number;
  siteUnderstanding: number;
  audienceClarity: number;
  competitiveClarity: number;
  canAutomate: boolean;
  questionsToAsk: Array<{
    id: string;
    question: string;
    impact: number;
    options?: string[];
  }>;
  explanation: string;
}

export interface KeywordRecommendation {
  priority: number;
  keyword: string;
  action: 'build-tool' | 'create-page' | 'write-content' | 'skip' | 'needs-input';
  effort: 'low' | 'medium' | 'high';
  impact: 'low' | 'medium' | 'high';
  rationale: string;
}

/**
 * Run keyword research based on tier
 */
export async function runAIKeywordResearch(
  options: AIKeywordResearchOptions
): Promise<FreeKeywordResult | PaidKeywordResult> {
  const { url, tier, openaiApiKey, maxPages = 20 } = options;

  console.log(`\n🔬 Starting AI Keyword Research (${tier} tier)...\n`);

  // Step 1: Crawl the site
  const crawlResult = await crawlSite(url, { maxPages });

  // Route based on tier
  if (tier === 'free') {
    return runFreeKeywordResearch(crawlResult, options);
  } else {
    if (!openaiApiKey) {
      throw new Error('OpenAI API key required for paid tier keyword research');
    }
    return runPaidKeywordResearch(crawlResult, options);
  }
}

/**
 * FREE TIER: Basic keyword extraction with teaser
 */
async function runFreeKeywordResearch(
  crawlResult: SiteCrawlResult,
  options: AIKeywordResearchOptions
): Promise<FreeKeywordResult> {
  console.log('📊 Running free tier analysis...');

  // Basic TF-IDF analysis (no AI)
  const documents = crawlResult.pages.map((p) => p.mainContent);
  const tfidfResults = calculateTFIDF(documents);

  // Extract key phrases
  const keyPhrases = extractKeyPhrases(crawlResult);

  // Get basic autocomplete suggestions for top terms
  const topTerms = tfidfResults.slice(0, 5).map((r) => r.term);
  let autocompleteKeywords: KeywordData[] = [];

  for (const term of topTerms) {
    try {
      const suggestions = await getExpandedSuggestions(term, {});
      autocompleteKeywords.push(...suggestions.slice(0, 5));
    } catch {
      // Ignore errors
    }
  }

  // Apply volume estimates
  autocompleteKeywords = applyEstimates(enrichKeywordsWithEstimates(autocompleteKeywords));

  // Create limited results (teaser)
  const limitedKeywords = autocompleteKeywords.slice(0, 10).map((kw) => {
    const estimatedVolume: 'low' | 'medium' | 'high' = kw.searchVolume > 5000 ? 'high' : kw.searchVolume > 1000 ? 'medium' : 'low';
    const estimatedDifficulty: 'low' | 'medium' | 'high' = kw.keywordDifficulty > 50 ? 'high' : kw.keywordDifficulty > 20 ? 'medium' : 'low';
    return {
      keyword: kw.keyword,
      estimatedVolume,
      estimatedDifficulty,
      relevance: 0.5 + Math.random() * 0.5, // Simplified relevance
    };
  });

  // Calculate opportunity score
  const opportunityScore = Math.min(
    100,
    Math.round(
      (limitedKeywords.filter((k) => k.estimatedDifficulty === 'low').length / limitedKeywords.length) * 50 +
        (limitedKeywords.filter((k) => k.estimatedVolume !== 'low').length / limitedKeywords.length) * 50
    )
  );

  // Detect site category
  const siteCategory = detectSiteCategory(crawlResult, tfidfResults);

  return {
    tier: 'free',
    keywords: limitedKeywords,
    opportunityScore,
    totalKeywordsFound: autocompleteKeywords.length + keyPhrases.length,
    siteCategory,
    teaserMessage: `We found ${autocompleteKeywords.length + keyPhrases.length} potential keywords for ${crawlResult.domain}. Upgrade to see full analysis with AI-powered insights, keyword clustering, and competitive analysis.`,
    upgradeFeatures: [
      '🧠 AI-powered site analysis',
      '📊 Full keyword data (volume, difficulty, trends)',
      '🎯 Semantic keyword clustering',
      '🛠️ Free tool ideas with CTA suggestions',
      '🏆 Competitive positioning analysis',
      '📈 Prioritized action recommendations',
      '🤖 Uncertainty wizard for better results',
    ],
  };
}

/**
 * PAID TIER: Full AI-powered analysis
 */
async function runPaidKeywordResearch(
  crawlResult: SiteCrawlResult,
  options: AIKeywordResearchOptions
): Promise<PaidKeywordResult> {
  const { openaiApiKey, userContext, wizardResponses, ciMode, competitiveSearchKeys } = options;
  const enableEnhancedToolIdeas = options.enableEnhancedToolIdeas !== false; // Default true

  console.log('🚀 Running full AI analysis...');

  // Step 1: AI Site Summary
  let siteSummary = await summarizeSite(crawlResult, {
    openaiApiKey: openaiApiKey!,
  });

  // Apply user context to improve summary
  if (userContext) {
    siteSummary = applyUserContext(siteSummary, userContext);
  }

  // Apply wizard responses
  if (wizardResponses) {
    siteSummary = applyWizardResponses(siteSummary, wizardResponses);
  }

  // Step 2: Full NLP Analysis
  const documents = crawlResult.pages.map((p) => p.mainContent);
  const nlpAnalysis = await runNLPAnalysis(documents, {
    openaiApiKey,
    numClusters: 8,
    numTopics: 6,
  });

  // Step 3: Generate seed keywords from multiple sources
  const seedKeywords = generateSeedKeywords(siteSummary, nlpAnalysis, crawlResult);

  // Step 4: Expand keywords with autocomplete and volume data
  console.log('🔍 Expanding keyword opportunities...');
  let allKeywords: KeywordData[] = [];

  for (const seed of seedKeywords.slice(0, 15)) {
    try {
      const suggestions = await getExpandedSuggestions(seed, {});
      allKeywords.push(...suggestions.slice(0, 20));

      const freeIdeas = await getAllFreeKeywordIdeas(seed, {
        includeQuestions: true,
        includeModifiers: true,
      });
      allKeywords.push(...freeIdeas);
    } catch {
      // Continue with other seeds
    }
  }

  // Enrich with volume estimates
  allKeywords = applyEstimates(enrichKeywordsWithEstimates(allKeywords));

  // Deduplicate
  const uniqueKeywords = deduplicateKeywords(allKeywords);

  // Step 5: Score and prioritize
  const opportunities = scoreKeywordOpportunities(
    uniqueKeywords,
    siteSummary,
    nlpAnalysis
  );

  // Step 6: Generate free tool ideas with competitive research and LLM judge
  let freeToolIdeas: FreeToolIdea[];

  if (enableEnhancedToolIdeas && openaiApiKey) {
    console.log('🔬 Running enhanced tool idea analysis with competitive research...');
    freeToolIdeas = await generateEnhancedFreeToolIdeas(
      opportunities,
      siteSummary,
      {
        openaiApiKey,
        ...competitiveSearchKeys,
      }
    );
  } else {
    // Fallback to basic tool idea generation
    freeToolIdeas = generateBasicFreeToolIdeas(opportunities, siteSummary);
  }

  // Step 7: Create keyword clusters
  const clusters = createKeywordClusters(opportunities, nlpAnalysis);

  // Step 8: Assess uncertainty
  const uncertainty = assessUncertainty(siteSummary, opportunities, ciMode);

  // Step 9: Generate recommendations
  const recommendations = generateRecommendations(
    opportunities,
    freeToolIdeas,
    uncertainty
  );

  return {
    tier: options.tier,
    siteSummary,
    opportunities: opportunities.slice(0, 100),
    nlpAnalysis,
    clusters,
    freeToolIdeas: freeToolIdeas.slice(0, 20),
    uncertainty,
    recommendations: recommendations.slice(0, 15),
  };
}

/**
 * Generate seed keywords from AI analysis
 */
function generateSeedKeywords(
  summary: SiteSummary,
  nlp: NLPAnalysisResult,
  crawl: SiteCrawlResult
): string[] {
  const seeds = new Set<string>();

  // From AI summary
  summary.suggestedSeedKeywords.forEach((k) => seeds.add(k.toLowerCase()));

  // From key features
  summary.keyFeatures.forEach((f) => {
    const words = tokenize(f);
    if (words.length <= 3) {
      seeds.add(words.join(' '));
    }
  });

  // From problems solved
  summary.problemsSolved.forEach((p) => {
    const words = tokenize(p);
    if (words.length <= 4) {
      seeds.add(words.join(' '));
    }
  });

  // From TF-IDF
  nlp.tfidfKeywords.slice(0, 15).forEach((k) => seeds.add(k.term));

  // From bigrams
  nlp.ngrams.bigrams.slice(0, 10).forEach((g) => seeds.add(g.phrase));

  // From entity phrases
  nlp.entityPhrases.slice(0, 10).forEach((e) => seeds.add(e.toLowerCase()));

  // Product name variations
  const productName = summary.productName.toLowerCase();
  seeds.add(productName);
  seeds.add(`${productName} alternative`);
  seeds.add(`${productName} vs`);
  seeds.add(`best ${summary.industry.toLowerCase()}`);

  // Industry + modifiers
  const industry = summary.industry.toLowerCase();
  seeds.add(`${industry} tool`);
  seeds.add(`${industry} software`);
  seeds.add(`free ${industry}`);
  seeds.add(`${industry} generator`);
  seeds.add(`${industry} ai`);

  return Array.from(seeds).filter((s) => s.length > 2 && s.length < 50);
}

/**
 * Score keyword opportunities
 */
function scoreKeywordOpportunities(
  keywords: KeywordData[],
  summary: SiteSummary,
  nlp: NLPAnalysisResult
): KeywordOpportunity[] {
  const opportunities: KeywordOpportunity[] = [];

  // Get relevance terms from summary
  const relevanceTerms = new Set([
    ...summary.suggestedSeedKeywords.map((k) => k.toLowerCase()),
    ...summary.keyFeatures.flatMap(tokenize),
    ...summary.problemsSolved.flatMap(tokenize),
    summary.industry.toLowerCase(),
    summary.productName.toLowerCase(),
  ]);

  for (const kw of keywords) {
    // Calculate relevance
    const kwTokens = tokenize(kw.keyword);
    const relevance = kwTokens.filter((t) => relevanceTerms.has(t)).length / Math.max(kwTokens.length, 1);

    // Skip very low relevance
    if (relevance < 0.1 && kw.searchVolume < 500) continue;

    // Calculate opportunity score
    // Higher volume + lower difficulty + higher relevance = better opportunity
    const volumeScore = Math.min(1, Math.log10(kw.searchVolume + 1) / 4);
    const difficultyScore = 1 - kw.keywordDifficulty / 100;
    const opportunityScore = Math.round(
      (volumeScore * 0.3 + difficultyScore * 0.4 + relevance * 0.3) * 100
    );

    // Determine intent
    const intent = determineIntent(kw.keyword);

    // Suggest content type
    const suggestedContentType = suggestContentType(kw.keyword, kw.keywordDifficulty, intent);

    // Generate CTA
    const suggestedCTA = generateCTA(kw.keyword, summary);

    // Generate rationale
    const rationale = generateRationale(kw, relevance, summary);

    opportunities.push({
      keyword: kw.keyword,
      volume: kw.searchVolume,
      difficulty: kw.keywordDifficulty,
      relevance: Math.round(relevance * 100),
      opportunityScore,
      intent,
      suggestedContentType,
      suggestedCTA,
      rationale,
    });
  }

  // Sort by opportunity score
  return opportunities.sort((a, b) => b.opportunityScore - a.opportunityScore);
}

/**
 * Generate free tool ideas with competitive research and LLM judge (enhanced version)
 */
async function generateEnhancedFreeToolIdeas(
  opportunities: KeywordOpportunity[],
  summary: SiteSummary,
  options: {
    openaiApiKey: string;
    braveApiKey?: string;
    serperApiKey?: string;
    githubToken?: string;
  }
): Promise<FreeToolIdea[]> {
  // Filter for tool-worthy keywords (low difficulty, decent volume)
  const toolKeywords = opportunities.filter(
    (kw) =>
      kw.difficulty < 30 && // Slightly more lenient
      kw.volume >= 300 && // Slightly lower threshold
      (kw.keyword.includes('generator') ||
        kw.keyword.includes('tool') ||
        kw.keyword.includes('maker') ||
        kw.keyword.includes('builder') ||
        kw.keyword.includes('converter') ||
        kw.keyword.includes('calculator') ||
        kw.keyword.includes('checker') ||
        kw.keyword.includes('validator') ||
        kw.keyword.includes('formatter') ||
        kw.keyword.includes('free') ||
        kw.intent === 'informational')
  );

  // Prepare basic tool ideas for enhancement
  const basicIdeas = toolKeywords.slice(0, 15).map((kw) => ({
    keyword: kw.keyword,
    toolName: generateToolName(kw.keyword),
    toolDescription: generateToolDescription(kw.keyword, summary),
    volume: kw.volume,
    difficulty: kw.difficulty,
  }));

  // Create competitive search function with caching
  const competitiveCache = new Map<string, CompetitiveSearchResult>();

  const getCompetitiveData = async (keyword: string): Promise<CompetitiveSearchResult | null> => {
    // Check cache
    if (competitiveCache.has(keyword)) {
      return competitiveCache.get(keyword)!;
    }

    try {
      const result = await searchCompetitors(keyword, {
        braveApiKey: options.braveApiKey,
        serperApiKey: options.serperApiKey,
        githubToken: options.githubToken,
        maxResults: 5,
      });
      competitiveCache.set(keyword, result);
      return result;
    } catch (error) {
      console.warn(`Competitive search failed for "${keyword}":`, error);
      return null;
    }
  };

  // Evaluate and enhance tool ideas using LLM judge
  const enhancedIdeas = await evaluateAndEnhanceToolIdeas(
    basicIdeas,
    summary,
    getCompetitiveData,
    { openaiApiKey: options.openaiApiKey }
  );

  // Convert enhanced ideas to FreeToolIdea format
  return enhancedIdeas.map((enhanced) => ({
    keyword: enhanced.keyword,
    toolName: enhanced.toolName,
    toolDescription: enhanced.description,
    estimatedEffort: complexityToEffort(enhanced.implementationHints.estimatedComplexity),
    ctaConnection: enhanced.ctaText,
    volume: enhanced.volume,
    difficulty: enhanced.difficulty,
    priority: enhanced.priority,
    inputFormat: enhanced.inputFormat,
    outputFormat: enhanced.outputFormat,
    productTieIn: enhanced.productTieIn,
    ctaText: enhanced.ctaText,
    deepLinkPattern: enhanced.deepLinkPattern,
    competitors: enhanced.competitors,
    implementationHints: enhanced.implementationHints,
    feasibilityScore: {
      feasibility: enhanced.feasibilityScore.feasibility,
      specificity: enhanced.feasibilityScore.specificity,
      productFit: enhanced.feasibilityScore.productFit,
      marketOpportunity: enhanced.feasibilityScore.marketOpportunity,
      overallScore: enhanced.feasibilityScore.overallScore,
      passes: enhanced.feasibilityScore.passes,
      reasoning: enhanced.feasibilityScore.reasoning,
    },
  }));
}

/**
 * Convert complexity to effort level
 */
function complexityToEffort(complexity: 'trivial' | 'simple' | 'moderate' | 'complex'): 'low' | 'medium' | 'high' {
  switch (complexity) {
    case 'trivial':
    case 'simple':
      return 'low';
    case 'moderate':
      return 'medium';
    case 'complex':
      return 'high';
    default:
      return 'medium';
  }
}

/**
 * Generate free tool ideas (basic version - fallback)
 */
function generateBasicFreeToolIdeas(
  opportunities: KeywordOpportunity[],
  summary: SiteSummary
): FreeToolIdea[] {
  const toolIdeas: FreeToolIdea[] = [];

  // Filter for tool-worthy keywords (low difficulty, decent volume)
  const toolKeywords = opportunities.filter(
    (kw) =>
      kw.difficulty < 20 &&
      kw.volume >= 500 &&
      (kw.keyword.includes('generator') ||
        kw.keyword.includes('tool') ||
        kw.keyword.includes('maker') ||
        kw.keyword.includes('builder') ||
        kw.keyword.includes('converter') ||
        kw.keyword.includes('calculator') ||
        kw.keyword.includes('checker') ||
        kw.keyword.includes('free') ||
        kw.intent === 'informational')
  );

  for (const kw of toolKeywords.slice(0, 30)) {
    const toolName = generateToolName(kw.keyword);
    const toolDescription = generateToolDescription(kw.keyword, summary);
    const effort = estimateToolEffort(kw.keyword);
    const ctaConnection = generateToolCTA(kw.keyword, summary);

    // Calculate priority
    const priority = Math.round(
      (kw.volume / 10000) * 30 + // Volume contribution
        ((100 - kw.difficulty) / 100) * 40 + // Difficulty contribution
        (kw.relevance / 100) * 30 // Relevance contribution
    );

    toolIdeas.push({
      keyword: kw.keyword,
      toolName,
      toolDescription,
      estimatedEffort: effort,
      ctaConnection,
      volume: kw.volume,
      difficulty: kw.difficulty,
      priority,
    });
  }

  return toolIdeas.sort((a, b) => b.priority - a.priority);
}

/**
 * Create keyword clusters
 */
function createKeywordClusters(
  opportunities: KeywordOpportunity[],
  nlp: NLPAnalysisResult
): Array<{
  name: string;
  keywords: string[];
  totalVolume: number;
  avgDifficulty: number;
}> {
  // Use NLP clusters if available
  if (nlp.clusters.length > 0) {
    return nlp.clusters.map((cluster) => {
      const clusterOpps = opportunities.filter((o) =>
        cluster.keywords.some(
          (k) => o.keyword.includes(k) || k.includes(o.keyword.split(' ')[0])
        )
      );

      return {
        name: cluster.name,
        keywords: clusterOpps.map((o) => o.keyword),
        totalVolume: clusterOpps.reduce((sum, o) => sum + o.volume, 0),
        avgDifficulty:
          clusterOpps.length > 0
            ? Math.round(clusterOpps.reduce((sum, o) => sum + o.difficulty, 0) / clusterOpps.length)
            : 0,
      };
    });
  }

  // Fallback: group by common terms
  const clusters: Map<string, KeywordOpportunity[]> = new Map();

  for (const opp of opportunities) {
    const mainTerm = opp.keyword.split(' ')[0];
    if (!clusters.has(mainTerm)) {
      clusters.set(mainTerm, []);
    }
    clusters.get(mainTerm)!.push(opp);
  }

  return Array.from(clusters.entries())
    .filter(([_, opps]) => opps.length >= 2)
    .map(([name, opps]) => ({
      name,
      keywords: opps.map((o) => o.keyword),
      totalVolume: opps.reduce((sum, o) => sum + o.volume, 0),
      avgDifficulty: Math.round(opps.reduce((sum, o) => sum + o.difficulty, 0) / opps.length),
    }))
    .sort((a, b) => b.totalVolume - a.totalVolume)
    .slice(0, 10);
}

/**
 * Assess uncertainty for CI mode
 */
function assessUncertainty(
  summary: SiteSummary,
  opportunities: KeywordOpportunity[],
  ciMode?: boolean
): UncertaintyAssessment {
  const siteUnderstanding = summary.confidence;
  const audienceClarity = summary.targetAudience.includes('Unknown') ? 0.3 : 0.8;
  const competitiveClarity = 0.5; // Would be higher with competitor analysis

  // Average relevance of top keywords
  const topOpps = opportunities.slice(0, 20);
  const avgRelevance = topOpps.length > 0
    ? topOpps.reduce((sum, o) => sum + o.relevance, 0) / topOpps.length / 100
    : 0.5;

  const overallConfidence =
    (siteUnderstanding + audienceClarity + competitiveClarity + avgRelevance) / 4;

  // In CI mode, require higher confidence
  const threshold = ciMode ? 0.7 : 0.5;
  const canAutomate = overallConfidence >= threshold;

  // Generate questions to reduce uncertainty
  const questions = generateUncertaintyQuestions(summary);

  let explanation: string;
  if (canAutomate) {
    explanation = `Confidence is ${Math.round(overallConfidence * 100)}%. Keyword recommendations can be automated.`;
  } else {
    explanation = `Confidence is only ${Math.round(overallConfidence * 100)}%. ${
      ciMode
        ? 'CI mode requires 70% confidence. Please run the keyword wizard to provide more context.'
        : 'Consider running the keyword wizard for better results.'
    }`;
  }

  return {
    overallConfidence,
    siteUnderstanding,
    audienceClarity,
    competitiveClarity,
    canAutomate,
    questionsToAsk: questions,
    explanation,
  };
}

/**
 * Generate prioritized recommendations
 */
function generateRecommendations(
  opportunities: KeywordOpportunity[],
  toolIdeas: FreeToolIdea[],
  uncertainty: UncertaintyAssessment
): KeywordRecommendation[] {
  const recommendations: KeywordRecommendation[] = [];
  let priority = 1;

  // If uncertainty is high, first recommendation is to run wizard
  if (!uncertainty.canAutomate) {
    recommendations.push({
      priority: priority++,
      keyword: '',
      action: 'needs-input',
      effort: 'low',
      impact: 'high',
      rationale: `Run the keyword wizard to answer ${uncertainty.questionsToAsk.length} questions and improve recommendation accuracy.`,
    });
  }

  // Add top free tool ideas
  for (const tool of toolIdeas.slice(0, 5)) {
    recommendations.push({
      priority: priority++,
      keyword: tool.keyword,
      action: 'build-tool',
      effort: tool.estimatedEffort,
      impact: tool.volume > 2000 ? 'high' : tool.volume > 500 ? 'medium' : 'low',
      rationale: `Build "${tool.toolName}": ${tool.volume} monthly searches, KD ${tool.difficulty}. ${tool.ctaConnection}`,
    });
  }

  // Add top content opportunities
  const contentOpps = opportunities
    .filter((o) => o.suggestedContentType !== 'free-tool' && o.difficulty < 30)
    .slice(0, 5);

  for (const opp of contentOpps) {
    recommendations.push({
      priority: priority++,
      keyword: opp.keyword,
      action: opp.suggestedContentType === 'landing-page' ? 'create-page' : 'write-content',
      effort: opp.suggestedContentType === 'guide' ? 'high' : 'medium',
      impact: opp.volume > 2000 ? 'high' : opp.volume > 500 ? 'medium' : 'low',
      rationale: opp.rationale,
    });
  }

  return recommendations;
}

// Helper functions

function detectSiteCategory(
  crawl: SiteCrawlResult,
  tfidf: Array<{ term: string; tfidf: number }>
): string {
  const topTerms = tfidf.slice(0, 20).map((t) => t.term);
  const text = topTerms.join(' ');

  if (text.includes('saas') || text.includes('software') || text.includes('app')) {
    return 'SaaS/Software';
  }
  if (text.includes('shop') || text.includes('buy') || text.includes('product')) {
    return 'E-commerce';
  }
  if (text.includes('blog') || text.includes('article') || text.includes('news')) {
    return 'Content/Media';
  }
  if (text.includes('agency') || text.includes('service') || text.includes('consult')) {
    return 'Agency/Services';
  }

  return 'General';
}

function deduplicateKeywords(keywords: KeywordData[]): KeywordData[] {
  const seen = new Map<string, KeywordData>();
  for (const kw of keywords) {
    const key = kw.keyword.toLowerCase().trim();
    const existing = seen.get(key);
    if (!existing || kw.searchVolume > existing.searchVolume) {
      seen.set(key, kw);
    }
  }
  return Array.from(seen.values());
}

function determineIntent(keyword: string): 'informational' | 'commercial' | 'transactional' | 'navigational' {
  const kw = keyword.toLowerCase();
  if (kw.includes('how to') || kw.includes('what is') || kw.includes('guide') || kw.includes('tutorial')) {
    return 'informational';
  }
  if (kw.includes('buy') || kw.includes('price') || kw.includes('cost') || kw.includes('purchase')) {
    return 'transactional';
  }
  if (kw.includes('best') || kw.includes('top') || kw.includes('review') || kw.includes('vs')) {
    return 'commercial';
  }
  return 'informational';
}

function suggestContentType(
  keyword: string,
  difficulty: number,
  intent: string
): 'free-tool' | 'landing-page' | 'blog-post' | 'comparison' | 'guide' {
  const kw = keyword.toLowerCase();

  if (kw.includes('generator') || kw.includes('tool') || kw.includes('maker') || kw.includes('calculator')) {
    return 'free-tool';
  }
  if (kw.includes('vs') || kw.includes('alternative') || kw.includes('comparison')) {
    return 'comparison';
  }
  if (intent === 'commercial' && difficulty < 30) {
    return 'landing-page';
  }
  if (kw.includes('guide') || kw.includes('how to') || kw.includes('tutorial')) {
    return 'guide';
  }
  return 'blog-post';
}

function generateCTA(keyword: string, summary: SiteSummary): string {
  const product = summary.productName;
  const kw = keyword.toLowerCase();

  if (kw.includes('generator') || kw.includes('tool')) {
    return `Try ${product} for more advanced ${summary.industry.toLowerCase()} features →`;
  }
  if (kw.includes('free')) {
    return `${product} offers a free tier with even more capabilities →`;
  }
  return `Discover how ${product} can help with ${kw.split(' ').slice(0, 3).join(' ')} →`;
}

function generateRationale(kw: KeywordData, relevance: number, summary: SiteSummary): string {
  const parts: string[] = [];

  if (kw.keywordDifficulty < 20) {
    parts.push('Low competition - easy to rank');
  } else if (kw.keywordDifficulty < 40) {
    parts.push('Moderate competition');
  }

  if (kw.searchVolume > 5000) {
    parts.push('High search volume');
  } else if (kw.searchVolume > 1000) {
    parts.push('Decent search volume');
  }

  if (relevance > 0.7) {
    parts.push('Highly relevant to your product');
  } else if (relevance > 0.4) {
    parts.push('Related to your industry');
  }

  return parts.join('. ') + '.';
}

function generateToolName(keyword: string): string {
  const kw = keyword.toLowerCase();
  const words = kw.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1));

  if (kw.includes('generator')) {
    return words.join(' ');
  }
  if (kw.includes('checker') || kw.includes('validator')) {
    return words.join(' ');
  }

  return `Free ${words.join(' ')} Tool`;
}

function generateToolDescription(keyword: string, summary: SiteSummary): string {
  return `A free ${keyword} tool. Use it to ${keyword.replace('generator', 'generate').replace('checker', 'check')}. Try ${summary.productName} for more advanced features.`;
}

function estimateToolEffort(keyword: string): 'low' | 'medium' | 'high' {
  const kw = keyword.toLowerCase();

  if (kw.includes('calculator') || kw.includes('converter') || kw.includes('counter')) {
    return 'low';
  }
  if (kw.includes('generator') || kw.includes('maker')) {
    return 'medium';
  }
  if (kw.includes('analyzer') || kw.includes('checker') || kw.includes('builder')) {
    return 'high';
  }

  return 'medium';
}

function generateToolCTA(keyword: string, summary: SiteSummary): string {
  return `"Like this free tool? ${summary.productName} can do much more - ${summary.valueProposition || `try ${summary.productName} free`}"`;
}

function applyUserContext(summary: SiteSummary, context: AIKeywordResearchOptions['userContext']): SiteSummary {
  if (!context) return summary;

  return {
    ...summary,
    productDescription: context.productDescription || summary.productDescription,
    targetAudience: context.targetAudience || summary.targetAudience,
    problemsSolved: context.mainProblem
      ? [context.mainProblem, ...summary.problemsSolved]
      : summary.problemsSolved,
    nicheFocus: context.differentiator || summary.nicheFocus,
    confidence: Math.min(1, summary.confidence + 0.2), // Boost confidence with user input
    uncertainties: summary.uncertainties.filter(
      (u) =>
        !(context.targetAudience && u.includes('audience')) &&
        !(context.mainProblem && u.includes('problem'))
    ),
  };
}

function applyWizardResponses(
  summary: SiteSummary,
  responses: Array<{ id: string; answer: string }>
): SiteSummary {
  let updated = { ...summary };
  let confidenceBoost = 0;

  for (const response of responses) {
    switch (response.id) {
      case 'target_audience':
        updated.targetAudience = response.answer;
        confidenceBoost += 0.15;
        break;
      case 'industry':
        updated.industry = response.answer;
        confidenceBoost += 0.1;
        break;
      case 'main_problem':
        updated.problemsSolved = [response.answer, ...updated.problemsSolved];
        confidenceBoost += 0.15;
        break;
      case 'differentiator':
        updated.nicheFocus = response.answer;
        confidenceBoost += 0.1;
        break;
    }
  }

  updated.confidence = Math.min(1, updated.confidence + confidenceBoost);
  updated.uncertainties = updated.uncertainties.filter(
    (u) => !responses.some((r) => u.toLowerCase().includes(r.id.replace('_', ' ')))
  );

  return updated;
}
