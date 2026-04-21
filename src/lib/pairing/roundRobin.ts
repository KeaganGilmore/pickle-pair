import type { Match, Player, Tournament } from '../types';
import {
  type PairingContext,
  type PairingResult,
  pairDoubles,
  previousMatchups,
  matchKey,
} from './core';
import { shuffle } from '../utils';

// Singles round robin — circle method for all players.
// For doubles, we form teams per the partner mode, then round robin teams.
export function generateRoundRobinRound(ctx: PairingContext): PairingResult {
  const { tournament, players, existingMatches, round } = ctx;
  const warnings: string[] = [];

  if (tournament.mode === 'singles') {
    return generateSinglesRR(ctx);
  }

  // Doubles
  const partnerMode = tournament.partner_mode ?? 'random';
  if (partnerMode === 'rotating') {
    // Americano flavour inside RR — rotate partners each round
    // Fallback to americano for rotating
    return generateRotatingRR(ctx);
  }

  const teams = buildStableTeams(players, tournament, existingMatches, warnings);
  if (teams.length < 2) {
    return { round, matches: [], warnings: ['Not enough teams to schedule matches.'] };
  }

  // Pick two teams per round avoiding rematches where possible.
  const played = previousMatchups(existingMatches);
  const teamOrder = shuffle(teams);

  const pairs: { team_a: string[]; team_b: string[] }[] = [];
  const used = new Set<number>();
  for (let i = 0; i < teamOrder.length; i++) {
    if (used.has(i)) continue;
    let matched = -1;
    for (let j = i + 1; j < teamOrder.length; j++) {
      if (used.has(j)) continue;
      const k = matchKey(teamOrder[i], teamOrder[j]);
      if (!played.has(k)) {
        matched = j;
        break;
      }
    }
    if (matched === -1) {
      for (let j = i + 1; j < teamOrder.length; j++) {
        if (!used.has(j)) {
          matched = j;
          break;
        }
      }
    }
    if (matched !== -1) {
      pairs.push({ team_a: teamOrder[i], team_b: teamOrder[matched] });
      used.add(i);
      used.add(matched);
    }
  }

  return {
    round,
    matches: pairs,
    warnings,
    bye: teamOrder.findIndex((_, idx) => !used.has(idx)) !== -1 ? 'team sitting out' : null,
  };
}

function generateSinglesRR(ctx: PairingContext): PairingResult {
  const { players, existingMatches, round } = ctx;
  const played = previousMatchups(existingMatches);
  const order = shuffle(players.map((p) => p.id));
  const matches: { team_a: string[]; team_b: string[] }[] = [];
  const used = new Set<number>();
  for (let i = 0; i < order.length; i++) {
    if (used.has(i)) continue;
    let matchedIdx = -1;
    for (let j = i + 1; j < order.length; j++) {
      if (used.has(j)) continue;
      const k = matchKey([order[i]], [order[j]]);
      if (!played.has(k)) {
        matchedIdx = j;
        break;
      }
    }
    if (matchedIdx === -1) {
      for (let j = i + 1; j < order.length; j++) {
        if (!used.has(j)) {
          matchedIdx = j;
          break;
        }
      }
    }
    if (matchedIdx !== -1) {
      matches.push({ team_a: [order[i]], team_b: [order[matchedIdx]] });
      used.add(i);
      used.add(matchedIdx);
    }
  }
  const byeIdx = order.findIndex((_, idx) => !used.has(idx));
  return {
    round,
    matches,
    warnings: [],
    bye: byeIdx >= 0 ? order[byeIdx] : null,
  };
}

function buildStableTeams(
  players: Player[],
  tournament: Tournament,
  _existing: Match[],
  warnings: string[],
): string[][] {
  const mode = tournament.partner_mode ?? 'random';
  if (mode === 'fixed') {
    const seen = new Set<string>();
    const teams: string[][] = [];
    for (const p of players) {
      if (seen.has(p.id)) continue;
      if (p.fixed_partner_id) {
        const partner = players.find((q) => q.id === p.fixed_partner_id);
        if (partner && !seen.has(partner.id)) {
          teams.push([p.id, partner.id]);
          seen.add(p.id);
          seen.add(partner.id);
          continue;
        }
      }
      warnings.push(`${p.name} has no fixed partner — sat out this round.`);
      seen.add(p.id);
    }
    return teams;
  }
  // random (stable for the tournament): pair once and remember
  const { pairs, leftover, warnings: w } = pairDoubles(players, tournament.mixed);
  warnings.push(...w);
  if (leftover.length > 0) {
    warnings.push(`${leftover.length} player(s) couldn't be paired this tournament.`);
  }
  return pairs.map((p) => [p[0], p[1]]);
}

function generateRotatingRR(ctx: PairingContext): PairingResult {
  // Reuse Americano for rotating in RR context
  // (imported lazily to avoid cycle)
  return generateAmericanoRound(ctx);
}

export function generateAmericanoRound(ctx: PairingContext): PairingResult {
  const { tournament, players, existingMatches, round } = ctx;
  const warnings: string[] = [];
  // Count how many times each player has played with each other
  const partnerCount: Map<string, Map<string, number>> = new Map();
  const opponentCount: Map<string, Map<string, number>> = new Map();
  const getMap = (m: Map<string, Map<string, number>>, k: string) => {
    let inner = m.get(k);
    if (!inner) {
      inner = new Map();
      m.set(k, inner);
    }
    return inner;
  };
  const bump = (m: Map<string, Map<string, number>>, a: string, b: string) => {
    getMap(m, a).set(b, (getMap(m, a).get(b) ?? 0) + 1);
    getMap(m, b).set(a, (getMap(m, b).get(a) ?? 0) + 1);
  };
  for (const match of existingMatches) {
    if (match.status === 'void') continue;
    if (match.team_a.length === 2) bump(partnerCount, match.team_a[0], match.team_a[1]);
    if (match.team_b.length === 2) bump(partnerCount, match.team_b[0], match.team_b[1]);
    for (const a of match.team_a) {
      for (const b of match.team_b) bump(opponentCount, a, b);
    }
  }

  const pool = shuffle(players.slice());
  const used = new Set<string>();
  const matches: { team_a: string[]; team_b: string[] }[] = [];

  const pickPartner = (p: Player, candidates: Player[]) => {
    if (tournament.mixed) {
      const other = p.gender === 'M' ? 'F' : p.gender === 'F' ? 'M' : null;
      if (other) candidates = candidates.filter((c) => c.gender === other);
    }
    candidates = candidates.filter((c) => !used.has(c.id));
    if (candidates.length === 0) return null;
    candidates.sort((a, b) => {
      const ca = getMap(partnerCount, p.id).get(a.id) ?? 0;
      const cb = getMap(partnerCount, p.id).get(b.id) ?? 0;
      if (ca !== cb) return ca - cb;
      return Math.random() - 0.5;
    });
    return candidates[0];
  };

  const pickOpponentTeam = (
    team: [string, string],
    candidates: Player[],
  ): [string, string] | null => {
    const [a, b] = team;
    const freshPairs: [Player, Player][] = [];
    for (let i = 0; i < candidates.length; i++) {
      for (let j = i + 1; j < candidates.length; j++) {
        const x = candidates[i];
        const y = candidates[j];
        if (used.has(x.id) || used.has(y.id)) continue;
        if (tournament.mixed) {
          const ok =
            (x.gender === 'M' && y.gender === 'F') ||
            (x.gender === 'F' && y.gender === 'M');
          if (!ok) continue;
        }
        freshPairs.push([x, y]);
      }
    }
    if (freshPairs.length === 0) return null;
    freshPairs.sort((p1, p2) => {
      const scoreOf = ([x, y]: [Player, Player]) =>
        (getMap(partnerCount, x.id).get(y.id) ?? 0) * 3 +
        (getMap(opponentCount, a).get(x.id) ?? 0) +
        (getMap(opponentCount, a).get(y.id) ?? 0) +
        (getMap(opponentCount, b).get(x.id) ?? 0) +
        (getMap(opponentCount, b).get(y.id) ?? 0);
      return scoreOf(p1) - scoreOf(p2);
    });
    const [x, y] = freshPairs[0];
    return [x.id, y.id];
  };

  for (const p of pool) {
    if (used.has(p.id)) continue;
    const partner = pickPartner(p, pool);
    if (!partner) continue;
    const teamA: [string, string] = [p.id, partner.id];
    const available = pool.filter((pp) => !used.has(pp.id) && pp.id !== p.id && pp.id !== partner.id);
    const teamB = pickOpponentTeam(teamA, available);
    if (!teamB) {
      // Can't form opposite team; skip
      continue;
    }
    matches.push({ team_a: teamA, team_b: teamB });
    used.add(teamA[0]);
    used.add(teamA[1]);
    used.add(teamB[0]);
    used.add(teamB[1]);
  }

  const leftover = pool.filter((p) => !used.has(p.id));
  if (leftover.length > 0) {
    warnings.push(
      `${leftover.length} player(s) sitting out this round (odd count or mixed ratio).`,
    );
  }

  return { round, matches, warnings };
}
