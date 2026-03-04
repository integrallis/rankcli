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

vi.mock('../lib/upsell.js', () => ({
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
