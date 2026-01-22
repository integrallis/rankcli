// AI-Powered SEO Analysis Module
// Exports for use in audits and Edge Functions

export { AIAnalyzer, createAIAnalyzer } from './analyzer.js';

export type {
  AIConfig,
  AIContentAnalysis,
  AIMetaAnalysis,
  AISchemaAnalysis,
  AILinkAnalysis,
  AIVisibilityAnalysis,
  AIFixPrioritization,
  AIAnalysisResult,
  PageContext,
} from './types.js';

export {
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
