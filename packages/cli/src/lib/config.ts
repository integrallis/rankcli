import Conf from 'conf';
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
}

// Production config - injected at build time via scripts/inject-config.js
// DO NOT hardcode secrets here - use environment variables or build-time injection
interface ProductionConfig {
  supabaseUrl: string;
  supabaseAnonKey: string;
  webAppUrl: string;
}

// Try to load build-time injected config (replaced during CI build)
const INJECTED_CONFIG: ProductionConfig | null = null; // __INJECT_PRODUCTION_CONFIG__

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

// API base URL for validation (lazy)
function getApiUrl(): string {
  return process.env.RANKCLI_API_URL || getSupabaseUrlLazy();
}

// Initialize config store
export const config = new Conf<ConfigSchema>({
  projectName: 'rankcli',
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

// Save API key to config
export function saveApiKey(apiKey: string, keyName?: string): void {
  config.set('apiKey', apiKey);
  if (keyName) {
    config.set('apiKeyName', keyName);
  }
}

// Validate API key with the server
export async function validateApiKey(apiKey: string): Promise<{
  valid: boolean;
  user?: { id: string; email: string };
  subscription?: { planId: string; planName: string; sitesLimit: number };
  error?: string;
}> {
  try {
    const response = await fetch(`${getApiUrl()}/functions/v1/validate-api-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': apiKey,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return { valid: false, error: data.error || 'Invalid API key' };
    }

    return {
      valid: true,
      user: data.user,
      subscription: data.subscription,
    };
  } catch (err) {
    return { valid: false, error: err instanceof Error ? err.message : 'Validation failed' };
  }
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
}

// Get user info
export function getUserInfo(): { userId?: string; email?: string; planName?: string; sitesLimit?: number } {
  return {
    userId: config.get('userId'),
    email: config.get('email'),
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
