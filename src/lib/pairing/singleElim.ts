import type { Match } from '../types';
import {
  type PairingContext,
  type PairingResult,
  type MatchSeed,
  pairDoubles,
} from './core';
import { shuffle, nowIso, uid } from '../utils';

// Build complete single elimination bracket up-front (all rounds, with placeholders).
// Round numbers: 1 = first round. Seeds laid out in standard bracket order.
export function buildSingleElimBracket(ctx: PairingContext): {
  matches: Match[];
  warnings: string[];
} {
  const { tournament, players } = ctx;
  const warnings: string[] = [];
  let teams: string[][] = [];

  if (tournament.mode === 'singles') {
    teams = shuffle(players.map((p) => [p.id]));
  } else {
    if ((tournament.partner_mode ?? 'random') === 'fixed') {
      const seen = new Set<string>();
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
        warnings.push(`${p.name} has no fixed partner — excluded from bracket.`);
        seen.add(p.id);
      }
    } else {
      const { pairs, warnings: w } = pairDoubles(players, tournament.mixed);
      warnings.push(...w);
      teams = pairs.map((p) => [p[0], p[1]]);
    }
  }

  if (teams.length < 2) {
    return { matches: [], warnings: ['Need at least 2 teams for an elimination bracket.'] };
  }

  // Expand to next power of two with byes
  const size = nextPow2(teams.length);
  const seeded = [...teams];
  while (seeded.length < size) seeded.push([]); // empty = bye

  const bracketOrder = standardBracketOrder(size);
  const ordered = bracketOrder.map((i) => seeded[i] ?? []);

  // Generate round-by-round with placeholders; advance byes immediately
  const rounds: MatchSeed[][] = [];
  const now = nowIso();
  // Round 1
  const r1: MatchSeed[] = [];
  for (let i = 0; i < ordered.length; i += 2) {
    r1.push({
      team_a: ordered[i],
      team_b: ordered[i + 1] ?? [],
      bracket_slot: `R1-${i / 2 + 1}`,
    });
  }
  rounds.push(r1);

  let prev = r1;
  let roundIdx = 2;
  while (prev.length > 1) {
    const next: MatchSeed[] = [];
    for (let i = 0; i < prev.length; i += 2) {
      next.push({
        team_a: [],
        team_b: [],
        bracket_slot: `R${roundIdx}-${i / 2 + 1}`,
      });
    }
    rounds.push(next);
    prev = next;
    roundIdx++;
  }

  const allMatches: Match[] = [];
  rounds.forEach((roundSeeds, rIdx) => {
    roundSeeds.forEach((s) => {
      allMatches.push({
        id: uid('m'),
        tournament_id: tournament.id,
        round: rIdx + 1,
        court: null,
        team_a: s.team_a,
        team_b: s.team_b,
        score_a: 0,
        score_b: 0,
        status: s.team_a.length === 0 && s.team_b.length === 0 ? 'scheduled' : 'scheduled',
        bracket_slot: s.bracket_slot ?? null,
        created_at: now,
        updated_at: now,
      });
    });
  });

  // Auto-advance byes in round 1
  const round1 = allMatches.filter((m) => m.round === 1);
  const round2 = allMatches.filter((m) => m.round === 2);
  round1.forEach((m, i) => {
    const aBye = m.team_a.length === 0;
    const bBye = m.team_b.length === 0;
    if (aBye && !bBye) {
      m.status = 'bye';
      m.winner_feeds_match = round2[Math.floor(i / 2)]?.id;
      feedWinner(round2, i, m.team_b);
    } else if (bBye && !aBye) {
      m.status = 'bye';
      feedWinner(round2, i, m.team_a);
    } else if (aBye && bBye) {
      m.status = 'bye';
    }
  });

  return { matches: allMatches, warnings };
}

function feedWinner(nextRound: Match[], sourceIdx: number, winnerTeam: string[]) {
  const targetIdx = Math.floor(sourceIdx / 2);
  const target = nextRound[targetIdx];
  if (!target) return;
  if (sourceIdx % 2 === 0) target.team_a = winnerTeam;
  else target.team_b = winnerTeam;
}

function nextPow2(n: number): number {
  let p = 1;
  while (p < n) p *= 2;
  return Math.max(p, 2);
}

// Standard bracket seeding order for size N (e.g., 8 -> 1,8,4,5,2,7,3,6)
function standardBracketOrder(size: number): number[] {
  if (size === 1) return [0];
  let order = [0, 1];
  while (order.length < size) {
    const n = order.length * 2;
    const next: number[] = [];
    for (const s of order) {
      next.push(s);
      next.push(n - 1 - s);
    }
    order = next;
  }
  return order;
}

// When a match finishes, advance the winner into the next bracket match.
export function advanceWinner(
  allMatches: Match[],
  finished: Match,
): Match[] {
  if (!finished.bracket_slot) return [];
  const idx = allMatches.findIndex((m) => m.id === finished.id);
  if (idx === -1) return [];
  const sameRound = allMatches.filter((m) => m.round === finished.round).sort(compareBySlot);
  const nextRound = allMatches.filter((m) => m.round === finished.round + 1).sort(compareBySlot);
  if (nextRound.length === 0) return [];
  const sourceIdx = sameRound.findIndex((m) => m.id === finished.id);
  const target = nextRound[Math.floor(sourceIdx / 2)];
  if (!target) return [];
  const winner = finished.score_a > finished.score_b ? finished.team_a : finished.team_b;
  if (sourceIdx % 2 === 0) target.team_a = winner;
  else target.team_b = winner;
  target.updated_at = nowIso();
  return [target];
}

function compareBySlot(a: Match, b: Match): number {
  const parse = (s: string | null | undefined) => {
    if (!s) return 0;
    const m = /R\d+-(\d+)/.exec(s);
    return m ? parseInt(m[1], 10) : 0;
  };
  return parse(a.bracket_slot) - parse(b.bracket_slot);
}

// Re-pair current round (for RR/Americano this is a shuffle; for SE, reseed round 1 from remaining teams)
export function _unused() {
  // intentional
}

export type { PairingContext, PairingResult };
