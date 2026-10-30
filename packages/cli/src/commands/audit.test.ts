import { describe, it, expect, beforeEach, afterEach, vi, type MockInstance } from 'vitest';

// Mock chalk with chainable methods
vi.mock('chalk', () => {
  const passthrough = (s: string) => s;
  const createMethod = () => {
    const fn = Object.assign(passthrough, {
      cyan: passthrough,
      green: passthrough,
      yellow: passthrough,
      red: passthrough,
      dim: passthrough,
      bold: passthrough,
      gray: passthrough,
      white: passthrough,
      bgGreen: passthrough,
      bgYellow: passthrough,
      bgRed: passthrough,
      blue: passthrough,
      magenta: passthrough,
    });
    return fn;
  };
  return {
    default: {
      cyan: createMethod(),
      green: createMethod(),
      yellow: createMethod(),
      red: createMethod(),
      dim: createMethod(),
      bold: createMethod(),
      gray: createMethod(),
      white: createMethod(),
      bgGreen: createMethod(),
      bgYellow: createMethod(),
      bgRed: createMethod(),
      blue: createMethod(),
      magenta: createMethod(),
    },
  };
});

// Mock ora
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

// The engine's site audit is mocked at the page level: `mockRunFullAudit` plays the engine
// for the one page, and `auditSite` wraps its report the way the real pipeline does. The
// rest of the runtime (gate rules, baselines, SARIF, JUnit) is real.
const mockRunFullAudit = vi.fn();

vi.mock('@rankcli/agent-runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@rankcli/agent-runtime')>();
  return {
    ...actual,
    auditSite: async (options: { url: string; checksLimit?: number; dir?: string; headers?: Record<string, string> }) => {
      const report = await mockRunFullAudit({ url: options.url, auditRootUrl: options.url, maxPages: 1, checksLimit: options.checksLimit, staticBuild: !!options.dir, headers: options.headers });
      if (!report) return null;
      const issues = (report.issues ?? []).map((i: Record<string, unknown>) => ({ affectedUrls: [options.url], ...i }));
      const pageFailure = issues.find((i: { code: string }) => i.code === 'FETCH_ERROR' || i.code === 'HTTP_ERROR_STATUS');
      const score = report.healthScore?.overall ?? 0;
      return {
        primaryReport: report,
        issues,
        pages: [{ url: options.url, score, errors: 0, warnings: 0, notices: 0 }],
        score,
        pagesAudited: 1,
        pagesDiscovered: 1,
        discovery: { source: 'none' },
        framework: null,
        pageFailure,
        checksRun: 280,
        auditMs: 1,
      };
    },
  };
});

// Mock config
const mockIsLoggedIn = vi.fn();
const mockGetUserInfo = vi.fn();
const mockIsApiKeyAuth = vi.fn();
const mockGetApiKey = vi.fn();
const mockGetSession = vi.fn();

vi.mock('../lib/config.js', () => ({
  isLoggedIn: () => mockIsLoggedIn(),
  getUserInfo: () => mockGetUserInfo(),
  WEB_APP_URL: 'http://localhost:3005',
  isApiKeyAuth: () => mockIsApiKeyAuth(),
  getApiKey: () => mockGetApiKey(),
  getSession: () => mockGetSession(),
  getApiUrl: () => 'http://localhost:3005',
  ensureApiKeyPlan: () => mockEnsureApiKeyPlan(),
}));

const mockEnsureApiKeyPlan = vi.fn();

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Import after mocks
import { audit, parseGateOptions, parseHeaderOptions, EXIT_CODES } from './audit.js';
import { evaluateGate } from '@rankcli/agent-runtime';

const baseReport = {
  url: 'https://example.com',
  issues: [],
  healthScore: { overall: 85, crawlability: 90, onPage: 85, content: 80, performance: 88, security: 82, aiReadiness: 70 },
  pages: [],
  summary: { errors: 0, warnings: 0, notices: 0, passed: 280 },
  timestamp: Date.now(),
};

describe('Audit Command', () => {
  let consoleLogSpy: MockInstance<any[], any>;
  let consoleErrorSpy: MockInstance<any[], any>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    // Default mocks
    mockIsLoggedIn.mockReturnValue(false);
    mockGetUserInfo.mockReturnValue({ planName: 'Free', sitesLimit: 1 });
    mockIsApiKeyAuth.mockReturnValue(false);
    mockGetApiKey.mockReturnValue(null);
    mockGetSession.mockResolvedValue(null);
    mockEnsureApiKeyPlan.mockResolvedValue(null);
    mockRunFullAudit.mockResolvedValue(baseReport);
    mockFetch.mockResolvedValue({
      ok: true,
      text: () => Promise.resolve('<html><body>Test</body></html>'),
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('URL validation', () => {
    it('shows usage and exits 2 when no URL provided', async () => {
      const code = await audit({ url: '' });

      expect(code).toBe(EXIT_CODES.USAGE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Please provide a URL')
      );
    });

    it('rejects invalid URLs with exit 2', async () => {
      const code = await audit({ url: 'not-a-url' });

      expect(code).toBe(EXIT_CODES.USAGE);
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid URL')
      );
      expect(mockRunFullAudit).not.toHaveBeenCalled();
    });

    it('suggests login for non-logged-in users in usage', async () => {
      mockIsLoggedIn.mockReturnValue(false);

      await audit({ url: '' });

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('rankcli login')
      );
    });

    it('prints a JSON error (not nothing) for a usage error in JSON mode', async () => {
      const code = await audit({ url: 'ftp://example.com', output: 'json' });

      expect(code).toBe(EXIT_CODES.USAGE);
      const parsed = JSON.parse(consoleLogSpy.mock.calls[0][0] as string);
      expect(parsed.exitCode).toBe(EXIT_CODES.USAGE);
      expect(parsed.error).toMatch(/Invalid URL/);
    });
  });

  describe('audit execution', () => {
    const mockReport = {
      url: 'https://example.com',
      issues: [],
      healthScore: {
        overall: 85,
        crawlability: 90,
        onPage: 85,
        content: 80,
        performance: 88,
        security: 82,
      },
      pageResults: [],
      timestamp: Date.now(),
    };

    it('runs audit for valid URL', async () => {
      mockRunFullAudit.mockResolvedValue(mockReport);

      await audit({ url: 'https://example.com' });

      expect(mockRunFullAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
        })
      );
    });

    it('exits 3 (not 0) when no page could be audited', async () => {
      mockRunFullAudit.mockRejectedValue(new Error('Network error'));

      await expect(audit({ url: 'https://example.com' })).resolves.toBe(EXIT_CODES.AUDIT_FAILED);
    });

    it('exits 0 for a completed audit without gate flags, even with errors', async () => {
      mockRunFullAudit.mockResolvedValue({
        ...mockReport,
        issues: [{ code: 'TITLE_MISSING', severity: 'error', category: 'on-page', title: 'Missing title tag' }],
      });

      await expect(audit({ url: 'https://example.com' })).resolves.toBe(EXIT_CODES.OK);
    });

    it('exits 3 when the site is unreachable, even without gate flags', async () => {
      mockRunFullAudit.mockResolvedValue({
        ...mockReport,
        healthScore: { overall: 0 },
        issues: [{ code: 'FETCH_ERROR', severity: 'error', category: 'indexability', title: 'Page fetch failed', description: 'ECONNREFUSED' }],
      });

      await expect(audit({ url: 'https://example.com' })).resolves.toBe(EXIT_CODES.AUDIT_FAILED);
    });

    it('exits 3 when the audited URL answers 5xx', async () => {
      mockRunFullAudit.mockResolvedValue({
        ...mockReport,
        healthScore: { overall: 0 },
        issues: [{ code: 'HTTP_ERROR_STATUS', severity: 'error', category: 'indexability', title: 'Page returns HTTP 500', description: '' }],
      });

      await expect(audit({ url: 'https://example.com', output: 'json' })).resolves.toBe(EXIT_CODES.AUDIT_FAILED);
      const parsed = JSON.parse(consoleLogSpy.mock.calls.at(-1)![0] as string);
      expect(parsed.exitCode).toBe(EXIT_CODES.AUDIT_FAILED);
      expect(parsed.error).toBe('Page returns HTTP 500');
    });
  });

  describe('the JSON document', () => {
    it('carries the timestamp, the CLI version and a per-page breakdown', async () => {
      await audit({ url: 'https://example.com', output: 'json' });
      const parsed = JSON.parse(consoleLogSpy.mock.calls.at(-1)![0] as string);
      expect(parsed.cliVersion).toMatch(/^\d+\.\d+\.\d+/);
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
      expect(parsed.pages.length).toBeGreaterThan(0);
      expect(parsed.pages[0]).toMatchObject({ url: 'https://example.com', score: expect.any(Number), errors: expect.any(Number), warnings: expect.any(Number), notices: expect.any(Number) });
      expect(parsed.checksRun).toBeGreaterThan(0);
    });
  });

  describe('the account box', () => {
    it('is not printed under a CI gate', async () => {
      mockIsLoggedIn.mockReturnValue(false);
      await audit({ url: 'https://example.com', failOn: 'notice' });
      const printed = consoleLogSpy.mock.calls.map(c => String(c[0])).join('\n');
      expect(printed).not.toContain('Keep this site audited');
    });
  });

  describe('CI gates', () => {
    const reportWith = (overall: number, severities: string[]) => ({
      url: 'https://example.com',
      issues: severities.map((severity, i) => ({ code: `ISSUE_${i}`, severity, category: 'on-page', title: `Issue ${i}` })),
      healthScore: { overall },
      pages: [],
      timestamp: Date.now(),
    });

    it('--fail-on error exits 1 when an error is present', async () => {
      mockRunFullAudit.mockResolvedValue(reportWith(90, ['error', 'warning']));
      await expect(audit({ url: 'https://example.com', failOn: 'error' })).resolves.toBe(EXIT_CODES.GATE_FAILED);
    });

    it('--fail-on error exits 0 when there are only warnings', async () => {
      mockRunFullAudit.mockResolvedValue(reportWith(90, ['warning', 'notice']));
      await expect(audit({ url: 'https://example.com', failOn: 'error' })).resolves.toBe(EXIT_CODES.OK);
    });

    it('--fail-on warning also trips on errors', async () => {
      mockRunFullAudit.mockResolvedValue(reportWith(90, ['error']));
      await expect(audit({ url: 'https://example.com', failOn: 'warning' })).resolves.toBe(EXIT_CODES.GATE_FAILED);
    });

    it('--min-score exits 1 below the threshold and 0 at it', async () => {
      mockRunFullAudit.mockResolvedValue(reportWith(79, []));
      await expect(audit({ url: 'https://example.com', minScore: '80' })).resolves.toBe(EXIT_CODES.GATE_FAILED);
      mockRunFullAudit.mockResolvedValue(reportWith(80, []));
      await expect(audit({ url: 'https://example.com', minScore: '80' })).resolves.toBe(EXIT_CODES.OK);
    });

    it('rejects invalid gate values with exit 2 before auditing', async () => {
      await expect(audit({ url: 'https://example.com', failOn: 'fatal' })).resolves.toBe(EXIT_CODES.USAGE);
      await expect(audit({ url: 'https://example.com', minScore: 'high' })).resolves.toBe(EXIT_CODES.USAGE);
      await expect(audit({ url: 'https://example.com', minScore: '101' })).resolves.toBe(EXIT_CODES.USAGE);
      expect(mockRunFullAudit).not.toHaveBeenCalled();
    });

    it('reports the gate result in JSON output', async () => {
      mockRunFullAudit.mockResolvedValue(reportWith(50, ['error']));
      const code = await audit({ url: 'https://example.com', output: 'json', failOn: 'error', minScore: '60' });

      expect(code).toBe(EXIT_CODES.GATE_FAILED);
      const parsed = JSON.parse(consoleLogSpy.mock.calls.at(-1)![0] as string);
      expect(parsed.exitCode).toBe(1);
      expect(parsed.gate.passed).toBe(false);
      expect(parsed.gate.failures).toHaveLength(2);
    });

    it('evaluateGate and parseGateOptions agree on thresholds', () => {
      const issues = [{ code: 'A', severity: 'notice' }] as never[];
      expect(evaluateGate(parseGateOptions({ failOn: 'notice' }).spec, issues, { overall: 100 }).passed).toBe(false);
      expect(evaluateGate(parseGateOptions({ failOn: 'warning' }).spec, issues, { overall: 100 }).passed).toBe(true);
      expect(parseGateOptions({ failOn: 'ERROR' }).failOn).toBe('error');
      expect(parseGateOptions({ minScore: '0' }).minScore).toBe(0);
      expect(parseGateOptions({ failOn: ['error', 'score:aiReadiness<70'], minScore: '80' }).spec.budgets).toEqual([
        { category: 'aiReadiness', min: 70 }, { category: 'overall', min: 80 },
      ]);
    });

    it('--fail-on score:<category> gates on that category', async () => {
      mockRunFullAudit.mockResolvedValue({ ...reportWith(90, []), healthScore: { overall: 90, aiReadiness: 61 } });
      await expect(audit({ url: 'https://example.com', failOn: ['score:aiReadiness<70'] })).resolves.toBe(EXIT_CODES.GATE_FAILED);
      await expect(audit({ url: 'https://example.com', failOn: ['score:aiReadiness<60'] })).resolves.toBe(EXIT_CODES.OK);
    });

    it('--baseline makes --fail-on count only new issues, and the JSON says what changed', async () => {
      const { writeFileSync, mkdtempSync } = await import('node:fs');
      const { tmpdir } = await import('node:os');
      const { join } = await import('node:path');
      const dir = mkdtempSync(join(tmpdir(), 'rankcli-baseline-'));
      const file = join(dir, 'baseline.json');
      writeFileSync(file, JSON.stringify({ score: 70, issues: [{ code: 'OLD', severity: 'error', category: 'on-page', title: 'Old', affectedUrls: ['https://example.com'] }] }));

      mockRunFullAudit.mockResolvedValue({ ...reportWith(90, []), issues: [{ code: 'OLD', severity: 'error', category: 'on-page', title: 'Old' }] });
      await expect(audit({ url: 'https://example.com', failOn: 'error', baseline: file })).resolves.toBe(EXIT_CODES.OK);

      mockRunFullAudit.mockResolvedValue({ ...reportWith(90, []), issues: [{ code: 'OLD', severity: 'error', category: 'on-page', title: 'Old' }, { code: 'NEW', severity: 'error', category: 'on-page', title: 'New' }] });
      const code = await audit({ url: 'https://example.com', output: 'json', failOn: 'error', baseline: file });
      expect(code).toBe(EXIT_CODES.GATE_FAILED);
      const parsed = JSON.parse(consoleLogSpy.mock.calls.at(-1)![0] as string);
      expect(parsed.baseline.added.map((i: { code: string }) => i.code)).toEqual(['NEW']);
      expect(parsed.baseline.unchanged).toBe(1);
      expect(parsed.gate.failures[0]).toMatch(/1 new issue/);

      await expect(audit({ url: 'https://example.com', baseline: join(dir, 'missing.json') })).resolves.toBe(EXIT_CODES.USAGE);
    });

    it('rejects an unknown output format and a malformed header with exit 2', async () => {
      await expect(audit({ url: 'https://example.com', output: 'yaml' })).resolves.toBe(EXIT_CODES.USAGE);
      await expect(audit({ url: 'https://example.com', header: ['nocolon'] })).resolves.toBe(EXIT_CODES.USAGE);
      expect(mockRunFullAudit).not.toHaveBeenCalled();
      expect(parseHeaderOptions(['Authorization: Bearer x'], ['a=1', 'b=2']).headers).toEqual({ Authorization: 'Bearer x', Cookie: 'a=1; b=2' });
      expect(parseHeaderOptions([], ['nope']).error).toMatch(/cookie/);
    });

    it('passes --header and --cookie to the site audit', async () => {
      await audit({ url: 'https://example.com', header: ['X-Token: abc'], cookie: ['s=1'] });
      expect(mockRunFullAudit).toHaveBeenCalledWith(expect.objectContaining({ headers: { 'X-Token': 'abc', Cookie: 's=1' } }));
    });
  });

  describe('machine formats', () => {
    it('writes a SARIF document with one result per issue, on failure too', async () => {
      mockRunFullAudit.mockResolvedValue({ ...baseReport, issues: [{ code: 'TITLE_MISSING', severity: 'error', category: 'on-page', title: 'Missing title', description: '', impact: '', howToFix: 'Add one' }] });
      await expect(audit({ url: 'https://example.com', output: 'sarif', failOn: 'error' })).resolves.toBe(EXIT_CODES.GATE_FAILED);
      const sarif = JSON.parse(consoleLogSpy.mock.calls.at(-1)![0] as string);
      expect(sarif.version).toBe('2.1.0');
      expect(sarif.runs[0].results).toHaveLength(1);
      expect(sarif.runs[0].results[0].ruleId).toBe('TITLE_MISSING');
      expect(sarif.runs[0].invocations[0].exitCode).toBe(1);

      await expect(audit({ url: 'ftp://x', output: 'sarif' })).resolves.toBe(EXIT_CODES.USAGE);
      const failed = JSON.parse(consoleLogSpy.mock.calls.at(-1)![0] as string);
      expect(failed.runs[0].invocations[0].executionSuccessful).toBe(false);
    });

    it('writes a JUnit document', async () => {
      mockRunFullAudit.mockResolvedValue({ ...baseReport, issues: [{ code: 'TITLE_MISSING', severity: 'error', category: 'on-page', title: 'Missing title', description: '', impact: '', howToFix: 'Add one' }] });
      await expect(audit({ url: 'https://example.com', output: 'junit' })).resolves.toBe(EXIT_CODES.OK);
      const xml = consoleLogSpy.mock.calls.at(-1)![0] as string;
      expect(xml).toContain('<testsuites name="rankcli"');
      expect(xml).toContain('<failure message="Missing title" type="error">');
    });
  });

  describe('plan resolution', () => {
    it('resolves the API key plan before choosing the tier', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      mockGetUserInfo.mockReturnValue({ planId: 'pro_annual', planName: 'Pro' });
      mockRunFullAudit.mockResolvedValue({ url: 'https://example.com', issues: [], healthScore: { overall: 90 }, pages: [] });

      await audit({ url: 'https://example.com' });

      expect(mockEnsureApiKeyPlan).toHaveBeenCalled();
      // pro_annual is the Pro tier (280 checks), not an unknown plan falling back to Free.
      expect(mockRunFullAudit).toHaveBeenCalledWith(expect.objectContaining({ checksLimit: 280 }));
    });
  });

  describe('output formats', () => {
    const mockReport = {
      url: 'https://example.com',
      issues: [
        {
          code: 'missing-title',
          severity: 'error' as const,
          category: 'meta',
          title: 'Missing title tag',
        },
      ],
      healthScore: { overall: 75 },
      pageResults: [],
      timestamp: Date.now(),
    };

    it('outputs JSON when format is json', async () => {
      mockRunFullAudit.mockResolvedValue(mockReport);

      await audit({ url: 'https://example.com', output: 'json' });

      // Should output valid JSON
      const jsonCalls = consoleLogSpy.mock.calls.filter((call) => {
        try {
          JSON.parse(call[0] as string);
          return true;
        } catch {
          return false;
        }
      });
      expect(jsonCalls.length).toBeGreaterThan(0);
    });
  });
});

describe('Cloud Sync Integration', () => {
  let consoleLogSpy: MockInstance<any[], any>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    mockRunFullAudit.mockResolvedValue(baseReport);
    mockIsApiKeyAuth.mockReturnValue(false);
    mockGetApiKey.mockReturnValue(null);
    mockGetSession.mockResolvedValue(null);
    mockEnsureApiKeyPlan.mockResolvedValue(null);
    // Default fetch mock: page-content fetches get raw HTML, the
    // sync-audit edge function call (see syncToCloud in audit.ts) gets a
    // successful { projectId, auditId } response - tests that need a
    // different sync-audit outcome (limit reached, network error, etc.)
    // override this per-test.
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('sync-audit')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ projectId: 'proj-test', auditId: 'audit-test' }),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('<html><body>Test</body></html>'),
      });
    });
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
  });

  // syncToCloud() (audit.ts) authenticates via isApiKeyAuth()/getApiKey()
  // or getSession() - not getAuthenticatedClient(), which the sync path
  // stopped using because RLS-based direct writes silently did nothing
  // for API-key users (see the comment on syncToCloud). These tests
  // exercise that real path: a session token, and the sync-audit edge
  // function call made via the mocked global fetch.
  const withSession = () => mockGetSession.mockResolvedValue({ access_token: 'test-token' });
  const syncAuditCalls = () => mockFetch.mock.calls.filter(([url]) => String(url).includes('sync-audit'));

  it('skips cloud sync when not logged in', async () => {
    mockIsLoggedIn.mockReturnValue(false);
    mockRunFullAudit.mockResolvedValue({
      url: 'https://example.com',
      issues: [],
      healthScore: { overall: 85 },
      pageResults: [],
      timestamp: Date.now(),
    });

    await audit({ url: 'https://example.com' });

    // Should never call the sync-audit endpoint
    expect(syncAuditCalls().length).toBe(0);
  });

  it('attempts sync when logged in', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    mockGetUserInfo.mockReturnValue({
      userId: 'user-123',
      email: 'test@example.com',
      planName: 'Pro',
      sitesLimit: 10,
    });
    withSession();

    mockRunFullAudit.mockResolvedValue({
      url: 'https://example.com',
      issues: [],
      healthScore: { overall: 90 },
      pageResults: [],
      timestamp: Date.now(),
    });

    await audit({ url: 'https://example.com' });

    expect(syncAuditCalls().length).toBe(1);
  });

  it('shows dashboard link after sync', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    mockGetUserInfo.mockReturnValue({
      userId: 'user-123',
      sitesLimit: 10,
    });
    withSession();

    mockRunFullAudit.mockResolvedValue({
      url: 'https://example.com',
      issues: [],
      healthScore: { overall: 95 },
      pageResults: [],
      timestamp: Date.now(),
    });

    await audit({ url: 'https://example.com' });

    // Should show dashboard link
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('localhost:3005')
    );
  });

  it('handles project limit gracefully', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    mockGetUserInfo.mockReturnValue({
      userId: 'user-free',
      planName: 'Free',
      sitesLimit: 1,
    });
    withSession();

    // sync-audit rejects with the same shape the real edge function
    // returns once a plan's project limit is reached.
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('sync-audit')) {
        return Promise.resolve({
          ok: false,
          json: () => Promise.resolve({ error: 'project_limit_reached', count: 1, limit: 1 }),
        });
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('<html><body>Test</body></html>'),
      });
    });

    mockRunFullAudit.mockResolvedValue({
      url: 'https://new-site.com',
      issues: [],
      healthScore: { overall: 80 },
      pageResults: [],
      timestamp: Date.now(),
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    await audit({ url: 'https://new-site.com' });

    // Limit warning goes to stderr - it also runs in --output json mode,
    // where stdout must stay a single JSON document.
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('limit')
    );
    consoleErrorSpy.mockRestore();
  });

  it('handles cloud sync errors gracefully', async () => {
    mockIsLoggedIn.mockReturnValue(true);
    mockGetUserInfo.mockReturnValue({
      userId: 'user-123',
      sitesLimit: 10,
    });
    withSession();

    // sync-audit call throws (network failure)
    mockFetch.mockImplementation((url: string) => {
      if (String(url).includes('sync-audit')) {
        return Promise.reject(new Error('network error'));
      }
      return Promise.resolve({
        ok: true,
        text: () => Promise.resolve('<html><body>Test</body></html>'),
      });
    });

    mockRunFullAudit.mockResolvedValue({
      url: 'https://example.com',
      issues: [],
      healthScore: { overall: 85 },
      pageResults: [],
      timestamp: Date.now(),
    });

    // Should not throw - audit runs locally
    await expect(audit({ url: 'https://example.com' })).resolves.not.toThrow();
  });
});
