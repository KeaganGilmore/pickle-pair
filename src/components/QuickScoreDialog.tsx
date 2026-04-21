import { useEffect, useState, type MouseEvent } from 'react';
import { toast } from 'sonner';
import { Pencil, Check } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Badge } from './ui/Badge';
import type { Match, Player, Tournament } from '@/lib/types';
import { teamDisplayName } from '@/lib/standings';
import { advanceWinner } from '@/lib/pairing';
import { upsertMatches, audit } from '@/lib/repo';
import { nowIso } from '@/lib/utils';

type Props = {
  match: Match;
  players: Map<string, Player>;
  tournament: Tournament;
  allMatches: Match[];
  trigger?: React.ReactNode;
};

export function QuickScoreDialog({ match, players, tournament, allMatches, trigger }: Props) {
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(match.score_a);
  const [b, setB] = useState(match.score_b);

  useEffect(() => {
    if (open) {
      setA(match.score_a);
      setB(match.score_b);
    }
  }, [open, match.score_a, match.score_b]);

  const aLabel = teamDisplayName(match.team_a, players);
  const bLabel = teamDisplayName(match.team_b, players);
  const tied = a === b;
  const editing = match.status === 'completed' || match.status === 'forfeit';

  const save = async () => {
    if (tied) {
      toast.error("Scores can't be tied — pickleball needs a winner.");
      return;
    }
    const now = nowIso();
    const completed: Match = {
      ...match,
      score_a: a,
      score_b: b,
      status: 'completed',
      started_at: match.started_at ?? now,
      completed_at: now,
      updated_at: now,
    };
    const updates: Match[] = [completed];
    if (tournament.format === 'single_elim') {
      const merged = allMatches.map((m) => (m.id === completed.id ? completed : m));
      updates.push(...advanceWinner(merged, completed));
    }
    await upsertMatches(updates);
    await audit(
      tournament.id,
      editing ? 'score_updated' : 'match_completed',
      match.id,
      { score_a: a, score_b: b, edited: editing },
    );
    toast.success(editing ? 'Result updated.' : 'Score saved.');
    setOpen(false);
  };

  const stop = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild onClick={stop}>
        {trigger ?? (
          <Button variant="ghost" size="icon-sm" title="Quick score">
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent onClick={stop}>
        <DialogHeader>
          <DialogTitle>{editing ? 'Edit result' : 'Record score'}</DialogTitle>
          <DialogDescription>
            Type the final score. No timer, no taps per point.
            {editing && (
              <>
                {' '}
                <Badge variant="warn" className="ml-1">
                  Editing a locked match
                </Badge>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-3">
          <ScoreInput label={aLabel} value={a} onChange={setA} />
          <div className="pb-2 text-center font-serif text-2xl text-muted-foreground">:</div>
          <ScoreInput label={bLabel} value={b} onChange={setB} alignRight />
        </div>

        {tournament.format === 'single_elim' && editing && (
          <p className="mt-3 text-xs text-amber-500">
            Heads up — editing a bracket match re-advances the winner. Downstream matches may need
            review.
          </p>
        )}

        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
          <Button variant="accent" onClick={save} disabled={tied}>
            <Check className="h-4 w-4" />
            {editing ? 'Save changes' : 'Lock result'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ScoreInput({
  label,
  value,
  onChange,
  alignRight,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? 'text-right' : ''}>
      <Label className="mb-1 block truncate text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        inputMode="numeric"
        min={0}
        max={99}
        value={value}
        onChange={(e) => onChange(Math.max(0, Math.min(99, Number(e.target.value) || 0)))}
        className={`h-14 text-center font-serif text-3xl tnum ${alignRight ? '' : ''}`}
      />
    </div>
  );
}
