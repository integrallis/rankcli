/**
 * Framework-Specific SEO Suggestion Engine
 *
 * Loads recipe files and provides framework-specific SEO suggestions.
 * Works with both CLI and Web UI.
 */

import { parse as parseYaml } from 'yaml';
import type { Framework, FrameworkInfo } from './detector.js';
import type { AuditIssue, IssueCategory, IssueSeverity } from '../audit/types.js';

export interface FrameworkCheck {
  code: string;
  severity: IssueSeverity;
  title: string;
  description: string;
  howToFix: string;
  impact?: string;
  detection?: {
    html_patterns?: string[];
    html_missing_patterns?: string[];
    missing_content?: boolean;
    title_in_js?: boolean;
    title_not_in_html?: boolean;
  };
  app_router_only?: boolean;
  pages_router_only?: boolean;
}

export interface FrameworkRecipe {
  framework: Framework;
  display_name: string;
  category: string;
  base_framework?: Framework;
  ssr_default: boolean;
  seo_challenges?: string[];
  seo_strengths?: string[];
  checks: FrameworkCheck[];
  performance_tips?: string[];
  migration_paths?: Record<string, {
    effort: string;
    benefits: string[];
    guide?: string;
  }>;
  recommended_plugins?: Record<string, string[]>;
  recommended_gems?: Record<string, string[]>;
  integrations?: string[];
}

// Embedded recipes (loaded at build time or dynamically)
const RECIPES: Record<Framework, FrameworkRecipe | null> = {
  // JavaScript/TypeScript
  react: null,
  nextjs: null,
  vue: null,
  nuxt: null,
  angular: null,
  svelte: null,
  sveltekit: null,
  astro: null,
  remix: null,
  gatsby: null,
  solidjs: null,
  qwik: null,
  fresh: null,
  
  // Ruby
  rails: null,
  
  // Python
  django: null,
  flask: null,
  fastapi: null,
  
  // PHP
  laravel: null,
  symfony: null,
  wordpress: null,
  
  // Java
  spring: null,
  
  // C#
  aspnet: null,
  
  // Go
  go: null,
  
  // Elixir
  phoenix: null,
  
  // Hypermedia
  htmx: null,
  hotwire: null,
  
  // Static Site Generators
  hugo: null,
  jekyll: null,
  eleventy: null,
  pelican: null,
  sphinx: null,
  docusaurus: null,
  
  // Unknown
  unknown: null,
};

// Recipe content will be bundled inline for distribution
// This allows the suggestion engine to work without file system access
const RECIPE_CONTENT: Record<string, string> = {};

/**
 * Load a recipe from embedded content or file system
 */
export async function loadRecipe(framework: Framework): Promise<FrameworkRecipe | null> {
  if (framework === 'unknown') return null;

  // Check cache
  if (RECIPES[framework]) {
    return RECIPES[framework];
  }

  // Check embedded content
  if (RECIPE_CONTENT[framework]) {
    try {
      const recipe = parseYaml(RECIPE_CONTENT[framework]) as FrameworkRecipe;
      RECIPES[framework] = recipe;
      return recipe;
    } catch {
      console.warn(`Failed to parse embedded recipe for ${framework}`);
      return null;
    }
  }

  // Try dynamic import for Node.js environment
  try {
    const fs = await import('fs');
    const path = await import('path');
    const url = await import('url');

    const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
    const recipePath = path.join(__dirname, 'recipes', `${framework}.yaml`);

    if (fs.existsSync(recipePath)) {
      const content = fs.readFileSync(recipePath, 'utf-8');
      const recipe = parseYaml(content) as FrameworkRecipe;
      RECIPES[framework] = recipe;
      return recipe;
    }
  } catch {
    // File system not available (browser, edge function)
  }

  return null;
}

/**
 * Get framework-specific issues based on HTML analysis
 */
export async function getFrameworkIssues(
  frameworkInfo: FrameworkInfo,
  html: string,
  url: string
): Promise<AuditIssue[]> {
  const recipe = await loadRecipe(frameworkInfo.framework);
  if (!recipe) return [];

  const issues: AuditIssue[] = [];

  for (const check of recipe.checks) {
    const matched = evaluateCheck(check, html, frameworkInfo);
    if (matched) {
      issues.push({
        code: check.code,
        severity: check.severity,
        category: 'on-page' as IssueCategory, // Framework issues are on-page
        title: check.title,
        description: check.description,
        impact: check.impact || `Framework-specific issue for ${recipe.display_name}`,
        howToFix: check.howToFix,
        affectedUrls: [url],
        details: {
          framework: recipe.display_name,
          frameworkCategory: recipe.category,
        },
      });
    }
  }

  return issues;
}

/**
 * Evaluate if a check matches the HTML content
 */
function evaluateCheck(
  check: FrameworkCheck,
  html: string,
  frameworkInfo: FrameworkInfo
): boolean {
  // Skip router-specific checks. Pages Router renders a <div id="__next">
  // hydration root; App Router does not use that wrapper at all - so its
  // presence is the Pages Router signal, not the App Router one.
  if (check.app_router_only && html.includes('__next')) {
    return false;
  }
  if (check.pages_router_only && !html.includes('__next')) {
    return false;
  }

  const detection = check.detection;
  if (!detection) {
    // No detection rules, check is informational only
    return false;
  }

  // Check HTML patterns
  if (detection.html_patterns) {
    for (const pattern of detection.html_patterns) {
      if (html.includes(pattern)) {
        return true;
      }
    }
  }

  // Inverse: fires when NONE of the expected patterns are present (e.g.
  // "no SEO plugin's meta signature found" for server-rendered frameworks
  // where a thin-body/SPA-style check doesn't apply).
  if (detection.html_missing_patterns) {
    const anyPresent = detection.html_missing_patterns.some(pattern => html.includes(pattern));
    if (!anyPresent) {
      return true;
    }
  }

  // Check for missing content (SPA detection)
  if (detection.missing_content) {
    const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1]
        .replace(/<script[\s\S]*?<\/script>/gi, '')
        .replace(/<style[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Less than 100 chars of text content = likely empty SPA
      if (bodyContent.length < 100) {
        return true;
      }
    }
  }

  // Check title in JS but not in HTML
  if (detection.title_in_js && detection.title_not_in_html) {
    const hasHtmlTitle = /<title[^>]*>[^<]+<\/title>/i.test(html);
    const hasJsTitle = /document\.title\s*=/.test(html) ||
                       /useHead|Helmet|useSeoMeta/.test(html);
    if (!hasHtmlTitle && hasJsTitle) {
      return true;
    }
  }

  return false;
}

/**
 * Get framework-specific suggestions for fixing issues
 */
export async function getFrameworkSuggestions(
  frameworkInfo: FrameworkInfo,
  issueCode: string
): Promise<string | null> {
  const recipe = await loadRecipe(frameworkInfo.framework);
  if (!recipe) return null;

  const check = recipe.checks.find(c => c.code === issueCode);
  if (check) {
    return check.howToFix;
  }

  return null;
}

/**
 * Get all available checks for a framework
 */
export async function getFrameworkChecks(
  framework: Framework
): Promise<FrameworkCheck[]> {
  const recipe = await loadRecipe(framework);
  if (!recipe) return [];
  return recipe.checks;
}

/**
 * Get performance tips for a framework
 */
export async function getPerformanceTips(
  framework: Framework
): Promise<string[]> {
  const recipe = await loadRecipe(framework);
  if (!recipe) return [];
  return recipe.performance_tips || [];
}

/**
 * Get SEO challenges for a framework
 */
export async function getSeoChallenges(
  framework: Framework
): Promise<string[]> {
  const recipe = await loadRecipe(framework);
  if (!recipe) return [];
  return recipe.seo_challenges || [];
}

/**
 * Get migration paths from current framework
 */
export async function getMigrationPaths(
  framework: Framework
): Promise<Record<string, { effort: string; benefits: string[]; guide?: string }>> {
  const recipe = await loadRecipe(framework);
  if (!recipe) return {};
  return recipe.migration_paths || {};
}

/**
 * Get total number of framework-specific checks
 */
export async function getTotalFrameworkChecks(): Promise<number> {
  let total = 0;
  for (const framework of Object.keys(RECIPES) as Framework[]) {
    const recipe = await loadRecipe(framework);
    if (recipe) {
      total += recipe.checks.length;
    }
  }
  return total;
}

/**
 * Get framework summary for display
 */
export async function getFrameworkSummary(framework: Framework): Promise<{
  name: string;
  category: string;
  ssrDefault: boolean;
  checkCount: number;
  strengths: string[];
  challenges: string[];
} | null> {
  const recipe = await loadRecipe(framework);
  if (!recipe) return null;

  return {
    name: recipe.display_name,
    category: recipe.category,
    ssrDefault: recipe.ssr_default,
    checkCount: recipe.checks.length,
    strengths: recipe.seo_strengths || [],
    challenges: recipe.seo_challenges || [],
  };
}

/**
 * Embed recipe content for bundling (called at build time)
 */
export function embedRecipe(framework: Framework, content: string): void {
  RECIPE_CONTENT[framework] = content;
}
