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
export * from './fixer/framework-fixes.js';
// Schemas are exported from ./fixer/schemas.js - import directly to avoid conflicts
// with generateFAQJsonLd and other duplicates in framework-fixes
export { Schemas } from './fixer/schemas.js';

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

// GEO (Generative Engine Optimization) tracking
export * from './geo/index.js';

// Keyword Rank Tracking
export * from './ranking/index.js';

// Advanced Analyzers (GEO, CWV, Security, Schema, Images, Links, Mobile)
export * as analyzers from './analyzers/index.js';

// Framework Detection & SEO Recipes
// Note: Export as namespace to avoid conflict with tools/detectFramework
export * as frameworks from './frameworks/index.js';

// wasm-adapter.ts (runSyncAudit, premium check logic) is deliberately NOT
// exported here. It's built separately via `build:wasm` and consumed only
// by the CLI's build.rs, which encrypts it into the WASM binary at compile
// time. Re-exporting it from the public entry point would ship every
// premium check's source, unencrypted, in this package's normal npm
// publish - see packaging.test.ts for the regression test.
