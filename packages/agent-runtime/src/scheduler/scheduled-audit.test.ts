import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  runScheduledAudit,
  shouldRunAudit,
  calculateNextRun,
  ScheduledAuditConfig,
  ScheduledAuditResult,
} from './scheduled-audit.js';

// Mock the runner
vi.mock('../audit/runner.js', () => ({
  runAuditWithFixes: vi.fn(),
  createAuditPR: vi.fn(),
}));

describe('scheduled-audit', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('shouldRunAudit', () => {
    it('returns true when schedule is "daily" and last run was more than 24 hours ago', () => {
      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'daily',
        lastRunAt: new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString(), // 25 hours ago
      };

      expect(shouldRunAudit(config)).toBe(true);
    });

    it('returns false when schedule is "daily" and last run was less than 24 hours ago', () => {
      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'daily',
        lastRunAt: new Date(Date.now() - 12 * 60 * 60 * 1000).toISOString(), // 12 hours ago
      };

      expect(shouldRunAudit(config)).toBe(false);
    });

    it('returns true when schedule is "weekly" and last run was more than 7 days ago', () => {
      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'weekly',
        lastRunAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000).toISOString(), // 8 days ago
      };

      expect(shouldRunAudit(config)).toBe(true);
    });

    it('returns false when schedule is "weekly" and last run was less than 7 days ago', () => {
      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'weekly',
        lastRunAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days ago
      };

      expect(shouldRunAudit(config)).toBe(false);
    });

    it('returns true when no last run exists', () => {
      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'daily',
      };

      expect(shouldRunAudit(config)).toBe(true);
    });

    it('returns false when schedule is "manual"', () => {
      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'manual',
      };

      expect(shouldRunAudit(config)).toBe(false);
    });

    it('returns true when schedule is "on-demand"', () => {
      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'on-demand',
        lastRunAt: new Date().toISOString(), // Just now, but on-demand should always run
      };

      expect(shouldRunAudit(config)).toBe(true);
    });
  });

  describe('calculateNextRun', () => {
    it('returns next day for daily schedule', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

      const result = calculateNextRun('daily');
      expect(result).toBe('2024-01-16T10:00:00.000Z');
    });

    it('returns next week for weekly schedule', () => {
      vi.setSystemTime(new Date('2024-01-15T10:00:00Z'));

      const result = calculateNextRun('weekly');
      expect(result).toBe('2024-01-22T10:00:00.000Z');
    });

    it('returns null for manual schedule', () => {
      const result = calculateNextRun('manual');
      expect(result).toBeNull();
    });

    it('returns null for on-demand schedule', () => {
      const result = calculateNextRun('on-demand');
      expect(result).toBeNull();
    });
  });

  describe('runScheduledAudit', () => {
    it('runs audit and returns result with score', async () => {
      const { runAuditWithFixes } = await import('../audit/runner.js');

      vi.mocked(runAuditWithFixes).mockResolvedValue({
        report: {
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: '2024-01-15T10:00:00Z',
          crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
          healthScore: { overall: 75, crawlability: 80, indexability: 75, onPage: 70, content: 80, links: 75, performance: 70, security: 80, aiReadiness: 75, social: 70, localSeo: 70 },
          issues: [],
          pages: [],
          summary: { errors: 0, warnings: 2, notices: 1, passed: 82 },
        },
        fixes: [],
        score: 75,
      });

      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'daily',
      };

      const result = await runScheduledAudit(config);

      expect(result.success).toBe(true);
      expect(result.score).toBe(75);
      expect(result.issuesFound).toBe(0);
      expect(runAuditWithFixes).toHaveBeenCalledWith(
        expect.objectContaining({ url: 'https://example.com' })
      );
    });

    it('includes previous score when available', async () => {
      const { runAuditWithFixes } = await import('../audit/runner.js');

      vi.mocked(runAuditWithFixes).mockResolvedValue({
        report: {
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: '2024-01-15T10:00:00Z',
          crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
          healthScore: { overall: 80, crawlability: 80, indexability: 80, onPage: 80, content: 80, links: 80, performance: 80, security: 80, aiReadiness: 80, social: 80, localSeo: 80 },
          issues: [],
          pages: [],
          summary: { errors: 0, warnings: 0, notices: 0, passed: 85 },
        },
        fixes: [],
        score: 80,
        previousScore: 65,
      });

      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'daily',
        previousScore: 65,
      };

      const result = await runScheduledAudit(config);

      expect(result.scoreChange).toBe(15);
      expect(runAuditWithFixes).toHaveBeenCalledWith(
        expect.objectContaining({ previousScore: 65 })
      );
    });

    it('creates PR when auto-fix is enabled and fixes are available', async () => {
      const { runAuditWithFixes, createAuditPR } = await import('../audit/runner.js');

      vi.mocked(runAuditWithFixes).mockResolvedValue({
        report: {
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: '2024-01-15T10:00:00Z',
          crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
          healthScore: { overall: 65, crawlability: 80, indexability: 70, onPage: 50, content: 70, links: 60, performance: 75, security: 80, aiReadiness: 65, social: 60, localSeo: 60 },
          issues: [{ code: 'TITLE_MISSING', severity: 'error', category: 'on-page', title: 'Missing title', description: 'No title', impact: 'Critical ranking factor missing.', howToFix: 'Add a title tag.', affectedUrls: [] }],
          pages: [],
          summary: { errors: 1, warnings: 0, notices: 0, passed: 84 },
        },
        fixes: [{ category: 'on-page', issues: ['TITLE_MISSING'], files: [{ path: 'index.html', content: '<title>Fixed</title>' }] }],
        score: 65,
      });

      vi.mocked(createAuditPR).mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/owner/repo/pull/99',
        prNumber: 99,
      });

      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'daily',
        autoFix: true,
        baseBranch: 'main',
      };

      const result = await runScheduledAudit(config);

      expect(result.success).toBe(true);
      expect(result.prCreated).toBe(true);
      expect(result.prUrl).toBe('https://github.com/owner/repo/pull/99');
      expect(createAuditPR).toHaveBeenCalled();
    });

    it('does not create PR when auto-fix is disabled', async () => {
      const { runAuditWithFixes, createAuditPR } = await import('../audit/runner.js');

      vi.mocked(runAuditWithFixes).mockResolvedValue({
        report: {
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: '2024-01-15T10:00:00Z',
          crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
          healthScore: { overall: 65, crawlability: 80, indexability: 70, onPage: 50, content: 70, links: 60, performance: 75, security: 80, aiReadiness: 65, social: 60, localSeo: 60 },
          issues: [{ code: 'TITLE_MISSING', severity: 'error', category: 'on-page', title: 'Missing title', description: 'No title', impact: 'Critical ranking factor missing.', howToFix: 'Add a title tag.', affectedUrls: [] }],
          pages: [],
          summary: { errors: 1, warnings: 0, notices: 0, passed: 84 },
        },
        fixes: [{ category: 'on-page', issues: ['TITLE_MISSING'], files: [{ path: 'index.html', content: '<title>Fixed</title>' }] }],
        score: 65,
      });

      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'daily',
        autoFix: false,
      };

      const result = await runScheduledAudit(config);

      expect(result.success).toBe(true);
      expect(result.prCreated).toBeFalsy();
      expect(createAuditPR).not.toHaveBeenCalled();
    });

    it('handles audit errors gracefully', async () => {
      const { runAuditWithFixes } = await import('../audit/runner.js');

      vi.mocked(runAuditWithFixes).mockRejectedValue(new Error('Network timeout'));

      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'daily',
      };

      const result = await runScheduledAudit(config);

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network timeout');
    });

    it('respects generateFixes option', async () => {
      const { runAuditWithFixes } = await import('../audit/runner.js');

      vi.mocked(runAuditWithFixes).mockResolvedValue({
        report: {
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: '2024-01-15T10:00:00Z',
          crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
          healthScore: { overall: 80, crawlability: 80, indexability: 80, onPage: 80, content: 80, links: 80, performance: 80, security: 80, aiReadiness: 80, social: 80, localSeo: 80 },
          issues: [],
          pages: [],
          summary: { errors: 0, warnings: 0, notices: 0, passed: 85 },
        },
        fixes: [],
        score: 80,
      });

      const config: ScheduledAuditConfig = {
        projectId: 'proj-1',
        url: 'https://example.com',
        schedule: 'daily',
        generateFixes: false,
      };

      await runScheduledAudit(config);

      expect(runAuditWithFixes).toHaveBeenCalledWith(
        expect.objectContaining({ generateFixes: false })
      );
    });
  });

  describe('integration scenarios', () => {
    it('handles complete scheduled audit workflow', async () => {
      const { runAuditWithFixes, createAuditPR } = await import('../audit/runner.js');

      // Mock a typical audit result with issues
      vi.mocked(runAuditWithFixes).mockResolvedValue({
        report: {
          url: 'https://myapp.com',
          domain: 'myapp.com',
          timestamp: '2024-01-15T10:00:00Z',
          crawlStats: { totalUrls: 5, crawledUrls: 5, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
          healthScore: { overall: 58, crawlability: 70, indexability: 60, onPage: 45, content: 55, links: 60, performance: 65, security: 75, aiReadiness: 55, social: 50, localSeo: 50 },
          issues: [
            { code: 'TITLE_MISSING', severity: 'error', category: 'on-page', title: 'Missing title', description: 'No title', impact: 'Critical ranking factor missing.', howToFix: 'Add a title tag.', affectedUrls: ['https://myapp.com/about'] },
            { code: 'META_DESC_MISSING', severity: 'error', category: 'on-page', title: 'Missing meta description', description: 'No meta', impact: 'Search results will show auto-generated snippets.', howToFix: 'Add a meta description.', affectedUrls: ['https://myapp.com/about'] },
            { code: 'OG_IMAGE_MISSING', severity: 'warning', category: 'social', title: 'Missing OG image', description: 'No og:image', impact: 'Social shares will not display a preview image.', howToFix: 'Add og:image meta tag.', affectedUrls: ['https://myapp.com'] },
          ],
          pages: [],
          summary: { errors: 2, warnings: 1, notices: 0, passed: 78 },
        },
        fixes: [
          { category: 'on-page', issues: ['TITLE_MISSING', 'META_DESC_MISSING'], files: [{ path: 'about.html', content: '<title>About</title>' }] },
          { category: 'social', issues: ['OG_IMAGE_MISSING'], files: [{ path: 'index.html', content: '<meta property="og:image">' }] },
        ],
        score: 58,
        previousScore: 45,
      });

      vi.mocked(createAuditPR).mockResolvedValue({
        success: true,
        prUrl: 'https://github.com/owner/myapp/pull/123',
        prNumber: 123,
      });

      const config: ScheduledAuditConfig = {
        projectId: 'proj-myapp',
        url: 'https://myapp.com',
        schedule: 'daily',
        autoFix: true,
        baseBranch: 'main',
        previousScore: 45,
      };

      const result = await runScheduledAudit(config);

      expect(result).toMatchObject({
        success: true,
        projectId: 'proj-myapp',
        score: 58,
        scoreChange: 13,
        issuesFound: 3,
        fixesGenerated: 2,
        prCreated: true,
        prUrl: 'https://github.com/owner/myapp/pull/123',
      });
    });
  });
});
