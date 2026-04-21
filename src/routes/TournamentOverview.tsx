import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Play, Pause, Flag, ArrowRight, Sparkle } from 'lucide-react';
import { toast } from 'sonner';
import { useTournamentData } from '@/hooks/useTournament';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { PlayerManager } from '@/components/PlayerManager';
import { MatchCard } from '@/components/MatchCard';
import { generateNextRound, validateForFormat } from '@/lib/pairing';
import { upsertTournament, upsertMatches, audit } from '@/lib/repo';
import { nowIso } from '@/lib/utils';
import type { Tournament } from '@/lib/types';

export function TournamentOverview() {
  const { token } = useParams<{ token: string }>();
  const { tournament, players, matches, playersById, isEditor } = useTournamentData(token);
  if (!tournament) return null;

  const upcoming = matches.filter(
    (m) =>
      m.round === tournament.current_round &&
      m.status !== 'completed' &&
      m.status !== 'bye',
  );
  const currentRoundMatches = matches.filter(
    (m) => m.round === tournament.current_round && !(m.status === 'bye' && m.notes === 'sit_out'),
  );
  const canStart = tournament.status === 'setup';

  const startOrNext = async () => {
    const v = validateForFormat(tournament, players);
    if (!v.ok) {
      toast.error(v.errors[0]);
      return;
    }
    const { matches: generated, warnings, nextRound, sitOut } = generateNextRound(tournament, players, matches);
    if (generated.length === 0 && warnings.length > 0) {
      toast.error(warnings[0]);
      return;
    }
    await upsertMatches(generated);
    const updated: Tournament = {
      ...tournament,
      current_round: nextRound,
      status: 'live',
      updated_at: nowIso(),
    };
    await upsertTournament(updated);
    await audit(tournament.id, 'round_generated', undefined, { round: nextRound, count: generated.length });
    for (const w of warnings) toast.warning(w);
    toast.success(
      tournament.current_round === 0
        ? `Tournament started — round ${nextRound} ready.`
        : `Round ${nextRound} generated.`,
    );
    if (sitOut.length > 0) {
      toast(`${sitOut.length} player${sitOut.length === 1 ? '' : 's'} sitting out this round.`);
    }
  };

  const togglePause = async () => {
    const next = tournament.status === 'paused' ? 'live' : 'paused';
    await upsertTournament({ ...tournament, status: next, updated_at: nowIso() });
    await audit(tournament.id, next === 'paused' ? 'tournament_paused' : 'tournament_resumed');
    toast(`Tournament ${next === 'paused' ? 'paused' : 'resumed'}.`);
  };

  const finish = async () => {
    await upsertTournament({ ...tournament, status: 'done', updated_at: nowIso() });
    toast.success('Tournament marked as done.');
  };

  return (
    <div className="grid gap-5 md:grid-cols-[1.2fr_1fr]">
      <div className="grid gap-5">
        <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle>
                    {tournament.status === 'setup' && 'Ready to start?'}
                    {tournament.status === 'live' && `Round ${tournament.current_round}`}
                    {tournament.status === 'paused' && `Paused — round ${tournament.current_round}`}
                    {tournament.status === 'done' && 'Tournament complete'}
                  </CardTitle>
                  <CardDescription>
                    {tournament.status === 'setup' && 'Add players below, then generate round 1.'}
                    {tournament.status === 'live' && `${currentRoundMatches.length} matches this round`}
                    {tournament.status === 'paused' && 'No new pairings advance until resumed.'}
                    {tournament.status === 'done' && 'Final standings are locked in.'}
                  </CardDescription>
                </div>
                <Sparkle className="h-5 w-5 text-accent" />
              </div>
            </CardHeader>
            {isEditor && tournament.status !== 'done' && (
              <CardContent className="flex flex-wrap gap-2">
                {tournament.format !== 'single_elim' || tournament.current_round === 0 ? (
                  <Button onClick={startOrNext} variant="accent" size="lg">
                    <Play className="h-4 w-4" />
                    {canStart ? 'Start tournament' : `Generate round ${tournament.current_round + 1}`}
                  </Button>
                ) : null}
                {tournament.status === 'live' && (
                  <Button variant="subtle" onClick={togglePause}>
                    <Pause className="h-4 w-4" /> Pause
                  </Button>
                )}
                {tournament.status === 'paused' && (
                  <Button variant="subtle" onClick={togglePause}>
                    <Play className="h-4 w-4" /> Resume
                  </Button>
                )}
                {tournament.status !== 'setup' && (
                  <Button variant="ghost" onClick={finish}>
                    <Flag className="h-4 w-4" /> Finish
                  </Button>
                )}
              </CardContent>
            )}
          </Card>
        </motion.div>

        {upcoming.length > 0 && (
          <section>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                Current round
              </h2>
              <Button asChild variant="ghost" size="sm">
                <Link to={`/t/${token}/matches`}>
                  All matches <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {upcoming.slice(0, 4).map((m) => (
                <MatchCard
                  key={m.id}
                  match={m}
                  players={playersById}
                  tournament={tournament}
                  allMatches={matches}
                  basePath={`/t/${token}`}
                  canEdit={isEditor}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      <aside>
        <div className="flex items-center gap-2 mb-2">
          <Users className="h-4 w-4 text-muted-foreground" />
        </div>
        <PlayerManager tournament={tournament} players={players} canEdit={isEditor} />
      </aside>
    </div>
  );
}
