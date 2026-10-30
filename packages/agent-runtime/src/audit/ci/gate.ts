/**
 * The CI gate: the rules that fail a build, in one syntax for the CLI (`--fail-on`, the config
 * file's `failOn` and `budgets`), the GitHub Action (`fail-on`) and anything else built on the
 * report.
 *
 *   error | warning | notice   any issue at or above this severity
 *   score<80                   the overall score is below 80 (`--min-score 80` says the same)
 *   score:aiReadiness<70       a category score is below 70
 *
 * Rules combine: `error,score<80,score:aiReadiness<70`, or the flag repeated. With a baseline,
 * the severity rule counts only issues that are not in the baseline; score rules are absolute.
 */
import type { AuditIssue, HealthScore } from '../types.js';

export const FAIL_ON_LEVELS = ['error', 'warning', 'notice'] as const;
export type FailOnLevel = (typeof FAIL_ON_LEVELS)[number];

/** 'critical' and 'info' exist in the severity type as well. */
export const SEVERITY_RANK: Record<string, number> = { critical: 4, error: 3, warning: 2, notice: 1, info: 1 };

export type ScoreCategory = keyof HealthScore;

export const SCORE_CATEGORIES: ScoreCategory[] = [
  'overall', 'crawlability', 'indexability', 'onPage', 'content', 'links', 'performance',
  'security', 'aiReadiness', 'social', 'localSeo', 'accessibility',
];

const CATEGORY_ALIASES: Record<string, ScoreCategory> = {
  overall: 'overall',
  crawlability: 'crawlability',
  indexability: 'indexability',
  onpage: 'onPage', 'on-page': 'onPage', on_page: 'onPage',
  content: 'content',
  links: 'links',
  performance: 'performance',
  security: 'security',
  aireadiness: 'aiReadiness', 'ai-readiness': 'aiReadiness', ai_readiness: 'aiReadiness', ai: 'aiReadiness',
  social: 'social',
  localseo: 'localSeo', 'local-seo': 'localSeo', local_seo: 'localSeo',
  accessibility: 'accessibility',
};

/** The score category a name refers to (`aiReadiness`, `ai-readiness` and `ai` are the same one). */
export function scoreCategory(name: string): ScoreCategory | undefined {
  return CATEGORY_ALIASES[name.trim().toLowerCase()];
}

export interface ScoreBudget {
  category: ScoreCategory;
  /** The lowest passing score. */
  min: number;
}

export interface GateSpec {
  /** The lowest severity that fails the build, if any. */
  failOn?: FailOnLevel;
  /** Minimum scores, overall and per category. */
  budgets: ScoreBudget[];
}

export const EMPTY_GATE: GateSpec = { budgets: [] };

const RULE_HELP = `${FAIL_ON_LEVELS.join(', ')}, score<N or score:<category><N`;

/** Parse one or more rules. The first rule that does not parse is the error. */
export function parseFailOn(rules: string | readonly string[] | undefined): { spec: GateSpec; error?: string } {
  const spec: GateSpec = { budgets: [] };
  const list = (Array.isArray(rules) ? rules : rules ? [rules] : [])
    .flatMap(r => String(r).split(','))
    .map(r => r.trim())
    .filter(Boolean);
  for (const rule of list) {
    const lower = rule.toLowerCase();
    if ((FAIL_ON_LEVELS as readonly string[]).includes(lower)) {
      const level = lower as FailOnLevel;
      // The most inclusive level wins: "error,warning" fails on warnings.
      if (!spec.failOn || SEVERITY_RANK[level] < SEVERITY_RANK[spec.failOn]) spec.failOn = level;
      continue;
    }
    const m = lower.match(/^score(?::([a-z_-]+))?\s*<\s*(\d+(?:\.\d+)?)$/);
    if (m) {
      const category = m[1] ? scoreCategory(m[1]) : 'overall';
      if (!category) return { spec, error: `Unknown score category "${m[1]}" in "${rule}" (use ${SCORE_CATEGORIES.join(', ')})` };
      const min = Number(m[2]);
      if (min < 0 || min > 100) return { spec, error: `Invalid threshold in "${rule}" (use a number from 0 to 100)` };
      addBudget(spec, { category, min });
      continue;
    }
    return { spec, error: `Invalid rule "${rule}" (use ${RULE_HELP})` };
  }
  return { spec };
}

/** The config file's `budgets` ({ "aiReadiness": 70 }) as gate rules. */
export function parseBudgets(budgets: unknown): { spec: GateSpec; error?: string } {
  const spec: GateSpec = { budgets: [] };
  if (budgets === undefined || budgets === null) return { spec };
  if (typeof budgets !== 'object' || Array.isArray(budgets)) return { spec, error: 'budgets must be an object such as { "overall": 80, "aiReadiness": 70 }' };
  for (const [name, value] of Object.entries(budgets as Record<string, unknown>)) {
    const category = scoreCategory(name);
    if (!category) return { spec, error: `Unknown score category "${name}" in budgets (use ${SCORE_CATEGORIES.join(', ')})` };
    const min = Number(value);
    if (typeof value !== 'number' || !Number.isFinite(min) || min < 0 || min > 100) {
      return { spec, error: `Invalid budget for "${name}": ${JSON.stringify(value)} (use a number from 0 to 100)` };
    }
    addBudget(spec, { category, min });
  }
  return { spec };
}

/** Combine specs: the most inclusive severity and, per category, the highest minimum. */
export function mergeGateSpecs(...specs: GateSpec[]): GateSpec {
  const merged: GateSpec = { budgets: [] };
  for (const spec of specs) {
    if (spec.failOn && (!merged.failOn || SEVERITY_RANK[spec.failOn] < SEVERITY_RANK[merged.failOn])) merged.failOn = spec.failOn;
    for (const budget of spec.budgets) addBudget(merged, budget);
  }
  return merged;
}

function addBudget(spec: GateSpec, budget: ScoreBudget): void {
  const existing = spec.budgets.find(b => b.category === budget.category);
  if (!existing) spec.budgets.push({ ...budget });
  else existing.min = Math.max(existing.min, budget.min);
}

/** True when the spec has any rule at all. */
export function isGated(spec: GateSpec): boolean {
  return spec.failOn !== undefined || spec.budgets.length > 0;
}

export interface GateResult {
  failOn?: FailOnLevel;
  /** The overall-score minimum, when there is one (what `--min-score` sets). */
  minScore?: number;
  budgets: Array<ScoreBudget & { actual: number }>;
  passed: boolean;
  failures: string[];
}

/**
 * Evaluate the gate. `issues` are the findings the severity rule may count: every issue, or
 * only the new ones when the caller applied a baseline (`newOnly` then names them so).
 */
export function evaluateGate(
  spec: GateSpec,
  issues: AuditIssue[],
  scores: Partial<HealthScore> & { overall: number },
  options: { newOnly?: boolean } = {},
): GateResult {
  const failures: string[] = [];
  if (spec.failOn) {
    const threshold = SEVERITY_RANK[spec.failOn];
    const hits = issues.filter(i => (SEVERITY_RANK[i.severity] ?? 0) >= threshold);
    if (hits.length > 0) {
      const counts = new Map<string, number>();
      for (const i of hits) counts.set(i.severity, (counts.get(i.severity) || 0) + 1);
      const breakdown = [...counts.entries()]
        .sort((a, b) => (SEVERITY_RANK[b[0]] ?? 0) - (SEVERITY_RANK[a[0]] ?? 0))
        .map(([severity, n]) => `${n} ${severity}`)
        .join(', ');
      const noun = options.newOnly ? 'new issue' : 'issue';
      failures.push(`${hits.length} ${noun}${hits.length === 1 ? '' : 's'} at or above fail-on ${spec.failOn} (${breakdown})`);
    }
  }
  const budgets = spec.budgets.map(b => ({ ...b, actual: scores[b.category] ?? 0 }));
  for (const b of budgets) {
    if (b.actual < b.min) {
      failures.push(b.category === 'overall'
        ? `score ${b.actual} is below the minimum ${b.min}`
        : `${b.category} score ${b.actual} is below its minimum ${b.min}`);
    }
  }
  const overall = spec.budgets.find(b => b.category === 'overall');
  return { failOn: spec.failOn, minScore: overall?.min, budgets, passed: failures.length === 0, failures };
}
