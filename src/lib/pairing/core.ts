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

// Count prior sit-out byes per player. Distinguished from bracket byes by
// the notes='sit_out' marker that the round-size trimmer writes.
export function countSitOutByes(matches: Match[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of matches) {
    if (m.status !== 'bye' || m.notes !== 'sit_out') continue;
    for (const id of m.team_a) map.set(id, (map.get(id) ?? 0) + 1);
  }
  return map;
}

// Count total matches a player participated in (including byes).
export function countPlayerAppearances(matches: Match[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const m of matches) {
    if (m.status === 'void') continue;
    for (const id of [...m.team_a, ...m.team_b]) {
      map.set(id, (map.get(id) ?? 0) + 1);
    }
  }
  return map;
}

// Trim a list of proposed matches to fit the available courts, picking the
// ones that give priority to players who have sat out more (bye fairness).
// Returns kept matches plus the player ids that sit out this round.
export function trimToCourts(
  seeds: MatchSeed[],
  activePlayers: Player[],
  existing: Match[],
  maxMatches: number,
): { kept: MatchSeed[]; sitOut: string[] } {
  if (seeds.length <= maxMatches) {
    const playingIds = new Set(seeds.flatMap((s) => [...s.team_a, ...s.team_b]));
    const sitOut = activePlayers.filter((p) => !playingIds.has(p.id)).map((p) => p.id);
    return { kept: seeds, sitOut };
  }
  const byes = countSitOutByes(existing);
  const appearances = countPlayerAppearances(existing);
  const score = (s: MatchSeed) => {
    const ids = [...s.team_a, ...s.team_b];
    if (ids.length === 0) return -Infinity;
    // Higher bye count = higher priority to play. Penalize players with many
    // appearances slightly so a player who's played every round doesn't keep
    // getting picked if a less-played alternative exists.
    const avgByes = ids.reduce((acc, id) => acc + (byes.get(id) ?? 0), 0) / ids.length;
    const avgPlays = ids.reduce((acc, id) => acc + (appearances.get(id) ?? 0), 0) / ids.length;
    return avgByes * 10 - avgPlays;
  };
  const sorted = seeds
    .map((s, i) => ({ s, i, score: score(s) }))
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const kept = sorted.slice(0, maxMatches).map((x) => x.s);
  const playingIds = new Set(kept.flatMap((s) => [...s.team_a, ...s.team_b]));
  const sitOut = activePlayers.filter((p) => !playingIds.has(p.id)).map((p) => p.id);
  return { kept, sitOut };
}
