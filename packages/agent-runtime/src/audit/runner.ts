/**
 * Audit Runner
 *
 * High-level API for running SEO audits with automatic fix generation
 * and PR creation. Orchestrates the audit engine, fix generators, and
 * git helpers.
 */

import { runFullAudit, AuditOptions } from './engine.js';
import { generateAllFixes, FixResult } from './fixes/index.js';
import {
  generatePRDescription,
  createPullRequest,
  SEOFixSummary,
  PRResult,
} from '../git/pr-helper.js';
import type { AuditReport } from './types.js';

export interface AuditRunnerOptions extends Partial<AuditOptions> {
  url: string;
  generateFixes?: boolean;
  previousScore?: number;
}

export interface AuditRunnerResult {
  report: AuditReport;
  fixes: FixResult[];
  score: number;
  previousScore?: number;
}

export interface CreateAuditPROptions {
  baseBranch: string;
  headBranch: string;
  dryRun?: boolean;
  reviewers?: string[];
  assignees?: string[];
  draft?: boolean;
}

export interface AuditPRResult {
  success: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
  dryRun?: boolean;
}

/**
 * Runs a full SEO audit and generates fixes for identified issues
 */
export async function runAuditWithFixes(
  options: AuditRunnerOptions
): Promise<AuditRunnerResult> {
  const { url, generateFixes = true, previousScore, ...auditOptions } = options;

  // Run the audit
  const report = await runFullAudit({ url, ...auditOptions });

  // Generate fixes if enabled
  let fixes: FixResult[] = [];
  if (generateFixes && report.issues.length > 0) {
    fixes = generateAllFixes(report);
  }

  return {
    report,
    fixes,
    score: report.healthScore.overall,
    previousScore,
  };
}

/**
 * Creates a pull request with audit fixes
 */
export async function createAuditPR(
  result: AuditRunnerResult,
  options: CreateAuditPROptions
): Promise<AuditPRResult> {
  // Check if there are any fixes
  if (result.fixes.length === 0) {
    return {
      success: false,
      error: 'No fixes available to create PR',
    };
  }

  // Convert fixes to SEOFixSummary format for PR description
  const fixSummaries: SEOFixSummary[] = result.fixes.map((fix) => ({
    category: fix.category,
    issues: fix.issues,
    filesCount: fix.files.length,
  }));

  // Generate PR description
  const prDescription = generatePRDescription(fixSummaries, {
    scoreBefore: result.previousScore,
    scoreAfter: result.score,
    reviewers: options.reviewers,
    assignees: options.assignees,
  });

  // Create the PR
  const prResult = await createPullRequest({
    title: prDescription.title,
    body: prDescription.body,
    baseBranch: options.baseBranch,
    headBranch: options.headBranch,
    labels: prDescription.labels,
    reviewers: prDescription.reviewers,
    assignees: prDescription.assignees,
    draft: options.draft,
    dryRun: options.dryRun,
  });

  if (!prResult.success) {
    return {
      success: false,
      error: prResult.error,
    };
  }

  return {
    success: true,
    prUrl: prResult.url,
    prNumber: prResult.number,
    dryRun: prResult.dryRun,
  };
}
