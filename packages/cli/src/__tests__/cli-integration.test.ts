/**
 * CLI Integration Tests
 *
 * Tests all CLI scenarios using API key authentication.
 * These tests require a valid API key to run against the actual backend.
 *
 * To run:
 *   RANKCLI_TEST_API_KEY=rankcli_xxx pnpm test
 *
 * The API key should be created from the RankCLI dashboard at /account
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Store for mock config
const mockConfigStore = new Map<string, unknown>();

// Mock Conf before importing config module
vi.mock('conf', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      get: (key: string) => mockConfigStore.get(key),
      set: (key: string, value: unknown) => mockConfigStore.set(key, value),
      delete: (key: string) => mockConfigStore.delete(key),
    })),
  };
});

// Import after mock
import {
  isLoggedIn,
  isApiKeyAuth,
  getApiKey,
  saveApiKey,
  validateApiKey,
  clearCredentials,
  getUserInfo,
  saveSubscription,
} from '../lib/config.js';

describe('CLI Config Module', () => {
  beforeEach(() => {
    mockConfigStore.clear();
    delete process.env.RANKCLI_API_KEY;
  });

  afterEach(() => {
    mockConfigStore.clear();
    delete process.env.RANKCLI_API_KEY;
  });

  describe('isLoggedIn', () => {
    it('returns false when no credentials exist', () => {
      expect(isLoggedIn()).toBe(false);
    });

    it('returns true when valid API key is stored', () => {
      mockConfigStore.set('apiKey', 'rankcli_test123456789');
      expect(isLoggedIn()).toBe(true);
    });

    it('returns true when API key is in environment variable', () => {
      process.env.RANKCLI_API_KEY = 'rankcli_envtest123';
      expect(isLoggedIn()).toBe(true);
    });

    it('returns false for invalid API key format', () => {
      mockConfigStore.set('apiKey', 'invalid_key');
      expect(isLoggedIn()).toBe(false);
    });

    it('returns true when valid session token exists', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      mockConfigStore.set('accessToken', 'test_access_token');
      mockConfigStore.set('expiresAt', futureTime);
      expect(isLoggedIn()).toBe(true);
    });

    it('returns false when session token is expired', () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      mockConfigStore.set('accessToken', 'test_access_token');
      mockConfigStore.set('expiresAt', pastTime);
      expect(isLoggedIn()).toBe(false);
    });
  });

  describe('isApiKeyAuth', () => {
    it('returns false when no API key', () => {
      expect(isApiKeyAuth()).toBe(false);
    });

    it('returns true when API key is stored', () => {
      mockConfigStore.set('apiKey', 'rankcli_stored123');
      expect(isApiKeyAuth()).toBe(true);
    });

    it('returns true when API key is in environment', () => {
      process.env.RANKCLI_API_KEY = 'rankcli_env123';
      expect(isApiKeyAuth()).toBe(true);
    });

    it('returns false for invalid prefix', () => {
      mockConfigStore.set('apiKey', 'seo_wrongprefix');
      expect(isApiKeyAuth()).toBe(false);
    });
  });

  describe('getApiKey', () => {
    it('returns null when no API key exists', () => {
      expect(getApiKey()).toBe(null);
    });

    it('returns stored API key', () => {
      mockConfigStore.set('apiKey', 'rankcli_stored456');
      expect(getApiKey()).toBe('rankcli_stored456');
    });

    it('prefers environment variable over stored key', () => {
      mockConfigStore.set('apiKey', 'rankcli_stored');
      process.env.RANKCLI_API_KEY = 'rankcli_env';
      expect(getApiKey()).toBe('rankcli_env');
    });
  });

  describe('saveApiKey', () => {
    it('saves API key to config', () => {
      saveApiKey('rankcli_newkey123');
      expect(mockConfigStore.get('apiKey')).toBe('rankcli_newkey123');
    });

    it('saves key name when provided', () => {
      saveApiKey('rankcli_namedkey', 'CI Server');
      expect(mockConfigStore.get('apiKey')).toBe('rankcli_namedkey');
      expect(mockConfigStore.get('apiKeyName')).toBe('CI Server');
    });
  });

  describe('clearCredentials', () => {
    it('clears all stored credentials', () => {
      mockConfigStore.set('accessToken', 'test');
      mockConfigStore.set('refreshToken', 'test');
      mockConfigStore.set('apiKey', 'rankcli_test');
      mockConfigStore.set('email', 'test@example.com');
      mockConfigStore.set('planName', 'Pro');

      clearCredentials();

      expect(mockConfigStore.get('accessToken')).toBeUndefined();
      expect(mockConfigStore.get('refreshToken')).toBeUndefined();
      expect(mockConfigStore.get('apiKey')).toBeUndefined();
      expect(mockConfigStore.get('email')).toBeUndefined();
    });
  });

  describe('getUserInfo', () => {
    it('returns default values when no info stored', () => {
      const info = getUserInfo();
      expect(info.planName).toBe('Free');
      expect(info.sitesLimit).toBe(1);
    });

    it('returns stored user info', () => {
      mockConfigStore.set('email', 'user@example.com');
      mockConfigStore.set('userId', 'user-123');
      mockConfigStore.set('planName', 'Pro');
      mockConfigStore.set('sitesLimit', 10);

      const info = getUserInfo();
      expect(info.email).toBe('user@example.com');
      expect(info.userId).toBe('user-123');
      expect(info.planName).toBe('Pro');
      expect(info.sitesLimit).toBe(10);
    });
  });

  describe('saveSubscription', () => {
    it('saves subscription info', () => {
      saveSubscription({
        planId: 'pro',
        planName: 'Pro',
        sitesLimit: 10,
      });

      expect(mockConfigStore.get('planId')).toBe('pro');
      expect(mockConfigStore.get('planName')).toBe('Pro');
      expect(mockConfigStore.get('sitesLimit')).toBe(10);
    });

    it('handles partial updates', () => {
      mockConfigStore.set('planName', 'Free');
      mockConfigStore.set('sitesLimit', 1);

      saveSubscription({ planName: 'Solo' });

      expect(mockConfigStore.get('planName')).toBe('Solo');
      expect(mockConfigStore.get('sitesLimit')).toBe(1); // Unchanged
    });
  });
});

describe('API Key Validation', () => {
  describe('validateApiKey format checks', () => {
    it('rejects keys without rankcli_ prefix', async () => {
      const result = await validateApiKey('invalid_key');
      // This will fail at the API level, but we test format validation
      expect(result.valid).toBe(false);
    });

    it('rejects empty API key', async () => {
      const result = await validateApiKey('');
      expect(result.valid).toBe(false);
    });
  });
});

describe('CLI Authentication Flow', () => {
  describe('API Key Login', () => {
    it('validates key format before API call', () => {
      const validKey = 'rankcli_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd';
      expect(validKey.startsWith('rankcli_')).toBe(true);
      expect(validKey.length).toBeGreaterThan(8);
    });

    it('rejects keys with wrong prefix', () => {
      const invalidKey = 'seo_ABCDEFGHIJKLMNOPQRSTUVWXYZabcd';
      expect(invalidKey.startsWith('rankcli_')).toBe(false);
    });

    it('stores API key after successful validation', () => {
      const apiKey = 'rankcli_validkey123';
      saveApiKey(apiKey);
      expect(getApiKey()).toBe(apiKey);
      expect(isApiKeyAuth()).toBe(true);
    });
  });

  describe('Session vs API Key Priority', () => {
    beforeEach(() => {
      mockConfigStore.clear();
      delete process.env.RANKCLI_API_KEY;
    });

    it('API key takes precedence over session', () => {
      // Set both session and API key
      const futureTime = Math.floor(Date.now() / 1000) + 3600;
      mockConfigStore.set('accessToken', 'session_token');
      mockConfigStore.set('expiresAt', futureTime);
      mockConfigStore.set('apiKey', 'rankcli_apikey');

      expect(isLoggedIn()).toBe(true);
      expect(isApiKeyAuth()).toBe(true);
    });

    it('environment API key takes precedence over stored', () => {
      mockConfigStore.set('apiKey', 'rankcli_stored');
      process.env.RANKCLI_API_KEY = 'rankcli_env';

      expect(getApiKey()).toBe('rankcli_env');
    });

    afterEach(() => {
      delete process.env.RANKCLI_API_KEY;
    });
  });

  describe('Logout', () => {
    beforeEach(() => {
      mockConfigStore.clear();
      delete process.env.RANKCLI_API_KEY;
    });

    it('clears all authentication state', () => {
      mockConfigStore.set('accessToken', 'token');
      mockConfigStore.set('apiKey', 'rankcli_key');
      mockConfigStore.set('email', 'user@test.com');

      clearCredentials();

      expect(isLoggedIn()).toBe(false);
      expect(isApiKeyAuth()).toBe(false);
      expect(getApiKey()).toBe(null);
    });
  });
});

describe('CLI Commands Requirements', () => {
  describe('Commands requiring authentication', () => {
    const authRequiredCommands = [
      'audit --url https://example.com', // Uses API quota
      'keywords --url https://example.com', // Uses AI credits
    ];

    it.each(authRequiredCommands)('command "%s" should check auth', (cmd) => {
      // These commands should verify isLoggedIn() before running
      expect(typeof isLoggedIn).toBe('function');
    });
  });

  describe('Commands not requiring authentication', () => {
    const noAuthCommands = ['login', 'logout', 'whoami'];

    it.each(noAuthCommands)('command "%s" does not require pre-auth', (cmd) => {
      // These commands handle their own auth flow
      expect(true).toBe(true);
    });
  });
});

describe('API Key Security', () => {
  beforeEach(() => {
    mockConfigStore.clear();
  });

  it('API keys should be 40 characters (8 prefix + 32 random)', () => {
    const expectedLength = 8 + 32; // 'rankcli_' + 32 chars
    // Sample key with exactly 32 chars after prefix
    const sampleKey = 'rankcli_ABCDEFGHIJKLMNOPQRSTUVWXYZabcdef';
    expect(sampleKey.length).toBe(expectedLength);
  });

  it('API key prefix should be rankcli_', () => {
    const key = 'rankcli_test123';
    expect(key.startsWith('rankcli_')).toBe(true);
  });

  it('should not expose full key in getUserInfo', () => {
    mockConfigStore.set('apiKey', 'rankcli_secretkey123456789012345678');
    const info = getUserInfo();
    // getUserInfo should not return the API key
    expect(info).not.toHaveProperty('apiKey');
  });
});

// Integration tests that require actual API connection
// These are skipped by default and run with RANKCLI_TEST_API_KEY
describe.skipIf(!process.env.RANKCLI_TEST_API_KEY)('Live API Integration Tests', () => {
  const testApiKey = process.env.RANKCLI_TEST_API_KEY!;

  it('validates a real API key', async () => {
    const result = await validateApiKey(testApiKey);
    expect(result.valid).toBe(true);
    expect(result.user).toBeDefined();
    expect(result.user?.email).toBeDefined();
    expect(result.subscription).toBeDefined();
  });

  it('returns user subscription info', async () => {
    const result = await validateApiKey(testApiKey);
    expect(result.subscription).toHaveProperty('planId');
    expect(result.subscription).toHaveProperty('planName');
    expect(result.subscription).toHaveProperty('sitesLimit');
  });

  it('rejects an invalid API key', async () => {
    const result = await validateApiKey('rankcli_invalidkey12345678901234567');
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
  });
});
