import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

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

export async function ensureAnonymousAuth() {
  if (!supabase) return null;
  const { data } = await supabase.auth.getSession();
  if (data.session) return data.session;
  // Fall back to anonymous sign-in — required for RLS to provide a stable uid
  const { data: anonData, error } = await supabase.auth.signInAnonymously();
  if (error) {
    console.warn('anonymous auth failed', error);
    return null;
  }
  return anonData.session;
}
