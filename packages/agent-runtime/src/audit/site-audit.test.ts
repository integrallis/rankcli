import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuditReport } from './types.js';

const runFullAudit = vi.fn();
vi.mock('./engine.js', () => ({ runFullAudit: (...args: unknown[]) => runFullAudit(...args) }));

const discoverPagesFromSitemap = vi.fn();
vi.mock('./discovery/sitemap.js', () => ({ discoverPagesFromSitemap: (...args: unknown[]) => discoverPagesFromSitemap(...args) }));

import { auditSite, mergeIssues, type SiteAuditProgress } from './site-audit.js';

const report = (url: string, overall: number, issues: Array<{ code: string; severity: string }>): AuditReport => ({
  url,
  domain: 'example.com',
  timestamp: new Date().toISOString(),
  crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
  healthScore: { overall, crawlability: overall, indexability: overall, onPage: overall, content: overall, links: overall, performance: overall, security: overall, aiReadiness: overall, social: overall, localSeo: overall, accessibility: overall },
  issues: issues.map(i => ({ category: 'on-page', title: i.code, description: '', impact: '', howToFix: '', affectedUrls: [url], ...i })) as AuditReport['issues'],
  pages: [],
  summary: { errors: issues.filter(i => i.severity === 'error').length, warnings: 0, notices: 0, passed: 270 },
});

const realFetch = globalThis.fetch;
const HOME = '<html><body><a href="/pricing">p</a><a href="/about">a</a><a href="/blog/x">b</a></body></html>';

beforeEach(() => {
  vi.clearAllMocks();
  globalThis.fetch = (async () => new Response(HOME, { status: 200, headers: { 'content-type': 'text/html' } })) as typeof fetch;
  discoverPagesFromSitemap.mockResolvedValue({ pages: [], sitemapsRead: 0 });
  runFullAudit.mockImplementation(async ({ url }: { url: string }) => report(url, 80, [{ code: 'TITLE_MISSING', severity: 'error' }]));
});
afterEach(() => { globalThis.fetch = realFetch; });

describe('auditSite', () => {
  it('seeds the page list from the sitemap and fills up from homepage links', async () => {
    discoverPagesFromSitemap.mockResolvedValue({ pages: [{ url: 'https://example.com/docs', source: 'sitemap', priority: 9 }], sitemapUrl: 'https://example.com/sitemap.xml', sitemapsRead: 1 });
    const events: SiteAuditProgress[] = [];
    const result = await auditSite({ url: 'https://example.com', maxPages: 3, onProgress: e => events.push(e) });
    expect(result?.pagesDiscovered).toBe(3);
    expect(runFullAudit.mock.calls.map(c => c[0].url)).toEqual(['https://example.com', 'https://example.com/docs', 'https://example.com/pricing']);
    expect(result?.discovery).toEqual({ source: 'sitemap', sitemapUrl: 'https://example.com/sitemap.xml' });
    expect(events.find(e => e.phase === 'discovery' && e.status === 'done')).toMatchObject({ pages: 3, source: 'sitemap' });
    expect(events.filter(e => e.phase === 'audit' && e.status === 'progress')).toHaveLength(3);
  });

  it('falls back to links without a sitemap, and audits the URL alone at maxPages 1 without discovery', async () => {
    const result = await auditSite({ url: 'https://example.com', maxPages: 2 });
    expect(result?.discovery.source).toBe('links');
    expect(runFullAudit).toHaveBeenCalledTimes(2);

    vi.clearAllMocks();
    runFullAudit.mockImplementation(async ({ url }: { url: string }) => report(url, 80, []));
    const single = await auditSite({ url: 'https://example.com', maxPages: 1, discovery: 'links' });
    expect(discoverPagesFromSitemap).not.toHaveBeenCalled();
    expect(runFullAudit).toHaveBeenCalledTimes(1);
    expect(single?.discovery.source).toBe('none');
  });

  it('passes the engine options through and merges issues across pages', async () => {
    runFullAudit.mockImplementation(async ({ url }: { url: string }) => report(url, 80, [{ code: 'TITLE_MISSING', severity: url.endsWith('pricing') ? 'warning' : 'error' }]));
    const result = await auditSite({ url: 'https://example.com', maxPages: 2, checkLinks: true, checksLimit: 100, staticBuild: true });
    expect(runFullAudit).toHaveBeenCalledWith(expect.objectContaining({ auditRootUrl: 'https://example.com', checkBrokenLinks: true, checkHreflangUrls: true, checksLimit: 100, staticBuild: true }));
    expect(result?.issues).toHaveLength(1);
    expect(result?.issues[0].severity).toBe('error');
    expect(result?.issues[0].affectedUrls).toEqual(['https://example.com', 'https://example.com/pricing']);
    expect(result?.pages).toHaveLength(2);
  });

  it('reports a page failure and returns null when nothing could be audited', async () => {
    runFullAudit.mockImplementation(async ({ url }: { url: string }) => report(url, 0, [{ code: 'HTTP_ERROR_STATUS', severity: 'error' }]));
    const failed = await auditSite({ url: 'https://example.com', maxPages: 1 });
    expect(failed?.pageFailure?.code).toBe('HTTP_ERROR_STATUS');

    runFullAudit.mockRejectedValue(new Error('boom'));
    expect(await auditSite({ url: 'https://example.com', maxPages: 1 })).toBeNull();
  });
});

describe('mergeIssues', () => {
  it('keeps the most severe copy and the union of pages', () => {
    const merged = mergeIssues([
      [{ code: 'X', severity: 'warning', category: 'on-page', title: '', description: '', impact: '', howToFix: '', affectedUrls: ['https://a/'] }],
      [{ code: 'X', severity: 'error', category: 'on-page', title: '', description: '', impact: '', howToFix: '', affectedUrls: ['https://a/b'] }],
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0].severity).toBe('error');
    expect(merged[0].affectedUrls).toEqual(['https://a/', 'https://a/b']);
  });
});
