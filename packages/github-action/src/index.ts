/**
 * RankCLI GitHub Action - runs the RankCLI SEO audit on a URL inside the
 * runner, reports it (job summary, PR comment, Slack/Discord), and fails
 * the step on the configured gate. See run.ts for the run order.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import { runFullAudit, sendSlackAlert, sendDiscordAlert, type AuditAlertPayload } from '@rankcli/agent-runtime';
import { runAction, type ApiValidationResult, type AlertPayload } from './run.js';

const API_URL = process.env.RANKCLI_API_URL || 'https://bspljbxwbjiqueeyzyat.supabase.co';

// Credentials stay out of the logs even when a workflow passes them as plain text instead of
// through secrets.* (which GitHub masks on its own).
for (const value of [core.getInput('api-key'), core.getInput('slack-webhook'), core.getInput('discord-webhook'), process.env.RANKCLI_API_KEY]) {
  if (value) core.setSecret(value);
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

void runAction({
  getInput: (name) => core.getInput(name),
  info: (message) => core.info(message),
  warning: (message) => core.warning(message),
  setOutput: (name, value) => core.setOutput(name, value),
  setFailed: (message) => core.setFailed(message),
  validateApiKey,
  runAudit: (url) => runFullAudit({ url }),
  writeJobSummary: async (summary, gate) => {
    await core.summary
      .addHeading('SEO Audit Results')
      .addRaw(gate.passed ? '✅ Passed' : `❌ Failed: ${gate.failures.join('; ')}`, true)
      .addTable([
        [{ data: 'Metric', header: true }, { data: 'Value', header: true }],
        ['URL', summary.url],
        ['Score', `${summary.score}/100`],
        ['Issues', String(summary.issuesCount)],
        ['Errors', String(summary.errorsCount)],
        ['Warnings', String(summary.warningsCount)],
      ])
      .addLink('Powered by RankCLI', 'https://rankcli.dev')
      .write();
  },
  postPRComment: pullRequest
    ? async (body, token) => {
        const octokit = github.getOctokit(token);
        await octokit.rest.issues.createComment({
          owner: github.context.repo.owner,
          repo: github.context.repo.repo,
          issue_number: pullRequest.number,
          body,
        });
      }
    : undefined,
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
});
