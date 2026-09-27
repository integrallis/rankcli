// The framework-specific half of the auto-fix prompt, built from the recipe for the framework
// that was actually detected.
//
// There are eleven recipes in src/frameworks/recipes - real knowledge about how each framework
// wants SEO done, with the exact code for each fix - and until now the PR generator used none
// of them. It carried its own `if (isReactVite) ... else if (isNextjs)` branches instead, which
// covered two frameworks, restated a fraction of what the recipes say, and could only be
// extended by editing a prompt inside an edge function.
//
// So the recipe becomes the guidance. Two properties matter more than completeness:
//
//   - Relevance. Only the checks the audit actually reported get their code included. A prompt
//     full of advice about problems this site does not have is budget spent on distraction.
//   - A budget. The prompt is what a PR costs: ~8K input tokens measured, and the recipes are
//     long enough to double that. Guidance is truncated at a character budget, always at a
//     check boundary, so it never ends mid-snippet.

import type { FrameworkRecipe, FrameworkCheck } from '../frameworks/suggestion-engine.js';

export interface FrameworkGuidanceOptions {
  /** Issue codes open on the report. Checks matching these come first. */
  issueCodes?: string[];
  /** Roughly 1K tokens. Generous enough for several snippets, small enough to notice. */
  maxChars?: number;
}

const DEFAULT_MAX_CHARS = 4000;

function checkBlock(check: FrameworkCheck): string {
  const fix = check.howToFix?.trim();
  return [
    `### ${check.title}${check.code ? ` (${check.code})` : ''}`,
    check.description?.trim(),
    fix ? `How this framework wants it fixed:\n${fix}` : null,
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * A markdown block for the prompt, or '' when there is no recipe for the framework.
 *
 * Ordering is deliberate: what the framework is, then the traps it has, then the fixes for
 * the issues this site actually reported, then anything else that fits the budget.
 */
export function buildFrameworkGuidance(
  recipe: FrameworkRecipe | null | undefined,
  options: FrameworkGuidanceOptions = {}
): string {
  if (!recipe) return '';

  const budget = options.maxChars ?? DEFAULT_MAX_CHARS;
  const reported = new Set(options.issueCodes ?? []);

  const header = [
    `## ${recipe.display_name} conventions`,
    `Renders on the server by default: ${recipe.ssr_default ? 'yes' : 'no'}.`,
    recipe.seo_challenges?.length
      ? `Known traps in this framework:\n${recipe.seo_challenges.map((c) => `- ${c}`).join('\n')}`
      : null,
  ]
    .filter(Boolean)
    .join('\n');

  // Checks for issues this report raised, then the rest - so a tight budget spends itself on
  // what is actually wrong with this site.
  const checks = recipe.checks ?? [];
  const relevant = checks.filter((c) => c.code && reported.has(c.code));
  const rest = checks.filter((c) => !relevant.includes(c));

  let out = header;
  let included = 0;
  for (const check of [...relevant, ...rest]) {
    const block = checkBlock(check);
    // Always break at a check boundary: half a code snippet is worse than none.
    if (out.length + block.length + 2 > budget) break;
    out += `\n\n${block}`;
    included++;
  }

  if (included < checks.length) {
    out += `\n\n_(${checks.length - included} more ${recipe.display_name} checks omitted.)_`;
  }
  return out;
}
