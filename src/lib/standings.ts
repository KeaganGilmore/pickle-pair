import type { Match, Player, Standing } from './types';

export function computeStandings(players: Player[], matches: Match[]): Standing[] {
  const byId = new Map(players.map((p) => [p.id, p]));
  const stats = new Map<string, Standing>();
  for (const p of players) {
    stats.set(p.id, {
      playerId: p.id,
      name: p.name,
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      diff: 0,
      withdrawn: p.withdrawn,
    });
  }
  for (const m of matches) {
    if (m.status !== 'completed' && m.status !== 'forfeit') continue;
    const aWin = m.score_a > m.score_b;
    for (const pid of m.team_a) {
      const s = stats.get(pid);
      if (!s) continue;
      s.matchesPlayed++;
      s.pointsFor += m.score_a;
      s.pointsAgainst += m.score_b;
      if (aWin) s.wins++;
      else s.losses++;
    }
    for (const pid of m.team_b) {
      const s = stats.get(pid);
      if (!s) continue;
      s.matchesPlayed++;
      s.pointsFor += m.score_b;
      s.pointsAgainst += m.score_a;
      if (!aWin) s.wins++;
      else s.losses++;
    }
  }
  const rows = Array.from(stats.values()).map((s) => ({
    ...s,
    diff: s.pointsFor - s.pointsAgainst,
  }));
  // Sort: wins desc, diff desc, pointsFor desc, name asc
  rows.sort((a, b) => {
    if (a.wins !== b.wins) return b.wins - a.wins;
    if (a.diff !== b.diff) return b.diff - a.diff;
    if (a.pointsFor !== b.pointsFor) return b.pointsFor - a.pointsFor;
    return a.name.localeCompare(b.name);
  });
  // head-to-head tiebreak among tied rows
  applyHeadToHead(rows, matches, byId);
  return rows;
}

function applyHeadToHead(
  rows: Standing[],
  matches: Match[],
  _byId: Map<string, Player>,
) {
  // Group by (wins, diff, pointsFor)
  let i = 0;
  while (i < rows.length) {
    let j = i + 1;
    while (
      j < rows.length &&
      rows[j].wins === rows[i].wins &&
      rows[j].diff === rows[i].diff &&
      rows[j].pointsFor === rows[i].pointsFor
    ) {
      j++;
    }
    if (j - i > 1) {
      // Resolve tie among rows[i..j)
      const tied = rows.slice(i, j);
      const tiedIds = new Set(tied.map((t) => t.playerId));
      const h2h = new Map<string, number>();
      for (const t of tied) h2h.set(t.playerId, 0);
      for (const m of matches) {
        if (m.status !== 'completed') continue;
        const aAll = m.team_a.every((id) => tiedIds.has(id));
        const bAll = m.team_b.every((id) => tiedIds.has(id));
        if (!aAll || !bAll) continue;
        const aWin = m.score_a > m.score_b;
        for (const id of m.team_a) h2h.set(id, (h2h.get(id) ?? 0) + (aWin ? 1 : -1));
        for (const id of m.team_b) h2h.set(id, (h2h.get(id) ?? 0) + (aWin ? -1 : 1));
      }
      tied.sort((a, b) => (h2h.get(b.playerId) ?? 0) - (h2h.get(a.playerId) ?? 0));
      rows.splice(i, tied.length, ...tied);
    }
    i = j;
  }
}

export function teamDisplayName(
  ids: string[],
  players: Map<string, Player> | Player[],
): string {
  const map = Array.isArray(players)
    ? new Map(players.map((p) => [p.id, p]))
    : players;
  if (ids.length === 0) return '—';
  const names = ids.map((id) => map.get(id)?.name ?? '?').map((n) => n.split(' ')[0]);
  return names.join(' / ');
}
