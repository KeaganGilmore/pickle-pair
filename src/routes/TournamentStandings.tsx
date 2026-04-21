import { useParams } from 'react-router-dom';
import { Trophy, Download } from 'lucide-react';
import { useTournamentData } from '@/hooks/useTournament';
import { computeStandings } from '@/lib/standings';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';

export function TournamentStandings() {
  const { token } = useParams<{ token: string }>();
  const { tournament, players, matches } = useTournamentData(token);
  if (!tournament) return null;
  const standings = computeStandings(players, matches);
  const hasAny = standings.some((s) => s.matchesPlayed > 0);

  const exportCsv = () => {
    const rows = [
      ['Rank', 'Player', 'MP', 'W', 'L', 'PF', 'PA', 'Diff', 'Byes'],
      ...standings.map((s, i) => [
        (i + 1).toString(),
        s.name,
        s.matchesPlayed.toString(),
        s.wins.toString(),
        s.losses.toString(),
        s.pointsFor.toString(),
        s.pointsAgainst.toString(),
        s.diff.toString(),
        s.byes.toString(),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => (c.includes(',') ? `"${c}"` : c)).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${tournament.name.replace(/\s+/g, '_')}-standings.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV exported.');
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Standings
        </h2>
        <Button variant="ghost" size="sm" onClick={exportCsv} disabled={!hasAny}>
          <Download className="h-4 w-4" /> CSV
        </Button>
      </div>

      {!hasAny ? (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center text-muted-foreground">
          Play some matches to see the standings.
        </div>
      ) : (
        <>
          {/* Phone: card list */}
          <ul className="grid gap-2 md:hidden">
            {standings.map((s, i) => (
              <li
                key={s.playerId}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                <Rank index={i} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium truncate">{s.name}</span>
                    {s.withdrawn && <Badge variant="warn">Withdrawn</Badge>}
                  </div>
                  <div className="text-xs text-muted-foreground tnum">
                    {s.wins}-{s.losses} · {s.matchesPlayed} played
                  </div>
                </div>
                <div className="text-right tnum">
                  <div className="font-semibold">
                    {s.diff >= 0 ? '+' : ''}
                    {s.diff}
                  </div>
                  <div className="text-[10px] text-muted-foreground">diff</div>
                </div>
              </li>
            ))}
          </ul>

          {/* Tablet/Desktop: table */}
          <div className="hidden md:block overflow-hidden rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="p-3 text-left">#</th>
                  <th className="p-3 text-left">Player</th>
                  <th className="p-3 text-right tnum">MP</th>
                  <th className="p-3 text-right tnum">W</th>
                  <th className="p-3 text-right tnum">L</th>
                  <th className="p-3 text-right tnum">PF</th>
                  <th className="p-3 text-right tnum">PA</th>
                  <th className="p-3 text-right tnum">Diff</th>
                  <th className="p-3 text-right tnum">Byes</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((s, i) => (
                  <tr
                    key={s.playerId}
                    className="border-t border-border transition-colors hover:bg-muted/30"
                  >
                    <td className="p-3"><Rank index={i} /></td>
                    <td className="p-3">
                      <span className="font-medium">{s.name}</span>
                      {s.withdrawn && <Badge variant="warn" className="ml-2">Withdrawn</Badge>}
                    </td>
                    <td className="p-3 text-right tnum">{s.matchesPlayed}</td>
                    <td className="p-3 text-right tnum">{s.wins}</td>
                    <td className="p-3 text-right tnum">{s.losses}</td>
                    <td className="p-3 text-right tnum">{s.pointsFor}</td>
                    <td className="p-3 text-right tnum">{s.pointsAgainst}</td>
                    <td className="p-3 text-right tnum font-semibold">
                      {s.diff >= 0 ? '+' : ''}{s.diff}
                    </td>
                    <td className="p-3 text-right tnum text-muted-foreground">{s.byes}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Rank({ index }: { index: number }) {
  const medal = index < 3;
  const color = index === 0 ? 'text-yellow-500' : index === 1 ? 'text-slate-400' : index === 2 ? 'text-amber-700' : '';
  return medal ? (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted">
      <Trophy className={`h-3.5 w-3.5 ${color}`} />
    </div>
  ) : (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted/60 text-xs tabular-nums text-muted-foreground">
      {index + 1}
    </div>
  );
}
