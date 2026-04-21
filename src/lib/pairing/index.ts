import type { Match, Player, Tournament } from '../types';
import type { PairingContext, PairingResult } from './core';
import { makeMatches } from './core';
import {
  generateRoundRobinRound,
  generateAmericanoRound,
} from './roundRobin';
import { buildSingleElimBracket, advanceWinner } from './singleElim';
import { generateKingOfCourtRound } from './kingOfCourt';

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
  const min =
    tournament.mode === 'singles' ? 2 : 4;
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

export function generateNextRound(
  tournament: Tournament,
  players: Player[],
  existingMatches: Match[],
): { matches: Match[]; warnings: string[]; nextRound: number } {
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
      result = generateKingOfCourtRound(ctx);
      break;
    case 'single_elim': {
      // Single elim: full bracket generated once on round 1
      if (round === 1) {
        const built = buildSingleElimBracket(ctx);
        return { matches: built.matches, warnings: built.warnings, nextRound: 1 };
      }
      return { matches: [], warnings: ['Single elim bracket is fixed at start.'], nextRound: round };
    }
  }
  const matches = makeMatches(tournament.id, round, result.matches, tournament.courts);
  return { matches, warnings: result.warnings, nextRound: round };
}
