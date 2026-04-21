import { Link } from 'react-router-dom';
import { Play, Check, CircleSlash, Pause } from 'lucide-react';
import type { Match, Player, Tournament } from '@/lib/types';
import { teamDisplayName } from '@/lib/standings';
import { Badge } from './ui/Badge';
import { cn } from '@/lib/utils';

export function MatchCard({
  match,
  players,
  tournament,
  basePath,
  compact = false,
}: {
  match: Match;
  players: Map<string, Player>;
  tournament: Tournament;
  basePath: string;
  compact?: boolean;
}) {
  const aName = teamDisplayName(match.team_a, players);
  const bName = teamDisplayName(match.team_b, players);
  const aWin = match.status === 'completed' && match.score_a > match.score_b;
  const bWin = match.status === 'completed' && match.score_b > match.score_a;
  const isBye = match.status === 'bye';

  return (
    <Link
      to={`${basePath}/matches/${match.id}`}
      className={cn(
        'group relative block rounded-2xl border border-border bg-card p-4 shadow-inset-border transition-all hover:border-accent/40 hover:shadow-glow',
        compact && 'p-3',
      )}
    >
      <header className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {match.court != null && <span className="rounded-md bg-muted px-1.5 py-0.5">Court {match.court}</span>}
          {match.bracket_slot && (
            <span className="rounded-md bg-muted px-1.5 py-0.5">{match.bracket_slot}</span>
          )}
          <span>Round {match.round}</span>
        </div>
        <MatchBadge status={match.status} />
      </header>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3">
        <Side name={aName} win={aWin} small={compact} />
        <div className="flex flex-col items-center gap-0.5 tnum">
          <span
            className={cn(
              'text-3xl font-semibold leading-none tracking-tight',
              compact && 'text-2xl',
              aWin && 'text-accent',
            )}
          >
            {match.score_a}
          </span>
          <span className="h-px w-6 bg-border" />
          <span
            className={cn(
              'text-3xl font-semibold leading-none tracking-tight',
              compact && 'text-2xl',
              bWin && 'text-accent',
            )}
          >
            {match.score_b}
          </span>
        </div>
        <Side name={bName} win={bWin} small={compact} align="right" />
      </div>

      {isBye && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Bye — advances automatically.
        </p>
      )}

      {match.status !== 'completed' && (
        <div className="mt-3 border-t border-border/60 pt-3 text-xs text-muted-foreground flex items-center justify-end gap-1">
          {tournament.status === 'paused' ? (
            <>
              <Pause className="h-3.5 w-3.5" /> Paused
            </>
          ) : match.status === 'in_progress' ? (
            <>
              <Play className="h-3.5 w-3.5 text-emerald-500" /> Tap to score
            </>
          ) : (
            <>Tap to start</>
          )}
        </div>
      )}
    </Link>
  );
}

function Side({
  name,
  win,
  small,
  align = 'left',
}: {
  name: string;
  win: boolean;
  small?: boolean;
  align?: 'left' | 'right';
}) {
  return (
    <div className={cn('min-w-0', align === 'right' && 'text-right')}>
      <div
        className={cn(
          'font-medium truncate',
          small ? 'text-sm' : 'text-base',
          win && 'text-foreground',
          !win && 'text-foreground/90',
        )}
      >
        {name}
      </div>
      {win && <div className="text-[10px] font-semibold uppercase tracking-wider text-accent">Winner</div>}
    </div>
  );
}

function MatchBadge({ status }: { status: Match['status'] }) {
  const map: Record<Match['status'], { label: string; variant: 'default' | 'accent' | 'success' | 'warn' | 'danger' | 'outline'; Icon?: typeof Check }> = {
    scheduled: { label: 'Scheduled', variant: 'outline' },
    in_progress: { label: 'Live', variant: 'accent', Icon: Play },
    completed: { label: 'Final', variant: 'success', Icon: Check },
    void: { label: 'Void', variant: 'warn', Icon: CircleSlash },
    bye: { label: 'Bye', variant: 'outline' },
    forfeit: { label: 'Forfeit', variant: 'warn' },
  };
  const cfg = map[status];
  const Icon = cfg.Icon;
  return (
    <Badge variant={cfg.variant}>
      {Icon && <Icon className="h-3 w-3" />} {cfg.label}
    </Badge>
  );
}
