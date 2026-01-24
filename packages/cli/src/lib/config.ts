import Conf from 'conf';
import { createClient, SupabaseClient, Session } from '@supabase/supabase-js';

// RankCLI configuration schema
interface ConfigSchema {
  // Auth
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
  userId?: string;
  email?: string;

  // Subscription
  planId?: string;
  planName?: string;
  sitesLimit?: number;
}

// Supabase configuration (supports VITE_ vars for dev, RANKCLI_ for production CLI)
const SUPABASE_URL = process.env.RANKCLI_SUPABASE_URL
  || process.env.VITE_SUPABASE_URL
  || 'https://uisqfyeasobjjrgurwnb.supabase.co';

const SUPABASE_ANON_KEY = process.env.RANKCLI_SUPABASE_ANON_KEY
  || process.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpc3FmeWVhc29iampyZ3Vyd25iIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgwMDc3NjIsImV4cCI6MjA2MzU4Mzc2Mn0.r-GaAqD-OwAKMyH8w7qpAj6P7w52cAPTsb8JfMZmtJE';

// Web app URL
export const WEB_APP_URL = process.env.RANKCLI_WEB_URL || 'http://localhost:3005';

// Initialize config store
export const config = new Conf<ConfigSchema>({
  projectName: 'rankcli',
  schema: {
    accessToken: { type: 'string' },
    refreshToken: { type: 'string' },
    expiresAt: { type: 'number' },
    userId: { type: 'string' },
    email: { type: 'string' },
    planId: { type: 'string' },
    planName: { type: 'string' },
    sitesLimit: { type: 'number' },
  },
});

// Supabase client singleton
let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient(): SupabaseClient {
  if (!supabaseClient) {
    supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false, // We manage session ourselves via conf
        autoRefreshToken: false,
      },
    });
  }
  return supabaseClient;
}

// Check if user is logged in and token is valid
export function isLoggedIn(): boolean {
  const accessToken = config.get('accessToken');
  const expiresAt = config.get('expiresAt');

  if (!accessToken || !expiresAt) {
    return false;
  }

  // Check if token is expired (with 5 min buffer)
  const now = Math.floor(Date.now() / 1000);
  return expiresAt > now + 300;
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
