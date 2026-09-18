import { describe, it, expect, vi } from 'vitest';
import type { AuditReport } from '@rankcli/agent-runtime';
import { runAction, type ActionDeps, type ApiValidationResult } from './run.js';

function report(overall: number, issues: Array<{ code: string; severity: string; category?: string; title?: string }>): AuditReport {
  return {
    url: 'https://example.com',
    domain: 'example.com',
    timestamp: new Date().toISOString(),
    crawlStats: { totalUrls: 1, crawledUrls: 1, errorUrls: 0, redirectUrls: 0, blockedUrls: 0 },
    healthScore: {
      overall, crawlability: overall, indexability: overall, onPage: overall, content: overall, links: overall,
      performance: overall, security: overall, aiReadiness: overall, social: overall, localSeo: overall, accessibility: overall,
    },
    issues: issues.map(i => ({ category: 'on-page', title: i.code, description: '', impact: '', howToFix: '', ...i })) as AuditReport['issues'],
    pages: [],
    summary: { errors: 0, warnings: 0, notices: 0, passed: 0 },
  };
}

function makeDeps(inputs: Record<string, string>, overrides: Partial<ActionDeps> = {}) {
  const events: string[] = [];
  const outputs: Record<string, unknown> = {};
  const failures: string[] = [];
  const warnings: string[] = [];
  const deps: ActionDeps = {
    getInput: (name) => inputs[name] || '',
    info: () => {},
    warning: (m) => { warnings.push(m); events.push('warning'); },
    setOutput: (name, value) => { outputs[name] = value; },
    setFailed: (m) => { failures.push(m); events.push('setFailed'); },
    validateApiKey: vi.fn(async (): Promise<ApiValidationResult> => ({ valid: true, tier: 'pro' })),
    runAudit: vi.fn(async () => { events.push('audit'); return report(90, []); }),
    writeJobSummary: vi.fn(async () => { events.push('summary'); }),
    postPRComment: vi.fn(async () => { events.push('comment'); }),
    sendAlert: vi.fn(async () => { events.push('alert'); }),
    ...overrides,
  };
  return { deps, events, outputs, failures, warnings };
}

describe('runAction', () => {
  it('passes a clean audit and sets outputs', async () => {
    const { deps, outputs, failures } = makeDeps({ url: 'https://example.com', 'fail-on-error': 'true' });
    await runAction(deps);
    expect(failures).toEqual([]);
    expect(outputs.score).toBe(90);
    expect(outputs.passed).toBe(true);
  });

  it('a PR comment that fails (read-only fork token) cannot mask a failing gate', async () => {
    const { deps, failures, warnings } = makeDeps(
      { url: 'https://example.com', 'fail-on-errors': 'true' },
      {
        runAudit: async () => report(70, [{ code: 'TITLE_MISSING', severity: 'error' }]),
        postPRComment: async () => { throw new Error('Resource not accessible by integration'); },
      },
    );
    await runAction(deps);
    expect(failures).toEqual(['SEO audit found 1 error']);
    expect(warnings.join(' ')).toMatch(/pull-requests: write/);
  });

  it('a PR comment that fails cannot turn a passing audit into a failure', async () => {
    const { deps, failures } = makeDeps(
      { url: 'https://example.com' },
      { postPRComment: async () => { throw new Error('Resource not accessible by integration'); } },
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

  it('still audits (and gates) when the API key is rate limited', async () => {
    const { deps, events, failures } = makeDeps(
      { url: 'https://example.com', 'api-key': 'rankcli_x', 'fail-on-error': 'true' },
      {
        validateApiKey: async () => ({ valid: false, errorCode: 'rate_limited', error: 'daily API request limit reached', nextAllowedAt: '2026-09-19T00:00:00Z' }),
        runAudit: async () => { events.push('audit'); return report(50, [{ code: 'TITLE_MISSING', severity: 'error' }]); },
      },
    );
    await runAction(deps);
    expect(events).toContain('audit');
    expect(failures).toEqual(['SEO audit found 1 error']);
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
      { runAudit: async () => report(0, [{ code: 'FETCH_ERROR', severity: 'error', category: 'indexability', title: 'Page fetch failed' }]) },
    );
    await runAction(deps);
    expect(failures[0]).toContain('could not be audited');
  });

  it('rejects an invalid url input', async () => {
    const { deps, failures } = makeDeps({ url: 'example.com' });
    await runAction(deps);
    expect(deps.runAudit).not.toHaveBeenCalled();
    expect(failures[0]).toContain('Invalid url');
  });

  it('skips the comment outside pull requests', async () => {
    const { deps, events } = makeDeps({ url: 'https://example.com' }, { postPRComment: undefined });
    await runAction(deps);
    expect(events).not.toContain('comment');
  });
});
