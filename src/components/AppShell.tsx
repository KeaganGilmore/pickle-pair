import { NavLink, Link, useLocation } from 'react-router-dom';
import { type ReactNode } from 'react';
import { LayoutGrid, Eye, Trophy, Home as HomeIcon } from 'lucide-react';
import { ThemeToggle } from './ThemeToggle';
import { SyncIndicatorButton } from './SyncIndicator';
import { Footer } from './Footer';
import { cn } from '@/lib/utils';

export function AppShell({ children }: { children: ReactNode }) {
  const loc = useLocation();
  const inTournament = /^\/t\/[^/]+/.exec(loc.pathname);
  return (
    <div className="relative flex min-h-dvh flex-col bg-background">
      <div className="pointer-events-none fixed inset-x-0 top-0 h-[60vh] bg-grid opacity-40" aria-hidden />
      <AppHeader />
      <main className={cn('flex-1 relative', inTournament ? 'pb-28 md:pb-10' : 'pb-10')}>
        {children}
      </main>
      <Footer />
      {inTournament && <BottomNav token={inTournament[0].split('/')[2]} />}
    </div>
  );
}

function AppHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/60 bg-background/75 backdrop-blur-xl safe-t">
      <div className="container flex h-14 items-center justify-between gap-2">
        <Link to="/" className="group inline-flex items-center gap-2">
          <LogoMark />
          <span className="font-semibold tracking-tight">PicklePair</span>
        </Link>
        <div className="flex items-center gap-1.5">
          <SyncIndicatorButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

function LogoMark() {
  return (
    <div className="relative h-7 w-7 rounded-full bg-gradient-to-br from-citrus-300 to-citrus-600 shadow-glow">
      <div className="absolute inset-1.5 grid grid-cols-3 gap-[2px]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="rounded-full bg-black/40" />
        ))}
      </div>
    </div>
  );
}

function BottomNav({ token }: { token: string }) {
  const items = [
    { to: `/t/${token}`, label: 'Tournament', icon: HomeIcon, end: true },
    { to: `/t/${token}/matches`, label: 'Matches', icon: LayoutGrid, end: false },
    { to: `/t/${token}/standings`, label: 'Standings', icon: Trophy, end: false },
    { to: `/t/${token}/settings`, label: 'Settings', icon: Eye, end: false },
  ];
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30 border-t border-border/60 bg-background/85 backdrop-blur-xl md:hidden safe-b">
      <ul className="grid grid-cols-4">
        {items.map(({ to, label, icon: Icon, end }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={end}
              className={({ isActive }) =>
                cn(
                  'flex h-16 flex-col items-center justify-center gap-1 text-[11px] font-medium text-muted-foreground transition-colors',
                  isActive && 'text-foreground',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon className={cn('h-5 w-5', isActive && 'text-accent')} />
                  <span>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
