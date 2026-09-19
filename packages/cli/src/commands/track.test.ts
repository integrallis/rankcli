import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies
vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
    warn: vi.fn().mockReturnThis(),
    text: '',
  }),
}));

vi.mock('../lib/config.js', () => ({
  isLoggedIn: vi.fn(() => true),
  getUserInfo: vi.fn(() => ({ planName: 'solo', userId: 'test-user' })),
  getAuthenticatedClient: vi.fn(() => Promise.resolve(null)),
  WEB_APP_URL: 'https://rankcli.dev',
}));

vi.mock('../lib/upsell.js', async (importOriginal) => ({
  tierFromPlanId: (await importOriginal<typeof import('../lib/upsell.js')>()).tierFromPlanId,
  showUpsell: vi.fn(),
  hasFeature: vi.fn(() => true),
}));

vi.mock('@rankcli/agent-runtime', () => ({
  RankTracker: vi.fn(),
  TIER_LIMITS: {
    free: { maxKeywords: 10, checksPerDay: 1 },
    solo: { maxKeywords: 100, checksPerDay: 1 },
    pro: { maxKeywords: 500, checksPerDay: 2 },
    agency: { maxKeywords: 2000, checksPerDay: 4 },
  },
}));

// Import after mocks
import { 
  trackAdd, 
  trackStatus, 
  trackHistory, 
  trackExport,
  trackCheck,
} from './track.js';

describe('rankcli track command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('trackAdd()', () => {
    it('should require keywords', async () => {
      const result = await trackAdd({
        url: 'https://example.com',
        // no keywords
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('keyword');
    });

    it('should require URL', async () => {
      const result = await trackAdd({
        keywords: ['seo tool'],
        // no url
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL');
    });

    it('should fail gracefully when not authenticated', async () => {
      const { isLoggedIn } = await import('../lib/config.js');
      vi.mocked(isLoggedIn).mockReturnValueOnce(false);

      const result = await trackAdd({
        keywords: ['seo tool'],
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('logged in');
    });
  });

  describe('trackStatus()', () => {
    it('should require URL', async () => {
      const result = await trackStatus({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL');
    });

    it('should fail gracefully when not authenticated', async () => {
      const { isLoggedIn } = await import('../lib/config.js');
      vi.mocked(isLoggedIn).mockReturnValueOnce(false);

      const result = await trackStatus({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('logged in');
    });
  });

  describe('trackHistory()', () => {
    it('should require URL', async () => {
      const result = await trackHistory({
        keyword: 'seo tool',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL');
    });

    it('should require keyword', async () => {
      const result = await trackHistory({
        url: 'https://example.com',
      });
      expect(result.success).toBe(false);
      expect(result.error).toContain('keyword');
    });
  });

  describe('trackHistory() against the database', () => {
    // A chainable stand-in for the Supabase client that records the tables queried.
    function fakeSupabase(tables: Record<string, unknown>) {
      const queried: string[] = [];
      const client = {
        from(table: string) {
          queried.push(table);
          const result = { data: tables[table] ?? null, error: null };
          const query: any = new Proxy({}, {
            get: (_target, prop) => {
              if (prop === 'then') return (resolve: (r: unknown) => void) => resolve(result);
              if (prop === 'single' || prop === 'maybeSingle') return () => Promise.resolve(result);
              return () => query;
            },
          });
          return query;
        },
      };
      return { client, queried };
    }

    it('reads the checks recorded in keyword_position_history', async () => {
      const { client, queried } = fakeSupabase({
        projects: { id: 'p1', domain: 'example.com', last_rank_check_at: null },
        keywords: { id: 'k1' },
        keyword_position_history: [
          { position: 4, url: 'https://example.com/a', checked_at: '2026-09-18T00:00:00Z' },
          { position: 7, url: 'https://example.com/a', checked_at: '2026-09-17T00:00:00Z' },
        ],
      });
      const config = await import('../lib/config.js');
      vi.mocked(config.getAuthenticatedClient).mockResolvedValue(client as never);
      const log = vi.spyOn(console, 'log').mockImplementation(() => {});

      const result = await trackHistory({ url: 'https://example.com', keyword: 'seo cli', output: 'json' });

      expect(result.success).toBe(true);
      expect(queried).toContain('keyword_position_history');
      expect(queried).not.toContain('rankings');
      const printed = JSON.parse(log.mock.calls.map((c) => c[0]).find((c) => String(c).startsWith('{')) as string);
      expect(printed.history.map((h: { position: number }) => h.position)).toEqual([4, 7]);
      log.mockRestore();
    });

    it('gives an annual subscriber their plan\'s keyword cap, not Free\'s', async () => {
      const { client } = fakeSupabase({
        projects: { id: 'p1', domain: 'example.com', last_rank_check_at: null },
        keywords: [],
      });
      const config = await import('../lib/config.js');
      vi.mocked(config.getAuthenticatedClient).mockResolvedValue(client as never);
      const keywords = Array.from({ length: 20 }, (_, i) => `keyword ${i}`); // Free allows 10

      vi.mocked(config.getUserInfo).mockReturnValue({ planName: 'Pro (Annual)', planId: 'pro_annual', userId: 'test-user' } as never);
      const pro = await trackAdd({ keywords, url: 'https://example.com' });
      expect(pro.error ?? '').not.toMatch(/limit/i);

      vi.mocked(config.getUserInfo).mockReturnValue({ planName: 'Free', planId: 'free', userId: 'test-user' } as never);
      const free = await trackAdd({ keywords, url: 'https://example.com' });
      expect(free.error).toMatch(/limit/i);
    });
  });

  describe('trackExport()', () => {
    it('should require URL', async () => {
      const result = await trackExport({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL');
    });

    it('should fail gracefully when not authenticated', async () => {
      const { isLoggedIn } = await import('../lib/config.js');
      vi.mocked(isLoggedIn).mockReturnValueOnce(false);

      const result = await trackExport({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('logged in');
    });
  });

  describe('trackCheck()', () => {
    it('should require URL', async () => {
      const result = await trackCheck({});
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL');
    });

    it('should fail gracefully when not authenticated', async () => {
      const { isLoggedIn } = await import('../lib/config.js');
      vi.mocked(isLoggedIn).mockReturnValueOnce(false);

      const result = await trackCheck({
        url: 'https://example.com',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('logged in');
    });
  });
});

describe('tier limits', () => {
  it('should have correct limits defined', async () => {
    const { TIER_LIMITS } = await import('@rankcli/agent-runtime');
    
    expect(TIER_LIMITS.free.maxKeywords).toBe(10);
    expect(TIER_LIMITS.solo.maxKeywords).toBe(100);
    expect(TIER_LIMITS.pro.maxKeywords).toBe(500);
    expect(TIER_LIMITS.agency.maxKeywords).toBe(2000);
  });
});
