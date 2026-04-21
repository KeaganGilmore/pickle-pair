import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { pullTournamentFromRemote } from '@/lib/sync';
import type { Tournament, Player, Match } from '@/lib/types';
import { useMemo } from 'react';

const REMOTE_REFETCH_MS = 20_000;

export function useTournamentByToken(token: string | undefined) {
  const qc = useQueryClient();
  const local = useLiveQuery(async () => {
    if (!token) return null;
    return (
      (await db.tournaments.where('token').equals(token).first()) ??
      (await db.tournaments.where('edit_token').equals(token).first()) ??
      null
    );
  }, [token]);

  const remote = useQuery({
    queryKey: ['tournament', token],
    queryFn: async () => {
      if (!token) return null;
      return pullTournamentFromRemote(token);
    },
    enabled: !!token,
    // Only poll the server when the tab is in the foreground and we don't
    // have a local copy yet, or rarely otherwise. Dexie live query already
    // reacts to local changes instantly.
    refetchInterval: (q) => (q.state.data ? REMOTE_REFETCH_MS : 4_000),
    refetchOnWindowFocus: true,
    staleTime: REMOTE_REFETCH_MS,
  });

  const tournament = (local ?? remote.data) as Tournament | null;

  return useMemo(
    () => ({
      tournament,
      loading: local === undefined && remote.isPending,
      isEditor: !!tournament && tournament.edit_token === token,
      refetch: () => qc.invalidateQueries({ queryKey: ['tournament', token] }),
    }),
    [tournament, local, remote.isPending, token, qc],
  );
}

export function usePlayers(tournamentId: string | undefined): Player[] {
  const players = useLiveQuery(
    async () => {
      if (!tournamentId) return [] as Player[];
      const rows = await db.players.where('tournament_id').equals(tournamentId).toArray();
      return rows.sort((a, b) => a.name.localeCompare(b.name));
    },
    [tournamentId],
    [] as Player[],
  );
  return players ?? [];
}

export function useMatches(tournamentId: string | undefined): Match[] {
  const matches = useLiveQuery(
    async () => {
      if (!tournamentId) return [] as Match[];
      const rows = await db.matches.where('tournament_id').equals(tournamentId).toArray();
      return rows.sort((a, b) => {
        if (a.round !== b.round) return a.round - b.round;
        const ac = a.court ?? 99;
        const bc = b.court ?? 99;
        return ac - bc;
      });
    },
    [tournamentId],
    [] as Match[],
  );
  return matches ?? [];
}

export function useAllTournaments(): Tournament[] {
  const rows = useLiveQuery(async () => {
    const all = await db.tournaments.toArray();
    return all.sort((a, b) => (a.updated_at < b.updated_at ? 1 : -1));
  }, [], [] as Tournament[]);
  return rows ?? [];
}

export function useTournamentData(token: string | undefined) {
  const { tournament, loading, isEditor, refetch } = useTournamentByToken(token);
  const players = usePlayers(tournament?.id);
  const matches = useMatches(tournament?.id);
  // Derived maps are re-computed only when their upstream arrays change by
  // reference; Dexie's liveQuery preserves reference identity when nothing
  // has actually changed, so downstream components avoid re-render churn.
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  return useMemo(
    () => ({ tournament, players, matches, playersById, loading, isEditor, refetch }),
    [tournament, players, matches, playersById, loading, isEditor, refetch],
  );
}
