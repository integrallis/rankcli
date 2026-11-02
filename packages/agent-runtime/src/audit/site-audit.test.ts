import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { AuditReport } from './types.js';

const runFullAudit = vi.fn();
vi.mock('./engine.js', () => ({ runFullAudit: (...args: unknown[]) => runFullAudit(...args) }));

const discoverPagesFromSitemap = vi.fn();
vi.mock('./discovery/sitemap.js', () => ({ discoverPagesFromSitemap: (...args: unknown[]) => discoverPagesFromSitemap(...args) }));

import { auditSite, mergeIssues, buildLinkGraph, linkGraphIssues, type SiteAuditProgress } from './site-audit.js';

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

// The JS-off link graph: what a crawler that runs no scripts can reach from the homepage.
describe('link graph', () => {
  const withLinks = (url: string, links: string[], issues: Array<{ code: string; severity: string }> = []): AuditReport => ({
    ...report(url, 80, issues),
    pages: [{ url, statusCode: 200, wordCount: 100, loadTime: 0, issues: [], internalLinks: links }],
  });

  it('computes depth from the homepage over the audited pages only', () => {
    const audited = new Map<string, string[]>([
      ['https://example.com/', ['https://example.com/a', 'https://example.com/b']],
      ['https://example.com/a', ['https://example.com/c']],
      ['https://example.com/b', []],
      ['https://example.com/c', ['https://example.com/d']],
      ['https://example.com/d', []],
      ['https://example.com/lonely', []],
    ]);
    const graph = buildLinkGraph('https://example.com', audited, { urls: [], complete: false });
    expect(graph.depth).toEqual({ 'https://example.com/': 0, 'https://example.com/a': 1, 'https://example.com/b': 1, 'https://example.com/c': 2, 'https://example.com/d': 3 });
    expect(graph.unreachable).toEqual(['https://example.com/lonely']);
    expect(graph.orphans).toBeUndefined();
    expect(graph.homepageLinks).toBe(2);
  });

  it('declares orphans only when every sitemap page was audited', () => {
    const audited = new Map<string, string[]>([
      ['https://example.com/', ['https://example.com/a']],
      ['https://example.com/a', []],
      ['https://example.com/b', []],
    ]);
    const partial = buildLinkGraph('https://example.com', audited, { urls: ['https://example.com/a', 'https://example.com/b', 'https://example.com/c'], complete: true });
    expect(partial.coverage.complete).toBe(false);
    expect(partial.orphans).toBeUndefined();
    const full = buildLinkGraph('https://example.com', audited, { urls: ['https://example.com/a/', 'https://example.com/b?utm_source=x'], complete: true });
    expect(full.coverage.complete).toBe(true);
    expect(full.orphans).toEqual(['https://example.com/b']);
    expect(linkGraphIssues('https://example.com', full).map(i => i.code)).toEqual(['ORPHAN_PAGES']);
  });

  it('reports navigation missing from the HTML when a large site’s homepage links to almost nothing', () => {
    const audited = new Map<string, string[]>([['https://example.com/', ['https://example.com/login']], ['https://example.com/login', []]]);
    const graph = buildLinkGraph('https://example.com', audited, { urls: Array.from({ length: 40 }, (_, i) => `https://example.com/p${i}`), complete: true });
    const issues = linkGraphIssues('https://example.com', graph);
    expect(issues.map(i => i.code)).toEqual(['NAV_NOT_IN_HTML']);
    expect(issues[0].severity).toBe('warning');
    expect(issues[0].description).toMatch(/40 pages in its sitemap/);
    // A small site with two links is just a small site.
    const small = buildLinkGraph('https://example.com', audited, { urls: ['https://example.com/login'], complete: true });
    expect(linkGraphIssues('https://example.com', small)).toEqual([]);
  });

  it('reports deep pages only with full coverage, and puts depth on the page summaries', async () => {
    const links: Record<string, string[]> = {
      'https://example.com': ['https://example.com/pricing'],
      'https://example.com/pricing': ['https://example.com/about'],
      'https://example.com/about': ['https://example.com/blog/x'],
      'https://example.com/blog/x': ['https://example.com/docs'],
      'https://example.com/docs': [],
    };
    discoverPagesFromSitemap.mockResolvedValue({
      pages: ['pricing', 'about', 'blog/x', 'docs'].map(p => ({ url: `https://example.com/${p}`, source: 'sitemap', priority: 5 })),
      sitemapUrl: 'https://example.com/sitemap.xml', sitemapsRead: 1,
      urls: ['pricing', 'about', 'blog/x', 'docs'].map(p => `https://example.com/${p}`), complete: true,
    });
    runFullAudit.mockImplementation(async ({ url }: { url: string }) => withLinks(url, links[url] ?? []));
    const result = await auditSite({ url: 'https://example.com', maxPages: 5 });
    expect(result?.linkGraph?.coverage).toEqual({ audited: 5, sitemap: 4, complete: true });
    expect(result?.pages.map(p => [p.url, p.depth])).toEqual([
      ['https://example.com', 0], ['https://example.com/pricing', 1], ['https://example.com/about', 2], ['https://example.com/blog/x', 3], ['https://example.com/docs', 4],
    ]);
    expect(result?.issues.map(i => i.code)).toContain('DEEP_PAGES');
    expect(result?.issues.map(i => i.code)).not.toContain('ORPHAN_PAGES');
  });

  it('builds no graph when a report carries no links (older engines and mocks)', async () => {
    const result = await auditSite({ url: 'https://example.com', maxPages: 2 });
    expect(result?.linkGraph).toBeUndefined();
    expect(result?.issues.map(i => i.code)).not.toContain('NAV_NOT_IN_HTML');
  });
});
