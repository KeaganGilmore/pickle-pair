import { Link } from 'react-router-dom';
import { useAllTournaments } from '@/hooks/useTournament';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Plus, ArrowRight, Trophy, Sparkles } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion } from 'framer-motion';

export function Home() {
  const tournaments = useAllTournaments();

  return (
    <div className="container py-6 md:py-10 max-w-4xl">
      <Hero />

      <section className="mt-10 md:mt-14">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Your tournaments
          </h2>
          {tournaments.length > 0 && (
            <Button asChild variant="ghost" size="sm">
              <Link to="/new">
                <Plus className="h-4 w-4" /> New
              </Link>
            </Button>
          )}
        </div>
        {tournaments.length === 0 ? (
          <EmptyState />
        ) : (
          <motion.ul
            className="grid gap-3"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
          >
            {tournaments.map((t, idx) => (
              <motion.li
                key={t.id}
                initial={{ y: 8, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Link to={`/t/${t.edit_token}`} className="block group">
                  <Card className="hover:bg-card/80 transition-colors">
                    <CardContent className="flex items-center justify-between gap-4 p-5">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <h3 className="font-serif text-lg md:text-xl truncate">{t.name}</h3>
                          <StatusBadge status={t.status} />
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {formatMode(t)} · {formatFormat(t.format)} · Updated{' '}
                          {formatDistanceToNow(new Date(t.updated_at), { addSuffix: true })}
                        </p>
                      </div>
                      <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 group-hover:text-foreground transition-all" />
                    </CardContent>
                  </Card>
                </Link>
              </motion.li>
            ))}
          </motion.ul>
        )}
      </section>
    </div>
  );
}

function Hero() {
  return (
    <div className="relative overflow-hidden rounded-3xl border border-border/70 bg-gradient-to-br from-background via-background to-citrus-600/10 p-6 md:p-10">
      <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-citrus-400/20 blur-3xl" />
      <div className="relative">
        <Badge variant="accent" className="mb-3">
          <Sparkles className="h-3 w-3" /> Courtside ready
        </Badge>
        <h1 className="font-serif text-4xl md:text-6xl leading-[0.95] text-balance">
          Pair a pickleball tournament, <em className="italic text-citrus-500/90">in seconds.</em>
        </h1>
        <p className="mt-4 max-w-xl text-muted-foreground text-pretty">
          Singles, doubles, mixed, Americano, brackets — no spreadsheets. Works offline on your
          phone. Share a link so spectators can follow along.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button asChild size="lg" variant="accent">
            <Link to="/new">
              <Plus className="h-4 w-4" /> New tournament
            </Link>
          </Button>
          <Button asChild size="lg" variant="subtle">
            <a href="#join">Join by link</a>
          </Button>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <Card className="border-dashed bg-transparent">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Trophy className="h-4 w-4 text-muted-foreground" />
          <CardTitle>No tournaments yet.</CardTitle>
        </div>
        <CardDescription>Spin one up — it takes less than a minute.</CardDescription>
      </CardHeader>
      <CardContent>
        <Button asChild variant="accent">
          <Link to="/new">
            <Plus className="h-4 w-4" /> Create tournament
          </Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: 'default' | 'success' | 'warn' | 'accent' | 'outline' }> = {
    setup: { label: 'Setup', variant: 'outline' },
    live: { label: 'Live', variant: 'accent' },
    paused: { label: 'Paused', variant: 'warn' },
    done: { label: 'Done', variant: 'success' },
  };
  const cfg = map[status] ?? map.setup;
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function formatMode(t: { mode: string; mixed: boolean; partner_mode?: string | null }) {
  const parts = [t.mode];
  if (t.mode === 'doubles') {
    if (t.mixed) parts.push('mixed');
    if (t.partner_mode) parts.push(t.partner_mode);
  }
  return parts.join(' · ');
}

export function formatFormat(f: string) {
  return ({
    round_robin: 'Round robin',
    single_elim: 'Single elimination',
    americano: 'Americano',
    king_of_court: 'King of the Court',
  } as Record<string, string>)[f] ?? f;
}
