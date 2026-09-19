import { describe, it, expect, vi, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  parseInputs,
  formatPRComment,
  shouldFail,
  evaluateGate,
  REMOVED_INPUTS,
  AuditSummary,
} from './action.js';

const inputsFrom = (values: Record<string, string>) => (name: string) => values[name] || '';

const summaryWith = (overrides: Partial<AuditSummary> = {}): AuditSummary => ({
  url: 'https://example.com',
  score: 65,
  issuesCount: 5,
  errorsCount: 2,
  warningsCount: 3,
  categories: {},
  ...overrides,
});

describe('github-action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseInputs', () => {
    it('parses required url input', () => {
      expect(parseInputs(inputsFrom({ url: 'https://example.com' })).url).toBe('https://example.com');
    });

    it('parses boolean inputs correctly', () => {
      const inputs = parseInputs(inputsFrom({ url: 'https://example.com', 'comment-on-pr': 'false', 'fail-on-error': 'true' }));
      expect(inputs.commentOnPr).toBe(false);
      expect(inputs.failOnError).toBe(true);
    });

    it('accepts fail-on-errors, the spelling the docs use', () => {
      expect(parseInputs(inputsFrom({ url: 'https://example.com', 'fail-on-errors': 'true' })).failOnError).toBe(true);
      expect(parseInputs(inputsFrom({ url: 'https://example.com', 'fail-on-error': 'false', 'fail-on-errors': 'true' })).failOnError).toBe(true);
    });

    it('parses score threshold as number', () => {
      expect(parseInputs(inputsFrom({ url: 'https://example.com', 'score-threshold': '70' })).scoreThreshold).toBe(70);
    });

    it('keeps supported alert-on values and warns about the rest', () => {
      const inputs = parseInputs(inputsFrom({ url: 'https://example.com', 'alert-on': 'error,score_drop,failure' }));
      expect(inputs.alertOn).toEqual(['error', 'failure']);
      expect(inputs.warnings.join(' ')).toContain('score_drop');
    });

    it('uses default values when inputs not provided', () => {
      const inputs = parseInputs(inputsFrom({ url: 'https://example.com' }));
      expect(inputs.commentOnPr).toBe(true);
      expect(inputs.failOnError).toBe(false);
      expect(inputs.scoreThreshold).toBe(0);
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

    it('runs on node24 from dist/index.js', () => {
      expect(yml).toContain("using: 'node24'");
      expect(yml).toContain("main: 'dist/index.js'");
    });
  });

  describe('formatPRComment', () => {
    it('formats comment with score and issues', () => {
      const comment = formatPRComment(summaryWith({ score: 72 }));
      expect(comment).toContain('SEO Audit Report');
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
      const comment = formatPRComment(summaryWith(), { passed: false, failures: ['SEO score 65 is below threshold 80'] });
      expect(comment).toContain('SEO check failed');
      expect(comment).toContain('below threshold 80');
    });
  });

  describe('evaluateGate / shouldFail', () => {
    it('fails when failOnError is set and errors exist', () => {
      expect(shouldFail({ failOnError: true, scoreThreshold: 0 }, summaryWith())).toBe(true);
    });

    it('passes when failOnError is set but there are no errors', () => {
      expect(shouldFail({ failOnError: true, scoreThreshold: 0 }, summaryWith({ errorsCount: 0, score: 85 }))).toBe(false);
    });

    it('fails when the score is below the threshold, passes at it', () => {
      expect(shouldFail({ failOnError: false, scoreThreshold: 70 }, summaryWith({ errorsCount: 0 }))).toBe(true);
      expect(shouldFail({ failOnError: false, scoreThreshold: 65 }, summaryWith({ errorsCount: 0 }))).toBe(false);
    });

    it('passes with no failure conditions set', () => {
      expect(shouldFail({ failOnError: false, scoreThreshold: 0 }, summaryWith({ score: 45 }))).toBe(false);
    });

    it('always fails when the page could not be audited', () => {
      const gate = evaluateGate({ failOnError: false, scoreThreshold: 0 }, summaryWith({ score: 0, pageFailure: 'Page returns HTTP 503' }));
      expect(gate.passed).toBe(false);
      expect(gate.failures[0]).toContain('HTTP 503');
    });
  });
});
