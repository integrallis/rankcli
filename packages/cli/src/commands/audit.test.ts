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

// Mock agent-runtime
const mockRunFullAudit = vi.fn();
const mockDiscoverPagesFromLinks = vi.fn();

vi.mock('@rankcli/agent-runtime', () => ({
  runFullAudit: (...args: unknown[]) => mockRunFullAudit(...args),
  formatReport: vi.fn().mockReturnValue('Formatted report'),
  discoverPagesFromLinks: (...args: unknown[]) => mockDiscoverPagesFromLinks(...args),
  metaRefreshTarget: () => null,
  frameworks: {
    detectFramework: vi.fn().mockReturnValue({ framework: 'unknown', confidence: 0 }),
    getFrameworkDisplayName: vi.fn().mockReturnValue('Unknown'),
    getFrameworkIssues: vi.fn().mockReturnValue([]),
  },
}));

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
  getDecryptPassphrase: () => undefined,
  getApiUrl: () => 'http://localhost:3005',
  ensureApiKeyPlan: () => mockEnsureApiKeyPlan(),
}));

const mockEnsureApiKeyPlan = vi.fn();

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Import after mocks
import { audit, evaluateGate, parseGateOptions, EXIT_CODES } from './audit.js';

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
    mockDiscoverPagesFromLinks.mockReturnValue([]); // Returns DiscoveredPage[]
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
      mockDiscoverPagesFromLinks.mockReturnValue([]);

      await audit({ url: 'https://example.com' });

      expect(mockRunFullAudit).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://example.com',
        })
      );
    });

    it('discovers additional pages before auditing', async () => {
      mockRunFullAudit.mockResolvedValue(mockReport);
      mockDiscoverPagesFromLinks.mockReturnValue([
        { url: 'https://example.com/about', source: 'internal-link', priority: 8 },
        { url: 'https://example.com/pricing', source: 'internal-link', priority: 9 },
      ]);

      await audit({ url: 'https://example.com', maxPages: '3' });

      // Should have called discoverPagesFromLinks
      expect(mockDiscoverPagesFromLinks).toHaveBeenCalled();
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
      expect(evaluateGate(issues, 100, 'notice').passed).toBe(false);
      expect(evaluateGate(issues, 100, 'warning').passed).toBe(true);
      expect(parseGateOptions({ failOn: 'ERROR' }).failOn).toBe('error');
      expect(parseGateOptions({ minScore: '0' }).minScore).toBe(0);
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

    mockDiscoverPagesFromLinks.mockReturnValue([]);
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
