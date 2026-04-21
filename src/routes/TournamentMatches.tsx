import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Coffee } from 'lucide-react';
import type { Match, Player } from '@/lib/types';
import { Sparkles, RefreshCw, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { toast } from 'sonner';
import { useTournamentData } from '@/hooks/useTournament';
import { MatchCard } from '@/components/MatchCard';
import { Button } from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from '@/components/ui/Dialog';
import { groupBy } from '@/lib/utils';
import { generateNextRound, validateForFormat } from '@/lib/pairing';
import { upsertMatches, upsertTournament, deleteMatches, audit } from '@/lib/repo';
import { nowIso } from '@/lib/utils';

export function TournamentMatches() {
  const { token } = useParams<{ token: string }>();
  const { tournament, players, matches, playersById, isEditor } = useTournamentData(token);
  if (!tournament) return null;

  const grouped = groupBy(matches, (m) => m.round);
  const rounds = Object.keys(grouped).map(Number).sort((a, b) => a - b);

  const generate = async () => {
    const v = validateForFormat(tournament, players);
    if (!v.ok) {
      toast.error(v.errors[0]);
      return;
    }
    const result = generateNextRound(tournament, players, matches);
    if (result.matches.length === 0) {
      toast.error(result.warnings[0] ?? 'No matches generated.');
      return;
    }
    await upsertMatches(result.matches);
    await upsertTournament({ ...tournament, current_round: result.nextRound, status: 'live', updated_at: nowIso() });
    await audit(tournament.id, 'round_generated', undefined, { round: result.nextRound });
    result.warnings.forEach((w) => toast.warning(w));
    toast.success(`Round ${result.nextRound} generated.`);
  };

  const deleteRound = async (round: number) => {
    const toDelete = matches.filter((m) => m.round === round).map((m) => m.id);
    if (toDelete.length === 0) return;
    await deleteMatches(toDelete, tournament.id);
    const highestRemaining = matches
      .filter((m) => !toDelete.includes(m.id))
      .reduce((max, m) => Math.max(max, m.round), 0);
    const nextCurrent = Math.min(tournament.current_round, highestRemaining);
    const status =
      highestRemaining === 0 && tournament.status === 'live' ? 'setup' : tournament.status;
    await upsertTournament({
      ...tournament,
      current_round: nextCurrent,
      status,
      updated_at: nowIso(),
    });
    await audit(tournament.id, 'round_repaired', undefined, { round, deleted: toDelete.length });
    toast(`Round ${round} removed (${toDelete.length} match${toDelete.length === 1 ? '' : 'es'}).`);
  };

  const repairRound = async (round: number) => {
    if (tournament.format === 'single_elim') {
      toast.error('Re-pair not supported for single elimination.');
      return;
    }
    const toDelete = matches.filter((m) => m.round === round && m.status !== 'completed').map((m) => m.id);
    await deleteMatches(toDelete, tournament.id);
    const remaining = matches.filter((m) => m.round !== round);
    const ctx = { ...tournament, current_round: round - 1 };
    const result = generateNextRound(ctx, players, remaining);
    await upsertMatches(result.matches);
    await audit(tournament.id, 'round_repaired', undefined, { round });
    toast.success(`Round ${round} re-paired.`);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Matches
        </h2>
        {isEditor && tournament.status !== 'done' && (
          <Button size="sm" variant="accent" onClick={generate}>
            <Sparkles className="h-4 w-4" /> Next round
          </Button>
        )}
      </div>
      {rounds.length === 0 && (
        <div className="rounded-xl border border-dashed border-border px-4 py-10 text-center">
          <p className="text-muted-foreground">
            No matches yet. Generate the first round from the overview.
          </p>
        </div>
      )}
      <div className="grid gap-6">
        {rounds.map((round) => (
          <section key={round}>
            <header className="mb-2 flex items-center justify-between">
              <h3 className="font-serif text-2xl">Round {round}</h3>
              {isEditor && (
                <div className="flex items-center gap-1">
                  {round === tournament.current_round && tournament.format !== 'single_elim' && (
                    <Button variant="ghost" size="sm" onClick={() => repairRound(round)}>
                      <RefreshCw className="h-3.5 w-3.5" /> Re-pair
                    </Button>
                  )}
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Delete round {round}?</DialogTitle>
                        <DialogDescription>
                          Removes every match in this round — including completed scores. Standings
                          will recalculate. Use this if you generated a round by accident.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <DialogClose asChild>
                          <Button variant="ghost">Cancel</Button>
                        </DialogClose>
                        <DialogClose asChild>
                          <Button variant="destructive" onClick={() => deleteRound(round)}>
                            Delete round
                          </Button>
                        </DialogClose>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>
              )}
            </header>
            <motion.div
              className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2"
              initial="hidden"
              animate="show"
              variants={{
                hidden: {},
                show: { transition: { staggerChildren: 0.03 } },
              }}
            >
              {grouped[round]
                .slice()
                .filter((m) => !(m.status === 'bye' && m.notes === 'sit_out'))
                .sort((a, b) => (a.court ?? 99) - (b.court ?? 99))
                .map((m) => (
                  <motion.div
                    key={m.id}
                    variants={{
                      hidden: { opacity: 0, y: 6 },
                      show: { opacity: 1, y: 0 },
                    }}
                  >
                    <MatchCard
                      match={m}
                      players={playersById}
                      tournament={tournament}
                      allMatches={matches}
                      basePath={`/t/${token}`}
                      canEdit={isEditor}
                    />
                  </motion.div>
                ))}
            </motion.div>
            <SitOutRow
              round={round}
              matches={grouped[round]}
              playersById={playersById}
            />
          </section>
        ))}
      </div>
    </div>
  );
}

function SitOutRow({
  round: _round,
  matches,
  playersById,
}: {
  round: number;
  matches: Match[];
  playersById: Map<string, Player>;
}) {
  const byes = matches.filter((m) => m.status === 'bye' && m.notes === 'sit_out');
  if (byes.length === 0) return null;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
      <Coffee className="h-3.5 w-3.5" />
      <span className="font-medium">Sitting out:</span>
      {byes.map((m) => {
        const id = m.team_a[0];
        const p = id ? playersById.get(id) : undefined;
        return (
          <Badge key={m.id} variant="outline">
            {p?.name ?? '?'}
          </Badge>
        );
      })}
    </div>
  );
}
