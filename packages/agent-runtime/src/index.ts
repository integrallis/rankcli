// Agent runtime for SEO Autopilot

// Types
export * from './types.js';

// Comprehensive Audit Module (Ahrefs-level checks)
export * from './audit/index.js';

// Keyword Research Module
export * from './keywords/index.js';

// Content Analysis & Optimization Module
export * from './content/index.js';

// Tracking & Monitoring Module
export * from './tracking/index.js';

// Loader
export { loadAgent, loadAgentByName, interpolatePrompt } from './loader.js';

// Executor
export { executeAgent, runDirectAnalysis } from './executor.js';
export type { ExecuteOptions, ExecutionResult } from './executor.js';

// Fix generator
export { generateFixes, applyFixes } from './fixer.js';
export type { FixGeneratorOptions, GeneratedFix } from './fixer.js';

// Tools
export { tools } from './tools/index.js';
export {
  crawlUrl,
  extractMeta,
  analyzeHeadings,
  extractImages,
  extractLinks,
  extractSchema,
  checkRobots,
  checkSitemap,
  readFile,
  writeFile,
  listFiles,
  detectFramework,
  findHtmlEntry,
  findPageFiles,
  analyzeUrl,
} from './tools/index.js';

// Git integration (conventional commits, co-authoring)
export * from './git/index.js';

// Scheduler (scheduled audits, alerts)
export * from './scheduler/index.js';

// Reports (HTML/PDF generation, white-label)
export * from './reports/index.js';
