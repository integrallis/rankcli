/**
 * `-o llm`: the report as an agent reads it. Plain Markdown, no colour, no bars, every
 * finding with its code so the agent can name it, the fix's first sentence on errors and
 * warnings so it can act, and nothing it does not need (the full fix text, the details, the
 * per-page breakdown) so a 280-check audit fits in a few hundred tokens. `-o json` stays the
 * document for programs; this one is for a model with a context window.
 */
import type { AuditIssue } from '@rankcli/agent-runtime';

export interface AgentReportInput {
  url: string;
  score: number;
  pagesAudited: number;
  cliVersion: string;
  issues: AuditIssue[];
  healthScores?: Record<string, number> | null;
  framework?: string | null;
  dir?: string;
  gated?: boolean;
  gate?: { passed: boolean; failures: string[] } | null;
  baseline?: { file: string; added: number; fixed: number; unchanged: number } | null;
  ignored?: number;
  note?: string;
}

const FIX_LIMIT = 240;

/** The first sentence or two of a fix, without its code blocks, cut at a sentence boundary. */
export function firstSentences(text: string, limit = FIX_LIMIT): string {
  const flat = text.replace(/```[\s\S]*?```/g, ' ').replace(/\s+/g, ' ').trim();
  if (flat.length <= limit) return flat;
  const cut = flat.slice(0, limit);
  const end = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('; '), cut.lastIndexOf(': '));
  return (end > limit / 2 ? cut.slice(0, end + 1) : cut.replace(/\s+\S*$/, '')).trim() + (end > limit / 2 ? '' : ' …');
}

function pathOf(pageUrl: string, origin: string): string {
  try {
    const u = new URL(pageUrl);
    const path = (u.pathname || '/') + u.search;
    return u.origin === origin ? path : u.href;
  } catch {
    return pageUrl;
  }
}

function pagesNote(issue: AuditIssue, origin: string): string {
  const pages = issue.affectedUrls ?? [];
  if (pages.length === 0) return '';
  const shown = pages.slice(0, 3).map((p) => pathOf(p, origin));
  const more = pages.length > 3 ? ` +${pages.length - 3}` : '';
  return ` [${pages.length === 1 ? shown[0] : `${pages.length} pages: ${shown.join(', ')}${more}`}]`;
}

export function renderForAgent(input: AgentReportInput): string {
  const origin = (() => {
    try {
      return new URL(input.url).origin;
    } catch {
      return '';
    }
  })();
  const sev = (s: string) => (s === 'critical' ? 'error' : s === 'info' ? 'notice' : s);
  const errors = input.issues.filter((i) => sev(i.severity) === 'error');
  const warnings = input.issues.filter((i) => sev(i.severity) === 'warning');
  const notices = input.issues.filter((i) => sev(i.severity) === 'notice');
  const lines: string[] = [];

  lines.push(`# RankCLI audit of ${input.url}`);
  const summary = [
    `Score ${input.score}/100 across ${input.pagesAudited} page${input.pagesAudited === 1 ? '' : 's'}.`,
    `${errors.length} errors, ${warnings.length} warnings, ${notices.length} notices${input.ignored ? ` (${input.ignored} ignored by config)` : ''}.`,
    input.framework ? `Framework: ${input.framework}.` : '',
    input.dir ? `Audited the build directory ${input.dir}; host checks skipped.` : '',
    `CLI ${input.cliVersion}.`,
  ].filter(Boolean);
  lines.push(summary.join(' '));
  if (input.gated && input.gate) {
    lines.push(input.gate.passed ? 'Gate: passed.' : `Gate: FAILED. ${input.gate.failures.join('; ')}`);
  }
  if (input.baseline) {
    lines.push(`Baseline ${input.baseline.file}: ${input.baseline.added} new, ${input.baseline.fixed} fixed, ${input.baseline.unchanged} unchanged.`);
  }

  const group = (label: string, items: AuditIssue[], withFix: boolean) => {
    if (items.length === 0) return;
    lines.push('', `## ${label} (${items.length})`);
    for (const issue of items) {
      lines.push(`- ${issue.code}: ${issue.title}${pagesNote(issue, origin)}`);
      if (withFix && issue.howToFix) lines.push(`  Fix: ${firstSentences(issue.howToFix)}`);
    }
  };
  group('Errors', errors, true);
  group('Warnings', warnings, true);
  group('Notices', notices, false);
  if (input.issues.length === 0) lines.push('', 'No findings.');

  if (input.healthScores) {
    const entries = Object.entries(input.healthScores).filter(([k, v]) => k !== 'overall' && typeof v === 'number');
    if (entries.length > 0) {
      lines.push('', '## Category scores', entries.map(([k, v]) => `${k} ${v}`).join(', '));
    }
  }
  if (input.note) lines.push('', `Note: ${input.note}`);
  lines.push('', `Full detail for any finding: rankcli audit --url ${input.url} -o json (the issues array carries description, impact, howToFix and details per code).`);
  return lines.join('\n') + '\n';
}
