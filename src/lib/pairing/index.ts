import type { Match, Player, Tournament } from '../types';
import type { PairingContext, PairingResult, MatchSeed } from './core';
import { makeMatches, trimToCourts } from './core';
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
  const ctx: PairingContext = { tournament, players: active, existingMatches, round };
  let result: PairingResult;

  switch (tournament.format) {
    case 'round_robin':
      result = generateRoundRobinRound(ctx);
      break;
    case 'americano':
      result = generateAmericanoRound(ctx);
      break;
    case 'king_of_court':
      // KOTC already respects court count by design.
      result = generateKingOfCourtRound(ctx);
      break;
    case 'single_elim': {
      if (round === 1) {
        const built = buildSingleElimBracket(ctx);
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
  }

  // Apply round-size mode: 'by_courts' trims to available courts and sits
  // the least-bye'd players out, respecting fairness across rounds.
  // KOTC already respects courts; SE uses a fixed bracket.
  const trimmableFormats = new Set(['round_robin', 'americano']);
  const shouldTrim =
    tournament.round_size_mode === 'by_courts' &&
    trimmableFormats.has(tournament.format);

  let kept: MatchSeed[] = result.matches;
  let sitOutIds: string[] = [];

  if (shouldTrim && tournament.courts > 0) {
    const trimmed = trimToCourts(result.matches, active, existingMatches, tournament.courts);
    kept = trimmed.kept;
    sitOutIds = trimmed.sitOut;
  } else {
    // Even in full mode, players the engine couldn't pair get a bye record.
    const playingIds = new Set(kept.flatMap((s) => [...s.team_a, ...s.team_b]));
    sitOutIds = active.filter((p) => !playingIds.has(p.id)).map((p) => p.id);
  }

  const played = makeMatches(tournament.id, round, kept, tournament.courts);
  const byes = makeSitOutByes(tournament.id, round, sitOutIds);

  return {
    matches: [...played, ...byes],
    warnings: result.warnings,
    nextRound: round,
    sitOut: sitOutIds,
  };
}
