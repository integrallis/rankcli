// Keyword Research Module

// Types
export * from './types.js';

// Main engine
export {
  runKeywordResearch,
  formatKeywordReport,
  extractSeedKeywords,
  type KeywordResearchOptions,
  type PageMeta,
} from './engine.js';

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
