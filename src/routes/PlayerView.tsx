import { useParams } from 'react-router-dom';
import { useTournamentData } from '@/hooks/useTournament';
import { MatchCard } from '@/components/MatchCard';
import { Badge } from '@/components/ui/Badge';
import { computeStandings } from '@/lib/standings';

export function PlayerView() {
  const { token, playerId } = useParams<{ token: string; playerId: string }>();
  const { tournament, players, matches, playersById } = useTournamentData(token);
  const player = players.find((p) => p.id === playerId);
  if (!tournament || !player) return null;

  const myMatches = matches.filter(
    (m) => m.team_a.includes(player.id) || m.team_b.includes(player.id),
  );
  const upcoming = myMatches.filter((m) => m.status !== 'completed' && m.status !== 'bye');
  const past = myMatches.filter((m) => m.status === 'completed');
  const standings = computeStandings(players, matches);
  const rank = standings.findIndex((s) => s.playerId === player.id) + 1;
  const me = standings.find((s) => s.playerId === player.id);

  return (
    <div>
      <header className="mb-4 flex flex-wrap items-center gap-2">
        <h2 className="font-serif text-2xl">{player.name}</h2>
        <Badge variant="outline">Rank {rank}</Badge>
        {me && (
          <Badge variant="accent">
            {me.wins}–{me.losses} · {me.diff >= 0 ? '+' : ''}
            {me.diff}
          </Badge>
        )}
      </header>

      <section className="mb-6">
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Upcoming
        </h3>
        {upcoming.length === 0 && (
          <div className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            Nothing scheduled right now.
          </div>
        )}
        <div className="grid gap-3 sm:grid-cols-2">
          {upcoming.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              players={playersById}
              tournament={tournament}
              basePath={`/t/${token}`}
              compact
            />
          ))}
        </div>
      </section>
      <section>
        <h3 className="mb-2 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Played
        </h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {past.map((m) => (
            <MatchCard
              key={m.id}
              match={m}
              players={playersById}
              tournament={tournament}
              basePath={`/t/${token}`}
              compact
            />
          ))}
        </div>
      </section>
    </div>
  );
}
