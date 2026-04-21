import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { pullTournamentFromRemote } from '@/lib/sync';
import type { Tournament, Player, Match } from '@/lib/types';
import { useMemo } from 'react';

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
    refetchInterval: 10_000,
    refetchOnWindowFocus: true,
  });

  return {
    tournament: (local ?? remote.data) as Tournament | null,
    loading: local === undefined && remote.isPending,
    isEditor: local ? local.edit_token === token : false,
    refetch: () => qc.invalidateQueries({ queryKey: ['tournament', token] }),
  };
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
  const playersById = useMemo(() => new Map(players.map((p) => [p.id, p])), [players]);
  return { tournament, players, matches, playersById, loading, isEditor, refetch };
}
