/**
 * Exit codes of the built CLI, end to end: spawns `node dist/index.js`
 * against a local HTTP server, the way a CI job runs it.
 *
 * Needs `pnpm build:js` first (CI's cli-tests job builds before testing).
 * Skipped locally when dist/ is missing; in CI (CI=true) a missing build
 * fails instead of silently skipping the test that guards the CI contract.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = join(__dirname, '..', '..', 'dist', 'index.js');
const built = existsSync(CLI);

function run(args: string[], cwd?: string): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env, RANKCLI_CONFIG_DIR: configDir, NO_COLOR: '1' };
    // Never pick up a developer's real credentials or AI keys.
    for (const key of Object.keys(env)) {
      if (key.startsWith('RANKCLI_') && key !== 'RANKCLI_CONFIG_DIR') delete env[key];
    }
    const child = spawn(process.execPath, [CLI, ...args], { env, cwd });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stderr += d; });
    child.on('close', (code) => resolve({ code, stdout, stderr }));
  });
}

let configDir = '';
let server: Server;
let base = '';
/** Headers seen on requests to the test server, by path. */
const seenHeaders = new Map<string, Record<string, string | string[] | undefined>>();

const PAGE_WITH_ERRORS = '<!doctype html><html><head></head><body><p>No title, no h1.</p></body></html>';

describe.skipIf(!built && !process.env.CI)('rankcli audit exit codes (built CLI)', () => {
  beforeAll(async () => {
    if (!built) throw new Error(`${CLI} is missing - run \`pnpm build:js\` in packages/cli first`);
    configDir = mkdtempSync(join(tmpdir(), 'rankcli-exit-codes-'));
    server = createServer((req, res) => {
      seenHeaders.set(req.url ?? '/', req.headers);
      if (req.url === '/robots.txt') {
        res.writeHead(200, { 'content-type': 'text/plain' });
        res.end('User-agent: *\nAllow: /\n');
      } else if (req.url === '/down') {
        res.writeHead(503, { 'content-type': 'text/html' });
        res.end('<html><head><title>Maintenance</title></head><body><h1>Back soon</h1></body></html>');
      } else {
        res.writeHead(200, { 'content-type': 'text/html' });
        res.end(PAGE_WITH_ERRORS);
      }
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    if (configDir) rmSync(configDir, { recursive: true, force: true });
  });

  it('exits 2 for an invalid URL', async () => {
    const { code } = await run(['audit', '--url', 'not-a-url']);
    expect(code).toBe(2);
  });

  it('exits 2 for an invalid --fail-on value, printing JSON in JSON mode', async () => {
    const { code, stdout } = await run(['audit', '--url', `${base}/`, '--fail-on', 'fatal', '-o', 'json']);
    expect(code).toBe(2);
    expect(JSON.parse(stdout).exitCode).toBe(2);
  });

  it('exits 0 for a completed audit with errors when no gate is set', async () => {
    const { code, stdout } = await run(['audit', '--url', `${base}/`, '--max-pages', '1', '-o', 'json']);
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.issues.some((i: { severity: string }) => i.severity === 'error')).toBe(true);
  }, 60000);

  it('exits 1 when --fail-on error trips', async () => {
    const { code, stdout } = await run(['audit', '--url', `${base}/`, '--max-pages', '1', '--fail-on', 'error', '-o', 'json']);
    expect(code).toBe(1);
    expect(JSON.parse(stdout).gate.passed).toBe(false);
  }, 60000);

  it('exits 1 when --min-score trips', async () => {
    const { code } = await run(['audit', '--url', `${base}/`, '--max-pages', '1', '--min-score', '100']);
    expect(code).toBe(1);
  }, 60000);

  it('exits 3 when the URL answers 503', async () => {
    const { code, stdout } = await run(['audit', '--url', `${base}/down`, '--max-pages', '1', '-o', 'json']);
    expect(code).toBe(3);
    expect(JSON.parse(stdout).score).toBe(0);
  }, 60000);

  it('sends --header and --cookie with every request to the site', async () => {
    const { code } = await run(['audit', '--url', `${base}/`, '--max-pages', '1', '--header', 'X-Preview-Token: abc', '--cookie', 'session=1', '-o', 'json']);
    expect(code).toBe(0);
    expect(seenHeaders.get('/')?.['x-preview-token']).toBe('abc');
    expect(seenHeaders.get('/')?.cookie).toBe('session=1');
    expect(seenHeaders.get('/robots.txt')?.['x-preview-token']).toBe('abc');
  }, 60000);

  it('writes SARIF and JUnit documents', async () => {
    const sarif = await run(['audit', '--url', `${base}/`, '--max-pages', '1', '-o', 'sarif', '--fail-on', 'error']);
    expect(sarif.code).toBe(1);
    const doc = JSON.parse(sarif.stdout);
    expect(doc.version).toBe('2.1.0');
    expect(doc.runs[0].tool.driver.name).toBe('RankCLI');
    expect(doc.runs[0].results.length).toBeGreaterThan(0);
    expect(doc.runs[0].invocations[0].exitCode).toBe(1);

    const junit = await run(['audit', '--url', `${base}/`, '--max-pages', '1', '-o', 'junit']);
    expect(junit.code).toBe(0);
    expect(junit.stdout).toMatch(/^<\?xml/);
    expect(junit.stdout).toContain('<testsuites name="rankcli"');
    expect(junit.stdout).toContain('<failure');
  }, 90000);

  it('gates on new issues only with --baseline, and rankcli diff reads the same files', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rankcli-baseline-'));
    const first = await run(['audit', '--url', `${base}/`, '--max-pages', '1', '-o', 'json']);
    expect(first.code).toBe(0);
    writeFileSync(join(dir, 'baseline.json'), first.stdout);

    const gated = await run(['audit', '--url', `${base}/`, '--max-pages', '1', '--fail-on', 'notice', '--baseline', join(dir, 'baseline.json'), '-o', 'json']);
    expect(gated.code).toBe(0);
    const report = JSON.parse(gated.stdout);
    expect(report.baseline.added).toEqual([]);
    expect(report.baseline.unchanged).toBeGreaterThan(0);
    expect(report.gate.passed).toBe(true);
    writeFileSync(join(dir, 'after.json'), gated.stdout);

    const same = await run(['diff', join(dir, 'baseline.json'), join(dir, 'after.json'), '--fail-on', 'notice', '-o', 'json']);
    expect(same.code).toBe(0);
    expect(JSON.parse(same.stdout).added).toEqual([]);
    rmSync(dir, { recursive: true, force: true });
  }, 120000);

  it('reads rankcli.config.json: url, ignore rules and gate rules, flags winning', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rankcli-config-'));
    writeFileSync(join(dir, 'rankcli.config.json'), JSON.stringify({ url: `${base}/`, maxPages: 1, failOn: 'error', ignore: ['TITLE_MISSING'] }));
    const gated = await run(['audit', '-o', 'json'], dir);
    expect(gated.code).toBe(1);
    const report = JSON.parse(gated.stdout);
    expect(report.config).toBe(join(dir, 'rankcli.config.json'));
    expect(report.issues.map((i: { code: string }) => i.code)).not.toContain('TITLE_MISSING');
    expect(report.ignored.map((i: { code: string }) => i.code)).toContain('TITLE_MISSING');
    expect(report.gate.failOn).toBe('error');

    const relaxed = await run(['audit', '--fail-on', 'score<0', '-o', 'json'], dir);
    expect(relaxed.code).toBe(0);

    writeFileSync(join(dir, 'rankcli.config.json'), '{ "failOn": "fatal" }');
    const broken = await run(['audit', '--url', `${base}/`, '-o', 'json'], dir);
    expect(broken.code).toBe(2);
    expect(JSON.parse(broken.stdout).error).toMatch(/failOn/);
    rmSync(dir, { recursive: true, force: true });
  }, 120000);

  it('audits a build directory with --dir, discovering pages from its sitemap', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rankcli-dist-'));
    const page = (title: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${title} - Example</title><meta name="description" content="A page about ${title} with enough words to describe it properly for the test."><link rel="canonical" href="https://example.com/${title === 'Home' ? '' : title.toLowerCase()}"></head><body><h1>${title}</h1><p>${'Content words. '.repeat(80)}</p><a href="/about">About</a> <a href="/pricing">Pricing</a></body></html>`;
    writeFileSync(join(dir, 'index.html'), page('Home'));
    mkdirSync(join(dir, 'about'));
    writeFileSync(join(dir, 'about', 'index.html'), page('About'));
    writeFileSync(join(dir, 'pricing.html'), page('Pricing'));
    writeFileSync(join(dir, 'robots.txt'), 'User-agent: *\nAllow: /\nSitemap: https://example.com/sitemap.xml\n');
    writeFileSync(join(dir, 'sitemap.xml'), '<?xml version="1.0"?><urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/pricing</loc></url><url><loc>https://example.com/about</loc></url></urlset>');

    const { code, stdout } = await run(['audit', '--dir', dir, '--url', 'https://example.com', '--max-pages', '3', '-o', 'json']);
    expect(code).toBe(0);
    const report = JSON.parse(stdout);
    expect(report.dir).toBe(dir);
    expect(report.discovery.source).toBe('sitemap');
    expect(report.pages.map((p: { url: string }) => p.url)).toEqual(['https://example.com', 'https://example.com/pricing', 'https://example.com/about']);
    expect(report.pages.every((p: { score: number }) => p.score > 0)).toBe(true);
    const codes = report.issues.map((i: { code: string }) => i.code);
    for (const hostCheck of ['HSTS_MISSING', 'UNCOMPRESSED', 'NO_CACHE', 'SECURITY_HEADERS_MISSING', 'CSP_MISSING', 'REDIRECT_CHAIN']) expect(codes).not.toContain(hostCheck);
    expect(codes).not.toContain('FETCH_ERROR');

    const missing = await run(['audit', '--dir', join(dir, 'nope'), '-o', 'json']);
    expect(missing.code).toBe(2);
    rmSync(dir, { recursive: true, force: true });
  }, 120000);

  it('exits 3 when nothing is listening', async () => {
    const dead = createServer();
    await new Promise<void>((resolve) => dead.listen(0, '127.0.0.1', () => resolve()));
    const port = (dead.address() as AddressInfo).port;
    await new Promise<void>((resolve) => dead.close(() => resolve()));

    const { code, stdout } = await run(['audit', '--url', `http://127.0.0.1:${port}/`, '--max-pages', '1', '-o', 'json']);
    expect(code).toBe(3);
    const report = JSON.parse(stdout);
    expect(report.score).toBe(0);
    expect(report.issues.map((i: { code: string }) => i.code)).toContain('FETCH_ERROR');
  }, 60000);
});
