import type { AuditIssue, SEOAnalysisResult } from '@rankcli/agent-runtime';

/**
 * The audit's issues in the shape the fix generator takes. The engine's five severities
 * squash into the fixer's three the way the console already treats them: 'error' is
 * critical-weight (red), 'notice' is info-weight. The fixer never reads `category` off its
 * input (each fixer hardcodes its own), so the engine's wider category set passes through.
 */
export function toFixerIssues(issues: AuditIssue[]): SEOAnalysisResult['issues'] {
  return issues.map(issue => ({
    severity: issue.severity === 'error' || issue.severity === 'critical' ? 'critical' as const
      : issue.severity === 'notice' || issue.severity === 'info' ? 'info' as const
      : 'warning' as const,
    category: issue.category,
    code: issue.code,
    message: issue.title,
    impact: issue.description || '',
  })) as SEOAnalysisResult['issues'];
}
