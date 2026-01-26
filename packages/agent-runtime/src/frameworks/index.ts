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
export const SUPPORTED_FRAMEWORKS = [
  'react',
  'nextjs',
  'vue',
  'nuxt',
  'angular',
  'svelte',
  'sveltekit',
  'astro',
  'remix',
  'gatsby',
  'rails',
  'laravel',
  'django',
  'wordpress',
] as const;
