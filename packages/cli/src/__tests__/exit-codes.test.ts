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
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CLI = join(__dirname, '..', '..', 'dist', 'index.js');
const built = existsSync(CLI);

function run(args: string[]): Promise<{ code: number | null; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const env: NodeJS.ProcessEnv = { ...process.env, RANKCLI_CONFIG_DIR: configDir, NO_COLOR: '1' };
    // Never pick up a developer's real credentials or AI keys.
    for (const key of Object.keys(env)) {
      if (key.startsWith('RANKCLI_') && key !== 'RANKCLI_CONFIG_DIR') delete env[key];
    }
    const child = spawn(process.execPath, [CLI, ...args], { env });
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

const PAGE_WITH_ERRORS = '<!doctype html><html><head></head><body><p>No title, no h1.</p></body></html>';

describe.skipIf(!built && !process.env.CI)('rankcli audit exit codes (built CLI)', () => {
  beforeAll(async () => {
    if (!built) throw new Error(`${CLI} is missing - run \`pnpm build:js\` in packages/cli first`);
    configDir = mkdtempSync(join(tmpdir(), 'rankcli-exit-codes-'));
    server = createServer((req, res) => {
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
