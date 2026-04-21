import { useNavigate, useParams, Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { ArrowLeft, Check, CircleSlash, RefreshCw, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { useTournamentData } from '@/hooks/useTournament';
import { ScoreControls } from '@/components/ScoreControls';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { useMatchTimer } from '@/hooks/useMatchTimer';
import { useOrientation, useIsNarrow } from '@/hooks/useOrientation';
import { teamDisplayName } from '@/lib/standings';
import { isMatchWinning } from '@/lib/scoring';
import { advanceWinner } from '@/lib/pairing';
import { upsertMatch, upsertMatches, audit } from '@/lib/repo';
import type { Match } from '@/lib/types';
import { formatDuration, nowIso, cn, haptic } from '@/lib/utils';
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

export function MatchView() {
  const { token, matchId } = useParams<{ token: string; matchId: string }>();
  const navigate = useNavigate();
  const { tournament, matches, playersById, isEditor } = useTournamentData(token);
  const match = matches.find((m) => m.id === matchId);
  const narrow = useIsNarrow();
  const orientation = useOrientation();
  const [confettiKey, setConfettiKey] = useState(0);
  const timer = useMatchTimer(match?.started_at, match?.status === 'in_progress');

  useEffect(() => {
    if (!match) return;
    if (match.status === 'scheduled' && isEditor && tournament?.status !== 'paused') {
      // Auto-start on first visit
      void upsertMatch({ ...match, status: 'in_progress', started_at: nowIso(), updated_at: nowIso() });
    }
  }, [match?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!tournament || !match) {
    return (
      <div className="container py-10 max-w-lg text-center">
        <p className="text-muted-foreground">Match not found.</p>
        <Button asChild variant="subtle" className="mt-4">
          <Link to={`/t/${token}/matches`}>Back to matches</Link>
        </Button>
      </div>
    );
  }

  const winnerSide = isMatchWinning(match, tournament);
  const aLabel = teamDisplayName(match.team_a, playersById);
  const bLabel = teamDisplayName(match.team_b, playersById);

  const setScore = async (patch: Partial<Match>) => {
    const next: Match = { ...match, ...patch, updated_at: nowIso() };
    if (next.status === 'scheduled') {
      next.status = 'in_progress';
      next.started_at = match.started_at ?? nowIso();
    }
    await upsertMatch(next);
    await audit(tournament.id, 'score_updated', match.id, { score_a: next.score_a, score_b: next.score_b });
  };

  const confirmWin = async () => {
    if (!winnerSide) return;
    const now = nowIso();
    const completed: Match = { ...match, status: 'completed', completed_at: now, updated_at: now };
    const updates: Match[] = [completed];
    // Bracket advance
    if (tournament.format === 'single_elim') {
      const advanced = advanceWinner(matches, completed);
      updates.push(...advanced);
    }
    await upsertMatches(updates);
    await audit(tournament.id, 'match_completed', match.id, {
      winner: winnerSide,
      score_a: match.score_a,
      score_b: match.score_b,
    });
    haptic('heavy');
    setConfettiKey((k) => k + 1);
    toast.success('Match locked.');
    setTimeout(() => navigate(`/t/${token}/matches`), 900);
  };

  const reset = async () => {
    await upsertMatch({ ...match, score_a: 0, score_b: 0, status: 'in_progress', updated_at: nowIso() });
    toast('Scores reset.');
  };

  const voidMatch = async () => {
    await upsertMatch({ ...match, status: 'void', updated_at: nowIso() });
    await audit(tournament.id, 'match_voided', match.id);
    toast('Match voided.');
    navigate(`/t/${token}/matches`);
  };

  const forfeit = async (side: 'a' | 'b') => {
    const winnerPoints = tournament.points_to_win;
    const next: Match = {
      ...match,
      status: 'forfeit',
      score_a: side === 'a' ? winnerPoints : 0,
      score_b: side === 'b' ? winnerPoints : 0,
      completed_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertMatch(next);
    await audit(tournament.id, 'match_forfeited', match.id, { winner: side });
    toast(`${side === 'a' ? aLabel : bLabel} win by forfeit.`);
    navigate(`/t/${token}/matches`);
  };

  const landscapeScoring = narrow && orientation === 'landscape' && match.status !== 'completed';

  return (
    <div className={cn('relative', landscapeScoring ? '-my-4' : '')}>
      {!landscapeScoring && (
        <div className="mb-4 flex items-center justify-between gap-2">
          <Button asChild variant="ghost" size="icon-sm">
            <Link to={`/t/${token}/matches`}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground tnum">
            {match.court != null && <Badge variant="outline">Court {match.court}</Badge>}
            <Badge variant="outline">Round {match.round}</Badge>
            {match.status === 'in_progress' && (
              <Badge variant="accent">
                <Clock className="h-3 w-3" /> {formatDuration(timer)}
              </Badge>
            )}
            {tournament.time_cap_minutes && match.started_at && (
              <TimeCapBadge timer={timer} cap={tournament.time_cap_minutes} />
            )}
          </div>
        </div>
      )}

      <div
        className={cn(
          'grid gap-3',
          landscapeScoring ? 'grid-cols-2 h-dvh' : 'md:grid-cols-2',
        )}
      >
        <ScoreControls
          label={aLabel}
          score={match.score_a}
          onChange={(n) => setScore({ score_a: n })}
          disabled={!isEditor || match.status === 'completed' || match.status === 'forfeit' || tournament.status === 'paused'}
          winner={winnerSide === 'a'}
          color="a"
        />
        <ScoreControls
          label={bLabel}
          score={match.score_b}
          onChange={(n) => setScore({ score_b: n })}
          disabled={!isEditor || match.status === 'completed' || match.status === 'forfeit' || tournament.status === 'paused'}
          winner={winnerSide === 'b'}
          alignRight
          color="b"
        />
      </div>

      {!landscapeScoring && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {isEditor && match.status !== 'completed' && (
              <>
                <Button variant="subtle" size="sm" onClick={reset}>
                  <RefreshCw className="h-3.5 w-3.5" /> Reset
                </Button>
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="ghost" size="sm">
                      <CircleSlash className="h-3.5 w-3.5" /> Void
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Void this match?</DialogTitle>
                      <DialogDescription>
                        Marks the match void and excludes it from standings. Use for canceled or
                        miscounted games. You can re-pair the round afterward.
                      </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                      <DialogClose asChild>
                        <Button variant="ghost">Cancel</Button>
                      </DialogClose>
                      <Button variant="destructive" onClick={voidMatch}>Void match</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
                <ForfeitMenu onForfeit={forfeit} aLabel={aLabel} bLabel={bLabel} />
              </>
            )}
          </div>
          <div>
            {isEditor && winnerSide && match.status !== 'completed' && (
              <Button variant="accent" size="lg" onClick={confirmWin}>
                <Check className="h-4 w-4" /> Lock as final
              </Button>
            )}
            {match.status === 'completed' && (
              <Badge variant="success">
                <Check className="h-3 w-3" /> Final
              </Badge>
            )}
          </div>
        </div>
      )}

      <AnimatePresence>
        {confettiKey > 0 && (
          <motion.div
            key={confettiKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pointer-events-none fixed inset-0 z-40"
          >
            <ConfettiBurst />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TimeCapBadge({ timer, cap }: { timer: number; cap: number }) {
  const capMs = cap * 60_000;
  const pct = Math.min(1, timer / capMs);
  const over = timer > capMs;
  return (
    <Badge variant={over ? 'warn' : 'outline'}>
      {over ? (
        <>
          <AlertTriangle className="h-3 w-3" /> Over cap
        </>
      ) : (
        <>
          {formatDuration(capMs - timer)} / cap
        </>
      )}
      <span className="ml-1 h-1 w-8 overflow-hidden rounded-full bg-muted">
        <span
          className={cn('block h-full', over ? 'bg-amber-500' : 'bg-accent')}
          style={{ width: `${Math.round(pct * 100)}%` }}
        />
      </span>
    </Badge>
  );
}

function ForfeitMenu({
  onForfeit,
  aLabel,
  bLabel,
}: {
  onForfeit: (side: 'a' | 'b') => void;
  aLabel: string;
  bLabel: string;
}) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          Forfeit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record a forfeit</DialogTitle>
          <DialogDescription>
            Who wins by forfeit? The winning side is credited a full-points victory.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-2">
          <Button variant="subtle" onClick={() => onForfeit('a')}>
            {aLabel} wins
          </Button>
          <Button variant="subtle" onClick={() => onForfeit('b')}>
            {bLabel} wins
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ConfettiBurst() {
  // Lightweight CSS confetti — no external lib
  const pieces = Array.from({ length: 40 });
  return (
    <div className="absolute inset-0 overflow-hidden">
      {pieces.map((_, i) => {
        const left = Math.random() * 100;
        const duration = 0.9 + Math.random() * 0.8;
        const delay = Math.random() * 0.2;
        const rotate = Math.random() * 360;
        const size = 6 + Math.random() * 6;
        const hue = 70 + Math.random() * 60;
        return (
          <motion.span
            key={i}
            initial={{ y: -20, opacity: 0, rotate: 0 }}
            animate={{ y: '100vh', opacity: [0, 1, 0], rotate }}
            transition={{ duration, delay, ease: 'easeIn' }}
            className="absolute block rounded-sm"
            style={{
              left: `${left}%`,
              width: size,
              height: size * 0.45,
              background: `hsl(${hue} 85% 55%)`,
            }}
          />
        );
      })}
    </div>
  );
}
