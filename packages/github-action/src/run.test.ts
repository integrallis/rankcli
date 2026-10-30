import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AuditReport, SiteAuditResult } from '@rankcli/agent-runtime';
import { runAction, type ActionDeps, type ApiValidationResult } from './run.js';

type Issue = { code: string; severity: string; category?: string; title?: string; affectedUrls?: string[] };

function report(overall: number, issues: Issue[]): AuditReport {
  return {
    url: 'https://example.com',
    domain: 'example.com',
    timestamp: new Date().toISOString(),
    crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
    healthScore: {
      overall, crawlability: overall, indexability: overall, onPage: overall, content: overall, links: overall,
      performance: overall, security: overall, aiReadiness: overall, social: overall, localSeo: overall, accessibility: overall,
    },
    issues: issues.map(i => ({ category: 'on-page', title: i.code, description: '', impact: '', howToFix: `fix ${i.code}`, affectedUrls: ['https://example.com/'], ...i })) as AuditReport['issues'],
    pages: [],
    summary: { errors: 0, warnings: 0, notices: 0, passed: 0 },
  };
}

function site(overall: number, issues: Issue[], extra: Partial<SiteAuditResult> = {}): SiteAuditResult {
  const primaryReport = report(overall, issues);
  return {
    primaryReport,
    issues: primaryReport.issues,
    pages: [{ url: 'https://example.com', score: overall, errors: 0, warnings: 0, notices: 0 }],
    score: overall,
    pagesAudited: 1,
    pagesDiscovered: 1,
    discovery: { source: 'none' },
    framework: null,
    pageFailure: primaryReport.issues.find(i => i.code === 'FETCH_ERROR' || i.code === 'HTTP_ERROR_STATUS'),
    checksRun: 280,
    auditMs: 1,
    ...extra,
  };
}

let cwd: string;
beforeEach(() => { cwd = mkdtempSync(join(tmpdir(), 'rankcli-action-run-')); });
afterEach(() => { rmSync(cwd, { recursive: true, force: true }); });

function makeDeps(inputs: Record<string, string>, overrides: Partial<ActionDeps> = {}) {
  const events: string[] = [];
  const outputs: Record<string, unknown> = {};
  const failures: string[] = [];
  const warnings: string[] = [];
  const annotations: Array<{ level: string; message: string; title: string; file?: string }> = [];
  const comments: string[] = [];
  const deps: ActionDeps = {
    cwd,
    getInput: (name) => inputs[name] || '',
    info: () => {},
    warning: (m) => { warnings.push(m); events.push('warning'); },
    setOutput: (name, value) => { outputs[name] = value; },
    setFailed: (m) => { failures.push(m); events.push('setFailed'); },
    validateApiKey: vi.fn(async (): Promise<ApiValidationResult> => ({ valid: true, tier: 'pro' })),
    runAudit: vi.fn(async () => { events.push('audit'); return site(90, []); }),
    writeJobSummary: vi.fn(async () => { events.push('summary'); }),
    annotate: vi.fn((level, message, props) => { annotations.push({ level, message, ...props }); events.push('annotate'); }),
    upsertPRComment: vi.fn(async (body: string) => { comments.push(body); events.push('comment'); return 'created' as const; }),
    writeFile: vi.fn(),
    sendAlert: vi.fn(async () => { events.push('alert'); }),
    ...overrides,
  };
  return { deps, events, outputs, failures, warnings, annotations, comments };
}

describe('runAction', () => {
  it('passes a clean audit and sets outputs', async () => {
    const { deps, outputs, failures } = makeDeps({ url: 'https://example.com', 'fail-on-error': 'true' });
    await runAction(deps);
    expect(failures).toEqual([]);
    expect(outputs.score).toBe(90);
    expect(outputs.passed).toBe(true);
    expect(outputs['new-issues-count']).toBe(0);
    expect(JSON.parse(String(outputs['report-json']))).toMatchObject({ url: 'https://example.com', score: 90, exitCode: 0 });
  });

  it('gates with fail-on rules, the same syntax as the CLI', async () => {
    const audit = async () => site(75, [{ code: 'TITLE_MISSING', severity: 'error' }, { code: 'W', severity: 'warning' }]);
    const a = makeDeps({ url: 'https://example.com', 'fail-on': 'error' }, { runAudit: audit });
    await runAction(a.deps);
    expect(a.failures).toEqual(['1 issue at or above fail-on error (1 error)']);

    const b = makeDeps({ url: 'https://example.com', 'fail-on': 'score<80, score:aiReadiness<80' }, { runAudit: audit });
    await runAction(b.deps);
    expect(b.failures[0]).toContain('score 75 is below the minimum 80');
    expect(b.failures[0]).toContain('aiReadiness score 75 is below its minimum 80');

    const c = makeDeps({ url: 'https://example.com', 'fail-on': 'nope' }, { runAudit: vi.fn(audit) });
    await runAction(c.deps);
    expect(c.failures[0]).toMatch(/fail-on/);
    expect(c.deps.runAudit).not.toHaveBeenCalled();
  });

  it('a PR comment that fails (read-only fork token) cannot mask a failing gate', async () => {
    const { deps, failures, warnings } = makeDeps(
      { url: 'https://example.com', 'fail-on-errors': 'true' },
      {
        runAudit: async () => site(70, [{ code: 'TITLE_MISSING', severity: 'error' }]),
        upsertPRComment: async () => { throw new Error('Resource not accessible by integration'); },
      },
    );
    await runAction(deps);
    expect(failures).toEqual(['1 issue at or above fail-on error (1 error)']);
    expect(warnings.join(' ')).toMatch(/pull-requests: write/);
  });

  it('a PR comment that fails cannot turn a passing audit into a failure', async () => {
    const { deps, failures } = makeDeps(
      { url: 'https://example.com', 'comment-on-pr': 'always' },
      { upsertPRComment: async () => { throw new Error('Resource not accessible by integration'); } },
    );
    await runAction(deps);
    expect(failures).toEqual([]);
  });

  it('decides the outputs before reporting, and fails last', async () => {
    const { deps, events } = makeDeps(
      { url: 'https://example.com', 'score-threshold': '95', 'slack-webhook': 'https://hooks.example/x', 'alert-on': 'failure' },
    );
    await runAction(deps);
    expect(events).toEqual(['audit', 'summary', 'comment', 'alert', 'setFailed']);
  });

  it('comments only on regressions by default, always or never when told', async () => {
    const clean = makeDeps({ url: 'https://example.com' });
    await runAction(clean.deps);
    expect(clean.events).not.toContain('comment');

    const failing = makeDeps({ url: 'https://example.com', 'fail-on': 'error' }, { runAudit: async () => site(70, [{ code: 'E', severity: 'error' }]) });
    await runAction(failing.deps);
    expect(failing.comments).toHaveLength(1);
    expect(failing.comments[0]).toContain('<!-- rankcli-audit -->');

    const always = makeDeps({ url: 'https://example.com', 'comment-on-pr': 'always' });
    await runAction(always.deps);
    expect(always.comments).toHaveLength(1);

    const never = makeDeps({ url: 'https://example.com', 'comment-on-pr': 'never', 'fail-on': 'error' }, { runAudit: async () => site(70, [{ code: 'E', severity: 'error' }]) });
    await runAction(never.deps);
    expect(never.comments).toHaveLength(0);
  });

  it('with a baseline, gates and comments on new findings only, and annotates them', async () => {
    writeFileSync(join(cwd, 'baseline.json'), JSON.stringify({ score: 70, issues: [{ code: 'OLD', severity: 'error', affectedUrls: ['https://example.com/'] }] }));
    const audit = async () => site(72, [{ code: 'OLD', severity: 'error' }, { code: 'NEW', severity: 'error', affectedUrls: ['https://example.com/pricing'] }]);

    const unchanged = makeDeps({ url: 'https://example.com', 'fail-on': 'error', baseline: 'baseline.json' }, { runAudit: async () => site(72, [{ code: 'OLD', severity: 'error' }]) });
    await runAction(unchanged.deps);
    expect(unchanged.failures).toEqual([]);
    expect(unchanged.comments).toHaveLength(0);
    expect(unchanged.annotations).toHaveLength(0);

    const regressed = makeDeps({ url: 'https://example.com', 'fail-on': 'error', baseline: 'baseline.json' }, { runAudit: audit });
    await runAction(regressed.deps);
    expect(regressed.failures).toEqual(['1 new issue at or above fail-on error (1 error)']);
    expect(regressed.outputs['new-issues-count']).toBe(1);
    expect(regressed.comments[0]).toContain('- `NEW` NEW (https://example.com/pricing)');
    expect(regressed.annotations).toEqual([{ level: 'error', message: 'NEW (https://example.com/pricing): fix NEW', title: 'NEW (new)', file: undefined }]);

    const missing = makeDeps({ url: 'https://example.com', baseline: 'nope.json' });
    await runAction(missing.deps);
    expect(missing.failures[0]).toMatch(/Baseline file not found/);
  });

  it('annotates errors with file locations when a build directory was audited', async () => {
    mkdirSync(join(cwd, 'dist'));
    writeFileSync(join(cwd, 'dist', 'index.html'), '<html></html>');
    const { deps, annotations, failures } = makeDeps(
      { dir: 'dist', url: 'https://example.com' },
      { runAudit: vi.fn(async () => site(80, [{ code: 'E', severity: 'error' }], { files: { 'https://example.com/': 'dist/index.html' } })) },
    );
    await runAction(deps);
    expect(failures).toEqual([]);
    expect(deps.runAudit).toHaveBeenCalledWith(expect.objectContaining({ dir: join(cwd, 'dist'), url: 'https://example.com' }));
    expect(annotations[0]).toMatchObject({ level: 'error', file: 'dist/index.html', title: 'E' });

    const nodir = makeDeps({ dir: 'out' });
    await runAction(nodir.deps);
    expect(nodir.failures[0]).toMatch(/not a directory/);
  });

  it('reads rankcli.config.json from the workspace, ignore rules included', async () => {
    writeFileSync(join(cwd, 'rankcli.config.json'), JSON.stringify({ url: 'https://file.example', failOn: 'error', ignore: ['IGNORED'], maxPages: 2 }));
    const { deps, failures, outputs } = makeDeps({}, { runAudit: vi.fn(async () => site(80, [{ code: 'IGNORED', severity: 'error' }, { code: 'W', severity: 'warning' }])) });
    await runAction(deps);
    expect(deps.runAudit).toHaveBeenCalledWith(expect.objectContaining({ url: 'https://file.example', maxPages: 2 }));
    expect(failures).toEqual([]);
    expect(outputs['issues-count']).toBe(1);
    expect(JSON.parse(String(outputs['report-json'])).ignored).toEqual([{ code: 'IGNORED' }]);
  });

  it('writes the report file when asked', async () => {
    const { deps, outputs } = makeDeps({ url: 'https://example.com', 'report-file': 'out/report.json' });
    await runAction(deps);
    expect(deps.writeFile).toHaveBeenCalledWith(join(cwd, 'out/report.json'), expect.stringContaining('"score": 90'));
    expect(outputs['report-file']).toBe(join(cwd, 'out/report.json'));
  });

  it('still audits (and gates) when the API key is rate limited', async () => {
    const { deps, events, failures } = makeDeps(
      { url: 'https://example.com', 'api-key': 'rankcli_x', 'fail-on-error': 'true' },
      {
        validateApiKey: async () => ({ valid: false, errorCode: 'rate_limited', error: 'daily API request limit reached', nextAllowedAt: '2026-09-19T00:00:00Z' }),
        runAudit: async () => { events.push('audit'); return site(50, [{ code: 'TITLE_MISSING', severity: 'error' }]); },
      },
    );
    await runAction(deps);
    expect(events).toContain('audit');
    expect(failures).toEqual(['1 issue at or above fail-on error (1 error)']);
  });

  it('fails without auditing on an invalid API key', async () => {
    const { deps, failures } = makeDeps(
      { url: 'https://example.com', 'api-key': 'rankcli_bad' },
      { validateApiKey: async () => ({ valid: false, errorCode: 'invalid_key', error: 'Invalid or revoked API key' }) },
    );
    await runAction(deps);
    expect(deps.runAudit).not.toHaveBeenCalled();
    expect(failures[0]).toContain('Invalid or revoked');
  });

  it('fails when the site could not be audited, even with no gate configured', async () => {
    const { deps, failures } = makeDeps(
      { url: 'https://example.com' },
      { runAudit: async () => site(0, [{ code: 'FETCH_ERROR', severity: 'error', category: 'indexability', title: 'Page fetch failed' }]) },
    );
    await runAction(deps);
    expect(failures[0]).toContain('could not be audited');
  });

  it('rejects an invalid url input, and needs a url or a dir', async () => {
    const { deps, failures } = makeDeps({ url: 'example.com' });
    await runAction(deps);
    expect(deps.runAudit).not.toHaveBeenCalled();
    expect(failures[0]).toContain('Invalid url');
    const none = makeDeps({});
    await runAction(none.deps);
    expect(none.failures[0]).toMatch(/`url`.*`dir`/);
  });

  it('skips the comment outside pull requests', async () => {
    const { deps, events } = makeDeps({ url: 'https://example.com', 'comment-on-pr': 'always' }, { upsertPRComment: undefined });
    await runAction(deps);
    expect(events).not.toContain('comment');
  });
});
