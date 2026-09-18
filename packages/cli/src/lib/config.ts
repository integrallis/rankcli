import Conf from 'conf';
import { createHash } from 'node:crypto';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// RankCLI configuration schema
interface ConfigSchema {
  // Auth (session-based)
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  userId?: string;
  email?: string;

  // Auth (API key-based)
  apiKey?: string;
  apiKeyName?: string;

  // Subscription
  planId?: string;
  planName?: string;
  sitesLimit?: number;
  // Which API key the cached plan above was resolved for (sha256 prefix,
  // never the key itself) and when - see ensureApiKeyPlan().
  planKeyFingerprint?: string;
  planCheckedAt?: number;
}

// Production config - injected at build time via scripts/inject-config.js
// DO NOT hardcode secrets here - use environment variables or build-time injection
interface ProductionConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  webAppUrl: string;
  // Decrypts the WASM-embedded premium check bundle - code protection,
  // not an access-control secret. See wasm-engine.ts's module doc.
  decryptPassphrase?: string;
}

// Try to load build-time injected config (replaced during CI build). Cast
// on the initializer, not just the declaration - a bare `= null` narrows
// same-scope top-level reads (like WEB_APP_URL below) to exactly `null`
// via control-flow analysis, even with the wider annotation on the
// binding; reads inside function bodies aren't affected, which is why
// only the top-level access below ever surfaced this.
const INJECTED_CONFIG = null as ProductionConfig | null; // __INJECT_PRODUCTION_CONFIG__

// Supabase configuration priority:
// 1. Environment variables (highest priority - for local dev and CI)
// 2. Build-time injected config (for npm package)
// 3. Error if neither available (no hardcoded fallbacks!)
function getSupabaseUrl(): string {
  const url = process.env.RANKCLI_SUPABASE_URL
    || process.env.VITE_SUPABASE_URL
    || INJECTED_CONFIG?.supabaseUrl;
  
  if (!url) {
    throw new Error(
      'Supabase URL not configured. Set RANKCLI_SUPABASE_URL environment variable.\n' +
      'See: https://rankcli.dev/docs/cli-setup'
    );
  }
  return url;
}

function getSupabaseAnonKey(): string {
  const key = process.env.RANKCLI_SUPABASE_ANON_KEY
    || process.env.VITE_SUPABASE_ANON_KEY
    || INJECTED_CONFIG?.supabaseAnonKey;
  
  if (!key) {
    throw new Error(
      'Supabase anon key not configured. Set RANKCLI_SUPABASE_ANON_KEY environment variable.\n' +
      'See: https://rankcli.dev/docs/cli-setup'
    );
  }
  return key;
}

// Lazy-loaded config values (only fail when actually needed, not at import time)
let _supabaseUrl: string | null = null;
let _supabaseAnonKey: string | null = null;

function getSupabaseUrlLazy(): string {
  if (!_supabaseUrl) _supabaseUrl = getSupabaseUrl();
  return _supabaseUrl;
}

function getSupabaseAnonKeyLazy(): string {
  if (!_supabaseAnonKey) _supabaseAnonKey = getSupabaseAnonKey();
  return _supabaseAnonKey;
}

// Web app URL
export const WEB_APP_URL = process.env.RANKCLI_WEB_URL
  || INJECTED_CONFIG?.webAppUrl
  || 'https://rankcli.dev';

/**
 * Passphrase that decrypts the WASM-embedded premium check bundle. Only
 * call wasm-engine.ts's initEngine() with this after independently
 * confirming the user has a valid paid apiKey - this value alone grants
 * nothing, it only unlocks code that was already shipped to everyone.
 */
export function getDecryptPassphrase(): string | undefined {
  return process.env.RANKCLI_BUILD_KEY || INJECTED_CONFIG?.decryptPassphrase;
}

// API base URL for validation (lazy)
export function getApiUrl(): string {
  return process.env.RANKCLI_API_URL || getSupabaseUrlLazy();
}

// Initialize config store. RANKCLI_CONFIG_DIR relocates it - for CI jobs
// and tests that must not read or write the developer's real login.
export const config = new Conf<ConfigSchema>({
  projectName: 'rankcli',
  ...(process.env.RANKCLI_CONFIG_DIR ? { cwd: process.env.RANKCLI_CONFIG_DIR } : {}),
  schema: {
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    expiresAt: { type: 'number' },
    userId: { type: 'string' },
    email: { type: 'string' },
    apiKey: { type: 'string' },
    apiKeyName: { type: 'string' },
    planId: { type: 'string' },
    planName: { type: 'string' },
    sitesLimit: { type: 'number' },
    planKeyFingerprint: { type: 'string' },
    planCheckedAt: { type: 'number' },
  },
});

// Supabase client singleton
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(getSupabaseUrlLazy(), getSupabaseAnonKeyLazy(), {
      auth: {
        persistSession: false, // We manage session ourselves via conf
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

// Check if user is logged in (via session or API key)
export function isLoggedIn(): boolean {
  // Check API key first (env var or stored)
  const apiKey = process.env.RANKCLI_API_KEY || config.get('apiKey');
  if (apiKey && apiKey.startsWith('rankcli_')) {
    return true;
  }

  // Check session token
  const accessToken = config.get('accessToken');
  const expiresAt = config.get('expiresAt');

  if (!accessToken || !expiresAt) {
    return false;
  }

  // Check if token is expired (with 5 min buffer)
  const now = Math.floor(Date.now() / 1000);
  return expiresAt > now + 300;
}

// Check if using API key auth
export function isApiKeyAuth(): boolean {
  const apiKey = process.env.RANKCLI_API_KEY || config.get('apiKey');
  return !!(apiKey && apiKey.startsWith('rankcli_'));
}

// Get API key (from env or config)
export function getApiKey(): string | null {
  return process.env.RANKCLI_API_KEY || config.get('apiKey') || null;
}

// Save API key to config. Also accepts email so `whoami` and friends can
// show something better than "N/A" for a key obtained via a flow (like
// browser login or MCP connect) that already knows it, without needing a
// separate validate-api-key round trip just to display it.
export function saveApiKey(apiKey: string, keyName?: string, email?: string): void {
  config.set('apiKey', apiKey);
  if (keyName) {
    config.set('apiKeyName', keyName);
  }
  if (email) {
    config.set('email', email);
  }
}

export interface ApiKeyValidation {
  valid: boolean;
  /** HTTP status from validate-api-key; undefined when it was never reached. */
  status?: number;
  user?: { id: string; email: string };
  subscription?: { planId: string; planName: string; sitesLimit: number };
  error?: string;
}

// Validate API key with the server
export async function validateApiKey(apiKey: string): Promise<ApiKeyValidation> {
  try {
    const response = await fetch(`${getApiUrl()}/functions/v1/validate-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
        'X-Endpoint': 'cli',
      },
    });

    const data = await response.json().catch(() => ({})) as {
      error?: string;
      user?: { id: string; email: string };
      subscription?: { planId: string; planName: string; sitesLimit: number };
    };

    if (!response.ok) {
      return { valid: false, status: response.status, error: data.error || `Invalid API key (HTTP ${response.status})` };
    }

    return {
      valid: true,
      status: response.status,
      user: data.user,
      subscription: data.subscription,
    };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Validation failed' };
  }
}

function keyFingerprint(apiKey: string): string {
  return createHash('sha256').update(apiKey).digest('hex').slice(0, 16);
}

// Re-validate a cached plan at most this often (each validation counts
// against the key's daily API quota).
const PLAN_CACHE_MS = 6 * 60 * 60 * 1000;

export type ApiKeyPlanStatus =
  /** Key valid, plan resolved from the server (or a fresh cache for this key). */
  | { status: 'ok'; planId?: string; planName: string; email?: string; cached: boolean }
  /** Key valid, but on the Free plan: validate-api-key answers 403 "requires a paid subscription". */
  | { status: 'free' }
  /** The server rejected the key (revoked, mistyped, wrong project). */
  | { status: 'invalid'; error: string }
  /** Couldn't ask (network, rate limit, server error) - the cached plan, if any, was kept. */
  | { status: 'unavailable'; error: string };

/**
 * Make the cached plan match the API key actually in use.
 *
 * The plan (planId/planName) was only ever written by `login --token`,
 * `whoami`, or a session login - so a CI job that just exports
 * RANKCLI_API_KEY (or a browser login, which stores a key but has no
 * session to read the plan through) ran on the Free tier regardless of
 * what the account paid for. This validates the key against the server
 * whenever the cached plan belongs to a different key or is stale.
 * Returns null when not using API-key auth.
 */
export async function ensureApiKeyPlan(options: { force?: boolean } = {}): Promise<ApiKeyPlanStatus | null> {
  if (!isApiKeyAuth()) return null;
  const apiKey = getApiKey()!;
  const fingerprint = keyFingerprint(apiKey);
  const sameKey = config.get('planKeyFingerprint') === fingerprint;
  const fresh = sameKey && Date.now() - (config.get('planCheckedAt') || 0) < PLAN_CACHE_MS;

  if (fresh && !options.force) {
    return { status: 'ok', planId: config.get('planId'), planName: config.get('planName') || 'Free', email: config.get('email'), cached: true };
  }

  const result = await validateApiKey(apiKey);

  if (result.valid) {
    config.set('planKeyFingerprint', fingerprint);
    config.set('planCheckedAt', Date.now());
    if (result.user?.email) config.set('email', result.user.email);
    if (result.subscription?.planId && result.subscription.planId !== 'free') {
      saveSubscription(result.subscription);
    } else {
      setFreePlan();
    }
    return { status: 'ok', planId: config.get('planId'), planName: config.get('planName') || 'Free', email: result.user?.email, cached: false };
  }

  if (result.status === 403) {
    // A real key on a plan without API access - that is the Free plan.
    config.set('planKeyFingerprint', fingerprint);
    config.set('planCheckedAt', Date.now());
    setFreePlan();
    return { status: 'free' };
  }

  if (result.status === 401) {
    // Never keep a paid plan cached for a key the server just refused.
    config.delete('planKeyFingerprint');
    setFreePlan();
    return { status: 'invalid', error: result.error || 'Invalid API key' };
  }

  // Unreachable, rate-limited, or a server error: a cached plan for this
  // exact key is still the best answer; a cache for another key is not.
  if (!sameKey) setFreePlan();
  return { status: 'unavailable', error: result.error || 'Validation failed' };
}

function setFreePlan(): void {
  config.delete('planId');
  config.set('planName', 'Free');
  config.set('sitesLimit', 1);
}

// Get current session if valid
export async function getSession(): Promise<Session | null> {
  const accessToken = config.get('accessToken');
  const refreshToken = config.get('refreshToken');
  const expiresAt = config.get('expiresAt');

  if (!accessToken || !refreshToken) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  // If token expired, try to refresh
  if (expiresAt && expiresAt <= now + 300) {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      // Refresh failed, clear credentials
      clearCredentials();
      return null;
    }

    // Save new tokens
    saveSession(data.session);
    return data.session;
  }

  // Return current session
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: expiresAt,
    expires_in: expiresAt ? expiresAt - now : 0,
    token_type: 'bearer',
    user: {
      id: config.get('userId') || '',
      email: config.get('email'),
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      created_at: '',
    },
  };
}

// Save session to config
export function saveSession(session: Session): void {
  config.set('accessToken', session.access_token);
  config.set('refreshToken', session.refresh_token);
  config.set('expiresAt', session.expires_at);
  config.set('userId', session.user.id);
  config.set('email', session.user.email);
}

// Save subscription info
export function saveSubscription(subscription: {
  planId?: string;
  planName?: string;
  sitesLimit?: number;
}): void {
  if (subscription.planId !== undefined) config.set('planId', subscription.planId);
  if (subscription.planName !== undefined) config.set('planName', subscription.planName);
  if (subscription.sitesLimit !== undefined) config.set('sitesLimit', subscription.sitesLimit);
}

// Clear all credentials
export function clearCredentials(): void {
  config.delete('accessToken');
  config.delete('refreshToken');
  config.delete('expiresAt');
  config.delete('userId');
  config.delete('email');
  config.delete('apiKey');
  config.delete('apiKeyName');
  config.delete('planId');
  config.delete('planName');
  config.delete('sitesLimit');
  config.delete('planKeyFingerprint');
  config.delete('planCheckedAt');
}

// Get user info
export function getUserInfo(): { userId?: string; email?: string; planId?: string; planName?: string; sitesLimit?: number } {
  return {
    userId: config.get('userId'),
    email: config.get('email'),
    planId: config.get('planId'),
    planName: config.get('planName') || 'Free',
    sitesLimit: config.get('sitesLimit') || 1,
  };
}

// Get authenticated Supabase client (sets auth header)
export async function getAuthenticatedClient(): Promise<SupabaseClient | null> {
  const session = await getSession();
  if (!session) {
    return null;
  }

  const supabase = getSupabaseClient();

  // Set the session
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  });

  return supabase;
}
