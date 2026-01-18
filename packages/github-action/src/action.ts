/**
 * GitHub Action Logic
 *
 * Core functionality for the SEO Autopilot GitHub Action.
 * Parses inputs, formats outputs, and determines pass/fail status.
 */

export type AlertType = 'error' | 'score_drop' | 'weekly_report' | 'pr_created';

export interface ActionInputs {
  url: string;
  githubToken?: string;
  createPr: boolean;
  prBaseBranch: string;
  commentOnPr: boolean;
  failOnError: boolean;
  scoreThreshold: number;
  slackWebhook?: string;
  discordWebhook?: string;
  alertOn: AlertType[];
  checks?: string[];
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
  reportUrl?: string;
  fixPrUrl?: string;
}

type GetInputFn = (name: string) => string;

/**
 * Parses action inputs from the GitHub Actions environment
 */
export function parseInputs(getInput: GetInputFn): ActionInputs {
  const url = getInput('url');
  const githubToken = getInput('github-token') || undefined;
  const createPr = getInput('create-pr') === 'true';
  const prBaseBranch = getInput('pr-base-branch') || 'main';
  const commentOnPr = getInput('comment-on-pr') !== 'false'; // default true
  const failOnError = getInput('fail-on-error') === 'true';
  const scoreThreshold = parseInt(getInput('score-threshold') || '0', 10);
  const slackWebhook = getInput('slack-webhook') || undefined;
  const discordWebhook = getInput('discord-webhook') || undefined;

  const alertOnStr = getInput('alert-on') || 'error';
  const alertOn = alertOnStr
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0) as AlertType[];

  const checksStr = getInput('checks');
  const checks = checksStr && checksStr !== 'all'
    ? checksStr.split(',').map((s) => s.trim())
    : undefined;

  return {
    url,
    githubToken,
    createPr,
    prBaseBranch,
    commentOnPr,
    failOnError,
    scoreThreshold,
    slackWebhook,
    discordWebhook,
    alertOn,
    checks,
  };
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
export function formatPRComment(summary: AuditSummary): string {
  const { url, score, issuesCount, errorsCount, warningsCount, categories, reportUrl, fixPrUrl } = summary;
  const color = getScoreColor(score);

  let comment = `## SEO Audit Report

![SEO Score](https://img.shields.io/badge/SEO%20Score-${score}%2F100-${color}?style=for-the-badge)

**URL:** ${url}

### Summary

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

  // Fix PR link
  if (fixPrUrl) {
    const prNumber = fixPrUrl.match(/\/pull\/(\d+)/)?.[1] || '';
    comment += `### :wrench: Auto-Fix PR

A pull request with fixes has been created: [PR #${prNumber}](${fixPrUrl})

`;
  }

  // Report link
  if (reportUrl) {
    comment += `### :page_facing_up: Full Report

[View Full Report](${reportUrl})

`;
  }

  // Footer
  comment += `---
:robot: Powered by [SEO Autopilot](https://github.com/seo-autopilot/seo-autopilot)`;

  return comment;
}

/**
 * Determines if the action should fail based on inputs and results
 */
export function shouldFail(inputs: ActionInputs, summary: AuditSummary): boolean {
  // Fail on errors if configured
  if (inputs.failOnError && summary.errorsCount > 0) {
    return true;
  }

  // Fail if score below threshold
  if (inputs.scoreThreshold > 0 && summary.score < inputs.scoreThreshold) {
    return true;
  }

  return false;
}
