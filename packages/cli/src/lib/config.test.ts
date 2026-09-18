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
  ensureApiKeyPlan,
} from './config.js';
import { tierFromPlanId } from './upsell.js';

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

  describe('ensureApiKeyPlan', () => {
    const respond = (status: number, body: unknown) =>
      vi.fn().mockResolvedValue({ ok: status < 400, status, json: () => Promise.resolve(body) });

    beforeEach(() => {
      process.env.RANKCLI_API_URL = 'http://localhost:54321';
    });

    afterEach(() => {
      delete process.env.RANKCLI_API_KEY;
      delete process.env.RANKCLI_API_URL;
      vi.unstubAllGlobals();
    });

    it('returns null without API-key auth', async () => {
      expect(await ensureApiKeyPlan()).toBeNull();
    });

    it('resolves a paid plan for RANKCLI_API_KEY (CI never ran login)', async () => {
      process.env.RANKCLI_API_KEY = 'rankcli_ci_key';
      const fetchMock = respond(200, {
        valid: true,
        user: { id: 'u1', email: 'ci@example.com' },
        subscription: { planId: 'pro', planName: 'Pro', sitesLimit: 10 },
      });
      vi.stubGlobal('fetch', fetchMock);

      const status = await ensureApiKeyPlan();

      expect(status).toMatchObject({ status: 'ok', planId: 'pro', cached: false });
      expect(getUserInfo().planId).toBe('pro');
      // Cached for this key: no second round trip.
      expect(await ensureApiKeyPlan()).toMatchObject({ status: 'ok', cached: true });
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('re-validates when the key changes', async () => {
      process.env.RANKCLI_API_KEY = 'rankcli_key_a';
      vi.stubGlobal('fetch', respond(200, { valid: true, subscription: { planId: 'agency', planName: 'Agency', sitesLimit: 50 } }));
      await ensureApiKeyPlan();

      process.env.RANKCLI_API_KEY = 'rankcli_key_b';
      vi.stubGlobal('fetch', respond(403, { error: 'API access requires a paid subscription' }));
      expect(await ensureApiKeyPlan()).toEqual({ status: 'free' });
      expect(getUserInfo().planId).toBeUndefined();
      expect(getUserInfo().planName).toBe('Free');
    });

    it('drops a cached paid plan when the key is rejected', async () => {
      process.env.RANKCLI_API_KEY = 'rankcli_key_c';
      vi.stubGlobal('fetch', respond(200, { valid: true, subscription: { planId: 'pro', planName: 'Pro', sitesLimit: 10 } }));
      await ensureApiKeyPlan();

      vi.stubGlobal('fetch', respond(401, { error: 'Invalid or revoked API key' }));
      expect(await ensureApiKeyPlan({ force: true })).toMatchObject({ status: 'invalid' });
      expect(getUserInfo().planId).toBeUndefined();
    });

    it('keeps the cached plan for the same key when the server is unreachable', async () => {
      process.env.RANKCLI_API_KEY = 'rankcli_key_d';
      vi.stubGlobal('fetch', respond(200, { valid: true, subscription: { planId: 'solo', planName: 'Solo', sitesLimit: 3 } }));
      await ensureApiKeyPlan();

      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('ECONNRESET')));
      expect(await ensureApiKeyPlan({ force: true })).toMatchObject({ status: 'unavailable' });
      expect(getUserInfo().planId).toBe('solo');
    });
  });
});

describe('tierFromPlanId', () => {
  it('maps billing variants to their base tier', () => {
    expect(tierFromPlanId('pro')).toBe('pro');
    expect(tierFromPlanId('pro_annual')).toBe('pro');
    expect(tierFromPlanId('pro_founding')).toBe('pro');
    expect(tierFromPlanId('agency_annual')).toBe('agency');
    expect(tierFromPlanId('ltd_solo')).toBe('solo');
    expect(tierFromPlanId('Solo')).toBe('solo');
    expect(tierFromPlanId('enterprise')).toBeUndefined();
    expect(tierFromPlanId(undefined)).toBeUndefined();
  });
});
