import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AuditIssue, SiteAuditResult } from '@rankcli/agent-runtime';
import {
  parseInputs,
  formatPRComment,
  summarize,
  shouldComment,
  issueLine,
  REMOVED_INPUTS,
  COMMENT_MARKER,
  AuditSummary,
} from './action.js';

const inputsFrom = (values: Record<string, string>) => (name: string) => values[name] || '';

const summaryWith = (overrides: Partial<AuditSummary> = {}): AuditSummary => ({
  url: 'https://example.com',
  score: 65,
  issuesCount: 5,
  errorsCount: 2,
  warningsCount: 3,
  noticesCount: 0,
  pagesAudited: 1,
  categories: {},
  ignoredCount: 0,
  ...overrides,
});

const issue = (code: string, severity: AuditIssue['severity'], urls = ['https://example.com/']): AuditIssue => ({
  code, severity, category: 'on-page', title: `Title ${code}`, description: '', impact: '', howToFix: `Fix ${code}`, affectedUrls: urls,
});

describe('github-action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseInputs', () => {
    it('parses required url input', () => {
      expect(parseInputs(inputsFrom({ url: 'https://example.com' })).url).toBe('https://example.com');
    });

    it('folds the legacy inputs into fail-on rules', () => {
      expect(parseInputs(inputsFrom({ url: 'https://example.com', 'fail-on-error': 'true', 'score-threshold': '70' })).failOn).toEqual(['error', 'score<70']);
      expect(parseInputs(inputsFrom({ url: 'https://example.com', 'fail-on-errors': 'true' })).failOn).toEqual(['error']);
      expect(parseInputs(inputsFrom({ url: 'https://example.com', 'fail-on': 'warning, score:aiReadiness<70' })).failOn).toEqual(['warning', 'score:aiReadiness<70']);
    });

    it('parses the comment mode, accepting the old booleans', () => {
      expect(parseInputs(inputsFrom({ url: 'x' })).commentOnPr).toBe('regressions');
      expect(parseInputs(inputsFrom({ url: 'x', 'comment-on-pr': 'true' })).commentOnPr).toBe('always');
      expect(parseInputs(inputsFrom({ url: 'x', 'comment-on-pr': 'false' })).commentOnPr).toBe('never');
      expect(parseInputs(inputsFrom({ url: 'x', 'comment-on-pr': 'always' })).commentOnPr).toBe('always');
      const odd = parseInputs(inputsFrom({ url: 'x', 'comment-on-pr': 'sometimes' }));
      expect(odd.commentOnPr).toBe('regressions');
      expect(odd.warnings.join(' ')).toContain('sometimes');
    });

    it('reads dir, baseline, config, max-pages, headers and report-file', () => {
      const inputs = parseInputs(inputsFrom({ dir: 'dist', url: 'https://example.com', baseline: '.rankcli/baseline.json', config: 'ci.json', 'max-pages': '3', headers: 'X-A: 1\n\nCookie: s=1\n', 'report-file': 'out/report.json', annotations: 'false' }));
      expect(inputs).toMatchObject({ dir: 'dist', baseline: '.rankcli/baseline.json', config: 'ci.json', maxPages: '3', headers: ['X-A: 1', 'Cookie: s=1'], reportFile: 'out/report.json', annotations: false });
    });

    it('keeps supported alert-on values and warns about the rest', () => {
      const inputs = parseInputs(inputsFrom({ url: 'https://example.com', 'alert-on': 'error,score_drop,failure' }));
      expect(inputs.alertOn).toEqual(['error', 'failure']);
      expect(inputs.warnings.join(' ')).toContain('score_drop');
    });

    it('uses default values when inputs not provided', () => {
      const inputs = parseInputs(inputsFrom({ url: 'https://example.com' }));
      expect(inputs.commentOnPr).toBe('regressions');
      expect(inputs.failOn).toEqual([]);
      expect(inputs.annotations).toBe(true);
      expect(inputs.alertOn).toEqual(['error']);
      expect(inputs.warnings).toEqual([]);
    });

    it('warns when a removed input is still used', () => {
      const inputs = parseInputs(inputsFrom({ url: 'https://example.com', 'create-pr': 'true', checks: 'meta' }));
      expect(inputs.warnings.some(w => w.includes('create-pr'))).toBe(true);
      expect(inputs.warnings.some(w => w.includes('checks'))).toBe(true);
    });

    it('parses webhook URLs', () => {
      const inputs = parseInputs(inputsFrom({
        url: 'https://example.com',
        'slack-webhook': 'https://hooks.slack.com/xxx',
        'discord-webhook': 'https://discord.com/api/webhooks/xxx',
      }));
      expect(inputs.slackWebhook).toBe('https://hooks.slack.com/xxx');
      expect(inputs.discordWebhook).toBe('https://discord.com/api/webhooks/xxx');
    });
  });

  describe('action.yml', () => {
    const yml = readFileSync(join(__dirname, '..', 'action.yml'), 'utf8');

    it('declares every input parseInputs reads', () => {
      const read = new Set<string>();
      parseInputs((name) => { read.add(name); return ''; });
      for (const name of read) expect(yml).toMatch(new RegExp(`^  ${name}:`, 'm'));
    });

    it('keeps removed inputs declared, with a deprecation message', () => {
      for (const name of REMOVED_INPUTS) {
        expect(yml).toMatch(new RegExp(`^  ${name}:\\n(?:    .*\\n)*?    deprecationMessage:`, 'm'));
      }
    });

    it('declares the outputs run.ts sets', () => {
      for (const name of ['score', 'passed', 'issues-count', 'errors-count', 'warnings-count', 'new-issues-count', 'fixed-issues-count', 'report-json', 'report-file']) {
        expect(yml).toMatch(new RegExp(`^  ${name}:`, 'm'));
      }
    });

    it('runs on node24 from dist/index.js', () => {
      expect(yml).toContain("using: 'node24'");
      expect(yml).toContain("main: 'dist/index.js'");
    });
  });

  describe('summarize', () => {
    it('counts by severity and category from the issues it is given', () => {
      const result = {
        score: 72, pagesAudited: 2, pageFailure: undefined,
        primaryReport: { healthScore: { overall: 72, onPage: 50, aiReadiness: 61 } },
      } as unknown as SiteAuditResult;
      const summary = summarize('https://example.com', result, [issue('A', 'error'), issue('B', 'warning'), { ...issue('C', 'notice'), category: 'ai-readiness' }], { ignoredCount: 1 });
      expect(summary).toMatchObject({ score: 72, pagesAudited: 2, issuesCount: 3, errorsCount: 1, warningsCount: 1, noticesCount: 1, ignoredCount: 1 });
      expect(summary.categories).toEqual({ 'on-page': { score: 50, issues: 2 }, 'ai-readiness': { score: 61, issues: 1 } });
    });
  });

  describe('shouldComment', () => {
    const ok = { passed: true, failures: [], budgets: [] };
    const failed = { passed: false, failures: ['x'], budgets: [] };
    it('comments on regressions only by default', () => {
      expect(shouldComment('regressions', summaryWith(), ok)).toBe(false);
      expect(shouldComment('regressions', summaryWith(), failed)).toBe(true);
      expect(shouldComment('regressions', summaryWith({ baseline: { file: 'b.json', added: [issue('N', 'notice')], fixed: [], unchanged: 3 } }), ok)).toBe(true);
      expect(shouldComment('regressions', summaryWith({ baseline: { file: 'b.json', added: [], fixed: [issue('F', 'error')], unchanged: 3 } }), ok)).toBe(false);
      expect(shouldComment('always', summaryWith(), ok)).toBe(true);
      expect(shouldComment('never', summaryWith(), failed)).toBe(false);
    });
  });

  describe('formatPRComment', () => {
    it('starts with the marker and formats score and issues', () => {
      const comment = formatPRComment(summaryWith({ score: 72 }));
      expect(comment.startsWith(COMMENT_MARKER)).toBe(true);
      expect(comment).toContain('SEO check passed');
      expect(comment).toContain('72');
      expect(comment).toContain('5 issues');
      expect(comment).toContain('2 errors');
      expect(comment).toContain('RankCLI');
    });

    it('shows the URL as code, so a crafted preview URL cannot @mention or inject Markdown', () => {
      const comment = formatPRComment(summaryWith({ url: 'https://evil.dev/@everyone`**x**' }));
      expect(comment).toContain('**URL:** `https://evil.dev/@everyone**x**`');
    });

    it('includes score badge with color based on score', () => {
      expect(formatPRComment(summaryWith({ score: 90 }))).toContain('brightgreen');
      expect(formatPRComment(summaryWith({ score: 35 }))).toContain('red');
    });

    it('includes category breakdown', () => {
      const comment = formatPRComment(summaryWith({
        categories: {
          'on-page': { score: 50, issues: 4 },
          'social-meta': { score: 70, issues: 2 },
          performance: { score: 85, issues: 2 },
        },
      }));
      expect(comment).toContain('On-Page');
      expect(comment).toContain('Social Meta');
      expect(comment).toContain('Performance');
    });

    it('states a failed gate at the top', () => {
      const comment = formatPRComment(summaryWith(), { passed: false, failures: ['score 65 is below the minimum 80'], budgets: [] });
      expect(comment).toContain('SEO check failed');
      expect(comment).toContain('below the minimum 80');
    });

    it('lists what is new and what was fixed against the baseline, and the ignored count', () => {
      const comment = formatPRComment(summaryWith({
        ignoredCount: 2,
        dir: 'dist',
        baseline: { file: '.rankcli/baseline.json', scoreBefore: 70, added: [issue('NEW_ONE', 'error', ['https://example.com/a', 'https://example.com/b'])], fixed: [issue('GONE', 'warning')], unchanged: 4 },
      }), { passed: true, failures: [], budgets: [] });
      expect(comment).toContain('SEO check: new findings');
      expect(comment).toContain('**Since `.rankcli/baseline.json`:** 1 new, 1 fixed, 4 unchanged. Score 70 → 65.');
      expect(comment).toContain('- `NEW_ONE` Title NEW_ONE (2 pages)');
      expect(comment).toContain('- `GONE` Title GONE (https://example.com/)');
      expect(comment).toContain('(2 ignored by rankcli.config.json)');
      expect(comment).toContain('(built in `dist`)');
      expect(issueLine({ ...issue('X', 'error'), title: 'a `b` *c*' })).toBe('- `X` a b c (https://example.com/)');
    });
  });
});
