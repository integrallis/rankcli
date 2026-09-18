/**
 * GitHub Action logic: inputs, the pass/fail gate, and the PR comment.
 * Pure functions - run.ts does the I/O.
 */

/**
 * Alert triggers the action implements:
 * - error: the audit found at least one error-severity issue
 * - failure: the action failed (gate tripped, or the site couldn't be audited)
 */
export type AlertTrigger = 'error' | 'failure';
const ALERT_TRIGGERS: readonly AlertTrigger[] = ['error', 'failure'];

/**
 * Inputs the action used to declare but never implemented. Still declared
 * in action.yml (with a deprecationMessage) so an existing workflow gets a
 * warning instead of an "Unexpected input" error.
 */
export const REMOVED_INPUTS = ['create-pr', 'pr-threshold-errors', 'pr-threshold-score', 'pr-base-branch', 'checks'] as const;

export interface ActionInputs {
  url: string;
  apiKey?: string;
  githubToken?: string;
  commentOnPr: boolean;
  failOnError: boolean;
  scoreThreshold: number;
  slackWebhook?: string;
  discordWebhook?: string;
  alertOn: AlertTrigger[];
  /** Human-readable warnings about inputs (removed, unsupported values). */
  warnings: string[];
}

export interface CategorySummary {
  score: number;
  issues: number;
}

export interface AuditSummary {
  url: string;
  score: number;
  issuesCount: number;
  errorsCount: number;
  warningsCount: number;
  categories: Record<string, CategorySummary>;
  /** Set when the page itself couldn't be audited (unreachable / 4xx / 5xx). */
  pageFailure?: string;
}

export interface GateResult {
  passed: boolean;
  failures: string[];
}

type GetInputFn = (name: string) => string;

const isTrue = (value: string) => value.trim().toLowerCase() === 'true';

/**
 * Parses action inputs from the GitHub Actions environment
 */
export function parseInputs(getInput: GetInputFn): ActionInputs {
  const warnings: string[] = [];
  const url = getInput('url').trim();
  const apiKey = getInput('api-key') || process.env.RANKCLI_API_KEY || undefined;
  const githubToken = getInput('github-token') || undefined;
  const commentOnPr = getInput('comment-on-pr') !== 'false'; // default true
  // The site docs have always said `fail-on-errors`; action.yml said
  // `fail-on-error`. Accept both - either one set to true turns it on.
  const failOnError = isTrue(getInput('fail-on-error')) || isTrue(getInput('fail-on-errors'));
  const scoreThreshold = parseInt(getInput('score-threshold') || '0', 10) || 0;
  const slackWebhook = getInput('slack-webhook') || undefined;
  const discordWebhook = getInput('discord-webhook') || undefined;

  const alertOn: AlertTrigger[] = [];
  for (const value of (getInput('alert-on') || 'error').split(',').map(s => s.trim()).filter(Boolean)) {
    if ((ALERT_TRIGGERS as readonly string[]).includes(value)) {
      if (!alertOn.includes(value as AlertTrigger)) alertOn.push(value as AlertTrigger);
    } else {
      warnings.push(`alert-on "${value}" is not supported and was ignored (supported: ${ALERT_TRIGGERS.join(', ')})`);
    }
  }

  const createPr = getInput('create-pr').trim().toLowerCase();
  if (createPr === 'true' || createPr === 'auto') {
    warnings.push(
      'create-pr was removed: it never opened a PR. For auto-fix PRs, run `rankcli setup --github-action --sync` ' +
      'in your repo - the workflow it writes runs `rankcli fix` and opens the PR.',
    );
  }
  const checks = getInput('checks').trim();
  if (checks && checks !== 'all') {
    warnings.push('checks was removed: it never filtered anything. Every check runs.');
  }

  return {
    url,
    apiKey,
    githubToken,
    commentOnPr,
    failOnError,
    scoreThreshold,
    slackWebhook,
    discordWebhook,
    alertOn,
    warnings,
  };
}

/**
 * The action's pass/fail decision. A page that couldn't be audited always
 * fails - it scores 0 and a green check would say the site is fine - the
 * other two conditions are the opt-in fail-on-error / score-threshold.
 */
export function evaluateGate(inputs: Pick<ActionInputs, 'failOnError' | 'scoreThreshold'>, summary: AuditSummary): GateResult {
  const failures: string[] = [];
  if (summary.pageFailure) {
    failures.push(`${summary.url} could not be audited: ${summary.pageFailure}`);
  }
  if (inputs.failOnError && summary.errorsCount > 0) {
    failures.push(`SEO audit found ${summary.errorsCount} error${summary.errorsCount === 1 ? '' : 's'}`);
  }
  if (inputs.scoreThreshold > 0 && summary.score < inputs.scoreThreshold) {
    failures.push(`SEO score ${summary.score} is below threshold ${inputs.scoreThreshold}`);
  }
  return { passed: failures.length === 0, failures };
}

/**
 * Determines if the action should fail based on inputs and results
 */
export function shouldFail(inputs: Pick<ActionInputs, 'failOnError' | 'scoreThreshold'>, summary: AuditSummary): boolean {
  return !evaluateGate(inputs, summary).passed;
}

/**
 * Gets the score badge color based on score value
 */
function getScoreColor(score: number): string {
  if (score >= 90) return 'brightgreen';
  if (score >= 70) return 'green';
  if (score >= 50) return 'yellow';
  if (score >= 30) return 'orange';
  return 'red';
}

/**
 * Formats a category name for display
 */
function formatCategoryName(category: string): string {
  const names: Record<string, string> = {
    'on-page': 'On-Page',
    'social-meta': 'Social Meta',
    'performance': 'Performance',
    'crawlability': 'Crawlability',
    'indexability': 'Indexability',
    'structured-data': 'Structured Data',
    'security': 'Security',
    'mobile': 'Mobile',
    'links': 'Links',
    'images': 'Images',
    'content': 'Content',
  };
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

/**
 * Formats the audit summary as a PR comment
 */
export function formatPRComment(summary: AuditSummary, gate?: GateResult): string {
  const { url, score, issuesCount, errorsCount, warningsCount, categories } = summary;
  const color = getScoreColor(score);

  let comment = `## SEO Audit Report

![SEO Score](https://img.shields.io/badge/SEO%20Score-${score}%2F100-${color}?style=for-the-badge)

**URL:** ${url}

`;

  if (gate && !gate.passed) {
    comment += `> [!CAUTION]
> **SEO check failed:** ${gate.failures.join('; ')}

`;
  }

  comment += `### Summary

| Metric | Value |
|--------|-------|
| Score | **${score}/100** |
| Total Issues | ${issuesCount} issues |
| Errors | ${errorsCount} errors |
| Warnings | ${warningsCount} warnings |

`;

  // Category breakdown
  const categoryEntries = Object.entries(categories);
  if (categoryEntries.length > 0) {
    comment += `### Category Breakdown

| Category | Score | Issues |
|----------|-------|--------|
`;
    for (const [category, data] of categoryEntries) {
      const emoji = data.score >= 70 ? ':white_check_mark:' : data.score >= 50 ? ':warning:' : ':x:';
      comment += `| ${emoji} ${formatCategoryName(category)} | ${data.score}/100 | ${data.issues} |\n`;
    }
    comment += '\n';
  }

  // Footer
  comment += `---
:robot: Powered by [RankCLI](https://rankcli.dev)`;

  return comment;
}
