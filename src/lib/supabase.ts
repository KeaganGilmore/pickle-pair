import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const rawUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

// Normalize: the SDK needs the project origin only (e.g. https://abc.supabase.co).
// If the secret is set to https://abc.supabase.co/rest/v1 or .../auth/v1 the SDK
// appends its own path on top, producing /rest/v1/rest/v1/... 404s.
function normalizeSupabaseUrl(raw: string | undefined): string | undefined {
  if (!raw) return undefined;
  try {
    return new URL(raw.trim()).origin;
  } catch {
    return undefined;
  }
}

const url = normalizeSupabaseUrl(rawUrl);

export const supabaseConfigured = Boolean(url && anon);

export const supabase: SupabaseClient | null = supabaseConfigured
  ? createClient(url!, anon!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'picklepair-auth',
      },
      global: {
        headers: { 'x-app': 'picklepair' },
      },
      realtime: {
        params: { eventsPerSecond: 5 },
      },
    })
  : null;

let anonAuthDisabled = false;

export function isAnonAuthDisabled() {
  return anonAuthDisabled;
}

export async function ensureAnonymousAuth() {
  if (!supabase) return null;
  if (anonAuthDisabled) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  const { data: anonData, error } = await supabase.auth.signInAnonymously();
  if (error) {
    // If the server says anon auth is disabled we remember it and stop
    // retrying for this session — otherwise every enqueue floods the
    // /auth/v1/signup endpoint with 422s.
    const msg = (error.message ?? '').toLowerCase();
    const status = (error as { status?: number })?.status;
    if (
      msg.includes('disabled') ||
      status === 422 ||
      status === 403 ||
      status === 404
    ) {
      anonAuthDisabled = true;
    }
    console.warn('anonymous auth failed', error);
    return null;
  }
  return anonData.session;
}
