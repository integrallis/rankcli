// Agent runtime for RankCLI

// Side-effecting: registers every framework recipe's YAML content via
// embedRecipe(). loadRecipe()'s fs.readFileSync fallback only resolves
// recipes/*.yaml when running directly against source (tsx) - both real
// shipped forms of this package (the tsup-bundled dist/ the published npm
// package and CLI SEA binary actually run, and the separate Deno edge-
// function bundle) collapse everything into one file with no adjacent
// recipes/ directory, so that path never exists at runtime otherwise.
import './frameworks/embedded-recipes.generated.js';

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
export { buildDeterministicFixes } from './fixer/deterministic.js';
export { findAppRoot } from './fixer/app-root.js';
export { servedDir } from './fixer/served-dir.js';
export { assessReplacement, describeConcerns } from './fixer/safety.js';
export { buildFrameworkGuidance } from './fixer/framework-guidance.js';
export type { DeterministicFixes, DeterministicFixInput } from './fixer/deterministic.js';
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
