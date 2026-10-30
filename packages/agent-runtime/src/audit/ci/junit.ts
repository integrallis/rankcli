/**
 * The report as a JUnit XML document, for test reporters (Jenkins, GitLab, Buildkite, the
 * `dorny/test-reporter` and `mikepenz/action-junit-report` Actions). Every finding is a test
 * case; the ones at or above the gate's severity are failures, the rest pass with the finding
 * in their output. A failed score gate is a failed case of its own.
 */
import type { AuditIssue } from '../types.js';
import { SEVERITY_RANK, type FailOnLevel } from './gate.js';

export interface JUnitInput {
  url: string;
  issues: AuditIssue[];
  /** Findings at or above this severity are failures (default: error). */
  failOn?: FailOnLevel;
  /** With a baseline: only the findings this returns true for can be failures; the rest pass with output. */
  isNew?: (issue: AuditIssue) => boolean;
  checksPassed?: number;
  score?: number;
  durationMs?: number;
  timestamp?: string;
  gateFailures?: string[];
  /** Why the audit did not complete, when it did not. */
  error?: string;
}

function esc(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');
}

export function toJUnit(input: JUnitInput): string {
  const threshold = SEVERITY_RANK[input.failOn ?? 'error'];
  const seconds = ((input.durationMs ?? 0) / 1000).toFixed(3);
  const cases: string[] = [];
  let failures = 0;
  let errors = 0;

  if (input.error) {
    errors = 1;
    cases.push(`    <testcase name="audit" classname="rankcli" time="${seconds}">\n      <error message="${esc(input.error)}">${esc(input.error)}</error>\n    </testcase>`);
  }

  for (const issue of input.issues) {
    const name = `${issue.code}: ${issue.title}`;
    const pages = issue.affectedUrls?.length ? `\nPages:\n${issue.affectedUrls.map(u => `  ${u}`).join('\n')}` : '';
    const body = `${issue.severity}: ${issue.title}\n${issue.description}\nFix: ${issue.howToFix}${pages}`;
    if ((SEVERITY_RANK[issue.severity] ?? 0) >= threshold && (!input.isNew || input.isNew(issue))) {
      failures++;
      cases.push(`    <testcase name="${esc(name)}" classname="rankcli.${esc(issue.category)}" time="0">\n      <failure message="${esc(issue.title)}" type="${esc(issue.severity)}">${esc(body)}</failure>\n    </testcase>`);
    } else {
      cases.push(`    <testcase name="${esc(name)}" classname="rankcli.${esc(issue.category)}" time="0">\n      <system-out>${esc(body)}</system-out>\n    </testcase>`);
    }
  }

  for (const failure of input.gateFailures ?? []) {
    failures++;
    cases.push(`    <testcase name="gate: ${esc(failure)}" classname="rankcli.gate" time="0">\n      <failure message="${esc(failure)}" type="gate">${esc(failure)}</failure>\n    </testcase>`);
  }

  if (input.checksPassed) {
    cases.push(`    <testcase name="${input.checksPassed} checks passed" classname="rankcli" time="0"/>`);
  }

  const tests = cases.length;
  const attrs = `name="rankcli audit ${esc(input.url)}" tests="${tests}" failures="${failures}" errors="${errors}" skipped="0" time="${seconds}"${input.timestamp ? ` timestamp="${esc(input.timestamp)}"` : ''}`;
  const properties = [
    `      <property name="url" value="${esc(input.url)}"/>`,
    ...(input.score !== undefined ? [`      <property name="score" value="${input.score}"/>`] : []),
  ].join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<testsuites name="rankcli" tests="${tests}" failures="${failures}" errors="${errors}" time="${seconds}">
  <testsuite ${attrs}>
    <properties>
${properties}
    </properties>
${cases.join('\n')}
  </testsuite>
</testsuites>
`;
}
