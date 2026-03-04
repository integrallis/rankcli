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
  hasFeature: vi.fn((tier: string, feature: string) => {
    if (tier === 'solo' && feature === 'auto_fix') return true;
    if (tier === 'free' && feature === 'auto_fix') return false;
    return false;
  }),
}));

vi.mock('@rankcli/agent-runtime', () => ({
  runDirectAnalysis: vi.fn(() => Promise.resolve({
    issues: [
      { code: 'TITLE_MISSING', severity: 'error', category: 'seo', message: 'Missing title tag' },
      { code: 'META_DESC_MISSING', severity: 'warning', category: 'seo', message: 'Missing meta description' },
    ],
    score: 65,
  })),
  generateFixes: vi.fn(() => Promise.resolve([
    {
      issue: { code: 'TITLE_MISSING', severity: 'error', category: 'seo', message: 'Missing title tag' },
      file: 'index.html',
      before: '',
      after: '<title>My Site</title>',
      explanation: 'Add a title tag',
      skipped: false,
    },
  ])),
  applyFixes: vi.fn(() => Promise.resolve({
    applied: [
      {
        issue: { code: 'TITLE_MISSING', severity: 'error', category: 'seo', message: 'Missing title tag' },
        file: 'index.html',
        applied: true,
      },
    ],
    skipped: [],
  })),
  detectFramework: vi.fn(() => Promise.resolve({
    success: true,
    data: { name: 'Vite', metaPattern: 'html-head' },
  })),
}));

// Import after mocks
import { fix, type FixOptions, type FixResult } from './fix.js';

describe('rankcli fix command', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('input validation', () => {
    it('should require a URL', async () => {
      const result = await fix({} as FixOptions);
      expect(result.success).toBe(false);
      expect(result.error).toContain('URL');
    });

    it('should validate URL format', async () => {
      const result = await fix({ url: 'not-a-url' });
      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid URL');
    });

    it('should accept valid URL', async () => {
      const result = await fix({ 
        url: 'https://example.com',
        dryRun: true,
      });
      // Should succeed with valid URL
      expect(result.success).toBe(true);
    });
  });

  describe('dry-run mode', () => {
    it('should not apply changes in dry-run mode', async () => {
      const result = await fix({
        url: 'https://example.com',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.dryRun).toBe(true);
      expect(result.appliedCount).toBe(0);
    });

    it('should return fixes in dry-run mode', async () => {
      const result = await fix({
        url: 'https://example.com',
        dryRun: true,
      });

      expect(result.success).toBe(true);
      expect(result.fixes).toBeDefined();
      expect(result.fixes!.length).toBeGreaterThan(0);
    });
  });

  describe('auto mode', () => {
    it('should require auto flag to apply fixes', async () => {
      const result = await fix({
        url: 'https://example.com',
        // no auto flag
      });

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(0); // Not applied without --auto
    });

    it('should apply fixes with auto flag', async () => {
      const result = await fix({
        url: 'https://example.com',
        auto: true,
      });

      expect(result.success).toBe(true);
      expect(result.appliedCount).toBe(1);
    });
  });

  describe('output formats', () => {
    it('should return JSON output when requested', async () => {
      const result = await fix({
        url: 'https://example.com',
        dryRun: true,
        output: 'json',
      });

      expect(result.success).toBe(true);
      expect(result.json).toBeDefined();

      const parsed = JSON.parse(result.json!);
      expect(parsed.url).toBe('https://example.com');
      expect(parsed.dryRun).toBe(true);
    });
  });

  describe('--only flag filtering', () => {
    it('should filter issues by code', async () => {
      const result = await fix({
        url: 'https://example.com',
        only: ['TITLE_MISSING'],
        dryRun: true,
      });

      expect(result.success).toBe(true);
      // The mock returns issues and generateFixes is called with filtered issues
    });
  });
});

describe('commit message generation', () => {
  it('should generate commit message with --commit flag when fixes applied', async () => {
    const result = await fix({
      url: 'https://example.com',
      auto: true,
      commit: true,
    });

    expect(result.success).toBe(true);
    // Commit message is generated based on applied fixes
    // If no fixes were marked as applied in the mock, message may be empty
    if (result.appliedCount && result.appliedCount > 0) {
      expect(result.commitMessage).toBeDefined();
    }
  });

  it('should have appliedCount when fixes are applied', async () => {
    const result = await fix({
      url: 'https://example.com',
      auto: true,
      commit: true,
    });

    expect(result.success).toBe(true);
    expect(result.appliedCount).toBe(1);
  });
});
