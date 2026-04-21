import type { Match, Tournament } from './types';

export function isMatchWinning(match: Match, t: Tournament): 'a' | 'b' | null {
  const { points_to_win, win_by_two } = t;
  const { score_a, score_b } = match;
  const aReached = score_a >= points_to_win;
  const bReached = score_b >= points_to_win;
  if (!aReached && !bReached) return null;
  if (win_by_two) {
    if (aReached && score_a - score_b >= 2) return 'a';
    if (bReached && score_b - score_a >= 2) return 'b';
    return null;
  }
  if (aReached && score_a > score_b) return 'a';
  if (bReached && score_b > score_a) return 'b';
  return null;
}

export function winnerTeam(m: Match): string[] {
  return m.score_a === m.score_b ? [] : m.score_a > m.score_b ? m.team_a : m.team_b;
}
