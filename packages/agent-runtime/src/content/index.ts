// Content Analysis & Optimization Module
// Tools for analyzing and optimizing content for SEO

// Readability Analysis
export {
  analyzeReadability,
  formatReadabilityReport,
  type ReadabilityResult,
} from './readability.js';

// Search Intent Classification
export {
  classifyIntent,
  classifyIntents,
  formatIntentReport,
  type SearchIntent,
  type IntentAnalysis,
} from './intent.js';

// Headline Analysis
export {
  analyzeHeadline,
  generateHeadlineVariations,
  formatHeadlineReport,
  type HeadlineAnalysis,
} from './headline.js';

// Featured Snippet Optimization
export {
  analyzeFeaturedSnippetPotential,
  formatFeaturedSnippetReport,
  type SnippetType,
  type FeaturedSnippetAnalysis,
  type SnippetRecommendation,
} from './featured-snippet.js';

// Keyword Density & LSI
export {
  analyzeKeywordDensity,
  findLSIKeywords,
  calculateTFIDF,
  formatKeywordDensityReport,
  type KeywordDensityAnalysis,
  type LSIKeyword,
  type ContentElements,
} from './keyword-density.js';

// Content Generation
export {
  generateBlogPost,
  generateChangelog,
  optimizeReadme,
  scoreContentSEO,
  type BlogPostConfig,
  type ChangelogConfig,
  type ReadmeConfig,
  type GeneratedContent,
  type ChangelogResult,
  type ReadmeResult,
  type SEOScore,
  type ContentGeneratorOptions,
} from './generator.js';
