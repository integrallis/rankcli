/**
 * SEO Autopilot GitHub Action
 *
 * Runs 200+ SEO checks on your site with auto-fix PRs, Slack alerts, and detailed reports.
 */

import * as core from '@actions/core';
import * as github from '@actions/github';
import {
  parseInputs,
  formatPRComment,
  shouldFail,
  shouldCreatePr,
  AuditSummary,
} from './action.js';
import {
  runAuditWithFixes,
  createAuditPR,
  sendSlackAlert,
  sendDiscordAlert,
  AlertConfig,
  AuditAlertPayload,
  AuditIssue,
} from '@rankcli/agent-runtime';

interface ApiValidationResult {
  valid: boolean;
  error?: string;
  errorCode?: 'rate_limited' | 'schedule_exceeded' | 'invalid_key' | 'no_access';
  tier?: string;
  nextAllowedAt?: string;
  upgradeUrl?: string;
  rateLimit?: {
    limit: number;
    remaining: number;
    resetsAt: string;
  };
}

interface ApiValidationResponse {
  valid?: boolean;
  error?: string;
  tier?: string;
  next_allowed_at?: string;
  resets_at?: string;
  upgrade_url?: string;
  subscription?: {
    planId?: string;
  };
  rateLimit?: {
    limit: number;
    remaining: number;
    resetsAt: string;
  };
}

async function validateApiKey(apiKey: string): Promise<ApiValidationResult> {
  try {
    const response = await fetch('https://bspljbxwbjiqueeyzyat.supabase.co/functions/v1/validate-api-key', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Endpoint': 'github-action',
      },
    });

    const data = await response.json() as ApiValidationResponse;

    if (!response.ok) {
      // Handle different error types
      if (response.status === 429) {
        if (data.error === 'schedule_exceeded') {
          return {
            valid: false,
            error: data.error,
            errorCode: 'schedule_exceeded',
            tier: data.tier,
            nextAllowedAt: data.next_allowed_at,
            upgradeUrl: data.upgrade_url,
          };
        }
        return {
          valid: false,
          error: 'Rate limit exceeded',
          errorCode: 'rate_limited',
          tier: data.tier,
          nextAllowedAt: data.resets_at,
          upgradeUrl: data.upgrade_url,
        };
      }
      if (response.status === 403) {
        return {
          valid: false,
          error: data.error || 'No API access',
          errorCode: 'no_access',
          upgradeUrl: data.upgrade_url,
        };
      }
      return {
        valid: false,
        error: data.error || 'Invalid API key',
        errorCode: 'invalid_key',
      };
    }

    return {
      valid: true,
      tier: data.subscription?.planId,
      rateLimit: data.rateLimit,
    };
  } catch (error) {
    return {
      valid: false,
      error: `API validation failed: ${(error as Error).message}`,
      errorCode: 'invalid_key',
    };
  }
}

async function run(): Promise<void> {
  try {
    // Parse inputs
    const inputs = parseInputs((name) => core.getInput(name));
    core.info(`Running SEO audit on: ${inputs.url}`);

    // Validate API key if provided (required for scheduled runs)
    if (inputs.apiKey) {
      core.info('Validating API key...');
      const validation = await validateApiKey(inputs.apiKey);

      if (!validation.valid) {
        // Handle schedule exceeded gracefully
        if (validation.errorCode === 'schedule_exceeded') {
          core.warning(`⏰ Scheduled audit skipped - your ${validation.tier} plan has reached its schedule limit.`);
          core.warning(`Next audit allowed at: ${validation.nextAllowedAt}`);
          if (validation.upgradeUrl) {
            core.warning(`Upgrade for more frequent audits: ${validation.upgradeUrl}`);
          }
          
          // Set outputs to indicate skip
          core.setOutput('skipped', 'true');
          core.setOutput('skip-reason', 'schedule_exceeded');
          core.setOutput('next-allowed-at', validation.nextAllowedAt);
          
          // Don't fail the action, just skip
          return;
        }

        // Handle rate limit exceeded
        if (validation.errorCode === 'rate_limited') {
          core.warning(`⚠️ Rate limit exceeded - your ${validation.tier} plan has used all daily API requests.`);
          core.warning(`Resets at: ${validation.nextAllowedAt}`);
          if (validation.upgradeUrl) {
            core.warning(`Need more? Upgrade: ${validation.upgradeUrl}`);
          }
          
          core.setOutput('skipped', 'true');
          core.setOutput('skip-reason', 'rate_limited');
          core.setOutput('resets-at', validation.nextAllowedAt);
          return;
        }

        // Other errors should fail
        core.setFailed(`API key validation failed: ${validation.error}`);
        return;
      }

      core.info(`API key valid. Tier: ${validation.tier}, Remaining requests: ${validation.rateLimit?.remaining}`);
      
      // Set rate limit info in outputs
      if (validation.rateLimit) {
        core.setOutput('rate-limit-remaining', validation.rateLimit.remaining);
        core.setOutput('rate-limit-resets-at', validation.rateLimit.resetsAt);
      }
    }

    // Determine if we should generate fixes
    const shouldGenerateFixes = inputs.createPr !== 'false';

    // Run audit
    const auditResult = await runAuditWithFixes({
      url: inputs.url,
      generateFixes: shouldGenerateFixes,
    });

    const { report, fixes, score } = auditResult;

    // Build summary
    const summary: AuditSummary = {
      url: inputs.url,
      score,
      issuesCount: report.issues.length,
      errorsCount: report.issues.filter((i: AuditIssue) => i.severity === 'error').length,
      warningsCount: report.issues.filter((i: AuditIssue) => i.severity === 'warning').length,
      categories: {},
    };

    // Build category breakdown
    for (const issue of report.issues) {
      if (!summary.categories[issue.category]) {
        summary.categories[issue.category] = { score: 0, issues: 0 };
      }
      summary.categories[issue.category].issues++;
    }

    // Add category scores from health scores
    const categoryScoreMap: Record<string, keyof typeof report.healthScore> = {
      'on-page': 'onPage',
      'crawlability': 'crawlability',
      'indexability': 'indexability',
      'performance': 'performance',
      'security': 'security',
      'content': 'content',
      'links': 'links',
    };

    for (const [category, healthKey] of Object.entries(categoryScoreMap)) {
      if (summary.categories[category]) {
        summary.categories[category].score = report.healthScore[healthKey];
      }
    }

    core.info(`Audit complete. Score: ${score}/100, Issues: ${summary.issuesCount}`);

    // Create fix PR if requested (check thresholds for auto mode)
    let fixPrUrl: string | undefined;
    const createPr = shouldCreatePr(inputs, summary);
    
    if (createPr && fixes.length > 0 && inputs.githubToken) {
      if (inputs.createPr === 'auto') {
        core.info(`Auto-PR triggered: ${summary.errorsCount} errors, score ${score}`);
      }
      core.info('Creating PR with fixes...');
      const prResult = await createAuditPR(auditResult, {
        baseBranch: inputs.prBaseBranch,
        headBranch: `seo-fixes-${Date.now()}`,
      });

      if (prResult.success && prResult.prUrl) {
        fixPrUrl = prResult.prUrl;
        summary.fixPrUrl = fixPrUrl;
        core.info(`Fix PR created: ${fixPrUrl}`);
      }
    } else if (inputs.createPr === 'auto' && !createPr) {
      core.info(`Auto-PR not triggered: ${summary.errorsCount} errors (threshold: ${inputs.prThresholdErrors}), score ${score} (threshold: ${inputs.prThresholdScore})`);
    }

    // Post PR comment if on a pull request
    if (inputs.commentOnPr && github.context.payload.pull_request) {
      const octokit = github.getOctokit(inputs.githubToken || process.env.GITHUB_TOKEN || '');
      const comment = formatPRComment(summary);

      await octokit.rest.issues.createComment({
        owner: github.context.repo.owner,
        repo: github.context.repo.repo,
        issue_number: github.context.payload.pull_request.number,
        body: comment,
      });

      core.info('Posted audit results as PR comment');
    }

    // Send alerts
    const alertPayload: AuditAlertPayload = {
      projectId: `${github.context.repo.owner}/${github.context.repo.repo}`,
      projectName: github.context.repo.repo,
      url: inputs.url,
      score,
      issuesFound: summary.issuesCount,
      errorCount: summary.errorsCount,
      prUrl: fixPrUrl,
      timestamp: new Date().toISOString(),
    };

    if (inputs.slackWebhook && inputs.alertOn.includes('error') && summary.errorsCount > 0) {
      await sendSlackAlert(inputs.slackWebhook, 'error', alertPayload);
      core.info('Sent Slack alert');
    }

    if (inputs.discordWebhook && inputs.alertOn.includes('error') && summary.errorsCount > 0) {
      await sendDiscordAlert(inputs.discordWebhook, 'error', alertPayload);
      core.info('Sent Discord alert');
    }

    // Set outputs
    core.setOutput('score', score);
    core.setOutput('issues-count', summary.issuesCount);
    core.setOutput('errors-count', summary.errorsCount);
    core.setOutput('warnings-count', summary.warningsCount);
    core.setOutput('report-json', JSON.stringify(report));

    if (fixPrUrl) {
      core.setOutput('pr-url', fixPrUrl);
    }

    // Write job summary
    await core.summary
      .addHeading('SEO Audit Results')
      .addTable([
        [{ data: 'Metric', header: true }, { data: 'Value', header: true }],
        ['Score', `${score}/100`],
        ['Issues', summary.issuesCount.toString()],
        ['Errors', summary.errorsCount.toString()],
        ['Warnings', summary.warningsCount.toString()],
      ])
      .addLink('Powered by SEO Autopilot', 'https://github.com/seo-autopilot/seo-autopilot')
      .write();

    // Determine if action should fail
    if (shouldFail(inputs, summary)) {
      if (inputs.failOnError && summary.errorsCount > 0) {
        core.setFailed(`SEO audit found ${summary.errorsCount} critical errors`);
      } else if (inputs.scoreThreshold > 0 && score < inputs.scoreThreshold) {
        core.setFailed(`SEO score ${score} is below threshold ${inputs.scoreThreshold}`);
      }
    }
  } catch (error) {
    core.setFailed(`Action failed: ${(error as Error).message}`);
  }
}

run();
