import type { QueryClient } from '@tanstack/react-query';
import { db } from './db';
import { supabase, supabaseConfigured, ensureAnonymousAuth, isAnonAuthDisabled } from './supabase';
import type { PendingMutation } from './types';
import { nowIso, uid } from './utils';

type SyncMode = 'configured' | 'local';
type SyncStatus = {
  online: boolean;
  pendingCount: number;
  lastSyncAt: string | null;
  syncing: boolean;
  error: string | null;
  mode: SyncMode;
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
  mode: supabaseConfigured ? 'configured' : 'local',
  configured: supabaseConfigured,
};

function notify() {
  for (const l of listeners) l({ ...state });
}

export function subscribeSync(l: Listener) {
  listeners.add(l);
  l({ ...state });
  return () => listeners.delete(l);
}

export function getSyncState() {
  return { ...state };
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

// Coalesce multiple mutations that target the same row into just the latest.
// Cuts N rapid score taps down to one network round-trip.
async function dedupeQueue() {
  const all = await db.pending.orderBy('created_at').toArray();
  if (all.length === 0) return;
  const latest = new Map<string, PendingMutation>();
  const toDelete: string[] = [];
  for (const m of all) {
    const rowId = (m.payload as { id?: string } | null)?.id ?? m.id;
    const key = `${m.entity}:${m.op}:${rowId}`;
    const prior = latest.get(key);
    if (!prior) {
      latest.set(key, m);
      continue;
    }
    // Same row touched twice — keep the newer one, drop the older.
    if (prior.created_at <= m.created_at) {
      toDelete.push(prior.id);
      latest.set(key, m);
    } else {
      toDelete.push(m.id);
    }
  }
  if (toDelete.length) await db.pending.bulkDelete(toDelete);
}

function extractStatus(err: unknown): number | undefined {
  const e = err as { status?: number; code?: string };
  if (typeof e?.status === 'number') return e.status;
  if (typeof e?.code === 'string') {
    const n = Number(e.code);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function isFatal(status: number | undefined): boolean {
  if (status === undefined) return false;
  // 401/403 = auth/policy; 400 = bad payload; 404 = table missing/wrong URL;
  // 409 = conflict we can't repair. Don't spin on any of these.
  return status === 400 || status === 401 || status === 403 || status === 404 || status === 409;
}

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
  const { error } = await supabase.from(table).upsert(m.payload, { onConflict: 'id' });
  if (error) throw error;
}

let syncRunning = false;
let nextSyncTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRetry(delayMs: number) {
  if (nextSyncTimer) clearTimeout(nextSyncTimer);
  nextSyncTimer = setTimeout(() => {
    nextSyncTimer = null;
    if (navigator.onLine) void runSync();
  }, delayMs);
}

export async function runSync(force = false) {
  if (!supabase) {
    state.mode = 'local';
    notify();
    return;
  }
  if (syncRunning && !force) return;
  syncRunning = true;
  state.syncing = true;
  state.error = null;
  notify();

  try {
    if (!navigator.onLine) {
      state.syncing = false;
      syncRunning = false;
      notify();
      return;
    }

    // Best-effort auth. Once we've learned anon auth is disabled on the
    // server, skip even trying — otherwise every enqueue floods auth/v1/signup.
    if (isAnonAuthDisabled()) {
      state.mode = 'local';
      state.error = 'Anonymous sign-ins are disabled on this Supabase project.';
      state.syncing = false;
      syncRunning = false;
      notify();
      return;
    }
    try {
      const session = await ensureAnonymousAuth();
      if (!session && isAnonAuthDisabled()) {
        state.mode = 'local';
        state.error = 'Anonymous sign-ins are disabled on this Supabase project.';
        state.syncing = false;
        syncRunning = false;
        notify();
        return;
      }
    } catch (err) {
      state.error = 'Auth error — running local-only.';
      state.mode = 'local';
      console.warn('supabase auth', err);
      state.syncing = false;
      syncRunning = false;
      notify();
      return;
    }

    await dedupeQueue();
    await refreshPendingCount();

    let hadFatal = false;
    for (;;) {
      const batch = await db.pending.orderBy('created_at').limit(25).toArray();
      if (batch.length === 0) break;
      for (const m of batch) {
        try {
          await processOne(m);
          await db.pending.delete(m.id);
        } catch (err) {
          const status = extractStatus(err);
          const msg = (err as Error)?.message || 'sync error';
          const fatal = isFatal(status);
          const tries = (m.tries ?? 0) + 1;
          if (fatal) {
            // Drop; it'll never work as-is and would jam the queue.
            console.warn('dropping unsyncable mutation', { m, status, msg });
            await db.pending.delete(m.id);
            state.error = `Server rejected a change (${status}). Dropped: ${m.entity}`;
            hadFatal = true;
          } else if (tries > 6) {
            console.warn('max retries exceeded; dropping', { m, msg });
            await db.pending.delete(m.id);
          } else {
            await db.pending.update(m.id, { tries, last_error: msg });
          }
          // After a failure, break out so we can backoff — but keep trying
          // subsequent entries if this one was just dropped.
          if (!fatal) {
            throw err;
          }
        }
      }
      await refreshPendingCount();
    }

    if (!hadFatal) state.error = null;
    state.mode = 'configured';
    state.lastSyncAt = nowIso();
  } catch (err) {
    state.error = (err as Error)?.message || 'sync error';
    // Exponential-ish backoff: try again in 5s, then sync cadence takes over.
    scheduleRetry(5000);
  } finally {
    state.syncing = false;
    syncRunning = false;
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
  // Fire-and-forget; debounced via dedupeQueue on the next run.
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
    void runSync();
    // Periodic drain — cheap when the queue is empty.
    setInterval(() => {
      if (navigator.onLine) void runSync();
    }, 20_000);
  }
}

export async function pullTournamentFromRemote(token: string) {
  if (!supabase) return null;
  if (isAnonAuthDisabled()) return null;
  try {
    await ensureAnonymousAuth();
  } catch {
    return null;
  }
  if (isAnonAuthDisabled()) return null;
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
