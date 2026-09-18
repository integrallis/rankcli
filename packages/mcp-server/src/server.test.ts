import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { handleAnalysisTool, fetchRobotsTxt, isPrivateAddress } from './server.js';
import { guardedFetch } from './fetch-guard.js';

const PAGE = '<!doctype html><html><head><title>Test page for GEO</title></head><body><h1>Hello</h1><p>Some content.</p></body></html>';

function startSite(routes: Record<string, { status: number; body: string; headers?: Record<string, string> }>): Promise<{ server: Server; base: string }> {
  return new Promise((resolve) => {
    const server = createServer((req, res) => {
      const route = routes[req.url || '/'] ?? { status: 404, body: 'not found' };
      res.writeHead(route.status, { 'content-type': 'text/html', ...route.headers });
      res.end(route.body);
    });
    server.listen(0, '127.0.0.1', () => {
      resolve({ server, base: `http://127.0.0.1:${(server.address() as AddressInfo).port}` });
    });
  });
}

const textOf = (result: Awaited<ReturnType<typeof handleAnalysisTool>>) =>
  (result!.content[0] as { text: string }).text;

describe('seo_geo_check reads the real robots.txt', () => {
  let site: { server: Server; base: string };
  let down: { server: Server; base: string };

  beforeAll(async () => {
    site = await startSite({
      '/': { status: 200, body: PAGE },
      '/robots.txt': { status: 200, body: 'User-agent: GPTBot\nDisallow: /\n\nUser-agent: *\nAllow: /\n' },
    });
    down = await startSite({
      '/': { status: 200, body: PAGE },
      '/robots.txt': { status: 503, body: 'unavailable' },
    });
  });

  afterAll(async () => {
    await new Promise<void>((r) => site.server.close(() => r()));
    await new Promise<void>((r) => down.server.close(() => r()));
  });

  it('reports a crawler the site blocks as blocked (it used to say every crawler was allowed)', async () => {
    const text = textOf(await handleAnalysisTool('seo_geo_check', { url: `${site.base}/` }));
    const blockedRow = text.split('\n').find(l => l.includes('Blocked'))!;
    expect(blockedRow).toContain('GPTBot');
    expect(text).toContain('robots.txt fetched from');
  });

  it('uses caller-provided robots.txt without fetching', async () => {
    const text = textOf(await handleAnalysisTool('seo_geo_check', { url: `${site.base}/`, html: PAGE, robotsTxt: 'User-agent: *\nAllow: /\n' }));
    expect(text.split('\n').find(l => l.includes('Blocked'))).toContain('None');
    expect(text).toContain('robots.txt as provided');
  });

  it('says crawler access is unknown when robots.txt answers 5xx', async () => {
    const text = textOf(await handleAnalysisTool('seo_geo_check', { url: `${down.base}/` }));
    expect(text).toContain('Unknown');
    expect(text).toContain('HTTP 503');
    expect(text).not.toContain('✅ Allowed');
  });

  it('seo_analyze fetches robots.txt too', async () => {
    const text = textOf(await handleAnalysisTool('seo_analyze', { url: `${site.base}/` }));
    expect(text).toContain('robots.txt fetched from');
  });

  it('treats a missing robots.txt (404) as allow-all, not unknown', async () => {
    const bare = await startSite({ '/': { status: 200, body: PAGE } });
    const r = await fetchRobotsTxt(`${bare.base}/some/page`);
    await new Promise<void>((resolve) => bare.server.close(() => resolve()));
    expect(r.unknown).toBeFalsy();
    expect(r.content).toBeUndefined();
    expect(r.note).toContain('allowed by default');
  });
});

describe('blockPrivateNetworks', () => {
  let site: { server: Server; base: string };

  beforeAll(async () => {
    site = await startSite({
      '/': { status: 200, body: PAGE },
      '/robots.txt': { status: 200, body: 'User-agent: *\nAllow: /\n' },
    });
  });

  afterAll(async () => {
    await new Promise<void>((r) => site.server.close(() => r()));
  });

  it('classifies private and public addresses', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254', '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:10.0.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(true);
    }
    for (const ip of ['8.8.8.8', '1.1.1.1', '2606:4700:4700::1111', '172.32.0.1']) {
      expect(isPrivateAddress(ip), ip).toBe(false);
    }
  });

  it('is off by default - a local server can audit localhost', async () => {
    const text = textOf(await handleAnalysisTool('seo_geo_check', { url: `${site.base}/` }));
    expect(text).toContain('GEO Analysis');
  });

  it('refuses private addresses when enabled', async () => {
    await expect(handleAnalysisTool('seo_geo_check', { url: `${site.base}/` }, { blockPrivateNetworks: true }))
      .rejects.toThrow(/private network/);
    await expect(guardedFetch('http://localhost:1/', { blockPrivateNetworks: true })).rejects.toThrow(/private network/);
  });

  it('refuses non-http(s) URLs either way', async () => {
    await expect(guardedFetch('file:///etc/passwd')).rejects.toThrow(/only http/);
  });
});
