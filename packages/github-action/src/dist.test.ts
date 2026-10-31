/**
 * Smoke test of what actually ships: runs the ncc bundle (dist/index.js)
 * the way the Actions runner does - inputs as INPUT_* env vars, outputs
 * via the GITHUB_OUTPUT file - against a local HTTP server.
 *
 * Needs `pnpm build` first. Skipped locally when dist/ is missing; in CI
 * (CI=true) a missing build fails instead.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const DIST = join(__dirname, '..', 'dist', 'index.js');
const built = existsSync(DIST);

let server: Server;
let base = '';
let tmp = '';

function runAction(inputs: Record<string, string>, extraEnv: Record<string, string> = {}): Promise<{ code: number | null; outputs: string; stdout: string }> {
  const outputFile = join(tmp, `output-${Math.random().toString(36).slice(2)}`);
  const summaryFile = join(tmp, `summary-${Math.random().toString(36).slice(2)}`);
  writeFileSync(outputFile, '');
  writeFileSync(summaryFile, '');
  const env: NodeJS.ProcessEnv = { PATH: process.env.PATH, GITHUB_OUTPUT: outputFile, GITHUB_STEP_SUMMARY: summaryFile, ...extraEnv };
  for (const [name, value] of Object.entries(inputs)) env[`INPUT_${name.toUpperCase()}`] = value;
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [DIST], { env });
    let stdout = '';
    child.stdout.on('data', (d) => { stdout += d; });
    child.stderr.on('data', (d) => { stdout += d; });
    child.on('close', (code) => resolve({ code, outputs: readFileSync(outputFile, 'utf8'), stdout }));
  });
}

describe.skipIf(!built && !process.env.CI)('built action (dist/index.js)', () => {
  beforeAll(async () => {
    if (!built) throw new Error(`${DIST} is missing - run \`pnpm build\` in packages/github-action first`);
    tmp = mkdtempSync(join(tmpdir(), 'rankcli-action-'));
    server = createServer((req, res) => {
      if (req.url === '/down') {
        res.writeHead(503, { 'content-type': 'text/html' });
        res.end('<html><body>down</body></html>');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html' });
      res.end('<!doctype html><html><head></head><body><p>No title here.</p></body></html>');
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server?.close(() => resolve()));
    if (tmp) rmSync(tmp, { recursive: true, force: true });
  });

  it('audits and passes with no gate configured', async () => {
    const { code, outputs } = await runAction({ url: `${base}/`, 'comment-on-pr': 'true' });
    expect(code).toBe(0);
    expect(outputs).toMatch(/^score<<|^score=/m);
    expect(outputs).toContain('passed');
  }, 60000);

  it('fails the step with fail-on-errors (the documented spelling)', async () => {
    const { code, stdout } = await runAction({ url: `${base}/`, 'fail-on-errors': 'true' });
    expect(code).toBe(1);
    expect(stdout).toMatch(/::error::\d+ issues? at or above fail-on error/);
  }, 60000);

  it('fails the step with fail-on rules and annotates the findings', async () => {
    const { code, stdout, outputs } = await runAction({ url: `${base}/`, 'fail-on': 'error,score<100' });
    expect(code).toBe(1);
    expect(stdout).toMatch(/::error title=[A-Z_]+::/);
    expect(stdout).toContain('is below the minimum 100');
    expect(outputs).toMatch(/^new-issues-count<<|^new-issues-count=/m);
  }, 60000);

  it('audits a build directory with dir, discovering pages from its sitemap', async () => {
    const dist = join(tmp, 'dist');
    mkdirSync(join(dist, 'about'), { recursive: true });
    const page = (t: string) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${t} - Example</title><meta name="description" content="About ${t}, in enough words for a description."></head><body><h1>${t}</h1><p>${'Words here. '.repeat(60)}</p><a href="/about">About</a></body></html>`;
    writeFileSync(join(dist, 'index.html'), page('Home'));
    writeFileSync(join(dist, 'about', 'index.html'), page('About'));
    writeFileSync(join(dist, 'sitemap.xml'), '<urlset><url><loc>https://example.com/</loc></url><url><loc>https://example.com/about</loc></url></urlset>');
    writeFileSync(join(dist, 'robots.txt'), 'User-agent: *\nAllow: /\n');
    const { code, outputs } = await runAction({ dir: dist, url: 'https://example.com', 'max-pages': '2', 'report-file': join(tmp, 'report.json') }, { GITHUB_WORKSPACE: tmp });
    expect(code).toBe(0);
    const report = JSON.parse(readFileSync(join(tmp, 'report.json'), 'utf8'));
    expect(report.discovery.source).toBe('sitemap');
    expect(report.pages.map((p: { url: string }) => p.url)).toEqual(['https://example.com', 'https://example.com/about']);
    expect(outputs).toMatch(/^report-file<<|^report-file=/m);
  }, 90000);

  it('masks the API key in the logs, even passed as plain text', async () => {
    // The key check goes to the local server, never to RankCLI's real API.
    const { stdout } = await runAction({ url: `${base}/`, 'api-key': 'rk_plaintext_secret_123' }, { RANKCLI_API_URL: base });
    expect(stdout).toContain('::add-mask::rk_plaintext_secret_123');
  }, 60000);

  // The Action runs the same audit as `rankcli audit`, every check included (until 2026-10 the
  // 21 "premium" checks were left out, so the Action scored a site differently from the CLI).
  // Nothing secret may ride along in the bundle.
  it('carries every check and nothing that looks like a secret', () => {
    const dir = join(__dirname, '..', 'dist');
    const bundle = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    for (const formerlyEncrypted of ['Commercial page without clear CTA', 'Service page lacks interactive tools', 'Content at risk of AI overview displacement']) {
      expect(bundle).toContain(formerlyEncrypted);
    }
    for (const secret of [/sk_(live|test)_[A-Za-z0-9]{10,}/, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /whsec_[A-Za-z0-9]{10,}/, /"role"\s*:\s*"service_role"/]) {
      expect(bundle).not.toMatch(secret);
    }
  });

  it('fails the step when the site answers 503', async () => {
    const { code, stdout } = await runAction({ url: `${base}/down` });
    expect(code).toBe(1);
    expect(stdout).toContain('could not be audited');
  }, 60000);
});
