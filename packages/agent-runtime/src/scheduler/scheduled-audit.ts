/**
 * Scheduled Audit Module
 *
 * Handles scheduled execution of SEO audits with optional auto-fix PR creation.
 * Can be used from Edge Functions, CLI cron jobs, or other scheduling mechanisms.
 */

import { runAuditWithFixes, createAuditPR } from '../audit/runner.js';
import { generateBranchName } from '../git/pr-helper.js';

export type AuditSchedule = 'manual' | 'daily' | 'weekly' | 'on-demand';

export interface ScheduledAuditConfig {
  projectId: string;
  url: string;
  schedule: AuditSchedule;
  lastRunAt?: string;
  previousScore?: number;
  autoFix?: boolean;
  baseBranch?: string;
  generateFixes?: boolean;
}

export interface ScheduledAuditResult {
  success: boolean;
  projectId: string;
  score?: number;
  scoreChange?: number;
  issuesFound?: number;
  fixesGenerated?: number;
  prCreated?: boolean;
  prUrl?: string;
  prNumber?: number;
  error?: string;
  completedAt: string;
  nextRunAt?: string | null;
}

const SCHEDULE_INTERVALS: Record<AuditSchedule, number | null> = {
  manual: null,
  daily: 24 * 60 * 60 * 1000, // 24 hours
  weekly: 7 * 24 * 60 * 60 * 1000, // 7 days
  'on-demand': null,
};

/**
 * Determines if an audit should run based on schedule and last run time
 */
export function shouldRunAudit(config: ScheduledAuditConfig): boolean {
  const { schedule, lastRunAt } = config;

  // Manual schedule never auto-runs
  if (schedule === 'manual') {
    return false;
  }

  // On-demand always runs when requested
  if (schedule === 'on-demand') {
    return true;
  }

  // If never run before, should run
  if (!lastRunAt) {
    return true;
  }

  const interval = SCHEDULE_INTERVALS[schedule];
  if (!interval) {
    return false;
  }

  const lastRun = new Date(lastRunAt).getTime();
  const now = Date.now();
  const elapsed = now - lastRun;

  return elapsed >= interval;
}

/**
 * Calculates the next scheduled run time
 */
export function calculateNextRun(schedule: AuditSchedule): string | null {
  const interval = SCHEDULE_INTERVALS[schedule];

  if (!interval) {
    return null;
  }

  const nextRun = new Date(Date.now() + interval);
  return nextRun.toISOString();
}

/**
 * Runs a scheduled audit with optional auto-fix PR creation
 */
export async function runScheduledAudit(
  config: ScheduledAuditConfig
): Promise<ScheduledAuditResult> {
  const { projectId, url, previousScore, autoFix, baseBranch, generateFixes = true, schedule } = config;

  try {
    // Run the audit
    const auditResult = await runAuditWithFixes({
      url,
      generateFixes,
      previousScore,
    });

    const result: ScheduledAuditResult = {
      success: true,
      projectId,
      score: auditResult.score,
      issuesFound: auditResult.report.issues.length,
      fixesGenerated: auditResult.fixes.length,
      completedAt: new Date().toISOString(),
      nextRunAt: calculateNextRun(schedule),
    };

    // Calculate score change if previous score available
    if (previousScore !== undefined) {
      result.scoreChange = auditResult.score - previousScore;
    }

    // Create PR if auto-fix is enabled and fixes are available
    if (autoFix && auditResult.fixes.length > 0 && baseBranch) {
      const headBranch = generateBranchName('seo-fixes');
      const prResult = await createAuditPR(auditResult, {
        baseBranch,
        headBranch,
      });

      if (prResult.success) {
        result.prCreated = true;
        result.prUrl = prResult.prUrl;
        result.prNumber = prResult.prNumber;
      }
    }

    return result;
  } catch (error) {
    return {
      success: false,
      projectId,
      error: (error as Error).message,
      completedAt: new Date().toISOString(),
      nextRunAt: calculateNextRun(schedule),
    };
  }
}
