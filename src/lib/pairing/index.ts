import type { Match, Player, Tournament } from '../types';
import type { PairingContext, PairingResult } from './core';
import { makeMatches, selectPlayingSubset } from './core';
import {
  generateRoundRobinRound,
  generateAmericanoRound,
} from './roundRobin';
import { buildSingleElimBracket, advanceWinner } from './singleElim';
import { generateKingOfCourtRound } from './kingOfCourt';
import { nowIso, uid } from '../utils';

export { advanceWinner };

export function activePlayers(players: Player[]): Player[] {
  return players.filter((p) => !p.withdrawn);
}

export function validateForFormat(
  tournament: Tournament,
  players: Player[],
): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  const active = activePlayers(players);
  const min = tournament.mode === 'singles' ? 2 : 4;
  if (active.length < min) errors.push(`Need at least ${min} active players.`);
  if (tournament.mode === 'doubles') {
    if (tournament.mixed) {
      const males = active.filter((p) => p.gender === 'M').length;
      const females = active.filter((p) => p.gender === 'F').length;
      if (males < 1 || females < 1) {
        errors.push('Mixed mode needs at least one male and one female.');
      }
      const unset = active.filter((p) => p.gender === 'Unspecified' || p.gender === 'Other').length;
      if (unset > 0) errors.push(`${unset} player(s) need gender set (Mixed mode).`);
    }
    if ((tournament.partner_mode ?? 'random') === 'fixed') {
      const unset = active.filter((p) => !p.fixed_partner_id);
      if (unset.length > 0) {
        errors.push(`${unset.length} player(s) don't have a fixed partner selected.`);
      }
    }
  }
  return { ok: errors.length === 0, errors };
}

function makeSitOutByes(
  tournamentId: string,
  round: number,
  sitOutIds: string[],
): Match[] {
  const now = nowIso();
  return sitOutIds.map((id) => ({
    id: uid('m'),
    tournament_id: tournamentId,
    round,
    court: null,
    team_a: [id],
    team_b: [],
    score_a: 0,
    score_b: 0,
    status: 'bye' as const,
    bracket_slot: null,
    notes: 'sit_out',
    started_at: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  }));
}

export function generateNextRound(
  tournament: Tournament,
  players: Player[],
  existingMatches: Match[],
): { matches: Match[]; warnings: string[]; nextRound: number; sitOut: string[] } {
  const active = activePlayers(players);
  const round = (tournament.current_round ?? 0) + 1;

  // Single-elim builds its whole bracket once; no round sizing applies.
  if (tournament.format === 'single_elim') {
    if (round === 1) {
      const built = buildSingleElimBracket({
        tournament,
        players: active,
        existingMatches,
        round,
      });
      return {
        matches: built.matches,
        warnings: built.warnings,
        nextRound: 1,
        sitOut: [],
      };
    }
    return {
      matches: [],
      warnings: ['Single elim bracket is fixed at start.'],
      nextRound: round,
      sitOut: [],
    };
  }

  // King of the Court respects the court count by design.
  if (tournament.format === 'king_of_court') {
    const result = generateKingOfCourtRound({
      tournament,
      players: active,
      existingMatches,
      round,
    });
    const played = makeMatches(tournament.id, round, result.matches, tournament.courts);
    return {
      matches: played,
      warnings: result.warnings,
      nextRound: round,
      sitOut: [],
    };
  }

  // Round robin & Americano: if round_size_mode is 'by_courts', pick who sits
  // out first (strict bye fairness) and feed only the playing subset to the
  // engine. This guarantees that players with the fewest prior byes always
  // get pulled to sit, so bye drift across the tournament stays ≤ 1.
  let playingPool = active;
  let sitOutIds: string[] = [];

  if (tournament.round_size_mode === 'by_courts') {
    const sel = selectPlayingSubset(tournament, active, existingMatches);
    playingPool = active.filter((p) => sel.playingIds.has(p.id));
    sitOutIds = sel.sitOutIds;
  }

  const ctx: PairingContext = {
    tournament,
    players: playingPool,
    existingMatches,
    round,
  };

  let result: PairingResult;
  switch (tournament.format) {
    case 'round_robin':
      result = generateRoundRobinRound(ctx);
      break;
    case 'americano':
      result = generateAmericanoRound(ctx);
      break;
  }

  // Safety net: any player the engine couldn't seat (e.g. odd counts in
  // 'full' mode) still gets a bye record so standings reflect reality.
  const playingIds = new Set(result.matches.flatMap((s) => [...s.team_a, ...s.team_b]));
  const extraSitters = active
    .filter((p) => !playingIds.has(p.id) && !sitOutIds.includes(p.id))
    .map((p) => p.id);
  sitOutIds = [...sitOutIds, ...extraSitters];

  const played = makeMatches(tournament.id, round, result.matches, tournament.courts);
  const byes = makeSitOutByes(tournament.id, round, sitOutIds);

  return {
    matches: [...played, ...byes],
    warnings: result.warnings,
    nextRound: round,
    sitOut: sitOutIds,
  };
}
