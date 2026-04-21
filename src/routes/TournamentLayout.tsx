import { Outlet, useParams, Link, NavLink } from 'react-router-dom';
import { useTournamentData } from '@/hooks/useTournament';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { ShareSheet } from '@/components/ShareSheet';
import { Skeleton } from '@/components/ui/Skeleton';
import { ArrowLeft, Eye } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatFormat } from './Home';

export function TournamentLayout() {
  const { token } = useParams<{ token: string }>();
  const { tournament, loading, isEditor } = useTournamentData(token);

  if (loading) {
    return (
      <div className="container py-6 max-w-5xl">
        <Skeleton className="h-8 w-48 mb-3" />
        <Skeleton className="h-12 w-80 mb-6" />
        <Skeleton className="h-72 w-full" />
      </div>
    );
  }
  if (!tournament) {
    return (
      <div className="container py-10 max-w-lg text-center">
        <h2 className="font-serif text-3xl mb-2">Tournament not found</h2>
        <p className="text-muted-foreground mb-4">
          This link might be wrong or offline. Check your connection and try again.
        </p>
        <Button asChild variant="subtle">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" /> Back home
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="container py-4 md:py-8 max-w-5xl">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="icon-sm" title="All tournaments">
          <Link to="/">
            <ArrowLeft className="h-4 w-4" />
          </Link>
        </Button>
        <Badge variant={isEditor ? 'accent' : 'outline'}>
          {isEditor ? 'Organizer' : (<><Eye className="h-3 w-3" /> Spectator</>)}
        </Badge>
        <div className="ml-auto flex items-center gap-2">
          <ShareSheet tournament={tournament} />
        </div>
      </div>
      <header className="mb-5">
        <h1 className="font-serif text-4xl md:text-5xl leading-none text-balance">
          {tournament.name}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {formatModeLine(tournament)} · {formatFormat(tournament.format)} ·{' '}
          {tournament.points_to_win} pts{tournament.win_by_two ? ' (win by 2)' : ''}
        </p>
      </header>
      <DesktopNav token={token!} format={tournament.format} />
      <Outlet />
    </div>
  );
}

function DesktopNav({ token, format }: { token: string; format: string }) {
  const items = [
    { to: `/t/${token}`, label: 'Overview', end: true },
    { to: `/t/${token}/matches`, label: 'Matches', end: false },
    { to: `/t/${token}/standings`, label: 'Standings', end: false },
    ...(format === 'single_elim'
      ? [{ to: `/t/${token}/bracket`, label: 'Bracket', end: false }]
      : []),
    { to: `/t/${token}/settings`, label: 'Settings', end: false },
  ];
  return (
    <nav className="mb-5 hidden md:flex items-center gap-1 rounded-xl bg-muted/50 p-1 w-fit">
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.end}
          className={({ isActive }) =>
            cn(
              'rounded-lg px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
              isActive && 'bg-background text-foreground shadow-soft',
            )
          }
        >
          {it.label}
        </NavLink>
      ))}
    </nav>
  );
}

function formatModeLine(t: { mode: string; mixed: boolean; partner_mode?: string | null }) {
  const parts = [t.mode];
  if (t.mode === 'doubles') {
    if (t.mixed) parts.push('mixed');
    if (t.partner_mode) parts.push(t.partner_mode);
  }
  return parts.join(' · ');
}
