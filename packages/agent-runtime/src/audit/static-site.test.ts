import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { serveDirectory, resolveFile, type StaticSite } from './static-site.js';

let dir: string;
let site: StaticSite;

beforeAll(async () => {
  dir = mkdtempSync(join(tmpdir(), 'rankcli-dist-'));
  writeFileSync(join(dir, 'index.html'), '<!doctype html><title>Home</title>');
  mkdirSync(join(dir, 'about'));
  writeFileSync(join(dir, 'about', 'index.html'), '<!doctype html><title>About</title>');
  writeFileSync(join(dir, 'pricing.html'), '<!doctype html><title>Pricing</title>');
  writeFileSync(join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\n');
  writeFileSync(join(dir, 'sitemap.xml'), '<urlset></urlset>');
  site = await serveDirectory(dir);
});
afterAll(async () => { await site.close(); rmSync(dir, { recursive: true, force: true }); });

describe('serveDirectory', () => {
  it('serves the build the way a static host does', async () => {
    const get = async (path: string) => { const r = await fetch(site.origin + path); return { status: r.status, type: r.headers.get('content-type'), body: await r.text() }; };
    expect(await get('/')).toMatchObject({ status: 200, type: 'text/html; charset=utf-8', body: expect.stringContaining('Home') });
    expect((await get('/about')).body).toContain('About');
    expect((await get('/about/')).body).toContain('About');
    expect((await get('/pricing')).body).toContain('Pricing');
    expect((await get('/pricing.html')).body).toContain('Pricing');
    expect(await get('/robots.txt')).toMatchObject({ status: 200, type: 'text/plain; charset=utf-8' });
    expect((await get('/sitemap.xml')).type).toBe('application/xml');
    expect((await get('/missing')).status).toBe(404);
    expect((await get('/about?x=1')).status).toBe(200);
  });

  it('answers HEAD without a body and refuses other methods', async () => {
    const head = await fetch(site.origin + '/', { method: 'HEAD' });
    expect(head.status).toBe(200);
    expect(await head.text()).toBe('');
    expect((await fetch(site.origin + '/', { method: 'POST' })).status).toBe(405);
  });

  it('never leaves the directory, and maps pages back to files', async () => {
    expect(await resolveFile(dir, '/../etc/passwd')).toBeNull();
    expect(await resolveFile(dir, '/%2e%2e/%2e%2e/etc/passwd')).toBeNull();
    expect(await resolveFile(dir, '/about')).toBe(join(dir, 'about', 'index.html'));
    expect(await site.fileFor('https://example.com/pricing')).toMatch(/pricing\.html$/);
    expect(await site.fileFor('https://example.com/nope')).toBeUndefined();
  });
});
