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
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
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
    expect(stdout).toContain('::error::SEO audit found');
  }, 60000);

  it('masks the API key in the logs, even passed as plain text', async () => {
    // The key check goes to the local server, never to RankCLI's real API.
    const { stdout } = await runAction({ url: `${base}/`, 'api-key': 'rk_plaintext_secret_123' }, { RANKCLI_API_URL: base });
    expect(stdout).toContain('::add-mask::rk_plaintext_secret_123');
  }, 60000);

  // The public repo gets this bundle. Premium check implementations stay private (they ship
  // only in the hosted worker), and nothing secret may ride along.
  it('carries no premium check code and nothing that looks like a secret', () => {
    const dir = join(__dirname, '..', 'dist');
    const bundle = readdirSync(dir).filter((f) => f.endsWith('.js')).map((f) => readFileSync(join(dir, f), 'utf8')).join('\n');
    for (const premiumOnly of ['Commercial page without clear CTA', 'Service page lacks interactive tools', 'Content at risk of AI overview displacement']) {
      expect(bundle).not.toContain(premiumOnly);
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
