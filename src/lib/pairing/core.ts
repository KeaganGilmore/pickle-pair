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

// Select the players who will sit this round BEFORE pairing, using strict
// fairness: fewest prior byes sit out first, ties broken by most prior
// appearances. Returns the set of player ids that should play and the ids
// that sit, given the tournament shape (mode, partner_mode, mixed, courts).
//
// The downstream engine then only sees the playing subset, so whoever plays
// really does play — it can't quietly drop a high-bye player because of
// partner availability. Drift in per-player bye counts is capped at 1 across
// the tournament: every round, the players with the fewest byes get pulled
// out of the playing pool, which equalizes as the rounds progress.
export type SitterSelection = {
  playingIds: Set<string>;
  sitOutIds: string[];
};

type TournamentShape = {
  mode: 'singles' | 'doubles';
  courts: number;
  mixed: boolean;
  partner_mode?: 'random' | 'fixed' | 'rotating' | null;
};

export function selectPlayingSubset(
  tournament: TournamentShape,
  active: Player[],
  existing: Match[],
): SitterSelection {
  const byes = countSitOutByes(existing);
  const appearances = countPlayerAppearances(existing);
  const score = (p: Player) => {
    // Higher byes first, then fewer appearances first (secondary).
    const bye = byes.get(p.id) ?? 0;
    const plays = appearances.get(p.id) ?? 0;
    return bye * 1000 - plays;
  };
  const cmp = (a: Player, b: Player) => {
    const diff = score(b) - score(a);
    if (diff !== 0) return diff;
    return a.id.localeCompare(b.id); // stable deterministic tiebreak
  };

  const perMatch = tournament.mode === 'singles' ? 2 : 4;
  const maxPlaying = Math.max(0, tournament.courts * perMatch);

  // ── Fixed partner doubles: pairs are atomic, pick whole pairs by fairness
  if (
    tournament.mode === 'doubles' &&
    (tournament.partner_mode ?? 'random') === 'fixed'
  ) {
    const seen = new Set<string>();
    const pairs: [Player, Player][] = [];
    for (const p of active) {
      if (seen.has(p.id)) continue;
      const partnerId = p.fixed_partner_id ?? null;
      if (partnerId) {
        const partner = active.find((q) => q.id === partnerId);
        if (partner && !seen.has(partner.id)) {
          pairs.push([p, partner]);
          seen.add(p.id);
          seen.add(partner.id);
          continue;
        }
      }
      // No partner — this player effectively sits
      seen.add(p.id);
    }
    const pairScore = ([a, b]: [Player, Player]) => (score(a) + score(b)) / 2;
    pairs.sort((a, b) => pairScore(b) - pairScore(a));
    const pairsWanted = tournament.courts * 2; // 2 pairs per match
    const playingPairs = pairs.slice(0, Math.min(pairsWanted, pairs.length));
    const playingIds = new Set(playingPairs.flatMap(([a, b]) => [a.id, b.id]));
    const sitOutIds = active.filter((p) => !playingIds.has(p.id)).map((p) => p.id);
    return { playingIds, sitOutIds };
  }

  // ── Mixed doubles (random/rotating): equal M and F per match
  if (tournament.mode === 'doubles' && tournament.mixed) {
    const males = active.filter((p) => p.gender === 'M').sort(cmp);
    const females = active.filter((p) => p.gender === 'F').sort(cmp);
    const others = active.filter((p) => p.gender !== 'M' && p.gender !== 'F');
    const needPerGender = tournament.courts * 2; // 2 per match of each gender
    // Each court needs 1M+1F per team × 2 teams = 2M+2F. To keep pairs
    // balanced we only play as many of each as we have of the other.
    const n = Math.min(
      needPerGender,
      males.length,
      females.length,
    );
    const playingMales = males.slice(0, n);
    const playingFemales = females.slice(0, n);
    const playingIds = new Set([
      ...playingMales.map((p) => p.id),
      ...playingFemales.map((p) => p.id),
    ]);
    const sitOutIds = [
      ...males.slice(n),
      ...females.slice(n),
      ...others,
    ].map((p) => p.id);
    return { playingIds, sitOutIds };
  }

  // ── Everything else: singles, non-mixed random doubles, rotating doubles
  const sorted = [...active].sort(cmp);
  let take = Math.min(maxPlaying, active.length);
  // For doubles, the engine pairs in groups of 4; trim to a multiple of 4.
  if (tournament.mode === 'doubles') take = take - (take % 4);
  if (tournament.mode === 'singles') take = take - (take % 2);
  const playing = sorted.slice(0, take);
  const playingIds = new Set(playing.map((p) => p.id));
  const sitOutIds = active.filter((p) => !playingIds.has(p.id)).map((p) => p.id);
  return { playingIds, sitOutIds };
}
