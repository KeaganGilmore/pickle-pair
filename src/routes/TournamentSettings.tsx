import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Trash2, History } from 'lucide-react';
import { useTournamentData } from '@/hooks/useTournament';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Switch } from '@/components/ui/Switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/Select';
import type { RoundSizeMode } from '@/lib/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { listAudit, upsertTournament } from '@/lib/repo';
import { db } from '@/lib/db';
import { enqueue } from '@/lib/sync';
import { nowIso } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
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

export function TournamentSettings() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { tournament, isEditor } = useTournamentData(token);
  const [name, setName] = useState(tournament?.name ?? '');
  const [courts, setCourts] = useState(tournament?.courts ?? 2);
  const [pointsToWin, setPointsToWin] = useState(tournament?.points_to_win ?? 11);
  const [winByTwo, setWinByTwo] = useState(tournament?.win_by_two ?? true);
  const [mixed, setMixed] = useState(tournament?.mixed ?? false);
  const [roundSizeMode, setRoundSizeMode] = useState<RoundSizeMode>(
    tournament?.round_size_mode ?? 'full',
  );

  const audit = useQuery({
    queryKey: ['audit', tournament?.id],
    queryFn: () => (tournament ? listAudit(tournament.id, 80) : Promise.resolve([])),
    enabled: !!tournament,
    refetchInterval: 5000,
  });

  if (!tournament) return null;

  const save = async () => {
    await upsertTournament({
      ...tournament,
      name: name.trim() || tournament.name,
      courts,
      points_to_win: pointsToWin,
      win_by_two: winByTwo,
      mixed,
      round_size_mode: roundSizeMode,
      updated_at: nowIso(),
    });
    toast.success('Settings saved.');
  };

  const deleteTournament = async () => {
    await db.tournaments.delete(tournament.id);
    await enqueue('tournament', 'delete', { id: tournament.id }, tournament.id);
    toast('Tournament deleted.');
    navigate('/');
  };

  return (
    <div className="grid gap-4 md:grid-cols-[1fr_1fr]">
      <Card>
        <CardHeader>
          <CardTitle>Settings</CardTitle>
          <CardDescription>
            Changes apply to future rounds and in-progress matches.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isEditor}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="grid gap-1.5">
              <Label>Courts</Label>
              <Input
                type="number"
                min={1}
                max={32}
                value={courts}
                onChange={(e) => setCourts(Math.max(1, Math.min(32, Number(e.target.value) || 1)))}
                disabled={!isEditor}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Points to win</Label>
              <Input
                type="number"
                min={1}
                max={99}
                value={pointsToWin}
                onChange={(e) => setPointsToWin(Math.max(1, Math.min(99, Number(e.target.value) || 11)))}
                disabled={!isEditor}
              />
            </div>
          </div>
          <div className="grid gap-1.5">
            <Label>Round format</Label>
            <Select
              value={roundSizeMode}
              onValueChange={(v) => setRoundSizeMode(v as RoundSizeMode)}
              disabled={!isEditor}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="full">Everyone plays every round</SelectItem>
                <SelectItem value="by_courts">Fill available courts (extras sit out)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
            <Label>Win by 2</Label>
            <Switch checked={winByTwo} onCheckedChange={setWinByTwo} disabled={!isEditor} />
          </div>
          {tournament.mode === 'doubles' && (
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <Label>Mixed</Label>
              <Switch checked={mixed} onCheckedChange={setMixed} disabled={!isEditor} />
            </div>
          )}
          {isEditor && (
            <Button onClick={save} variant="accent">
              Save changes
            </Button>
          )}

          {isEditor && (
            <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
              <div className="text-sm font-medium text-destructive mb-1">Danger zone</div>
              <p className="text-xs text-muted-foreground mb-3">
                Deleting removes the tournament from this device and cloud. This can't be undone.
              </p>
              <HoldToDelete onConfirm={deleteTournament} />
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <History className="h-4 w-4 text-muted-foreground" />
            <CardTitle>Activity</CardTitle>
          </div>
          <CardDescription>Audit trail of everything that's happened.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="grid gap-2 max-h-96 overflow-y-auto no-scrollbar">
            {(audit.data ?? []).length === 0 && (
              <li className="text-sm text-muted-foreground">Nothing yet.</li>
            )}
            {(audit.data ?? []).map((a) => (
              <li key={a.id} className="rounded-lg border border-border/60 bg-background/50 p-2.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-medium">{a.action.replace(/_/g, ' ')}</span>
                  <span className="text-muted-foreground tnum">
                    {new Date(a.created_at).toLocaleTimeString()}
                  </span>
                </div>
                {a.payload && (
                  <div className="mt-1 font-mono text-[10px] text-muted-foreground truncate">
                    {JSON.stringify(a.payload)}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function HoldToDelete({ onConfirm }: { onConfirm: () => void }) {
  const [holding, setHolding] = useState(false);
  const [pct, setPct] = useState(0);
  let timer: ReturnType<typeof setInterval> | null = null;

  const start = () => {
    setHolding(true);
    const startedAt = Date.now();
    timer = setInterval(() => {
      const elapsed = Date.now() - startedAt;
      const p = Math.min(1, elapsed / 3000);
      setPct(p);
      if (p >= 1) {
        cleanup();
        onConfirm();
      }
    }, 50);
  };
  const cleanup = () => {
    if (timer) clearInterval(timer);
    timer = null;
    setHolding(false);
    setPct(0);
  };

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="destructive">
          <Trash2 className="h-4 w-4" /> Delete tournament
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Hold to confirm</DialogTitle>
          <DialogDescription>
            Press and hold the button for 3 seconds. There's no undo.
          </DialogDescription>
        </DialogHeader>
        <div
          onMouseDown={start}
          onMouseUp={cleanup}
          onMouseLeave={cleanup}
          onTouchStart={start}
          onTouchEnd={cleanup}
          className="relative mt-2 grid h-14 select-none place-items-center overflow-hidden rounded-xl border border-destructive/40 bg-destructive/10 text-sm font-semibold text-destructive"
        >
          <div
            className="absolute inset-y-0 left-0 bg-destructive/40 transition-[width] duration-100"
            style={{ width: `${Math.round(pct * 100)}%` }}
          />
          <span className="relative">{holding ? 'Keep holding...' : 'Hold to delete'}</span>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Cancel</Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
