import type { QueryClient } from '@tanstack/react-query';
import { db } from './db';
import { supabase, supabaseConfigured, ensureAnonymousAuth } from './supabase';
import type { PendingMutation } from './types';
import { nowIso, uid } from './utils';

type SyncStatus = {
  online: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  syncing: boolean;
  error: string | null;
  configured: boolean;
};

type Listener = (s: SyncStatus) => void;

let queryClient: QueryClient | null = null;
const listeners = new Set<Listener>();

const state: SyncStatus = {
  online: typeof navigator !== 'undefined' ? navigator.onLine : true,
  pendingCount: 0,
  lastSyncAt: null,
  syncing: false,
  error: null,
  configured: supabaseConfigured,
};

function notify() {
  for (const l of listeners) l(state);
}

export function subscribeSync(l: Listener) {
  listeners.add(l);
  l(state);
  return () => listeners.delete(l);
}

export function getSyncState() {
  return state;
}

async function refreshPendingCount() {
  state.pendingCount = await db.pending.count();
  notify();
}

const TABLE_MAP: Record<PendingMutation['entity'], string> = {
  tournament: 'tournaments',
  player: 'players',
  match: 'matches',
  audit: 'audit_log',
};

async function processOne(m: PendingMutation): Promise<void> {
  if (!supabase) throw new Error('supabase not configured');
  const table = TABLE_MAP[m.entity];
  if (m.op === 'delete') {
    const id = (m.payload as { id?: string }).id;
    if (!id) return;
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) throw error;
    return;
  }
  // upsert
  const { error } = await supabase.from(table).upsert(m.payload, { onConflict: 'id' });
  if (error) throw error;
}

let running = false;
export async function runSync(force = false) {
  if (!supabase) return;
  if (running && !force) return;
  running = true;
  state.syncing = true;
  state.error = null;
  notify();
  try {
    if (!navigator.onLine) {
      running = false;
      state.syncing = false;
      notify();
      return;
    }
    await ensureAnonymousAuth();
    // Drain queue
    for (;;) {
      const batch = await db.pending.orderBy('created_at').limit(25).toArray();
      if (batch.length === 0) break;
      for (const m of batch) {
        try {
          await processOne(m);
          await db.pending.delete(m.id);
        } catch (err) {
          const msg = (err as Error).message || 'sync error';
          const tries = (m.tries ?? 0) + 1;
          if (tries > 6) {
            console.error('giving up on mutation', m, msg);
            await db.pending.delete(m.id);
          } else {
            await db.pending.update(m.id, { tries, last_error: msg });
          }
          throw err;
        }
      }
      await refreshPendingCount();
    }
    state.lastSyncAt = nowIso();
    state.error = null;
  } catch (err) {
    state.error = (err as Error).message || 'sync error';
  } finally {
    state.syncing = false;
    running = false;
    await refreshPendingCount();
    notify();
    queryClient?.invalidateQueries();
  }
}

export async function enqueue(
  entity: PendingMutation['entity'],
  op: PendingMutation['op'],
  payload: Record<string, unknown>,
  tournamentId: string,
) {
  await db.pending.add({
    id: uid('m'),
    entity,
    op,
    tournament_id: tournamentId,
    payload,
    created_at: nowIso(),
    tries: 0,
  });
  await refreshPendingCount();
  // Fire and forget — don't await
  void runSync();
}

export async function initSync(qc: QueryClient) {
  queryClient = qc;
  await refreshPendingCount();
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      state.online = true;
      notify();
      void runSync();
    });
    window.addEventListener('offline', () => {
      state.online = false;
      notify();
    });
    window.addEventListener('focus', () => void runSync());
  }
  if (supabaseConfigured) {
    await ensureAnonymousAuth();
    void runSync();
    // Periodic background sync
    setInterval(() => {
      if (navigator.onLine) void runSync();
    }, 15_000);
  }
}

export async function pullTournamentFromRemote(token: string) {
  if (!supabase) return null;
  await ensureAnonymousAuth();
  const { data: t, error } = await supabase
    .from('tournaments')
    .select('*')
    .or(`token.eq.${token},edit_token.eq.${token}`)
    .maybeSingle();
  if (error || !t) return null;
  await db.tournaments.put(t);
  const [players, matches] = await Promise.all([
    supabase.from('players').select('*').eq('tournament_id', t.id),
    supabase.from('matches').select('*').eq('tournament_id', t.id),
  ]);
  if (players.data) await db.players.bulkPut(players.data);
  if (matches.data) await db.matches.bulkPut(matches.data);
  return t;
}
