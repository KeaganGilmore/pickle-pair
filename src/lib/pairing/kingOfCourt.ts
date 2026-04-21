import { type PairingContext, type PairingResult } from './core';
import { shuffle } from '../utils';

// King of the Court
// - N courts ranked 1 (king) down to N
// - Winners move up a court, losers move down
// - Round 1: random assignment
// - For singles, straight 1v1. For doubles, pairs per partner rules,
//   teams shuffle on losing courts (rotating) if partner_mode is rotating.
export function generateKingOfCourtRound(ctx: PairingContext): PairingResult {
  const { tournament, players, existingMatches, round } = ctx;
  const warnings: string[] = [];
  const courts = Math.max(1, tournament.courts ?? 1);

  if (round === 1) {
    const shuffled = shuffle(players.map((p) => p.id));
    return buildKotcMatches(shuffled, tournament.mode, courts, round, warnings);
  }

  // Use previous round results to reassign courts
  const prevRound = Math.max(0, round - 1);
  const prev = existingMatches.filter((m) => m.round === prevRound && m.status === 'completed');
  if (prev.length === 0) {
    warnings.push('No completed previous round — doing random assignment.');
    return buildKotcMatches(
      shuffle(players.map((p) => p.id)),
      tournament.mode,
      courts,
      round,
      warnings,
    );
  }
  // Sort by court number
  prev.sort((a, b) => (a.court ?? 99) - (b.court ?? 99));

  // For each court: winners promote (up = lower court number), losers demote.
  // Simple rule: court 1 winner stays on court 1, loser of court 1 moves to court 2,
  // winner of court N moves up (to court N-1), etc. Clamp at boundaries.
  const courtAssign: Record<number, string[]> = {};
  const place = (court: number, ids: string[]) => {
    (courtAssign[court] ??= []).push(...ids);
  };

  for (const m of prev) {
    const c = m.court ?? 1;
    const winners = m.score_a > m.score_b ? m.team_a : m.team_b;
    const losers = m.score_a > m.score_b ? m.team_b : m.team_a;
    place(Math.max(1, c - 1), winners);
    place(Math.min(courts, c + 1), losers);
  }
  // Players who didn't play last round: add to highest court with room
  const active = new Set(players.map((p) => p.id));
  const placed = new Set(Object.values(courtAssign).flat());
  const missing = players.map((p) => p.id).filter((id) => active.has(id) && !placed.has(id));
  for (const id of missing) {
    // place on most-populated court to be balanced out
    let target = 1;
    let min = Infinity;
    for (let c = 1; c <= courts; c++) {
      const count = (courtAssign[c] ?? []).length;
      if (count < min) {
        min = count;
        target = c;
      }
    }
    place(target, [id]);
  }

  // Build per-court matches
  const seeds: { team_a: string[]; team_b: string[]; court: number }[] = [];
  for (let c = 1; c <= courts; c++) {
    const group = (courtAssign[c] ?? []).filter((id) => active.has(id));
    if (group.length < 2) continue;
    if (tournament.mode === 'singles') {
      const [a, b] = shuffle(group);
      if (a && b) seeds.push({ team_a: [a], team_b: [b], court: c });
    } else {
      // doubles: take first 4 (random order). If rotating, reshuffle partners.
      const shuffled = shuffle(group).slice(0, 4);
      if (shuffled.length === 4) {
        seeds.push({
          team_a: [shuffled[0], shuffled[1]],
          team_b: [shuffled[2], shuffled[3]],
          court: c,
        });
      } else {
        warnings.push(`Court ${c} has ${shuffled.length} players — skipped.`);
      }
    }
  }

  return { round, matches: seeds, warnings };
}

function buildKotcMatches(
  playerIds: string[],
  mode: 'singles' | 'doubles',
  courts: number,
  round: number,
  warnings: string[],
): PairingResult {
  const seeds: { team_a: string[]; team_b: string[]; court: number }[] = [];
  if (mode === 'singles') {
    // Sort into courts, 2 per court
    for (let c = 1; c <= courts; c++) {
      const a = playerIds[(c - 1) * 2];
      const b = playerIds[(c - 1) * 2 + 1];
      if (a && b) seeds.push({ team_a: [a], team_b: [b], court: c });
    }
    const placed = courts * 2;
    if (playerIds.length > placed) {
      warnings.push(`${playerIds.length - placed} player(s) sitting out — not enough courts.`);
    }
  } else {
    for (let c = 1; c <= courts; c++) {
      const base = (c - 1) * 4;
      const group = playerIds.slice(base, base + 4);
      if (group.length === 4) {
        seeds.push({
          team_a: [group[0], group[1]],
          team_b: [group[2], group[3]],
          court: c,
        });
      }
    }
    const placed = courts * 4;
    if (playerIds.length > placed) {
      warnings.push(`${playerIds.length - placed} player(s) sitting out — not enough courts.`);
    }
  }
  return { round, matches: seeds, warnings };
}
