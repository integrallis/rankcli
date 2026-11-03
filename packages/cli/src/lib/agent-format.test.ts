import { describe, it, expect } from 'vitest';
import { renderForAgent, firstSentences } from './agent-format.js';
import type { AuditIssue } from '@rankcli/agent-runtime';

const issue = (code: string, severity: AuditIssue['severity'], pages: string[], howToFix = 'Do the thing. Then the other thing, which takes a while to explain.'): AuditIssue =>
  ({ code, severity, category: 'on-page', title: `Title for ${code}`, description: 'd', impact: 'i', howToFix, affectedUrls: pages }) as AuditIssue;

describe('renderForAgent', () => {
  const out = renderForAgent({
    url: 'https://example.com',
    score: 72,
    pagesAudited: 4,
    cliVersion: '0.0.54',
    framework: 'Astro',
    gated: true,
    gate: { passed: false, failures: ['score 72 is below the minimum 80'] },
    baseline: { file: '.rankcli/baseline.json', added: 1, fixed: 2, unchanged: 30 },
    issues: [
      issue('TITLE_MISSING', 'error', ['https://example.com/', 'https://example.com/a', 'https://example.com/b', 'https://example.com/c']),
      issue('META_DESC_SHORT', 'warning', ['https://example.com/pricing'], 'Write 120 to 160 characters.\n\n```html\n<meta name="description" content="...">\n```\nMention the product.'),
      issue('LLMS_TXT_MISSING', 'notice', ['https://example.com/']),
    ],
    healthScores: { overall: 72, crawlability: 95, aiReadiness: 60 },
    note: 'AI Readiness measures hygiene.',
  });

  it('leads with the numbers an agent needs and the gate verdict', () => {
    expect(out).toMatch(/^# RankCLI audit of https:\/\/example.com\n/);
    expect(out).toContain('Score 72/100 across 4 pages. 1 errors, 1 warnings, 1 notices. Framework: Astro. CLI 0.0.54.');
    expect(out).toContain('Gate: FAILED. score 72 is below the minimum 80');
    expect(out).toContain('Baseline .rankcli/baseline.json: 1 new, 2 fixed, 30 unchanged.');
  });

  it('names every finding by code, with pages as paths and the fix on errors and warnings only', () => {
    expect(out).toContain('- TITLE_MISSING: Title for TITLE_MISSING [4 pages: /, /a, /b +1]');
    expect(out).toContain('  Fix: Do the thing. Then the other thing, which takes a while to explain.');
    expect(out).toContain('- META_DESC_SHORT: Title for META_DESC_SHORT [/pricing]');
    // Code blocks are dropped from the fix; prose around them survives.
    expect(out).toContain('  Fix: Write 120 to 160 characters. Mention the product.');
    expect(out).toContain('- LLMS_TXT_MISSING: Title for LLMS_TXT_MISSING [/]');
    expect(out.split('\n').filter((l) => l.startsWith('  Fix:'))).toHaveLength(2);
  });

  it('carries the category scores, the note and the pointer to the full document, no colour codes', () => {
    expect(out).toContain('## Category scores\ncrawlability 95, aiReadiness 60');
    expect(out).toContain('Note: AI Readiness measures hygiene.');
    expect(out).toContain('rankcli audit --url https://example.com -o json');
    expect(out).not.toMatch(/\u001b\[/);
  });

  it('says so when there is nothing to report', () => {
    const clean = renderForAgent({ url: 'https://example.com', score: 100, pagesAudited: 1, cliVersion: '0.0.54', issues: [] });
    expect(clean).toContain('No findings.');
    expect(clean).not.toContain('Gate:');
  });
});

describe('firstSentences', () => {
  it('cuts long fixes at a sentence boundary', () => {
    const long = 'First sentence here. ' + 'Second sentence that goes on and on and on for a while to pass the limit. '.repeat(5);
    const cut = firstSentences(long, 120);
    expect(cut.length).toBeLessThanOrEqual(121);
    expect(cut.endsWith('.')).toBe(true);
  });
});
