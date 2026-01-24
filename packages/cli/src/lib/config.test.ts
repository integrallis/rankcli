import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Mock conf before importing config
vi.mock('conf', () => {
  const store = new Map<string, unknown>();
  return {
    default: class MockConf {
      get(key: string) { return store.get(key); }
      set(key: string, value: unknown) { store.set(key, value); }
      delete(key: string) { store.delete(key); }
      clear() { store.clear(); }
    }
  };
});

// Mock @supabase/supabase-js
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: {
      refreshSession: vi.fn(),
      setSession: vi.fn(),
      signOut: vi.fn(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => Promise.resolve({ data: null, error: null }),
        }),
      }),
    }),
  }),
}));

import {
  config,
  isLoggedIn,
  saveSession,
  clearCredentials,
  getUserInfo,
  WEB_APP_URL,
} from './config.js';

describe('CLI Config', () => {
  beforeEach(() => {
    // Clear config before each test
    clearCredentials();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isLoggedIn', () => {
    it('returns false when not logged in', () => {
      expect(isLoggedIn()).toBe(false);
    });

    it('returns true when logged in with valid token', () => {
      const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
      config.set('accessToken', 'test-token');
      config.set('expiresAt', futureTime);

      expect(isLoggedIn()).toBe(true);
    });

    it('returns false when token is expired', () => {
      const pastTime = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      config.set('accessToken', 'test-token');
      config.set('expiresAt', pastTime);

      expect(isLoggedIn()).toBe(false);
    });
  });

  describe('saveSession', () => {
    it('saves session data to config', () => {
      const session = {
        access_token: 'access-123',
        refresh_token: 'refresh-456',
        expires_at: 1234567890,
        expires_in: 3600,
        token_type: 'bearer' as const,
        user: {
          id: 'user-id-123',
          email: 'test@example.com',
          app_metadata: {},
          user_metadata: {},
          aud: 'authenticated',
          created_at: '2024-01-01',
        },
      };

      saveSession(session);

      expect(config.get('accessToken')).toBe('access-123');
      expect(config.get('refreshToken')).toBe('refresh-456');
      expect(config.get('expiresAt')).toBe(1234567890);
      expect(config.get('userId')).toBe('user-id-123');
      expect(config.get('email')).toBe('test@example.com');
    });
  });

  describe('clearCredentials', () => {
    it('clears all stored credentials', () => {
      config.set('accessToken', 'test');
      config.set('refreshToken', 'test');
      config.set('userId', 'test');
      config.set('email', 'test@test.com');

      clearCredentials();

      expect(config.get('accessToken')).toBeUndefined();
      expect(config.get('refreshToken')).toBeUndefined();
      expect(config.get('userId')).toBeUndefined();
      expect(config.get('email')).toBeUndefined();
    });
  });

  describe('getUserInfo', () => {
    it('returns default values when not logged in', () => {
      const info = getUserInfo();

      expect(info.userId).toBeUndefined();
      expect(info.email).toBeUndefined();
      expect(info.planName).toBe('Free');
      expect(info.sitesLimit).toBe(1);
    });

    it('returns stored user info', () => {
      config.set('userId', 'user-123');
      config.set('email', 'user@example.com');
      config.set('planName', 'Pro');
      config.set('sitesLimit', 10);

      const info = getUserInfo();

      expect(info.userId).toBe('user-123');
      expect(info.email).toBe('user@example.com');
      expect(info.planName).toBe('Pro');
      expect(info.sitesLimit).toBe(10);
    });
  });

  describe('WEB_APP_URL', () => {
    it('has a valid URL', () => {
      expect(WEB_APP_URL).toMatch(/^https?:\/\//);
    });
  });
});
