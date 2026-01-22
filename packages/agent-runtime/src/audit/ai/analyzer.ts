// AI-Powered SEO Analyzer
// Uses LLMs to provide contextual, intelligent SEO analysis

import type {
  AIConfig,
  AIContentAnalysis,
  AIMetaAnalysis,
  AISchemaAnalysis,
  AIVisibilityAnalysis,
  AIFixPrioritization,
  AIAnalysisResult,
  PageContext,
} from './types.js';

import {
  CONTENT_ANALYSIS_SYSTEM,
  CONTENT_ANALYSIS_USER,
  META_ANALYSIS_SYSTEM,
  META_ANALYSIS_USER,
  SCHEMA_ANALYSIS_SYSTEM,
  SCHEMA_ANALYSIS_USER,
  AI_VISIBILITY_SYSTEM,
  AI_VISIBILITY_USER,
  FIX_PRIORITIZATION_SYSTEM,
  FIX_PRIORITIZATION_USER,
} from './prompts/content-analysis.js';

export class AIAnalyzer {
  private config: AIConfig;
  private cache: Map<string, { result: unknown; timestamp: number }> = new Map();
  private cacheTimeout = 3600000; // 1 hour

  constructor(config: AIConfig) {
    this.config = {
      model: 'gpt-4o',
      maxTokens: 4096,
      temperature: 0.3,
      ...config,
    };
  }

  /**
   * Call OpenAI API with structured JSON response
   */
  private async callOpenAI<T>(
    systemPrompt: string,
    userPrompt: string,
    cacheKey?: string
  ): Promise<{ result: T; tokensUsed: number; cached: boolean }> {
    // Check cache
    if (cacheKey) {
      const cached = this.cache.get(cacheKey);
      if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
        return { result: cached.result as T, tokensUsed: 0, cached: true };
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.config.openaiApiKey}`,
      },
      body: JSON.stringify({
        model: this.config.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature,
        response_format: { type: 'json_object' },
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${error}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    const tokensUsed = data.usage?.total_tokens || 0;

    if (!content) {
      throw new Error('No content in OpenAI response');
    }

    let result: T;
    try {
      result = JSON.parse(content) as T;
    } catch {
      throw new Error(`Failed to parse OpenAI JSON response: ${content}`);
    }

    // Cache result
    if (cacheKey) {
      this.cache.set(cacheKey, { result, timestamp: Date.now() });
    }

    return { result, tokensUsed, cached: false };
  }

  /**
   * Analyze content quality using AI
   */
  async analyzeContent(context: PageContext): Promise<{
    analysis: AIContentAnalysis;
    tokensUsed: number;
    cached: boolean;
  }> {
    const cacheKey = `content:${context.url}:${context.textContent.length}`;

    const { result, tokensUsed, cached } = await this.callOpenAI<AIContentAnalysis>(
      CONTENT_ANALYSIS_SYSTEM,
      CONTENT_ANALYSIS_USER({
        url: context.url,
        title: context.title,
        h1: context.h1,
        metaDescription: context.metaDescription,
        textContent: context.textContent,
        wordCount: context.wordCount,
        headings: context.headings,
      }),
      cacheKey
    );

    return { analysis: result, tokensUsed, cached };
  }

  /**
   * Analyze and optimize meta tags using AI
   */
  async analyzeMeta(context: PageContext): Promise<{
    analysis: AIMetaAnalysis;
    tokensUsed: number;
    cached: boolean;
  }> {
    const cacheKey = `meta:${context.url}:${context.title}:${context.metaDescription}`;

    const { result, tokensUsed, cached } = await this.callOpenAI<AIMetaAnalysis>(
      META_ANALYSIS_SYSTEM,
      META_ANALYSIS_USER({
        url: context.url,
        title: context.title,
        metaDescription: context.metaDescription,
        h1: context.h1,
        pageType: context.industry,
        industry: context.industry,
      }),
      cacheKey
    );

    return { analysis: result, tokensUsed, cached };
  }

  /**
   * Analyze and generate structured data using AI
   */
  async analyzeSchema(context: PageContext): Promise<{
    analysis: AISchemaAnalysis;
    tokensUsed: number;
    cached: boolean;
  }> {
    const cacheKey = `schema:${context.url}`;

    // Detect page type from URL and content
    let pageType = 'other';
    const urlLower = context.url.toLowerCase();
    const contentLower = context.textContent.toLowerCase();

    if (urlLower.includes('/blog/') || urlLower.includes('/article/') || urlLower.includes('/post/')) {
      pageType = 'article';
    } else if (urlLower.includes('/product/') || contentLower.includes('add to cart') || contentLower.includes('buy now')) {
      pageType = 'product';
    } else if (urlLower.includes('/faq') || contentLower.includes('frequently asked')) {
      pageType = 'faq';
    } else if (urlLower.includes('/about') || urlLower.includes('/team')) {
      pageType = 'organization';
    } else if (urlLower.includes('/contact')) {
      pageType = 'local-business';
    }

    const { result, tokensUsed, cached } = await this.callOpenAI<AISchemaAnalysis>(
      SCHEMA_ANALYSIS_SYSTEM,
      SCHEMA_ANALYSIS_USER({
        url: context.url,
        title: context.title,
        textContent: context.textContent,
        existingSchema: context.schema,
        pageType,
      }),
      cacheKey
    );

    return { analysis: result, tokensUsed, cached };
  }

  /**
   * Analyze AI/LLM visibility and optimization
   */
  async analyzeAIVisibility(
    context: PageContext,
    botAccess: { hasLlmsTxt: boolean; llmsTxtContent?: string; blockedBots: string[] }
  ): Promise<{
    analysis: AIVisibilityAnalysis;
    tokensUsed: number;
    cached: boolean;
  }> {
    const cacheKey = `aivis:${context.url}`;

    const { result, tokensUsed, cached } = await this.callOpenAI<AIVisibilityAnalysis>(
      AI_VISIBILITY_SYSTEM,
      AI_VISIBILITY_USER({
        url: context.url,
        title: context.title,
        textContent: context.textContent,
        headings: context.headings,
        hasLlmsTxt: botAccess.hasLlmsTxt,
        llmsTxtContent: botAccess.llmsTxtContent,
        blockedBots: botAccess.blockedBots,
      }),
      cacheKey
    );

    return { analysis: result, tokensUsed, cached };
  }

  /**
   * Prioritize fixes using AI
   */
  async prioritizeFixes(
    issues: { code: string; severity: string; title: string; category: string }[],
    context: { url: string; framework?: string }
  ): Promise<{
    analysis: AIFixPrioritization;
    tokensUsed: number;
    cached: boolean;
  }> {
    // Don't cache fix prioritization - issues change each audit
    const { result, tokensUsed, cached } = await this.callOpenAI<AIFixPrioritization>(
      FIX_PRIORITIZATION_SYSTEM,
      FIX_PRIORITIZATION_USER({
        issues,
        url: context.url,
        framework: context.framework,
      })
    );

    return { analysis: result, tokensUsed, cached };
  }

  /**
   * Run full AI analysis on a page
   */
  async runFullAnalysis(
    context: PageContext,
    options: {
      analyzeContent?: boolean;
      analyzeMeta?: boolean;
      analyzeSchema?: boolean;
      analyzeAIVisibility?: boolean;
      prioritizeFixes?: boolean;
      issues?: { code: string; severity: string; title: string; category: string }[];
      botAccess?: { hasLlmsTxt: boolean; llmsTxtContent?: string; blockedBots: string[] };
    } = {}
  ): Promise<AIAnalysisResult> {
    const startTime = Date.now();
    let totalTokens = 0;
    let anyCached = false;

    const result: AIAnalysisResult = {
      analysisTime: 0,
      tokensUsed: 0,
      modelUsed: this.config.model || 'gpt-4o',
      cached: false,
    };

    // Run analyses in parallel where possible
    const analyses = await Promise.allSettled([
      options.analyzeContent !== false
        ? this.analyzeContent(context)
        : Promise.resolve(null),
      options.analyzeMeta !== false
        ? this.analyzeMeta(context)
        : Promise.resolve(null),
      options.analyzeSchema !== false
        ? this.analyzeSchema(context)
        : Promise.resolve(null),
      options.analyzeAIVisibility !== false && options.botAccess
        ? this.analyzeAIVisibility(context, options.botAccess)
        : Promise.resolve(null),
      options.prioritizeFixes && options.issues
        ? this.prioritizeFixes(options.issues, { url: context.url, framework: context.framework })
        : Promise.resolve(null),
    ]);

    // Process results
    if (analyses[0].status === 'fulfilled' && analyses[0].value) {
      result.content = analyses[0].value.analysis;
      totalTokens += analyses[0].value.tokensUsed;
      if (analyses[0].value.cached) anyCached = true;
    }

    if (analyses[1].status === 'fulfilled' && analyses[1].value) {
      result.meta = analyses[1].value.analysis;
      totalTokens += analyses[1].value.tokensUsed;
      if (analyses[1].value.cached) anyCached = true;
    }

    if (analyses[2].status === 'fulfilled' && analyses[2].value) {
      result.schema = analyses[2].value.analysis;
      totalTokens += analyses[2].value.tokensUsed;
      if (analyses[2].value.cached) anyCached = true;
    }

    if (analyses[3].status === 'fulfilled' && analyses[3].value) {
      result.aiVisibility = analyses[3].value.analysis;
      totalTokens += analyses[3].value.tokensUsed;
      if (analyses[3].value.cached) anyCached = true;
    }

    if (analyses[4].status === 'fulfilled' && analyses[4].value) {
      result.fixPrioritization = analyses[4].value.analysis;
      totalTokens += analyses[4].value.tokensUsed;
      if (analyses[4].value.cached) anyCached = true;
    }

    result.analysisTime = Date.now() - startTime;
    result.tokensUsed = totalTokens;
    result.cached = anyCached;

    return result;
  }

  /**
   * Clear the cache
   */
  clearCache(): void {
    this.cache.clear();
  }
}

// Export a factory function for creating analyzers
export function createAIAnalyzer(config: AIConfig): AIAnalyzer {
  return new AIAnalyzer(config);
}
