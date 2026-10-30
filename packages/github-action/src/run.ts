/**
 * The action's run order, with every side effect injected so it can be
 * tested. index.ts wires in @actions/core, @actions/github and the runtime.
 *
 * Order matters: the gate is decided right after the audit, and nothing
 * after that (job summary, annotations, PR comment, alerts) can change it.
 * The PR comment used to run first and throw on a read-only token (every
 * fork PR), so the action failed with "Resource not accessible by
 * integration" instead of reporting - or passing - the actual audit.
 */
import { existsSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import {
  resolveAuditSettings,
  loadBaselineFile,
  applyIgnores,
  diffIssues,
  issueKeys,
  evaluateGate,
  isGated,
  type AuditIssue,
  type AuditSettings,
  type BaselineReport,
  type GateResult,
  type SiteAuditResult,
} from '@rankcli/agent-runtime';
import { parseInputs, summarize, shouldComment, formatPRComment, type AuditSummary } from './action.js';

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

export type AnnotationLevel = 'error' | 'warning' | 'notice';

export interface ActionDeps {
  getInput(name: string): string;
  info(message: string): void;
  warning(message: string): void;
  setOutput(name: string, value: string | number | boolean): void;
  setFailed(message: string): void;
  validateApiKey(apiKey: string): Promise<ApiValidationResult>;
  /** The engine's site audit with these settings (`dir` already absolute). */
  runAudit(settings: AuditSettings & { url: string }): Promise<SiteAuditResult | null>;
  writeJobSummary(summary: AuditSummary, gate: GateResult): Promise<void>;
  /** One annotation on the run; `file` when the finding maps to a file in the checkout. */
  annotate?: (level: AnnotationLevel, message: string, properties: { title: string; file?: string }) => void;
  /** Create the PR comment, or update the one that carries COMMENT_MARKER. Undefined outside pull requests. */
  upsertPRComment?: (body: string, token: string) => Promise<'created' | 'updated'>;
  /** Write the JSON report where `report-file` says. */
  writeFile?: (path: string, content: string) => void;
  sendAlert(channel: 'slack' | 'discord', webhookUrl: string, payload: AlertPayload): Promise<void>;
  /** The workspace (default: process.cwd()). */
  cwd?: string;
}

async function bestEffort(deps: ActionDeps, what: string, fn: () => Promise<void> | void): Promise<void> {
  try {
    await fn();
  } catch (error) {
    deps.warning(`${what} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

const MAX_ANNOTATIONS_PER_LEVEL = 10;

export async function runAction(deps: ActionDeps): Promise<void> {
  const cwd = deps.cwd ?? process.cwd();
  try {
    const inputs = parseInputs((name) => deps.getInput(name));
    for (const warning of inputs.warnings) deps.warning(warning);

    const resolved = resolveAuditSettings({
      url: inputs.url,
      dir: inputs.dir,
      maxPages: inputs.maxPages,
      failOn: inputs.failOn,
      baseline: inputs.baseline,
      header: inputs.headers,
      config: inputs.config,
    }, cwd);
    if (resolved.error || !resolved.settings) {
      deps.setFailed(resolved.error ?? 'Invalid settings');
      return;
    }
    const settings = resolved.settings;
    if (settings.dir) {
      const dir = isAbsolute(settings.dir) ? settings.dir : join(cwd, settings.dir);
      if (!existsSync(dir) || !statSync(dir).isDirectory()) {
        deps.setFailed(`dir "${settings.dir}" is not a directory in the workspace (check out the repository and build it first)`);
        return;
      }
      settings.dir = dir;
      settings.url ||= 'http://localhost';
    }
    const url = settings.url;
    if (!url) {
      deps.setFailed('Set `url` (the site or preview to audit) or `dir` (a build directory)');
      return;
    }
    try {
      const parsed = new URL(url);
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('not http(s)');
    } catch {
      deps.setFailed(`Invalid url input "${url}" - use a full http(s) URL`);
      return;
    }

    let baseline: (BaselineReport & { file: string }) | undefined;
    if (settings.baselineFile) {
      const read = loadBaselineFile(settings.baselineFile, cwd);
      if (read.error) {
        deps.setFailed(read.error);
        return;
      }
      baseline = read.baseline;
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

    deps.info(settings.dir ? `Running SEO audit on ${settings.dir} as ${url}` : `Running SEO audit on: ${url}`);
    if (settings.configPath) deps.info(`Using ${settings.configPath}`);
    const startedAt = new Date();
    const result = await deps.runAudit({ ...settings, url });
    if (!result) {
      deps.setFailed(`${url} could not be audited: no page could be analyzed`);
      return;
    }

    const { issues, ignored } = applyIgnores(result.issues, settings.ignore);
    const diff = baseline ? diffIssues(baseline.issues, issues) : undefined;
    const baselineKeys = baseline ? new Set(baseline.issues.flatMap(issueKeys)) : undefined;
    const isNew = (issue: AuditIssue) => !baselineKeys || issueKeys(issue).some(k => !baselineKeys.has(k));
    const scores = { ...(result.primaryReport.healthScore ?? {}), overall: result.score };
    const gate = evaluateGate(settings.spec, diff ? diff.added : issues, scores, { newOnly: !!diff });
    // A page that couldn't be audited always fails - it scores 0 and a green check would say
    // the site is fine.
    if (result.pageFailure) {
      gate.passed = false;
      gate.failures.unshift(`${url} could not be audited: ${result.pageFailure.title}`);
    }
    const summary = summarize(url, result, issues, {
      baseline: baseline && diff ? { file: baseline.file, added: diff.added, fixed: diff.fixed, unchanged: diff.unchanged, scoreBefore: baseline.score } : undefined,
      ignoredCount: ignored.length,
      dir: inputs.dir ?? settings.config?.dir,
    });

    deps.info(`Audit complete. Score: ${summary.score}/100, Issues: ${summary.issuesCount}, Errors: ${summary.errorsCount}${diff ? `, New since baseline: ${diff.added.length}` : ''}`);

    deps.setOutput('score', summary.score);
    deps.setOutput('issues-count', summary.issuesCount);
    deps.setOutput('errors-count', summary.errorsCount);
    deps.setOutput('warnings-count', summary.warningsCount);
    deps.setOutput('new-issues-count', diff ? diff.added.length : summary.issuesCount);
    deps.setOutput('fixed-issues-count', diff ? diff.fixed.length : 0);
    deps.setOutput('passed', gate.passed);
    const report = {
      url,
      timestamp: startedAt.toISOString(),
      score: summary.score,
      pagesAudited: result.pagesAudited,
      pages: result.pages,
      discovery: result.discovery,
      checksRun: result.checksRun,
      checksPassed: result.primaryReport.summary?.passed ?? 0,
      framework: result.framework,
      ...(summary.dir && { dir: summary.dir }),
      ...(settings.configPath && { config: settings.configPath }),
      issues,
      ...(ignored.length > 0 && { ignored }),
      ...(summary.baseline && { baseline: summary.baseline }),
      healthScores: result.primaryReport.healthScore,
      ...(result.pageFailure && { error: result.pageFailure.title }),
      ...(isGated(settings.spec) && { gate }),
      exitCode: result.pageFailure ? 3 : gate.passed ? 0 : 1,
    };
    deps.setOutput('report-json', JSON.stringify(report));
    if (inputs.reportFile && deps.writeFile) {
      const path = isAbsolute(inputs.reportFile) ? inputs.reportFile : join(cwd, inputs.reportFile);
      await bestEffort(deps, `Writing ${inputs.reportFile}`, () => deps.writeFile!(path, JSON.stringify(report, null, 2)));
      deps.setOutput('report-file', path);
    }

    // Everything below is reporting. None of it may change the outcome.
    await bestEffort(deps, 'Writing the job summary', () => deps.writeJobSummary(summary, gate));

    if (inputs.annotations && deps.annotate) {
      // With a baseline, the new findings; otherwise the errors, and the warnings when the
      // gate counts them. Ten per level: GitHub shows no more than that per step anyway.
      const candidates = diff ? diff.added : issues.filter(i => i.severity === 'error' || i.severity === 'critical' || (settings.spec.failOn && settings.spec.failOn !== 'error' && i.severity === 'warning'));
      const counts: Record<AnnotationLevel, number> = { error: 0, warning: 0, notice: 0 };
      await bestEffort(deps, 'Annotating the run', () => {
        for (const issue of candidates) {
          const level: AnnotationLevel = issue.severity === 'error' || issue.severity === 'critical' ? 'error' : issue.severity === 'warning' ? 'warning' : 'notice';
          if (counts[level] >= MAX_ANNOTATIONS_PER_LEVEL) continue;
          counts[level]++;
          const page = issue.affectedUrls?.[0];
          const file = page ? result.files?.[page] : undefined;
          const where = page && !file ? ` (${page})` : '';
          deps.annotate!(level, `${issue.title}${where}: ${issue.howToFix || issue.description}`, { title: `${issue.code}${isNew(issue) && diff ? ' (new)' : ''}`, file });
        }
      });
    }

    if (deps.upsertPRComment && shouldComment(inputs.commentOnPr, summary, gate)) {
      const token = inputs.githubToken || process.env.GITHUB_TOKEN || '';
      await bestEffort(
        deps,
        'Posting the PR comment (fork PRs get a read-only token; the workflow needs `permissions: pull-requests: write`)',
        async () => {
          const what = await deps.upsertPRComment!(formatPRComment(summary, gate), token);
          deps.info(what === 'updated' ? 'Updated the audit comment on the pull request' : 'Posted audit results as a PR comment');
        },
      );
    }

    const shouldAlert = (inputs.alertOn.includes('error') && summary.errorsCount > 0)
      || (inputs.alertOn.includes('failure') && !gate.passed);
    if (shouldAlert) {
      const payload: AlertPayload = {
        url,
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
