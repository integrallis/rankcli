/**
 * The action's run order, with every side effect injected so it can be
 * tested. index.ts wires in @actions/core, @actions/github and the runtime.
 *
 * Order matters: the gate is decided right after the audit, and nothing
 * after that (job summary, PR comment, alerts) can change it. The PR
 * comment used to run first and throw on a read-only token (every fork
 * PR), so the action failed with "Resource not accessible by integration"
 * instead of reporting - or passing - the actual audit.
 */
import type { AuditReport, AuditIssue } from '@rankcli/agent-runtime';
import { parseInputs, evaluateGate, formatPRComment, type AuditSummary, type GateResult } from './action.js';

export interface ApiValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: 'rate_limited' | 'schedule_exceeded' | 'invalid_key' | 'no_access' | 'unavailable';
  tier?: string;
  nextAllowedAt?: string;
  upgradeUrl?: string;
  rateLimit?: { limit: number; remaining: number; resetsAt: string };
}

export interface AlertPayload {
  url: string;
  score: number;
  issuesFound: number;
  errorCount: number;
  failed: boolean;
  failures: string[];
}

export interface ActionDeps {
  getInput(name: string): string;
  info(message: string): void;
  warning(message: string): void;
  setOutput(name: string, value: string | number | boolean): void;
  setFailed(message: string): void;
  validateApiKey(apiKey: string): Promise<ApiValidationResult>;
  runAudit(url: string): Promise<AuditReport>;
  writeJobSummary(summary: AuditSummary, gate: GateResult): Promise<void>;
  /** Undefined when the run isn't for a pull request. */
  postPRComment?: (body: string, token: string) => Promise<void>;
  sendAlert(channel: 'slack' | 'discord', webhookUrl: string, payload: AlertPayload): Promise<void>;
}

const PAGE_FAILURE_CODES = new Set(['FETCH_ERROR', 'HTTP_ERROR_STATUS']);

export function summarize(url: string, report: AuditReport): AuditSummary {
  const issues: AuditIssue[] = report.issues;
  const summary: AuditSummary = {
    url,
    score: report.healthScore.overall,
    issuesCount: issues.length,
    errorsCount: issues.filter(i => i.severity === 'error' || i.severity === 'critical').length,
    warningsCount: issues.filter(i => i.severity === 'warning').length,
    categories: {},
  };
  const pageFailure = issues.find(i => PAGE_FAILURE_CODES.has(i.code));
  if (pageFailure) summary.pageFailure = pageFailure.title;

  for (const issue of issues) {
    summary.categories[issue.category] ??= { score: 0, issues: 0 };
    summary.categories[issue.category].issues++;
  }
  const categoryScoreMap: Record<string, keyof AuditReport['healthScore']> = {
    'on-page': 'onPage',
    crawlability: 'crawlability',
    indexability: 'indexability',
    performance: 'performance',
    security: 'security',
    content: 'content',
    links: 'links',
  };
  for (const [category, key] of Object.entries(categoryScoreMap)) {
    if (summary.categories[category]) summary.categories[category].score = report.healthScore[key];
  }
  return summary;
}

async function bestEffort(deps: ActionDeps, what: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    deps.warning(`${what} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function runAction(deps: ActionDeps): Promise<void> {
  try {
    const inputs = parseInputs((name) => deps.getInput(name));
    for (const warning of inputs.warnings) deps.warning(warning);

    try {
      const parsed = new URL(inputs.url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('not http(s)');
    } catch {
      deps.setFailed(`Invalid url input "${inputs.url}" - use a full http(s) URL`);
      return;
    }

    // The audit runs entirely in this runner; the key only identifies the
    // account. So a quota or plan problem is a warning and the audit still
    // runs - returning early here used to report success on a rate-limited
    // day without auditing anything. Only a wrong/revoked key fails.
    if (inputs.apiKey) {
      deps.info('Validating API key...');
      const validation = await deps.validateApiKey(inputs.apiKey);
      if (validation.valid) {
        deps.info(`API key valid. Plan: ${validation.tier ?? 'unknown'}`);
        if (validation.rateLimit) {
          deps.setOutput('rate-limit-remaining', validation.rateLimit.remaining);
          deps.setOutput('rate-limit-resets-at', validation.rateLimit.resetsAt);
        }
      } else if (validation.errorCode === 'invalid_key') {
        deps.setFailed(`API key validation failed: ${validation.error}`);
        return;
      } else {
        deps.warning(`RankCLI API key not usable right now (${validation.error}) - running the audit anyway.`);
        if (validation.errorCode === 'rate_limited' && validation.nextAllowedAt) {
          deps.setOutput('rate-limit-remaining', 0);
          deps.setOutput('rate-limit-resets-at', validation.nextAllowedAt);
        }
        if (validation.upgradeUrl) deps.info(`Upgrade: ${validation.upgradeUrl}`);
      }
    }

    deps.info(`Running SEO audit on: ${inputs.url}`);
    const report = await deps.runAudit(inputs.url);
    const summary = summarize(inputs.url, report);
    const gate = evaluateGate(inputs, summary);

    deps.info(`Audit complete. Score: ${summary.score}/100, Issues: ${summary.issuesCount}, Errors: ${summary.errorsCount}`);

    deps.setOutput('score', summary.score);
    deps.setOutput('issues-count', summary.issuesCount);
    deps.setOutput('errors-count', summary.errorsCount);
    deps.setOutput('warnings-count', summary.warningsCount);
    deps.setOutput('passed', gate.passed);
    deps.setOutput('report-json', JSON.stringify(report));

    // Everything below is reporting. None of it may change the outcome.
    await bestEffort(deps, 'Writing the job summary', () => deps.writeJobSummary(summary, gate));

    if (inputs.commentOnPr && deps.postPRComment) {
      const token = inputs.githubToken || process.env.GITHUB_TOKEN || '';
      await bestEffort(
        deps,
        'Posting the PR comment (fork PRs get a read-only token; the workflow needs `permissions: pull-requests: write`)',
        async () => {
          await deps.postPRComment!(formatPRComment(summary, gate), token);
          deps.info('Posted audit results as PR comment');
        },
      );
    }

    const shouldAlert = (inputs.alertOn.includes('error') && summary.errorsCount > 0)
      || (inputs.alertOn.includes('failure') && !gate.passed);
    if (shouldAlert) {
      const payload: AlertPayload = {
        url: inputs.url,
        score: summary.score,
        issuesFound: summary.issuesCount,
        errorCount: summary.errorsCount,
        failed: !gate.passed,
        failures: gate.failures,
      };
      if (inputs.slackWebhook) {
        await bestEffort(deps, 'Slack alert', () => deps.sendAlert('slack', inputs.slackWebhook!, payload));
      }
      if (inputs.discordWebhook) {
        await bestEffort(deps, 'Discord alert', () => deps.sendAlert('discord', inputs.discordWebhook!, payload));
      }
    }

    if (!gate.passed) {
      deps.setFailed(gate.failures.join('; '));
    }
  } catch (error) {
    deps.setFailed(`Action failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}
