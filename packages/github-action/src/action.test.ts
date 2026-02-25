import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  parseInputs,
  formatPRComment,
  shouldFail,
  ActionInputs,
  AuditSummary,
} from './action.js';

describe('github-action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('parseInputs', () => {
    it('parses required url input', () => {
      const getInput = vi.fn((name: string) => {
        if (name === 'url') return 'https://example.com';
        return '';
      });

      const inputs = parseInputs(getInput);
      expect(inputs.url).toBe('https://example.com');
    });

    it('parses boolean inputs correctly', () => {
      const getInput = vi.fn((name: string) => {
        const values: Record<string, string> = {
          'url': 'https://example.com',
          'create-pr': 'true',
          'comment-on-pr': 'false',
          'fail-on-error': 'true',
        };
        return values[name] || '';
      });

      const inputs = parseInputs(getInput);
      expect(inputs.createPr).toBe('true');
      expect(inputs.commentOnPr).toBe(false);
      expect(inputs.failOnError).toBe(true);
    });

    it('parses create-pr auto mode', () => {
      const getInput = vi.fn((name: string) => {
        const values: Record<string, string> = {
          'url': 'https://example.com',
          'create-pr': 'auto',
          'pr-threshold-errors': '2',
          'pr-threshold-score': '60',
        };
        return values[name] || '';
      });

      const inputs = parseInputs(getInput);
      expect(inputs.createPr).toBe('auto');
      expect(inputs.prThresholdErrors).toBe(2);
      expect(inputs.prThresholdScore).toBe(60);
    });

    it('parses score threshold as number', () => {
      const getInput = vi.fn((name: string) => {
        if (name === 'url') return 'https://example.com';
        if (name === 'score-threshold') return '70';
        return '';
      });

      const inputs = parseInputs(getInput);
      expect(inputs.scoreThreshold).toBe(70);
    });

    it('parses alert-on as array', () => {
      const getInput = vi.fn((name: string) => {
        if (name === 'url') return 'https://example.com';
        if (name === 'alert-on') return 'error,score_drop,pr_created';
        return '';
      });

      const inputs = parseInputs(getInput);
      expect(inputs.alertOn).toEqual(['error', 'score_drop', 'pr_created']);
    });

    it('uses default values when inputs not provided', () => {
      const getInput = vi.fn((name: string) => {
        if (name === 'url') return 'https://example.com';
        return '';
      });

      const inputs = parseInputs(getInput);
      expect(inputs.createPr).toBe('false');
      expect(inputs.commentOnPr).toBe(true);
      expect(inputs.failOnError).toBe(false);
      expect(inputs.scoreThreshold).toBe(0);
      expect(inputs.prBaseBranch).toBe('main');
      expect(inputs.prThresholdErrors).toBe(1);
      expect(inputs.prThresholdScore).toBe(70);
    });

    it('parses webhook URLs', () => {
      const getInput = vi.fn((name: string) => {
        const values: Record<string, string> = {
          'url': 'https://example.com',
          'slack-webhook': 'https://hooks.slack.com/xxx',
          'discord-webhook': 'https://discord.com/api/webhooks/xxx',
        };
        return values[name] || '';
      });

      const inputs = parseInputs(getInput);
      expect(inputs.slackWebhook).toBe('https://hooks.slack.com/xxx');
      expect(inputs.discordWebhook).toBe('https://discord.com/api/webhooks/xxx');
    });
  });

  describe('formatPRComment', () => {
    it('formats comment with score and issues', () => {
      const summary: AuditSummary = {
        url: 'https://example.com',
        score: 72,
        issuesCount: 5,
        errorsCount: 2,
        warningsCount: 3,
        categories: {
          'on-page': { score: 65, issues: 3 },
          'social-meta': { score: 80, issues: 2 },
        },
      };

      const comment = formatPRComment(summary);

      expect(comment).toContain('SEO Audit Report');
      expect(comment).toContain('72');
      expect(comment).toContain('5 issues');
      expect(comment).toContain('2 errors');
    });

    it('includes score badge with color based on score', () => {
      const highScore: AuditSummary = {
        url: 'https://example.com',
        score: 90,
        issuesCount: 1,
        errorsCount: 0,
        warningsCount: 1,
        categories: {},
      };

      const lowScore: AuditSummary = {
        url: 'https://example.com',
        score: 35,
        issuesCount: 10,
        errorsCount: 5,
        warningsCount: 5,
        categories: {},
      };

      const highComment = formatPRComment(highScore);
      const lowComment = formatPRComment(lowScore);

      expect(highComment).toContain('brightgreen');
      expect(lowComment).toContain('red');
    });

    it('includes category breakdown', () => {
      const summary: AuditSummary = {
        url: 'https://example.com',
        score: 65,
        issuesCount: 8,
        errorsCount: 3,
        warningsCount: 5,
        categories: {
          'on-page': { score: 50, issues: 4 },
          'social-meta': { score: 70, issues: 2 },
          'performance': { score: 85, issues: 2 },
        },
      };

      const comment = formatPRComment(summary);

      expect(comment).toContain('On-Page');
      expect(comment).toContain('Social Meta');
      expect(comment).toContain('Performance');
    });

    it('includes link to full report when provided', () => {
      const summary: AuditSummary = {
        url: 'https://example.com',
        score: 72,
        issuesCount: 3,
        errorsCount: 1,
        warningsCount: 2,
        categories: {},
        reportUrl: 'https://seo-autopilot.dev/reports/abc123',
      };

      const comment = formatPRComment(summary);
      expect(comment).toContain('https://seo-autopilot.dev/reports/abc123');
    });

    it('includes PR link when fixes were created', () => {
      const summary: AuditSummary = {
        url: 'https://example.com',
        score: 65,
        issuesCount: 5,
        errorsCount: 2,
        warningsCount: 3,
        categories: {},
        fixPrUrl: 'https://github.com/owner/repo/pull/42',
      };

      const comment = formatPRComment(summary);
      expect(comment).toContain('PR #42');
      expect(comment).toContain('github.com/owner/repo/pull/42');
    });
  });

  describe('shouldFail', () => {
    it('returns true when failOnError is true and errors exist', () => {
      const inputs: ActionInputs = {
        url: 'https://example.com',
        createPr: 'false',
        commentOnPr: true,
        failOnError: true,
        scoreThreshold: 0,
        prBaseBranch: 'main',
        prThresholdErrors: 1,
        prThresholdScore: 70,
        alertOn: ['error'],
      };

      const summary: AuditSummary = {
        url: 'https://example.com',
        score: 65,
        issuesCount: 5,
        errorsCount: 2,
        warningsCount: 3,
        categories: {},
      };

      expect(shouldFail(inputs, summary)).toBe(true);
    });

    it('returns false when failOnError is true but no errors', () => {
      const inputs: ActionInputs = {
        url: 'https://example.com',
        createPr: 'false',
        commentOnPr: true,
        failOnError: true,
        scoreThreshold: 0,
        prBaseBranch: 'main',
        prThresholdErrors: 1,
        prThresholdScore: 70,
        alertOn: ['error'],
      };

      const summary: AuditSummary = {
        url: 'https://example.com',
        score: 85,
        issuesCount: 2,
        errorsCount: 0,
        warningsCount: 2,
        categories: {},
      };

      expect(shouldFail(inputs, summary)).toBe(false);
    });

    it('returns true when score is below threshold', () => {
      const inputs: ActionInputs = {
        url: 'https://example.com',
        createPr: 'false',
        commentOnPr: true,
        failOnError: false,
        scoreThreshold: 70,
        prBaseBranch: 'main',
        prThresholdErrors: 1,
        prThresholdScore: 70,
        alertOn: [],
      };

      const summary: AuditSummary = {
        url: 'https://example.com',
        score: 65,
        issuesCount: 5,
        errorsCount: 0,
        warningsCount: 5,
        categories: {},
      };

      expect(shouldFail(inputs, summary)).toBe(true);
    });

    it('returns false when score meets threshold', () => {
      const inputs: ActionInputs = {
        url: 'https://example.com',
        createPr: 'false',
        commentOnPr: true,
        failOnError: false,
        scoreThreshold: 70,
        prBaseBranch: 'main',
        prThresholdErrors: 1,
        prThresholdScore: 70,
        alertOn: [],
      };

      const summary: AuditSummary = {
        url: 'https://example.com',
        score: 75,
        issuesCount: 3,
        errorsCount: 0,
        warningsCount: 3,
        categories: {},
      };

      expect(shouldFail(inputs, summary)).toBe(false);
    });

    it('returns false when no failure conditions set', () => {
      const inputs: ActionInputs = {
        url: 'https://example.com',
        createPr: 'false',
        commentOnPr: true,
        failOnError: false,
        scoreThreshold: 0,
        prBaseBranch: 'main',
        prThresholdErrors: 1,
        prThresholdScore: 70,
        alertOn: [],
      };

      const summary: AuditSummary = {
        url: 'https://example.com',
        score: 45,
        issuesCount: 10,
        errorsCount: 5,
        warningsCount: 5,
        categories: {},
      };

      expect(shouldFail(inputs, summary)).toBe(false);
    });
  });

  describe('integration scenarios', () => {
    it('handles typical CI workflow inputs', () => {
      const getInput = vi.fn((name: string) => {
        const values: Record<string, string> = {
          'url': 'https://preview-abc123.vercel.app',
          'github-token': 'gha_xxx',
          'create-pr': 'false',
          'comment-on-pr': 'true',
          'fail-on-error': 'true',
          'score-threshold': '60',
          'slack-webhook': 'https://hooks.slack.com/services/xxx',
          'alert-on': 'error,score_drop',
        };
        return values[name] || '';
      });

      const inputs = parseInputs(getInput);

      expect(inputs).toEqual({
        url: 'https://preview-abc123.vercel.app',
        apiKey: undefined,
        githubToken: 'gha_xxx',
        createPr: 'false',
        commentOnPr: true,
        failOnError: true,
        scoreThreshold: 60,
        prBaseBranch: 'main',
        prThresholdErrors: 1,
        prThresholdScore: 70,
        slackWebhook: 'https://hooks.slack.com/services/xxx',
        discordWebhook: undefined,
        alertOn: ['error', 'score_drop'],
        checks: undefined,
      });
    });

    it('formats comprehensive PR comment', () => {
      const summary: AuditSummary = {
        url: 'https://myapp.vercel.app',
        score: 58,
        issuesCount: 12,
        errorsCount: 4,
        warningsCount: 8,
        categories: {
          'on-page': { score: 45, issues: 5 },
          'social-meta': { score: 60, issues: 3 },
          'performance': { score: 70, issues: 2 },
          'crawlability': { score: 55, issues: 2 },
        },
        fixPrUrl: 'https://github.com/owner/myapp/pull/99',
        reportUrl: 'https://seo-autopilot.dev/reports/xyz789',
      };

      const comment = formatPRComment(summary);

      // Should have all key elements
      expect(comment).toContain('## SEO Audit Report');
      expect(comment).toContain('58/100');
      expect(comment).toContain('12 issues');
      expect(comment).toContain('4 errors');
      expect(comment).toContain('On-Page');
      expect(comment).toContain('45');
      expect(comment).toContain('PR #99');
      expect(comment).toContain('View Full Report');
      expect(comment).toContain('SEO Autopilot');
    });
  });
});
