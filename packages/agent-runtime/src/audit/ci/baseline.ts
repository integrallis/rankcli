/**
 * Baselines: a saved report that says which findings a site already had, so a gate can fail
 * the build on regressions only and a site can adopt the gate before every old finding is
 * fixed. A finding is identified by its code and the page's path.
 */
import type { AuditIssue, HealthScore } from '../types.js';

/** The part of a URL that identifies a page across runs: path and query, trailing slash dropped. */
export function pagePath(url: string): string {
  try {
    const u = new URL(url);
    return (u.pathname.replace(/\/+$/, '') || '/') + u.search;
  } catch {
    return url;
  }
}

const keyOf = (code: string, url?: string): string => (url === undefined ? code : `${code} ${pagePath(url)}`);

/** One key per (code, page) pair; the code alone for a finding that names no page. */
export function issueKeys(issue: AuditIssue): string[] {
  const urls = issue.affectedUrls ?? [];
  return urls.length ? urls.map(u => keyOf(issue.code, u)) : [keyOf(issue.code)];
}

export interface IssueDiff {
  /** Findings not in the baseline: an issue, or the pages of it, that was not there before. */
  added: AuditIssue[];
  /** Baseline findings that are gone. */
  fixed: AuditIssue[];
  /** (code, page) pairs present in both. */
  unchanged: number;
}

export function diffIssues(before: AuditIssue[], after: AuditIssue[]): IssueDiff {
  const beforeKeys = new Set(before.flatMap(issueKeys));
  const afterKeys = new Set(after.flatMap(issueKeys));
  let unchanged = 0;
  for (const key of afterKeys) if (beforeKeys.has(key)) unchanged++;
  return { added: onlyIn(after, beforeKeys), fixed: onlyIn(before, afterKeys), unchanged };
}

/** The part of each issue whose (code, page) pairs are not in `known`. */
function onlyIn(issues: AuditIssue[], known: Set<string>): AuditIssue[] {
  const out: AuditIssue[] = [];
  for (const issue of issues) {
    const urls = issue.affectedUrls ?? [];
    if (urls.length === 0) {
      if (!known.has(keyOf(issue.code))) out.push({ ...issue });
      continue;
    }
    const fresh = urls.filter(u => !known.has(keyOf(issue.code, u)));
    if (fresh.length) out.push({ ...issue, affectedUrls: fresh });
  }
  return out;
}

export interface BaselineReport {
  issues: AuditIssue[];
  score?: number;
  healthScores?: Partial<HealthScore>;
  url?: string;
  timestamp?: string;
}

/** A saved report (`rankcli audit -o json`, or the engine's own report object) as a baseline. */
export function readBaseline(doc: unknown): BaselineReport | { error: string } {
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { error: 'not a JSON object' };
  const d = doc as Record<string, unknown>;
  if (!Array.isArray(d.issues)) return { error: 'no "issues" array (save one with: rankcli audit -o json > baseline.json)' };
  const issues = d.issues.filter(i => i && typeof i === 'object' && typeof (i as AuditIssue).code === 'string') as AuditIssue[];
  const scores = (d.healthScores ?? d.healthScore) as Partial<HealthScore> | undefined;
  const score = typeof d.score === 'number' ? d.score : scores?.overall;
  return {
    issues,
    score,
    healthScores: scores && typeof scores === 'object' ? scores : undefined,
    url: typeof d.url === 'string' ? d.url : undefined,
    timestamp: typeof d.timestamp === 'string' ? d.timestamp : undefined,
  };
}
