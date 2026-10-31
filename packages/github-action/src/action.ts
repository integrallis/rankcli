/**
 * GitHub Action logic: inputs, the summary, the PR comment. Pure functions - run.ts does the
 * I/O, and the gate itself is the engine's (`evaluateGate`), the same one `rankcli audit`
 * applies.
 */
import type { AuditIssue, GateResult, HealthScore, SiteAuditResult } from '@rankcli/agent-runtime';

/**
 * Alert triggers the action implements:
 * - error: the audit found at least one error-severity issue
 * - failure: the action failed (gate tripped, or the site couldn't be audited)
 */
export type AlertTrigger = 'error' | 'failure';
const ALERT_TRIGGERS: readonly AlertTrigger[] = ['error', 'failure'];

export type CommentMode = 'regressions' | 'always' | 'never';
const COMMENT_MODES: readonly CommentMode[] = ['regressions', 'always', 'never'];

/**
 * Inputs the action used to declare but never implemented. Still declared
 * in action.yml (with a deprecationMessage) so an existing workflow gets a
 * warning instead of an "Unexpected input" error.
 */
export const REMOVED_INPUTS = ['create-pr', 'pr-threshold-errors', 'pr-threshold-score', 'pr-base-branch', 'checks'] as const;

/** The marker that identifies the action's PR comment, so a later run updates it instead of adding another. */
export const COMMENT_MARKER = '<!-- rankcli-audit -->';

export interface ActionInputs {
  url?: string;
  dir?: string;
  /** Gate rules in the `--fail-on` syntax; the legacy inputs are folded in. */
  failOn: string[];
  baseline?: string;
  config?: string;
  maxPages?: string;
  /** "Name: value" lines. */
  headers: string[];
  reportFile?: string;
  apiKey?: string;
  githubToken?: string;
  commentOnPr: CommentMode;
  annotations: boolean;
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
  noticesCount: number;
  pagesAudited: number;
  categories: Record<string, CategorySummary>;
  healthScores?: Partial<HealthScore>;
  /** Set when the page itself couldn't be audited (unreachable / 4xx / 5xx). */
  pageFailure?: string;
  /** Set when a baseline was applied. */
  baseline?: { file: string; added: AuditIssue[]; fixed: AuditIssue[]; unchanged: number; scoreBefore?: number };
  ignoredCount: number;
  /** The build directory, when one was audited. */
  dir?: string;
}

type GetInputFn = (name: string) => string;

const isTrue = (value: string) => value.trim().toLowerCase() === 'true';
const splitList = (value: string) => value.split(',').map(s => s.trim()).filter(Boolean);

/**
 * Parses action inputs from the GitHub Actions environment
 */
export function parseInputs(getInput: GetInputFn): ActionInputs {
  const warnings: string[] = [];
  const url = getInput('url').trim() || undefined;
  const dir = getInput('dir').trim() || undefined;
  const apiKey = getInput('api-key') || process.env.RANKCLI_API_KEY || undefined;
  const githubToken = getInput('github-token') || undefined;

  const failOn = splitList(getInput('fail-on'));
  // The site docs have always said `fail-on-errors`; action.yml said `fail-on-error`. Both
  // mean `fail-on: error`. `score-threshold: N` means `fail-on: score<N`.
  if (isTrue(getInput('fail-on-error')) || isTrue(getInput('fail-on-errors'))) failOn.push('error');
  const scoreThreshold = parseInt(getInput('score-threshold') || '0', 10) || 0;
  if (scoreThreshold > 0) failOn.push(`score<${scoreThreshold}`);

  const commentRaw = getInput('comment-on-pr').trim().toLowerCase();
  let commentOnPr: CommentMode = 'regressions';
  if (commentRaw === 'true') commentOnPr = 'always';
  else if (commentRaw === 'false') commentOnPr = 'never';
  else if ((COMMENT_MODES as readonly string[]).includes(commentRaw)) commentOnPr = commentRaw as CommentMode;
  else if (commentRaw) warnings.push(`comment-on-pr "${commentRaw}" is not supported; using "regressions" (supported: ${COMMENT_MODES.join(', ')}, true, false)`);

  const annotationsRaw = getInput('annotations').trim().toLowerCase();
  const annotations = annotationsRaw === '' ? true : annotationsRaw !== 'false';

  const alertOn: AlertTrigger[] = [];
  for (const value of splitList(getInput('alert-on') || 'error')) {
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
    dir,
    failOn,
    baseline: getInput('baseline').trim() || undefined,
    config: getInput('config').trim() || undefined,
    maxPages: getInput('max-pages').trim() || undefined,
    headers: getInput('headers').split('\n').map(l => l.trim()).filter(Boolean),
    reportFile: getInput('report-file').trim() || undefined,
    apiKey,
    githubToken,
    commentOnPr,
    annotations,
    slackWebhook: getInput('slack-webhook') || undefined,
    discordWebhook: getInput('discord-webhook') || undefined,
    alertOn,
    warnings,
  };
}

/** The audit, as the summary, the comment and the outputs see it. */
export function summarize(url: string, result: SiteAuditResult, issues: AuditIssue[], extras: Pick<AuditSummary, 'baseline' | 'ignoredCount' | 'dir'>): AuditSummary {
  const summary: AuditSummary = {
    url,
    score: result.score,
    issuesCount: issues.length,
    errorsCount: issues.filter(i => i.severity === 'error' || i.severity === 'critical').length,
    warningsCount: issues.filter(i => i.severity === 'warning').length,
    noticesCount: issues.filter(i => i.severity === 'notice' || i.severity === 'info').length,
    pagesAudited: result.pagesAudited,
    categories: {},
    healthScores: result.primaryReport.healthScore,
    pageFailure: result.pageFailure?.title,
    ...extras,
  };
  for (const issue of issues) {
    summary.categories[issue.category] ??= { score: 0, issues: 0 };
    summary.categories[issue.category].issues++;
  }
  const hs = result.primaryReport.healthScore;
  const categoryScoreMap: Record<string, keyof HealthScore> = {
    'on-page': 'onPage',
    crawlability: 'crawlability',
    indexability: 'indexability',
    performance: 'performance',
    security: 'security',
    content: 'content',
    links: 'links',
    'ai-readiness': 'aiReadiness',
    social: 'social',
    'local-seo': 'localSeo',
    accessibility: 'accessibility',
  };
  for (const [category, key] of Object.entries(categoryScoreMap)) {
    if (summary.categories[category] && hs) summary.categories[category].score = hs[key];
  }
  return summary;
}

/** Whether this run posts (or updates) the PR comment. */
export function shouldComment(mode: CommentMode, summary: AuditSummary, gate: GateResult): boolean {
  if (mode === 'always') return true;
  if (mode === 'never') return false;
  // regressions: the gate failed, or there are new findings against the baseline
  return !gate.passed || (summary.baseline !== undefined && summary.baseline.added.length > 0);
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
    'ai-readiness': 'AI Readiness',
    'local-seo': 'Local SEO',
  };
  return names[category] || category.charAt(0).toUpperCase() + category.slice(1);
}

/** Text safe inside the comment's Markdown: no code spans, emphasis, tags or table pipes. Underscores stay: every issue code has them. */
const plain = (text: string) => text.replace(/[`*<>|]/g, '');

/** A finding as one Markdown list line: the code, the title, the pages. */
export function issueLine(issue: AuditIssue): string {
  const pages = issue.affectedUrls?.length ? ` (${issue.affectedUrls.length === 1 ? plain(issue.affectedUrls[0]) : `${issue.affectedUrls.length} pages`})` : '';
  return `- \`${plain(issue.code)}\` ${plain(issue.title)}${pages}`;
}

/**
 * Formats the audit summary as a PR comment. Starts with COMMENT_MARKER so the next run finds
 * and updates it.
 */
export function formatPRComment(summary: AuditSummary, gate?: GateResult): string {
  const { url, score, issuesCount, errorsCount, warningsCount, categories } = summary;
  const color = getScoreColor(score);
  const title = gate && !gate.passed ? 'SEO check failed' : summary.baseline && summary.baseline.added.length > 0 ? 'SEO check: new findings' : 'SEO check passed';

  let comment = `${COMMENT_MARKER}
## ${title}

![SEO Score](https://img.shields.io/badge/SEO%20Score-${score}%2F100-${color}?style=for-the-badge)

**URL:** \`${url.replace(/`/g, '')}\`${summary.dir ? ` (built in \`${summary.dir.replace(/`/g, '')}\`)` : ''}

`;

  if (gate && !gate.passed) {
    comment += `> [!CAUTION]
> ${gate.failures.map(plain).join('; ')}

`;
  }

  if (summary.baseline) {
    const b = summary.baseline;
    const delta = b.scoreBefore !== undefined ? ` Score ${b.scoreBefore} → ${score}.` : '';
    comment += `**Since \`${plain(b.file)}\`:** ${b.added.length} new, ${b.fixed.length} fixed, ${b.unchanged} unchanged.${delta}\n\n`;
    if (b.added.length > 0) comment += `### New findings\n\n${b.added.slice(0, 20).map(issueLine).join('\n')}${b.added.length > 20 ? `\n- … and ${b.added.length - 20} more` : ''}\n\n`;
    if (b.fixed.length > 0) comment += `### Fixed\n\n${b.fixed.slice(0, 10).map(issueLine).join('\n')}${b.fixed.length > 10 ? `\n- … and ${b.fixed.length - 10} more` : ''}\n\n`;
  }

  comment += `### Summary

| Metric | Value |
|--------|-------|
| Score | **${score}/100** |
| Pages audited | ${summary.pagesAudited} |
| Total Issues | ${issuesCount} issues${summary.ignoredCount ? ` (${summary.ignoredCount} ignored by rankcli.config.json)` : ''} |
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
