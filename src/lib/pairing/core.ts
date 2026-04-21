import type { Match, Player, Tournament } from '../types';
import { nowIso, shuffle, uid } from '../utils';

export type MatchSeed = {
  team_a: string[]; // player ids
  team_b: string[];
  court?: number | null;
  bracket_slot?: string | null;
};

export type PairingContext = {
  tournament: Tournament;
  players: Player[]; // active (non-withdrawn)
  existingMatches: Match[]; // prior matches (for history/avoid rematches)
  round: number;
};

export type PairingResult = {
  round: number;
  matches: MatchSeed[];
  warnings: string[];
  bye?: string | null; // player id sitting out (singles/doubles with odd count)
};

export function makeMatches(
  tournamentId: string,
  round: number,
  seeds: MatchSeed[],
  courtCount: number,
): Match[] {
  return seeds.map((s, idx) => ({
    id: uid('m'),
    tournament_id: tournamentId,
    round,
    court: s.court ?? ((idx % Math.max(courtCount, 1)) + 1),
    team_a: s.team_a,
    team_b: s.team_b,
    score_a: 0,
    score_b: 0,
    status: 'scheduled',
    bracket_slot: s.bracket_slot ?? null,
    started_at: null,
    completed_at: null,
    created_at: nowIso(),
    updated_at: nowIso(),
  }));
}

// Build gender-respecting pairs when mixed mode on.
// Returns list of pairs (each [p1, p2] ids). If odd count or impossible, returns leftover list.
export function pairDoubles(
  players: Player[],
  mixed: boolean,
): { pairs: [string, string][]; leftover: Player[]; warnings: string[] } {
  const warnings: string[] = [];
  if (!mixed) {
    const shuffled = shuffle(players);
    const pairs: [string, string][] = [];
    for (let i = 0; i + 1 < shuffled.length; i += 2) {
      pairs.push([shuffled[i].id, shuffled[i + 1].id]);
    }
    const leftover = shuffled.length % 2 === 1 ? [shuffled[shuffled.length - 1]] : [];
    return { pairs, leftover, warnings };
  }
  // Mixed: one M and one F per pair
  const males = shuffle(players.filter((p) => p.gender === 'M'));
  const females = shuffle(players.filter((p) => p.gender === 'F'));
  const unset = players.filter((p) => p.gender !== 'M' && p.gender !== 'F');
  if (unset.length > 0) {
    warnings.push(
      `${unset.length} player(s) don't have gender set — they can't be paired in mixed mode until set.`,
    );
  }
  const n = Math.min(males.length, females.length);
  const pairs: [string, string][] = [];
  for (let i = 0; i < n; i++) pairs.push([males[i].id, females[i].id]);
  const leftover = [
    ...males.slice(n),
    ...females.slice(n),
    ...unset,
  ];
  if (males.length !== females.length) {
    warnings.push(
      `M:F ratio is ${males.length}:${females.length} — ${Math.abs(males.length - females.length)} player(s) will sit out or need override.`,
    );
  }
  return { pairs, leftover, warnings };
}

export function teamKey(ids: string[]): string {
  return ids.slice().sort().join('|');
}

export function matchKey(a: string[], b: string[]): string {
  const [x, y] = [teamKey(a), teamKey(b)].sort();
  return `${x}::${y}`;
}

export function previousMatchups(matches: Match[]): Set<string> {
  const set = new Set<string>();
  for (const m of matches) {
    if (m.status === 'void') continue;
    set.add(matchKey(m.team_a, m.team_b));
  }
  return set;
}
