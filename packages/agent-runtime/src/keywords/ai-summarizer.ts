/**
 * AI-Powered Site Summarizer
 *
 * Uses OpenAI to understand what a site does from crawled content.
 * Extracts: product, audience, features, industry, positioning.
 */

import OpenAI from 'openai';
import type { SiteCrawlResult } from './site-crawler.js';

export interface SiteSummary {
  /** Primary product/service name */
  productName: string;
  /** What the product does (1-2 sentences) */
  productDescription: string;
  /** Target audience description */
  targetAudience: string;
  /** Key features/benefits (3-7 items) */
  keyFeatures: string[];
  /** Industry/category */
  industry: string;
  /** Business model */
  businessModel: 'saas' | 'ecommerce' | 'marketplace' | 'agency' | 'media' | 'other';
  /** Unique value proposition */
  valueProposition: string;
  /** Niche focus (if specific segment) */
  nicheFocus?: string;
  /** Pricing tier detected */
  pricingTier?: 'free' | 'freemium' | 'paid' | 'enterprise' | 'unknown';
  /** Geographic focus */
  geographicFocus?: string;
  /** Primary use cases */
  useCases: string[];
  /** Problems solved */
  problemsSolved: string[];
  /** Seed keyword suggestions */
  suggestedSeedKeywords: string[];
  /** Confidence score (0-1) */
  confidence: number;
  /** What we're uncertain about */
  uncertainties: string[];
}

export interface SummarizerOptions {
  openaiApiKey: string;
  model?: string;
  maxTokens?: number;
}

const SUMMARIZER_PROMPT = `You are an expert SEO analyst. Analyze the following website content and extract key information for keyword research.

WEBSITE CONTENT:
{content}

HEADINGS FOUND:
{headings}

PAGE TYPES DETECTED:
- Product pages: {productPages}
- Pricing pages: {pricingPages}
- Blog posts: {blogPages}
- Feature pages: {featurePages}

Analyze this content and respond with a JSON object containing:

{
  "productName": "The name of the product/service",
  "productDescription": "What it does in 1-2 sentences",
  "targetAudience": "Who this is for (be specific)",
  "keyFeatures": ["feature1", "feature2", "..."],
  "industry": "The industry/category (e.g., 'Marketing Automation', 'Project Management')",
  "businessModel": "saas|ecommerce|marketplace|agency|media|other",
  "valueProposition": "The unique value proposition",
  "nicheFocus": "Specific niche if focused (e.g., 'small businesses', 'developers'), or null if broad",
  "pricingTier": "free|freemium|paid|enterprise|unknown",
  "geographicFocus": "Geographic focus if any, or null",
  "useCases": ["use case 1", "use case 2", "..."],
  "problemsSolved": ["problem 1", "problem 2", "..."],
  "suggestedSeedKeywords": ["keyword1", "keyword2", "..."],
  "confidence": 0.0 to 1.0,
  "uncertainties": ["What we couldn't determine from the content"]
}

IMPORTANT:
- suggestedSeedKeywords should include: product category keywords, feature keywords, problem keywords, and audience keywords
- Be specific about the niche - don't say "businesses" if you can say "small e-commerce stores"
- confidence should be low if the content is thin or unclear
- List specific uncertainties that would need user input to resolve

Respond ONLY with the JSON object, no other text.`;

/**
 * Summarize a site using AI
 */
export async function summarizeSite(
  crawlResult: SiteCrawlResult,
  options: SummarizerOptions
): Promise<SiteSummary> {
  const openai = new OpenAI({ apiKey: options.openaiApiKey });
  const model = options.model || 'gpt-4o-mini';

  // Prepare content (limit for token constraints)
  let content = crawlResult.aggregatedContent;
  if (content.length > 15000) {
    content = content.substring(0, 15000) + '\n...[truncated]';
  }

  // Prepare headings
  const headings = crawlResult.uniqueHeadings.slice(0, 30).join('\n');

  // Build prompt
  const prompt = SUMMARIZER_PROMPT
    .replace('{content}', content)
    .replace('{headings}', headings)
    .replace('{productPages}', String(crawlResult.detectedPageTypes.product))
    .replace('{pricingPages}', String(crawlResult.detectedPageTypes.pricing))
    .replace('{blogPages}', String(crawlResult.detectedPageTypes.blog))
    .replace('{featurePages}', String(crawlResult.detectedPageTypes.feature));

  console.log('🤖 Analyzing site content with AI...');

  try {
    const response = await openai.chat.completions.create({
      model,
      messages: [
        {
          role: 'system',
          content: 'You are an expert SEO analyst. Always respond with valid JSON only.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.3,
      max_tokens: options.maxTokens || 2000,
    });

    const responseText = response.choices[0]?.message?.content || '';

    // Parse JSON response
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const summary = JSON.parse(jsonMatch[0]) as SiteSummary;

    // Validate and set defaults
    return {
      productName: summary.productName || 'Unknown Product',
      productDescription: summary.productDescription || 'No description available',
      targetAudience: summary.targetAudience || 'General audience',
      keyFeatures: summary.keyFeatures || [],
      industry: summary.industry || 'Unknown',
      businessModel: summary.businessModel || 'other',
      valueProposition: summary.valueProposition || '',
      nicheFocus: summary.nicheFocus || undefined,
      pricingTier: summary.pricingTier || 'unknown',
      geographicFocus: summary.geographicFocus || undefined,
      useCases: summary.useCases || [],
      problemsSolved: summary.problemsSolved || [],
      suggestedSeedKeywords: summary.suggestedSeedKeywords || [],
      confidence: Math.min(1, Math.max(0, summary.confidence || 0.5)),
      uncertainties: summary.uncertainties || [],
    };
  } catch (error) {
    console.error('AI summarization failed:', error);

    // Return fallback summary
    return createFallbackSummary(crawlResult);
  }
}

/**
 * Create a basic summary without AI (fallback)
 */
export function createFallbackSummary(crawlResult: SiteCrawlResult): SiteSummary {
  // Extract from page titles
  const titles = crawlResult.pages.map((p) => p.title).filter(Boolean);
  const productName = titles[0]?.split(/[|\-–—:]/)[0]?.trim() || crawlResult.domain;

  // Extract key phrases from headings
  const keyFeatures = crawlResult.uniqueHeadings
    .filter((h) => h.length > 5 && h.length < 60)
    .slice(0, 7);

  // Extract potential seed keywords from titles and headings
  const allText = [...titles, ...crawlResult.uniqueHeadings].join(' ').toLowerCase();
  const words = allText.split(/\s+/).filter((w) => w.length > 4);
  const wordFreq = new Map<string, number>();
  for (const word of words) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }
  const suggestedSeedKeywords = Array.from(wordFreq.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);

  // Detect business model from page types
  let businessModel: SiteSummary['businessModel'] = 'other';
  if (crawlResult.detectedPageTypes.pricing > 0) {
    businessModel = 'saas';
  } else if (crawlResult.detectedPageTypes.product > 2) {
    businessModel = 'ecommerce';
  }

  return {
    productName,
    productDescription: `Website at ${crawlResult.domain}`,
    targetAudience: 'Unknown - requires AI analysis or user input',
    keyFeatures,
    industry: 'Unknown',
    businessModel,
    valueProposition: '',
    useCases: [],
    problemsSolved: [],
    suggestedSeedKeywords,
    confidence: 0.2, // Low confidence for fallback
    uncertainties: [
      'Target audience could not be determined',
      'Industry classification is uncertain',
      'Value proposition is unclear',
      'Use cases need user input',
    ],
  };
}

/**
 * Enhance summary with competitive context
 */
export async function enhanceSummaryWithCompetitors(
  summary: SiteSummary,
  competitors: string[],
  options: SummarizerOptions
): Promise<SiteSummary & { competitivePositioning: string }> {
  const openai = new OpenAI({ apiKey: options.openaiApiKey });

  const prompt = `Given this product summary:
Product: ${summary.productName}
Description: ${summary.productDescription}
Industry: ${summary.industry}
Key Features: ${summary.keyFeatures.join(', ')}

And these competitors: ${competitors.join(', ')}

Analyze the competitive positioning. If this product focuses on a niche segment while competitors are broader, identify that advantage. Respond with JSON:

{
  "competitivePositioning": "Description of how this product is positioned vs competitors",
  "nicheAdvantages": ["advantage1", "advantage2"],
  "competitorKeywordsToTarget": ["keyword1", "keyword2"],
  "competitorKeywordsToAvoid": ["keyword1", "keyword2"],
  "updatedUncertainties": ["uncertainty1", "uncertainty2"]
}`;

  try {
    const response = await openai.chat.completions.create({
      model: options.model || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: 'Respond with valid JSON only.' },
        { role: 'user', content: prompt },
      ],
      temperature: 0.3,
      max_tokens: 1000,
    });

    const responseText = response.choices[0]?.message?.content || '';
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const analysis = JSON.parse(jsonMatch[0]);
      return {
        ...summary,
        competitivePositioning: analysis.competitivePositioning || '',
        suggestedSeedKeywords: [
          ...summary.suggestedSeedKeywords,
          ...(analysis.competitorKeywordsToTarget || []),
        ],
        uncertainties: [
          ...summary.uncertainties.filter(
            (u) => !analysis.updatedUncertainties?.includes(u)
          ),
          ...(analysis.updatedUncertainties || []),
        ],
      };
    }
  } catch (error) {
    console.error('Competitive analysis failed:', error);
  }

  return { ...summary, competitivePositioning: '' };
}

/**
 * Generate questions to reduce uncertainty
 */
export function generateUncertaintyQuestions(
  summary: SiteSummary
): Array<{
  id: string;
  question: string;
  category: string;
  impact: number;
  options?: string[];
}> {
  const questions: Array<{
    id: string;
    question: string;
    category: string;
    impact: number;
    options?: string[];
  }> = [];

  // Always ask about target audience if uncertain
  if (summary.confidence < 0.7 || summary.targetAudience.includes('Unknown')) {
    questions.push({
      id: 'target_audience',
      question: 'Who is your primary target customer?',
      category: 'audience',
      impact: 0.3,
      options: [
        'Small businesses (1-50 employees)',
        'Mid-market companies (50-500 employees)',
        'Enterprise (500+ employees)',
        'Developers/Technical users',
        'Marketing teams',
        'Individual consumers',
        'Freelancers/Agencies',
      ],
    });
  }

  // Ask about industry if uncertain
  if (summary.industry === 'Unknown' || summary.confidence < 0.6) {
    questions.push({
      id: 'industry',
      question: 'What industry or category best describes your product?',
      category: 'product',
      impact: 0.25,
    });
  }

  // Ask about main problem solved
  if (summary.problemsSolved.length === 0) {
    questions.push({
      id: 'main_problem',
      question: 'What is the main problem your product solves?',
      category: 'product',
      impact: 0.35,
    });
  }

  // Ask about competitors
  questions.push({
    id: 'competitors',
    question: 'Who are your main competitors? (comma-separated)',
    category: 'competition',
    impact: 0.2,
  });

  // Ask about differentiator
  if (!summary.nicheFocus) {
    questions.push({
      id: 'differentiator',
      question: 'What makes your product different from competitors?',
      category: 'positioning',
      impact: 0.25,
    });
  }

  // Ask about goals
  questions.push({
    id: 'seo_goals',
    question: 'What are your SEO goals?',
    category: 'goals',
    impact: 0.15,
    options: [
        'Get more signups/trials',
      'Generate leads',
      'Build brand awareness',
      'Drive organic traffic',
      'Rank for specific keywords',
    ],
  });

  return questions.sort((a, b) => b.impact - a.impact);
}
