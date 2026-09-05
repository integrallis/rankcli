import { describe, it, expect, beforeEach, afterEach, vi, Mock, type MockInstance } from 'vitest';

// Mock dependencies before importing
vi.mock('chalk', () => ({
  default: {
    cyan: (s: string) => s,
    green: (s: string) => s,
    yellow: (s: string) => s,
    red: (s: string) => s,
    dim: (s: string) => s,
    bold: (s: string) => s,
  },
}));

vi.mock('ora', () => ({
  default: () => ({
    start: vi.fn().mockReturnThis(),
    stop: vi.fn().mockReturnThis(),
    succeed: vi.fn().mockReturnThis(),
    fail: vi.fn().mockReturnThis(),
  }),
}));

vi.mock('inquirer', () => ({
  default: {
    prompt: vi.fn(),
  },
}));

vi.mock('open', () => ({
  default: vi.fn(),
}));

// Mock config module
const mockIsLoggedIn = vi.fn();
const mockGetUserInfo = vi.fn();
const mockClearCredentials = vi.fn();
const mockSaveSession = vi.fn();
const mockSaveSubscription = vi.fn();
const mockGetSupabaseClient = vi.fn();
const mockGetAuthenticatedClient = vi.fn();
const mockIsApiKeyAuth = vi.fn();
const mockGetApiKey = vi.fn();
const mockSaveApiKey = vi.fn();
const mockValidateApiKey = vi.fn();

vi.mock('../lib/config.js', () => ({
  isLoggedIn: () => mockIsLoggedIn(),
  getUserInfo: () => mockGetUserInfo(),
  clearCredentials: () => mockClearCredentials(),
  saveSession: (s: unknown) => mockSaveSession(s),
  saveSubscription: (s: unknown) => mockSaveSubscription(s),
  getSupabaseClient: () => mockGetSupabaseClient(),
  getAuthenticatedClient: () => mockGetAuthenticatedClient(),
  isApiKeyAuth: () => mockIsApiKeyAuth(),
  getApiKey: () => mockGetApiKey(),
  saveApiKey: (key: string, name?: string) => mockSaveApiKey(key, name),
  validateApiKey: (key: string) => mockValidateApiKey(key),
  WEB_APP_URL: 'http://localhost:3005',
}));

import { login, logout, whoami } from './auth.js';
import inquirer from 'inquirer';

describe('Auth Commands', () => {
  let consoleLogSpy: MockInstance<any[], any>;
  let consoleErrorSpy: MockInstance<any[], any>;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  describe('login', () => {
    it('shows message when already logged in', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      mockGetUserInfo.mockReturnValue({ email: 'test@example.com' });

      await login({});

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Already logged in')
      );
    });

    it('prompts for email when not provided', async () => {
      mockIsLoggedIn.mockReturnValue(false);
      (inquirer.prompt as unknown as Mock).mockResolvedValueOnce({ email: 'user@test.com' });
      (inquirer.prompt as unknown as Mock).mockResolvedValueOnce({ password: 'secret' });

      const mockSignIn = vi.fn().mockResolvedValue({
        data: {
          session: {
            access_token: 'token',
            refresh_token: 'refresh',
            expires_at: Date.now() + 3600,
            user: { id: 'user-1', email: 'user@test.com' },
          },
          user: { email: 'user@test.com' },
        },
        error: null,
      });

      mockGetSupabaseClient.mockReturnValue({
        auth: { signInWithPassword: mockSignIn },
      });

      mockGetAuthenticatedClient.mockResolvedValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      });

      await login({});

      expect(inquirer.prompt).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ name: 'email' }),
        ])
      );
    });

    it('handles login error gracefully', async () => {
      mockIsLoggedIn.mockReturnValue(false);
      (inquirer.prompt as unknown as Mock).mockResolvedValueOnce({ email: 'user@test.com' });
      (inquirer.prompt as unknown as Mock).mockResolvedValueOnce({ password: 'wrong' });

      mockGetSupabaseClient.mockReturnValue({
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { session: null, user: null },
            error: { message: 'Invalid login credentials' },
          }),
        },
      });

      await login({ email: 'user@test.com' });

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Invalid login')
      );
    });

    it('saves session on successful login', async () => {
      mockIsLoggedIn.mockReturnValue(false);
      (inquirer.prompt as unknown as Mock).mockResolvedValue({ password: 'correct' });

      const mockSession = {
        access_token: 'token-123',
        refresh_token: 'refresh-456',
        expires_at: Date.now() + 3600,
        user: { id: 'user-1', email: 'success@test.com' },
      };

      mockGetSupabaseClient.mockReturnValue({
        auth: {
          signInWithPassword: vi.fn().mockResolvedValue({
            data: { session: mockSession, user: mockSession.user },
            error: null,
          }),
        },
      });

      mockGetAuthenticatedClient.mockResolvedValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: null }),
            }),
          }),
        }),
      });

      mockGetUserInfo.mockReturnValue({ planName: 'Free', sitesLimit: 1 });

      await login({ email: 'success@test.com' });

      expect(mockSaveSession).toHaveBeenCalledWith(mockSession);
    });
  });

  describe('logout', () => {
    it('shows message when not logged in', async () => {
      mockIsLoggedIn.mockReturnValue(false);

      await logout();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not logged in')
      );
    });

    it('clears credentials on successful logout', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      mockGetUserInfo.mockReturnValue({ email: 'user@test.com' });

      mockGetSupabaseClient.mockReturnValue({
        auth: { signOut: vi.fn().mockResolvedValue({}) },
      });

      await logout();

      expect(mockClearCredentials).toHaveBeenCalled();
    });

    it('handles logout error gracefully', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      mockGetUserInfo.mockReturnValue({ email: 'user@test.com' });

      mockGetSupabaseClient.mockReturnValue({
        auth: {
          signOut: vi.fn().mockRejectedValue(new Error('Network error')),
        },
      });

      await logout();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Network error')
      );
    });
  });

  describe('whoami', () => {
    it('shows message when not logged in', async () => {
      mockIsLoggedIn.mockReturnValue(false);

      await whoami();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Not logged in')
      );
    });

    it('displays account info when logged in via session', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      mockIsApiKeyAuth.mockReturnValue(false);
      mockGetUserInfo.mockReturnValue({
        email: 'pro@test.com',
        planName: 'Pro',
        sitesLimit: 10,
      });

      mockGetAuthenticatedClient.mockResolvedValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({
                data: {
                  plan: { plan_id: 'pro', name: 'Pro', sites_limit: 10 },
                },
                error: null,
              }),
            }),
          }),
        }),
      });

      await whoami();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('pro@test.com')
      );
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Pro')
      );
    });

    it('displays account info when logged in via API key', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      mockIsApiKeyAuth.mockReturnValue(true);
      mockGetApiKey.mockReturnValue('rankcli_testkey123');
      mockValidateApiKey.mockResolvedValue({
        valid: true,
        subscription: { planId: 'pro', planName: 'Pro', sitesLimit: 10 },
      });
      mockGetUserInfo.mockReturnValue({
        email: 'apikey@test.com',
        planName: 'Pro',
        sitesLimit: 10,
      });

      await whoami();

      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('apikey@test.com')
      );
    });

    it('handles fetch error gracefully', async () => {
      mockIsLoggedIn.mockReturnValue(true);
      mockIsApiKeyAuth.mockReturnValue(false);
      mockGetUserInfo.mockReturnValue({ email: 'user@test.com' });

      mockGetAuthenticatedClient.mockRejectedValue(new Error('Auth failed'));

      await whoami();

      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auth failed')
      );
    });
  });
});
