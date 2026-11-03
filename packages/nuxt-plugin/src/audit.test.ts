import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The engine audit is mocked: the real one serves the directory and runs 280 checks, which is
// the engine's own test suite's job. parseFailOn and evaluateGate stay real.
const auditSite = vi.fn();
vi.mock('@rankcli/agent-runtime', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@rankcli/agent-runtime')>()),
  auditSite: (...args: unknown[]) => auditSite(...args),
}));
import { auditBuildOutput } from './audit.js';

const result = (score: number, issues: Array<{ code: string; severity: string; affectedUrls?: string[] }>) => ({
  score,
  pagesAudited: 2,
  issues: issues.map(i => ({ category: 'on-page', title: `Title ${i.code}`, description: '', impact: '', howToFix: '', affectedUrls: ['https://example.com/'], ...i })),
  primaryReport: { healthScore: { overall: score, crawlability: score, indexability: score, onPage: score, content: score, links: score, performance: score, security: score, aiReadiness: score, social: score, localSeo: score, accessibility: score } },
});

describe('auditBuildOutput', () => {
  let dir: string;
  const logs: string[] = [];
  const warns: string[] = [];
  const run = (over: Partial<Parameters<typeof auditBuildOutput>[0]> = {}) =>
    auditBuildOutput({ siteUrl: 'https://example.com', dir, pageCount: 2, log: m => logs.push(m), warn: m => warns.push(m), ...over });

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'nuxt-rankcli-'));
    writeFileSync(join(dir, 'index.html'), '<html><head><title>x</title></head><body><h1>x</h1></body></html>');
    logs.length = 0;
    warns.length = 0;
    auditSite.mockReset();
    auditSite.mockImplementation(async () => result(90, []));
  });
  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('serves the directory as the site and audits every built page by default', async () => {
    const outcome = await run();
    expect(auditSite).toHaveBeenCalledWith({ url: 'https://example.com', dir, maxPages: 2, staticBuild: true });
    expect(outcome).toEqual({ score: 90, pagesAudited: 2, errors: 0, warnings: 0, notices: 0 });
    expect(logs.some(l => /RankCLI score 90\/100 across 2 pages: 0 errors, 0 warnings, 0 notices/.test(l))).toBe(true);
  });

  it('lists errors and warnings with their codes and counts the notices', async () => {
    auditSite.mockImplementation(async () => result(70, [
      { code: 'TITLE_MISSING', severity: 'error', affectedUrls: ['https://example.com/about/'] },
      { code: 'META_DESC_SHORT', severity: 'warning', affectedUrls: ['https://example.com/', 'https://example.com/about/'] },
      { code: 'LLMS_TXT_MISSING', severity: 'notice' },
    ]));
    const outcome = await run({ maxPages: 1 });
    expect(auditSite).toHaveBeenCalledWith(expect.objectContaining({ maxPages: 1 }));
    expect(outcome).toMatchObject({ errors: 1, warnings: 1, notices: 1 });
    expect(warns).toContain('  error [TITLE_MISSING] Title TITLE_MISSING (/about/)');
    expect(warns).toContain('  warn  [META_DESC_SHORT] Title META_DESC_SHORT (2 pages)');
    expect(logs.some(l => /1 notice not listed/.test(l))).toBe(true);
  });

  it('fails the build on the gate rules of rankcli audit --fail-on', async () => {
    auditSite.mockImplementation(async () => result(70, [{ code: 'META_DESC_SHORT', severity: 'warning' }]));
    await expect(run({ failOn: 'error' })).resolves.toBeTruthy();
    await expect(run({ failOn: ['error', 'score<80'] })).rejects.toThrow(/RankCLI gate failed: .*score 70/);
    await expect(run({ failOn: 'warning' })).rejects.toThrow(/warning|META_DESC_SHORT/);
    await expect(run({ failOn: 'severe' })).rejects.toThrow(/invalid failOn/);
  });

  it('warns and returns null when the engine could not audit', async () => {
    auditSite.mockImplementation(async () => null);
    expect(await run()).toBeNull();
    expect(warns[0]).toMatch(/could not run/);
  });
});
