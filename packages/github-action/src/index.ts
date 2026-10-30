/**
 * RankCLI GitHub Action - runs the RankCLI SEO audit on a URL or a build directory inside the
 * runner, reports it (job summary, annotations, one PR comment kept up to date, Slack/Discord),
 * and fails the step on the configured gate. See run.ts for the run order.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { auditSite, sendSlackAlert, sendDiscordAlert, type AuditAlertPayload, type SiteAuditProgress } from '@rankcli/agent-runtime';
import { COMMENT_MARKER, issueLine } from './action.js';
import { runAction, type ApiValidationResult, type AlertPayload } from './run.js';

const API_URL = process.env.RANKCLI_API_URL || 'https://bspljbxwbjiqueeyzyat.supabase.co';

// Credentials stay out of the logs even when a workflow passes them as plain text instead of
// through secrets.* (which GitHub masks on its own). Header values are tokens more often than not.
for (const value of [core.getInput('api-key'), core.getInput('slack-webhook'), core.getInput('discord-webhook'), process.env.RANKCLI_API_KEY]) {
  if (value) core.setSecret(value);
}
for (const line of core.getInput('headers').split('\n')) {
  const value = line.slice(line.indexOf(':') + 1).trim();
  if (line.includes(':') && value.length >= 8) core.setSecret(value);
}

async function validateApiKey(apiKey: string): Promise<ApiValidationResult> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}/functions/v1/validate-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Endpoint': 'github-action',
      },
    });
  } catch (error) {
    // Couldn't ask - not evidence the key is wrong.
    return { valid: false, errorCode: 'unavailable', error: `could not reach RankCLI (${(error as Error).message})` };
  }

  const data = await response.json().catch(() => ({})) as {
    error?: string;
    tier?: string;
    next_allowed_at?: string;
    resets_at?: string;
    upgrade_url?: string;
    subscription?: { planId?: string };
    rateLimit?: { limit: number; remaining: number; resetsAt: string };
  };

  if (response.ok) {
    return { valid: true, tier: data.subscription?.planId, rateLimit: data.rateLimit };
  }
  if (response.status === 429) {
    const schedule = data.error === 'schedule_exceeded';
    return {
      valid: false,
      errorCode: schedule ? 'schedule_exceeded' : 'rate_limited',
      error: schedule ? 'scheduled-audit limit reached' : 'daily API request limit reached',
      tier: data.tier,
      nextAllowedAt: schedule ? data.next_allowed_at : data.resets_at,
      upgradeUrl: data.upgrade_url,
    };
  }
  if (response.status === 403) {
    return { valid: false, errorCode: 'no_access', error: data.error || 'no API access on this plan', upgradeUrl: data.upgrade_url };
  }
  if (response.status === 401) {
    return { valid: false, errorCode: 'invalid_key', error: data.error || 'invalid API key' };
  }
  return { valid: false, errorCode: 'unavailable', error: data.error || `RankCLI answered HTTP ${response.status}` };
}

const pullRequest = github.context.payload.pull_request;

const logProgress = (event: SiteAuditProgress) => {
  if (event.phase === 'discovery' && event.status === 'done') {
    core.info(`Discovered ${event.pages} page${event.pages === 1 ? '' : 's'} to audit${event.source === 'sitemap' ? ' via the sitemap' : event.source === 'links' ? ' via homepage links' : ''}${event.framework ? ` (${event.framework})` : ''}`);
  } else if (event.phase === 'audit' && event.status === 'done') {
    core.info(`Audited ${event.audited}/${event.total} page${event.total === 1 ? '' : 's'} in ${event.ms}ms`);
  }
};

void runAction({
  getInput: (name) => core.getInput(name),
  info: (message) => core.info(message),
  warning: (message) => core.warning(message),
  setOutput: (name, value) => core.setOutput(name, value),
  setFailed: (message) => core.setFailed(message),
  validateApiKey,
  runAudit: (settings) => auditSite({
    url: settings.url,
    maxPages: settings.maxPages,
    checkLinks: settings.checkLinks,
    dir: settings.dir,
    headers: settings.headers,
    relativeTo: process.env.GITHUB_WORKSPACE || process.cwd(),
    onProgress: logProgress,
  }),
  writeJobSummary: async (summary, gate) => {
    const s = core.summary
      .addHeading(gate.passed ? 'SEO check passed' : 'SEO check failed', 2)
      .addRaw(gate.passed ? '✅ Passed' : `❌ ${gate.failures.join('; ')}`, true)
      .addTable([
        [{ data: 'Metric', header: true }, { data: 'Value', header: true }],
        ['URL', summary.url],
        ['Score', `${summary.score}/100${summary.baseline?.scoreBefore !== undefined ? ` (baseline ${summary.baseline.scoreBefore})` : ''}`],
        ['Pages audited', String(summary.pagesAudited)],
        ['Issues', `${summary.issuesCount}${summary.ignoredCount ? ` (${summary.ignoredCount} ignored)` : ''}`],
        ['Errors', String(summary.errorsCount)],
        ['Warnings', String(summary.warningsCount)],
        ...(summary.baseline ? [['New since baseline', String(summary.baseline.added.length)], ['Fixed since baseline', String(summary.baseline.fixed.length)]] : []),
      ]);
    if (summary.baseline && summary.baseline.added.length > 0) {
      s.addHeading('New findings', 3).addRaw(summary.baseline.added.slice(0, 20).map(issueLine).join('\n'), true);
    }
    s.addLink('Powered by RankCLI', 'https://rankcli.dev');
    await s.write();
  },
  annotate: (level, message, properties) => {
    const props = { title: properties.title, ...(properties.file && { file: properties.file, startLine: 1 }) };
    if (level === 'error') core.error(message, props);
    else if (level === 'warning') core.warning(message, props);
    else core.notice(message, props);
  },
  upsertPRComment: pullRequest
    ? async (body, token) => {
        const octokit = github.getOctokit(token);
        const { owner, repo } = github.context.repo;
        const existing = await octokit.paginate(octokit.rest.issues.listComments, { owner, repo, issue_number: pullRequest.number, per_page: 100 });
        const mine = existing.find(c => c.body?.startsWith(COMMENT_MARKER));
        if (mine) {
          await octokit.rest.issues.updateComment({ owner, repo, comment_id: mine.id, body });
          return 'updated';
        }
        await octokit.rest.issues.createComment({ owner, repo, issue_number: pullRequest.number, body });
        return 'created';
      }
    : undefined,
  writeFile: (path, content) => {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
  },
  sendAlert: async (channel, webhookUrl, payload: AlertPayload) => {
    const alert: AuditAlertPayload = {
      projectId: `${github.context.repo.owner}/${github.context.repo.repo}`,
      projectName: github.context.repo.repo,
      url: payload.url,
      score: payload.score,
      issuesFound: payload.issuesFound,
      errorCount: payload.errorCount,
      timestamp: new Date().toISOString(),
    };
    const send = channel === 'slack' ? sendSlackAlert : sendDiscordAlert;
    const result = await send(webhookUrl, 'error', alert);
    if (!result.success) throw new Error(result.error || `${channel} webhook failed`);
  },
  cwd: process.env.GITHUB_WORKSPACE || process.cwd(),
});
