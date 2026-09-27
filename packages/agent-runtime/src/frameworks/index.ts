/**
 * Framework Detection and SEO Recipes
 *
 * Provides framework-specific SEO suggestions for:
 * - React, Next.js, Gatsby, Remix
 * - Vue, Nuxt
 * - Angular
 * - Svelte, SvelteKit
 * - Astro
 * - Ruby on Rails
 * - Laravel, Django
 * - WordPress
 *
 * Usage:
 *
 * ```typescript
 * import { detectFramework, getFrameworkIssues } from './frameworks';
 *
 * // Detect framework from HTML
 * const frameworkInfo = detectFramework({ html });
 *
 * // Get framework-specific issues
 * const issues = await getFrameworkIssues(frameworkInfo, html, url);
 * ```
 */

export {
  type Framework,
  type FrameworkInfo,
  detectFramework,
  detectFromHtml,
  detectFromPackageJson,
  detectFromHeaders,
  getFrameworkDisplayName,
} from './detector.js';

export {
  type FrameworkCheck,
  type FrameworkRecipe,
  loadRecipe,
  getFrameworkIssues,
  getFrameworkSuggestions,
  getFrameworkChecks,
  getPerformanceTips,
  getSeoChallenges,
  getMigrationPaths,
  getTotalFrameworkChecks,
  getFrameworkSummary,
  embedRecipe,
} from './suggestion-engine.js';

// Convenience function to get all available frameworks
// Frameworks with a recipe in ./recipes - the ones that get framework-specific fixes rather
// than generic advice. This list claimed svelte, remix and gatsby, which have no recipe, while
// the marketing copy listed the eleven that do; index.test.ts now asserts it against the
// directory so the two cannot drift again.
//
// Detection recognises far more than this (see the Framework type in detector.ts - Spring,
// Phoenix, Hugo, Jekyll, htmx and the rest). Those are identified and reported; they just have
// no recipe to fix them with.
export const SUPPORTED_FRAMEWORKS = [
  'angular',
  'astro',
  'django',
  'laravel',
  'nextjs',
  'nuxt',
  'rails',
  'react',
  'sveltekit',
  'vue',
  'wordpress',
] as const;
