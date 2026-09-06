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
}));

// Mock global fetch
const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// Import after mocks
import { audit } from './audit.js';

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
    it('shows usage when no URL provided', async () => {
      await audit({ url: '' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Please provide a URL')
      );
    });

    it('rejects invalid URLs', async () => {
      await audit({ url: 'not-a-url' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid URL')
      );
    });

    it('suggests login for non-logged-in users in usage', async () => {
      mockIsLoggedIn.mockReturnValue(false);

      await audit({ url: '' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('rankcli login')
      );
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

    it('handles audit errors gracefully', async () => {
      // When all audits fail, the function should not throw
      mockRunFullAudit.mockRejectedValue(new Error('Network error'));

      // Should not throw even when runFullAudit fails
      await expect(audit({ url: 'https://example.com' })).resolves.not.toThrow();
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

    await audit({ url: 'https://new-site.com' });

    // Should show limit warning
    expect(consoleLogSpy).toHaveBeenCalledWith(
      expect.stringContaining('limit')
    );
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
