import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  runAuditWithFixes,
  createAuditPR,
  AuditRunnerOptions,
  AuditRunnerResult,
} from './runner.js';
import type { AuditReport } from './types.js';

// Mock the audit engine
vi.mock('./engine.js', () => ({
  runFullAudit: vi.fn(),
}));

// Mock the fix generators
vi.mock('./fixes/index.js', () => ({
  generateAllFixes: vi.fn(),
}));

// Mock the PR helper
vi.mock('../git/pr-helper.js', () => ({
  generatePRDescription: vi.fn(),
  createPullRequest: vi.fn(),
}));

describe('audit-runner', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('runAuditWithFixes', () => {
    it('runs audit and returns report with fixes', async () => {
      const { runFullAudit } = await import('./engine.js');
      const { generateAllFixes } = await import('./fixes/index.js');

      const mockReport: AuditReport = {
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: '2024-01-01T00:00:00Z',
        crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
        healthScore: { overall: 65, crawlability: 80, indexability: 70, onPage: 50, content: 70, links: 60, performance: 75, security: 80 },
        issues: [
          { code: 'TITLE_MISSING', severity: 'error', category: 'on-page', title: 'Missing title', description: 'No title tag', affectedUrls: ['https://example.com'] },
          { code: 'OG_IMAGE_MISSING', severity: 'warning', category: 'social-meta', title: 'Missing OG image', description: 'No og:image', affectedUrls: ['https://example.com'] },
        ],
        pages: [],
        summary: { errors: 1, warnings: 1, notices: 0, passed: 80 },
      };

      const mockFixes = [
        { category: 'on-page', issues: ['TITLE_MISSING'], files: [{ path: 'index.html', content: '<title>Example</title>' }] },
        { category: 'social-meta', issues: ['OG_IMAGE_MISSING'], files: [{ path: 'index.html', content: '<meta property="og:image">' }] },
      ];

      vi.mocked(runFullAudit).mockResolvedValue(mockReport);
      vi.mocked(generateAllFixes).mockReturnValue(mockFixes);

      const result = await runAuditWithFixes({ url: 'https://example.com' });

      expect(result.report).toEqual(mockReport);
      expect(result.fixes).toEqual(mockFixes);
      expect(result.score).toBe(65);
      expect(runFullAudit).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://example.com' }));
    });

    it('passes through audit options', async () => {
      const { runFullAudit } = await import('./engine.js');
      const { generateAllFixes } = await import('./fixes/index.js');

      vi.mocked(runFullAudit).mockResolvedValue({
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: '2024-01-01T00:00:00Z',
        crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
        healthScore: { overall: 80, crawlability: 80, indexability: 80, onPage: 80, content: 80, links: 80, performance: 80, security: 80 },
        issues: [],
        pages: [],
        summary: { errors: 0, warnings: 0, notices: 0, passed: 85 },
      });
      vi.mocked(generateAllFixes).mockReturnValue([]);

      await runAuditWithFixes({
        url: 'https://example.com',
        checkBrokenLinks: true,
        checkHreflangUrls: true,
      });

      expect(runFullAudit).toHaveBeenCalledWith(expect.objectContaining({
        url: 'https://example.com',
        checkBrokenLinks: true,
        checkHreflangUrls: true,
      }));
    });

    it('skips fix generation when disabled', async () => {
      const { runFullAudit } = await import('./engine.js');
      const { generateAllFixes } = await import('./fixes/index.js');

      vi.mocked(runFullAudit).mockResolvedValue({
        url: 'https://example.com',
        domain: 'example.com',
        timestamp: '2024-01-01T00:00:00Z',
        crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
        healthScore: { overall: 80, crawlability: 80, indexability: 80, onPage: 80, content: 80, links: 80, performance: 80, security: 80 },
        issues: [{ code: 'TITLE_MISSING', severity: 'error', category: 'on-page', title: 'Missing title', description: 'No title', affectedUrls: [] }],
        pages: [],
        summary: { errors: 1, warnings: 0, notices: 0, passed: 84 },
      });

      const result = await runAuditWithFixes({
        url: 'https://example.com',
        generateFixes: false,
      });

      expect(result.fixes).toEqual([]);
      expect(generateAllFixes).not.toHaveBeenCalled();
    });

    it('handles audit errors gracefully', async () => {
      const { runFullAudit } = await import('./engine.js');

      vi.mocked(runFullAudit).mockRejectedValue(new Error('Network error'));

      await expect(runAuditWithFixes({ url: 'https://example.com' }))
        .rejects.toThrow('Network error');
    });
  });

  describe('createAuditPR', () => {
    it('creates PR with audit results', async () => {
      const { generatePRDescription, createPullRequest } = await import('../git/pr-helper.js');

      const mockResult: AuditRunnerResult = {
        report: {
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: '2024-01-01T00:00:00Z',
          crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
          healthScore: { overall: 82, crawlability: 80, indexability: 80, onPage: 85, content: 80, links: 80, performance: 80, security: 80 },
          issues: [],
          pages: [],
          summary: { errors: 0, warnings: 0, notices: 0, passed: 85 },
        },
        fixes: [
          { category: 'on-page', issues: ['TITLE_MISSING'], files: [{ path: 'index.html', content: '' }] },
        ],
        score: 82,
        previousScore: 65,
      };

      vi.mocked(generatePRDescription).mockReturnValue({
        title: 'fix(meta): SEO improvements',
        body: '## Summary',
        labels: ['seo'],
      });

      vi.mocked(createPullRequest).mockResolvedValue({
        success: true,
        url: 'https://github.com/owner/repo/pull/123',
        number: 123,
      });

      const result = await createAuditPR(mockResult, {
        baseBranch: 'main',
        headBranch: 'seo-fixes',
      });

      expect(result.success).toBe(true);
      expect(result.prUrl).toBe('https://github.com/owner/repo/pull/123');
      expect(generatePRDescription).toHaveBeenCalledWith(
        expect.arrayContaining([expect.objectContaining({ category: 'on-page' })]),
        expect.objectContaining({ scoreBefore: 65, scoreAfter: 82 })
      );
    });

    it('returns error when no fixes available', async () => {
      const mockResult: AuditRunnerResult = {
        report: {
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: '2024-01-01T00:00:00Z',
          crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
          healthScore: { overall: 95, crawlability: 95, indexability: 95, onPage: 95, content: 95, links: 95, performance: 95, security: 95 },
          issues: [],
          pages: [],
          summary: { errors: 0, warnings: 0, notices: 0, passed: 85 },
        },
        fixes: [],
        score: 95,
      };

      const result = await createAuditPR(mockResult, {
        baseBranch: 'main',
        headBranch: 'seo-fixes',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No fixes');
    });

    it('supports dry run mode', async () => {
      const { createPullRequest } = await import('../git/pr-helper.js');

      const mockResult: AuditRunnerResult = {
        report: {
          url: 'https://example.com',
          domain: 'example.com',
          timestamp: '2024-01-01T00:00:00Z',
          crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
          healthScore: { overall: 82, crawlability: 80, indexability: 80, onPage: 85, content: 80, links: 80, performance: 80, security: 80 },
          issues: [],
          pages: [],
          summary: { errors: 0, warnings: 0, notices: 0, passed: 85 },
        },
        fixes: [
          { category: 'on-page', issues: ['TITLE_MISSING'], files: [{ path: 'index.html', content: '' }] },
        ],
        score: 82,
      };

      vi.mocked(createPullRequest).mockResolvedValue({
        success: true,
        dryRun: true,
      });

      const result = await createAuditPR(mockResult, {
        baseBranch: 'main',
        headBranch: 'seo-fixes',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
    });
  });

  describe('integration scenarios', () => {
    it('full audit to PR workflow', async () => {
      const { runFullAudit } = await import('./engine.js');
      const { generateAllFixes } = await import('./fixes/index.js');
      const { generatePRDescription, createPullRequest } = await import('../git/pr-helper.js');

      // Mock audit result
      vi.mocked(runFullAudit).mockResolvedValue({
        url: 'https://myapp.com',
        domain: 'myapp.com',
        timestamp: '2024-01-01T00:00:00Z',
        crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
        healthScore: { overall: 45, crawlability: 60, indexability: 50, onPage: 30, content: 40, links: 50, performance: 60, security: 70 },
        issues: [
          { code: 'TITLE_MISSING', severity: 'error', category: 'on-page', title: 'Missing title', description: 'No title', affectedUrls: ['https://myapp.com'] },
          { code: 'META_DESC_MISSING', severity: 'error', category: 'on-page', title: 'Missing description', description: 'No meta desc', affectedUrls: ['https://myapp.com'] },
          { code: 'OG_TITLE_MISSING', severity: 'warning', category: 'social-meta', title: 'Missing OG title', description: 'No og:title', affectedUrls: ['https://myapp.com'] },
          { code: 'SCHEMA_MISSING', severity: 'warning', category: 'structured-data', title: 'No schema', description: 'Missing JSON-LD', affectedUrls: ['https://myapp.com'] },
        ],
        pages: [],
        summary: { errors: 2, warnings: 2, notices: 0, passed: 81 },
      });

      // Mock fix generation
      vi.mocked(generateAllFixes).mockReturnValue([
        { category: 'on-page', issues: ['TITLE_MISSING', 'META_DESC_MISSING'], files: [{ path: 'index.html', content: '<title>...</title>' }] },
        { category: 'social-meta', issues: ['OG_TITLE_MISSING'], files: [{ path: 'index.html', content: '<meta property="og:title">' }] },
        { category: 'structured-data', issues: ['SCHEMA_MISSING'], files: [{ path: 'index.html', content: '<script type="application/ld+json">' }] },
      ]);

      // Mock PR creation
      vi.mocked(generatePRDescription).mockReturnValue({
        title: 'fix(seo): SEO improvements - 4 issues fixed',
        body: '## Summary\nFixes 4 SEO issues...',
        labels: ['seo', 'automated'],
      });

      vi.mocked(createPullRequest).mockResolvedValue({
        success: true,
        url: 'https://github.com/owner/myapp/pull/47',
        number: 47,
      });

      // Run audit
      const auditResult = await runAuditWithFixes({
        url: 'https://myapp.com',
        previousScore: 45,
      });

      expect(auditResult.score).toBe(45);
      expect(auditResult.fixes).toHaveLength(3);

      // Create PR
      const prResult = await createAuditPR(auditResult, {
        baseBranch: 'main',
        headBranch: 'seo-fixes-20240101',
      });

      expect(prResult.success).toBe(true);
      expect(prResult.prUrl).toContain('/pull/47');
    });
  });
});
