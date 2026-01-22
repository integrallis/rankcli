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

async function run(): Promise<void> {
  try {
    // Parse inputs
    const inputs = parseInputs((name) => core.getInput(name));
    core.info(`Running SEO audit on: ${inputs.url}`);

    // Run audit
    const auditResult = await runAuditWithFixes({
      url: inputs.url,
      generateFixes: inputs.createPr,
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

    // Create fix PR if requested
    let fixPrUrl: string | undefined;
    if (inputs.createPr && fixes.length > 0 && inputs.githubToken) {
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
