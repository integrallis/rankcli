/**
 * LLM-as-Judge Module
 *
 * Uses AI to evaluate tool feasibility, specificity, and product fit.
 * Prevents vague or unbuildable tool suggestions.
 */

import OpenAI from 'openai';
import type { CompetitorTool, CompetitiveSearchResult } from './sources/competitive-search.js';
import type { SiteSummary } from './ai-summarizer.js';

export interface ToolFeasibilityScore {
  /** Overall feasibility score 1-5 */
  feasibility: number;
  /** Specificity score 1-5 (how detailed/actionable is the idea?) */
  specificity: number;
  /** Product fit score 1-5 (how well does it tie into the main product?) */
  productFit: number;
  /** Market opportunity score 1-5 */
  marketOpportunity: number;
  /** Combined weighted score */
  overallScore: number;
  /** Pass/fail based on minimum threshold */
  passes: boolean;
  /** Explanation for the scores */
  reasoning: string;
  /** Issues that would prevent building */
  blockers: string[];
  /** Improvements to make the tool more specific */
  improvements: string[];
}

export interface EnhancedToolIdea {
  keyword: string;
  toolName: string;
  description: string;
  /** Specific input format (e.g., "PlantUML text syntax") */
  inputFormat: string;
  /** Specific output format (e.g., "Mermaid diagram code") */
  outputFormat: string;
  /** How this tool connects back to the main product */
  productTieIn: string;
  /** Specific CTA text */
  ctaText: string;
  /** Deep link into product if possible */
  deepLinkPattern?: string;
  /** Competitor analysis */
  competitors: {
    hasFreeAlternative: boolean;
    topCompetitor?: string;
    ourAdvantage: string;
  };
  /** Technical implementation hints */
  implementationHints: {
    suggestedLibraries: string[];
    estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex';
    canUseExistingOSS: boolean;
    ossLibrary?: string;
  };
  /** Feasibility assessment */
  feasibilityScore: ToolFeasibilityScore;
  /** Search volume and difficulty from keyword data */
  volume: number;
  difficulty: number;
  priority: number;
}

export interface LLMJudgeOptions {
  openaiApiKey: string;
  minFeasibilityScore?: number; // Default: 3
  minSpecificityScore?: number; // Default: 3
  minProductFitScore?: number; // Default: 2
}

/**
 * Evaluate a tool idea for feasibility, specificity, and product fit
 */
export async function evaluateToolFeasibility(
  toolIdea: {
    keyword: string;
    toolName: string;
    toolDescription: string;
  },
  siteSummary: SiteSummary,
  competitiveData: CompetitiveSearchResult | null,
  options: LLMJudgeOptions
): Promise<ToolFeasibilityScore> {
  const openai = new OpenAI({ apiKey: options.openaiApiKey });

  const minFeasibility = options.minFeasibilityScore ?? 3;
  const minSpecificity = options.minSpecificityScore ?? 3;
  const minProductFit = options.minProductFitScore ?? 2;

  const competitorInfo = competitiveData
    ? `
Existing competitors found:
${competitiveData.existingTools.slice(0, 5).map(t => `- ${t.name}: ${t.isPaid ? 'Paid' : 'Free'} - ${t.description}`).join('\n')}

Open source options:
${competitiveData.openSourceOptions.slice(0, 5).map(t => `- ${t.name} (${t.stars || 0} stars): ${t.description}`).join('\n')}

Market insights:
- Has free solutions: ${competitiveData.marketInsights.hasFreeSolutions}
- Has paid solutions: ${competitiveData.marketInsights.hasPaidSolutions}
- Dominant player: ${competitiveData.marketInsights.dominantPlayer || 'None identified'}
- Market gap: ${competitiveData.marketInsights.marketGap || 'None identified'}
`
    : 'No competitive data available.';

  const prompt = `You are evaluating a free tool idea for feasibility and quality. Be STRICT - reject vague or unbuildable ideas.

## Main Product Context
- Product: ${siteSummary.productName}
- Description: ${siteSummary.productDescription}
- Industry: ${siteSummary.industry}
- Key features: ${siteSummary.keyFeatures.join(', ')}
- Target audience: ${siteSummary.targetAudience}

## Tool Idea to Evaluate
- Keyword: ${toolIdea.keyword}
- Tool Name: ${toolIdea.toolName}
- Description: ${toolIdea.toolDescription}

## Competitive Landscape
${competitorInfo}

## Evaluation Criteria

Rate each criterion 1-5:

### 1. FEASIBILITY (Can this actually be built?)
- 1: Impossible or would require AI that doesn't exist
- 2: Extremely complex, would take months
- 3: Buildable in 1-2 weeks with moderate effort
- 4: Buildable in a few days
- 5: Trivial, could be done in hours

### 2. SPECIFICITY (Is it detailed enough to build?)
- 1: Completely vague, no actionable details
- 2: Missing critical details (what inputs? what outputs?)
- 3: Has basic details but needs refinement
- 4: Clear inputs/outputs/purpose
- 5: Fully specified, ready to implement

### 3. PRODUCT FIT (Does it connect to the main product?)
- 1: No connection whatsoever
- 2: Tangentially related industry
- 3: Same audience, different use case
- 4: Natural lead-in to product features
- 5: Direct integration possible (e.g., output feeds into product)

### 4. MARKET OPPORTUNITY (Is there demand + can we win?)
- 1: Saturated market with dominant free player
- 2: Many free alternatives exist
- 3: Some alternatives but room for improvement
- 4: Few alternatives, clear differentiation possible
- 5: No free alternatives, high search volume

Respond in JSON:
{
  "feasibility": <1-5>,
  "specificity": <1-5>,
  "productFit": <1-5>,
  "marketOpportunity": <1-5>,
  "reasoning": "<2-3 sentences explaining scores>",
  "blockers": ["<issues that prevent building>"],
  "improvements": ["<suggestions to make it more specific/buildable>"]
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o-mini',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.3,
  });

  const result = JSON.parse(response.choices[0].message.content || '{}');

  // Calculate overall score (weighted average)
  const overallScore =
    result.feasibility * 0.3 +
    result.specificity * 0.3 +
    result.productFit * 0.2 +
    result.marketOpportunity * 0.2;

  // Determine pass/fail
  const passes =
    result.feasibility >= minFeasibility &&
    result.specificity >= minSpecificity &&
    result.productFit >= minProductFit;

  return {
    feasibility: result.feasibility,
    specificity: result.specificity,
    productFit: result.productFit,
    marketOpportunity: result.marketOpportunity,
    overallScore: Math.round(overallScore * 10) / 10,
    passes,
    reasoning: result.reasoning,
    blockers: result.blockers || [],
    improvements: result.improvements || [],
  };
}

/**
 * Enhance a tool idea with specific details using AI
 */
export async function enhanceToolIdea(
  toolIdea: {
    keyword: string;
    toolName: string;
    toolDescription: string;
    volume: number;
    difficulty: number;
  },
  siteSummary: SiteSummary,
  competitiveData: CompetitiveSearchResult | null,
  options: LLMJudgeOptions
): Promise<EnhancedToolIdea | null> {
  const openai = new OpenAI({ apiKey: options.openaiApiKey });

  // First, evaluate feasibility
  const feasibilityScore = await evaluateToolFeasibility(
    toolIdea,
    siteSummary,
    competitiveData,
    options
  );

  // If it doesn't pass minimum thresholds, skip it
  if (!feasibilityScore.passes) {
    console.log(`⚠️ Skipping "${toolIdea.toolName}" - failed feasibility check: ${feasibilityScore.reasoning}`);
    return null;
  }

  // Now enhance with specific details
  const prompt = `You are specifying a free tool idea in detail. The tool must be:
1. SPECIFIC - exact input/output formats
2. BUILDABLE - realistic scope for 1-2 day build
3. CONNECTED - ties back to the main product

## Main Product
- Name: ${siteSummary.productName}
- Description: ${siteSummary.productDescription}
- Key features: ${siteSummary.keyFeatures.join(', ')}

## Tool to Specify
- Keyword: ${toolIdea.keyword}
- Current Name: ${toolIdea.toolName}
- Current Description: ${toolIdea.toolDescription}

## Competitive Intelligence
${competitiveData?.existingTools.slice(0, 3).map(t => `- ${t.name} (${t.isPaid ? 'Paid' : 'Free'})`).join('\n') || 'No competitors found'}
${competitiveData?.openSourceOptions.slice(0, 3).map(t => `- OSS: ${t.name} (${t.stars} stars)`).join('\n') || ''}

## Required Output (JSON)
{
  "toolName": "<improved, specific name>",
  "description": "<2-3 sentence specific description of what it does>",
  "inputFormat": "<exact input format, e.g., 'PlantUML text syntax' or 'JSON with nested objects'>",
  "outputFormat": "<exact output format, e.g., 'Mermaid diagram code' or 'CSV file'>",
  "productTieIn": "<how this leads users to the main product>",
  "ctaText": "<specific CTA, e.g., 'See your diagram animated in ${siteSummary.productName} →'>",
  "deepLinkPattern": "<URL pattern if output can link into product, e.g., '/editor?import={output}' or null>",
  "ourAdvantage": "<why our version is better than existing options>",
  "suggestedLibraries": ["<npm/github libraries that could power this>"],
  "estimatedComplexity": "<trivial|simple|moderate|complex>",
  "canUseExistingOSS": <true if an OSS library does most of the work>,
  "ossLibrary": "<name of OSS library to use, or null>"
}`;

  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    temperature: 0.5,
  });

  const enhanced = JSON.parse(response.choices[0].message.content || '{}');

  // Calculate priority based on scores and metrics
  const priority = Math.round(
    feasibilityScore.overallScore * 20 +
    (toolIdea.volume / 1000) * 10 +
    ((100 - toolIdea.difficulty) / 100) * 20
  );

  return {
    keyword: toolIdea.keyword,
    toolName: enhanced.toolName || toolIdea.toolName,
    description: enhanced.description || toolIdea.toolDescription,
    inputFormat: enhanced.inputFormat || 'Unspecified',
    outputFormat: enhanced.outputFormat || 'Unspecified',
    productTieIn: enhanced.productTieIn || '',
    ctaText: enhanced.ctaText || `Try ${siteSummary.productName} for more →`,
    deepLinkPattern: enhanced.deepLinkPattern || undefined,
    competitors: {
      hasFreeAlternative: competitiveData?.marketInsights.hasFreeSolutions || false,
      topCompetitor: competitiveData?.marketInsights.dominantPlayer,
      ourAdvantage: enhanced.ourAdvantage || 'Free and integrated with our product',
    },
    implementationHints: {
      suggestedLibraries: enhanced.suggestedLibraries || [],
      estimatedComplexity: enhanced.estimatedComplexity || 'moderate',
      canUseExistingOSS: enhanced.canUseExistingOSS || false,
      ossLibrary: enhanced.ossLibrary || undefined,
    },
    feasibilityScore,
    volume: toolIdea.volume,
    difficulty: toolIdea.difficulty,
    priority,
  };
}

/**
 * Batch evaluate and enhance tool ideas
 */
export async function evaluateAndEnhanceToolIdeas(
  toolIdeas: Array<{
    keyword: string;
    toolName: string;
    toolDescription: string;
    volume: number;
    difficulty: number;
  }>,
  siteSummary: SiteSummary,
  getCompetitiveData: (keyword: string) => Promise<CompetitiveSearchResult | null>,
  options: LLMJudgeOptions
): Promise<EnhancedToolIdea[]> {
  const enhancedIdeas: EnhancedToolIdea[] = [];

  // Process sequentially to avoid rate limits
  for (const idea of toolIdeas) {
    try {
      console.log(`🔍 Evaluating "${idea.toolName}"...`);

      // Get competitive data for this specific tool
      const competitiveData = await getCompetitiveData(idea.keyword);

      // Enhance the idea
      const enhanced = await enhanceToolIdea(idea, siteSummary, competitiveData, options);

      if (enhanced) {
        enhancedIdeas.push(enhanced);
        console.log(`✅ "${enhanced.toolName}" passed (score: ${enhanced.feasibilityScore.overallScore})`);
      }

      // Rate limit: wait 500ms between API calls
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (error) {
      console.warn(`⚠️ Error evaluating "${idea.toolName}":`, error);
    }
  }

  // Sort by priority
  return enhancedIdeas.sort((a, b) => b.priority - a.priority);
}
