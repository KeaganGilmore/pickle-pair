import { db } from './db';
import { enqueue } from './sync';
import type {
  Tournament,
  Player,
  Match,
  AuditLog,
  AuditAction,
} from './types';
import { nowIso, uid } from './utils';

// ─── Tournaments ──────────────────────────────────────────────

export async function upsertTournament(t: Tournament) {
  await db.tournaments.put(t);
  await enqueue('tournament', 'upsert', t, t.id);
}

export async function getTournamentByToken(token: string): Promise<Tournament | null> {
  const byView = await db.tournaments.where('token').equals(token).first();
  if (byView) return byView;
  const byEdit = await db.tournaments.where('edit_token').equals(token).first();
  return byEdit ?? null;
}

// ─── Players ──────────────────────────────────────────────────

export async function listPlayers(tournamentId: string): Promise<Player[]> {
  return db.players.where('tournament_id').equals(tournamentId).toArray();
}

export async function upsertPlayer(p: Player) {
  await db.players.put(p);
  await enqueue('player', 'upsert', p, p.tournament_id);
}

export async function upsertPlayers(players: Player[]) {
  await db.players.bulkPut(players);
  for (const p of players) await enqueue('player', 'upsert', p, p.tournament_id);
}

export async function deletePlayer(p: Player) {
  await db.players.delete(p.id);
  await enqueue('player', 'delete', { id: p.id }, p.tournament_id);
}

// ─── Matches ──────────────────────────────────────────────────

export async function listMatches(tournamentId: string): Promise<Match[]> {
  return db.matches
    .where('tournament_id')
    .equals(tournamentId)
    .sortBy('round');
}

export async function upsertMatch(m: Match) {
  await db.matches.put(m);
  await enqueue('match', 'upsert', m, m.tournament_id);
}

export async function upsertMatches(matches: Match[]) {
  if (matches.length === 0) return;
  await db.matches.bulkPut(matches);
  for (const m of matches) await enqueue('match', 'upsert', m, m.tournament_id);
}

export async function deleteMatches(ids: string[], tournamentId: string) {
  if (ids.length === 0) return;
  await db.matches.bulkDelete(ids);
  for (const id of ids) await enqueue('match', 'delete', { id }, tournamentId);
}

// ─── Audit ────────────────────────────────────────────────────

export async function audit(
  tournamentId: string,
  action: AuditAction,
  targetId?: string,
  payload?: Record<string, unknown>,
) {
  const row: AuditLog = {
    id: uid('a'),
    tournament_id: tournamentId,
    action,
    target_id: targetId ?? null,
    payload: payload ?? null,
    created_at: nowIso(),
  };
  await db.audit.put(row);
  await enqueue('audit', 'upsert', row, tournamentId);
}

export async function listAudit(tournamentId: string, limit = 50): Promise<AuditLog[]> {
  const all = await db.audit.where('tournament_id').equals(tournamentId).toArray();
  return all.sort((a, b) => (a.created_at < b.created_at ? 1 : -1)).slice(0, limit);
}
