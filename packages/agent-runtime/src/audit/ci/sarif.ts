/**
 * The report as SARIF 2.1.0, for GitHub Code Scanning (`github/codeql-action/upload-sarif`) and
 * every other tool that reads it. One rule per issue code, one result per (issue, page).
 */
import type { AuditIssue, HealthScore } from '../types.js';
import { pagePath } from './baseline.js';

export interface SarifInput {
  url: string;
  issues: AuditIssue[];
  toolVersion?: string;
  score?: number;
  healthScores?: Partial<HealthScore>;
  /** The repository file a page came from, when a build directory was audited. */
  fileFor?: (url: string) => string | undefined;
  exitCode?: number;
  /** Why the audit did not complete, when it did not. */
  error?: string;
  /** Keys (see issueKeys) of the findings a baseline already had: those results are `unchanged`, the rest `new`. */
  baselineKeys?: Set<string>;
}

const LEVELS: Record<string, 'error' | 'warning' | 'note'> = {
  critical: 'error', error: 'error', warning: 'warning', notice: 'note', info: 'note',
};

/** A repository-relative path for a page: index.html for the root, the URL path otherwise. */
export function artifactUri(url: string): string {
  const path = pagePath(url).split('?')[0];
  return path === '/' ? 'index.html' : path.replace(/^\/+/, '');
}

export function toSarif(input: SarifInput): Record<string, unknown> {
  const rules: Record<string, unknown>[] = [];
  const ruleIndex = new Map<string, number>();
  const results: Record<string, unknown>[] = [];

  for (const issue of input.issues) {
    let index = ruleIndex.get(issue.code);
    if (index === undefined) {
      index = rules.length;
      ruleIndex.set(issue.code, index);
      rules.push({
        id: issue.code,
        name: issue.code,
        shortDescription: { text: issue.title },
        fullDescription: { text: issue.description || issue.title },
        help: { text: issue.howToFix || issue.description || issue.title },
        defaultConfiguration: { level: LEVELS[issue.severity] ?? 'warning' },
        properties: { category: issue.category, impact: issue.impact, tags: ['seo', issue.category] },
      });
    }
    const urls = issue.affectedUrls?.length ? issue.affectedUrls : [input.url];
    for (const url of urls) {
      results.push({
        ruleId: issue.code,
        ruleIndex: index,
        level: LEVELS[issue.severity] ?? 'warning',
        message: { text: issue.howToFix ? `${issue.title}. ${issue.howToFix}` : issue.title },
        locations: [{
          physicalLocation: {
            artifactLocation: { uri: input.fileFor?.(url) ?? artifactUri(url), uriBaseId: '%SRCROOT%' },
            region: { startLine: 1, startColumn: 1 },
          },
        }],
        partialFingerprints: { rankcli: `${issue.code} ${pagePath(url)}` },
        ...(input.baselineKeys && { baselineState: input.baselineKeys.has(`${issue.code} ${pagePath(url)}`) || input.baselineKeys.has(issue.code) ? 'unchanged' : 'new' }),
        properties: { url, severity: issue.severity, category: issue.category },
      });
    }
  }

  return {
    $schema: 'https://json.schemastore.org/sarif-2.1.0.json',
    version: '2.1.0',
    runs: [{
      tool: {
        driver: {
          name: 'RankCLI',
          fullName: 'RankCLI SEO and AI-search audit',
          informationUri: 'https://rankcli.dev',
          ...(input.toolVersion && { version: input.toolVersion }),
          rules,
        },
      },
      invocations: [{
        executionSuccessful: !input.error,
        ...(input.exitCode !== undefined && { exitCode: input.exitCode }),
        ...(input.error && { toolExecutionNotifications: [{ level: 'error', message: { text: input.error } }] }),
      }],
      results,
      properties: {
        url: input.url,
        ...(input.score !== undefined && { score: input.score }),
        ...(input.healthScores && { healthScores: input.healthScores }),
      },
    }],
  };
}
