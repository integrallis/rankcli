// AI-Powered SEO Analysis Types

export interface AIConfig {
  openaiApiKey: string;
  model?: 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4-turbo';
  maxTokens?: number;
  temperature?: number;
}

// Content Analysis Types
export interface AIContentAnalysis {
  overallScore: number;
  searchIntentMatch: number;
  contentDepth: 'shallow' | 'moderate' | 'comprehensive';
  keywordNaturalness: number;

  eeatSignals: {
    experience: string[];
    expertise: string[];
    authority: string[];
    trust: string[];
  };

  improvements: {
    priority: number;
    suggestion: string;
    impact: string;
  }[];

  uniqueValue: string;
  missingTopics: string[];
  targetKeyword?: string;
  keywordDensity?: number;
}

// Meta Tag Analysis Types
export interface AIMetaAnalysis {
  titleAnalysis: {
    effectiveness: number;
    clickPotential: number;
    keywordPlacement: 'optimal' | 'suboptimal' | 'missing';
    emotionalTriggers: string[];
    suggestions: string[];
  };

  descriptionAnalysis: {
    effectiveness: number;
    hasCallToAction: boolean;
    hasUniqueSellingProposition: boolean;
    keywordNaturalness: number;
    suggestions: string[];
  };

  serpPrediction: {
    predictedCTR: number;
    competitiveStrength: 'weak' | 'average' | 'strong';
    improvements: string[];
  };
}

// Schema/Structured Data Analysis Types
export interface AISchemaAnalysis {
  detectedPageType: string;
  recommendedSchemas: {
    type: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    reason: string;
  }[];

  generatedSchemas: {
    type: string;
    jsonLd: object;
    explanation: string;
  }[];

  richSnippetPotential: {
    type: string;
    eligible: boolean;
    requirements: string[];
  }[];
}

// Link Quality Analysis Types
export interface AILinkAnalysis {
  internalLinkQuality: {
    topicalRelevance: number;
    anchorTextQuality: 'descriptive' | 'generic' | 'over-optimized';
    distribution: 'balanced' | 'top-heavy' | 'sparse';
  };

  suggestedInternalLinks: {
    targetUrl: string;
    suggestedAnchor: string;
    contextReason: string;
  }[];

  externalLinkQuality: {
    authorityScore: number;
    relevanceScore: number;
    concerningLinks: {
      url: string;
      concern: string;
    }[];
  };
}

// AI Visibility Analysis Types
export interface AIVisibilityAnalysis {
  llmReadability: {
    score: number;
    structureClarity: number;
    contextClarity: number;
    citationPotential: number;
    improvements: string[];
  };

  botAccessRecommendation: {
    shouldAllowGPTBot: boolean;
    shouldAllowClaudeBot: boolean;
    shouldAllowPerplexityBot: boolean;
    shouldAllowGoogleExtended: boolean;
    rationale: string;
  };

  llmsTxtSuggestion?: {
    content: string;
    explanation: string;
  };
}

// Fix Prioritization Types
export interface AIFixPrioritization {
  prioritizedIssues: {
    issueCode: string;
    impactScore: number;
    effortScore: number;
    roiScore: number;
    rationale: string;
  }[];

  fixBatches: {
    batch: number;
    theme: string;
    estimatedImpact: string;
    issueCodes: string[];
  }[];
}

// Combined AI Analysis Result
export interface AIAnalysisResult {
  content?: AIContentAnalysis;
  meta?: AIMetaAnalysis;
  schema?: AISchemaAnalysis;
  links?: AILinkAnalysis;
  aiVisibility?: AIVisibilityAnalysis;
  fixPrioritization?: AIFixPrioritization;

  // Metadata
  analysisTime: number;
  tokensUsed: number;
  modelUsed: string;
  cached: boolean;
}

// Page Context for AI Analysis
export interface PageContext {
  url: string;
  title?: string;
  metaDescription?: string;
  h1?: string;
  headings?: { level: number; text: string }[];
  textContent: string;
  wordCount: number;
  links?: { href: string; text: string; isInternal: boolean }[];
  images?: { src: string; alt?: string }[];
  schema?: object[];
  framework?: string;
  industry?: string;
}
