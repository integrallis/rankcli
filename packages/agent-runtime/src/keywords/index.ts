// Keyword Research Module

// Types
export * from './types.js';

// Main engine (legacy)
export {
  runKeywordResearch,
  formatKeywordReport,
  extractSeedKeywords,
  type KeywordResearchOptions,
  type PageMeta,
} from './engine.js';

// AI-Powered Keyword Research (new)
export {
  runAIKeywordResearch,
  type AIKeywordResearchOptions,
  type PlanTier,
  type FreeKeywordResult,
  type PaidKeywordResult,
  type KeywordOpportunity,
  type FreeToolIdea,
  type CompetitiveInsight,
  type UncertaintyAssessment,
  type KeywordRecommendation,
} from './ai-keyword-engine.js';

// Site Crawler
export {
  crawlSite,
  extractKeyPhrases,
  type CrawledPage,
  type SiteCrawlResult,
} from './site-crawler.js';

// AI Summarizer
export {
  summarizeSite,
  createFallbackSummary,
  enhanceSummaryWithCompetitors,
  generateUncertaintyQuestions,
  type SiteSummary,
  type SummarizerOptions,
} from './ai-summarizer.js';

// NLP Analysis
export {
  runNLPAnalysis,
  calculateTFIDF as calculateKeywordTFIDF,
  extractNgrams,
  calculateBM25,
  clusterKeywordsByEmbedding,
  extractEntityPhrases,
  extractTopics,
  tokenize,
  type TFIDFResult,
  type NGram,
  type KeywordCluster,
  type TopicModel,
  type NLPAnalysisResult,
} from './nlp-analysis.js';

// Wizard
export {
  startWizardSession,
  generateWizardQuestions,
  processWizardResponse,
  getNextQuestion,
  completeWizard,
  wizardResponsesToContext,
  formatWizardProgress,
  type WizardQuestion,
  type WizardResponse,
  type WizardSession,
  type WizardResult,
} from './wizard.js';

// CI Mode
export {
  runCIKeywordResearch,
  formatCIResult,
  type CIKeywordOptions,
  type CIKeywordResult,
  type CIAction,
} from './ci-mode.js';

// Prioritization
export { prioritizeKeywords } from './prioritizer.js';

// Data sources
export {
  getAutocompleteSuggestions,
  getExpandedSuggestions,
  enrichKeywordsWithEstimates,
} from './sources/autocomplete.js';

export {
  transformGSCData,
  findCTROpportunities,
  findAlmostPage1Keywords,
  findTopPerformers,
  buildGSCRequest,
  getDateRange,
} from './sources/gsc.js';

export {
  getKeywordData,
  getKeywordSuggestions,
  getRelatedKeywords,
  checkBalance,
  LOCATION_CODES,
  type DataForSEOCredentials,
} from './sources/dataforseo.js';

// Competitor Analysis (SpyFu Kombat-style)
export {
  discoverCompetitorKeywords,
  formatCompetitorReport,
  type CompetitorKeywordResult,
  type CompetitorOverlap,
} from './sources/competitor-analysis.js';

// Topic Grouping/Clustering
export {
  groupKeywordsByTopic,
  formatTopicReport,
  type KeywordTopic,
  type TopicClusterResult,
  type ContentRecommendation,
} from './topic-grouping.js';
