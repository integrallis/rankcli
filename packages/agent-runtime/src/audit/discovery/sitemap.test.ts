import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { discoverPagesFromSitemap } from './sitemap.js';

type Route = { status?: number; type?: string; body: string };
let routes: Record<string, Route>;
const realFetch = globalThis.fetch;

beforeEach(() => {
  routes = {};
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = input instanceof Request ? input.url : String(input);
    const route = routes[url];
    if (!route) return new Response('not found', { status: 404, headers: { 'content-type': 'text/plain' } });
    return new Response(route.body, { status: route.status ?? 200, headers: { 'content-type': route.type ?? 'application/xml' } });
  }) as typeof fetch;
});
afterEach(() => { globalThis.fetch = realFetch; });

const urlset = (...locs: string[]) => `<?xml version="1.0"?><urlset>${locs.map(l => `<url><loc>${l}</loc></url>`).join('')}</urlset>`;

describe('discoverPagesFromSitemap', () => {
  it('reads the sitemap named in robots.txt, skips the root and other hosts, and stops at maxPages', async () => {
    routes['https://example.com/robots.txt'] = { type: 'text/plain', body: 'User-agent: *\nSitemap: https://example.com/sm/pages.xml\n' };
    routes['https://example.com/sm/pages.xml'] = { body: urlset('https://example.com/', 'https://example.com/pricing', 'https://cdn.example.net/x', 'https://example.com/about', 'https://example.com/blog/a') };
    const found = await discoverPagesFromSitemap('https://example.com', 2);
    expect(found.sitemapUrl).toBe('https://example.com/sm/pages.xml');
    expect(found.pages.map(p => p.url)).toEqual(['https://example.com/pricing', 'https://example.com/about']);
  });

  it('follows a sitemap index into its child sitemaps', async () => {
    routes['https://example.com/sitemap.xml'] = { body: '<sitemapindex><sitemap><loc>https://example.com/a.xml</loc></sitemap><sitemap><loc>https://example.com/b.xml</loc></sitemap></sitemapindex>' };
    routes['https://example.com/a.xml'] = { body: urlset('https://example.com/one') };
    routes['https://example.com/b.xml'] = { body: urlset('https://example.com/two') };
    const found = await discoverPagesFromSitemap('https://example.com', 5);
    expect(found.pages.map(p => p.url).sort()).toEqual(['https://example.com/one', 'https://example.com/two']);
    expect(found.sitemapsRead).toBe(3);
  });

  it('treats HTML at /sitemap.xml (a SPA catch-all) as no sitemap', async () => {
    routes['https://example.com/sitemap.xml'] = { type: 'text/html', body: '<!doctype html><html><body>app</body></html>' };
    const found = await discoverPagesFromSitemap('https://example.com', 5);
    expect(found.pages).toEqual([]);
    expect(found.sitemapUrl).toBeUndefined();
    expect(found.sitemapsRead).toBe(0);
  });

  it('finds nothing without a sitemap and asks for nothing when no pages are wanted', async () => {
    expect((await discoverPagesFromSitemap('https://example.com', 5)).pages).toEqual([]);
    const calls = vi.fn();
    globalThis.fetch = calls as unknown as typeof fetch;
    expect((await discoverPagesFromSitemap('https://example.com', 0)).pages).toEqual([]);
    expect(calls).not.toHaveBeenCalled();
  });
});
