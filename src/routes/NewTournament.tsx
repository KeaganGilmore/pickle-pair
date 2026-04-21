import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
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
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/Card';
import { nowIso, longToken, shortToken, uid } from '@/lib/utils';
import type { Tournament, PartnerMode, TournamentFormat, TournamentMode, RoundSizeMode } from '@/lib/types';
import { upsertTournament } from '@/lib/repo';
import { audit } from '@/lib/repo';

export function NewTournament() {
  const navigate = useNavigate();
  const [name, setName] = useState('Saturday Social');
  const [mode, setMode] = useState<TournamentMode>('doubles');
  const [format, setFormat] = useState<TournamentFormat>('round_robin');
  const [partnerMode, setPartnerMode] = useState<PartnerMode>('random');
  const [mixed, setMixed] = useState(false);
  const [courts, setCourts] = useState(2);
  const [roundSizeMode, setRoundSizeMode] = useState<RoundSizeMode>('full');
  const [pointsToWin, setPointsToWin] = useState(11);
  const [winByTwo, setWinByTwo] = useState(true);
  const [timeCap, setTimeCap] = useState<number | ''>('');
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!name.trim()) {
      toast.error('Tournament needs a name.');
      return;
    }
    setSaving(true);
    try {
      const id = uid('t');
      const t: Tournament = {
        id,
        token: shortToken(6),
        edit_token: longToken(18),
        name: name.trim(),
        mode,
        format,
        partner_mode: mode === 'doubles' ? partnerMode : null,
        mixed: mode === 'doubles' ? mixed : false,
        round_size_mode: roundSizeMode,
        courts,
        points_to_win: pointsToWin,
        win_by_two: winByTwo,
        time_cap_minutes: typeof timeCap === 'number' ? timeCap : null,
        status: 'setup',
        current_round: 0,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      await upsertTournament(t);
      await audit(id, 'tournament_created', id, { name: t.name });
      toast.success('Tournament created.');
      navigate(`/t/${t.edit_token}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container py-6 max-w-2xl">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link to="/">
          <ArrowLeft className="h-4 w-4" /> Home
        </Link>
      </Button>

      <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }}>
        <h1 className="font-serif text-4xl md:text-5xl leading-none mb-1">New tournament</h1>
        <p className="text-muted-foreground">A minute of setup. Years of bragging rights.</p>
      </motion.div>

      <div className="mt-6 grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Basics</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Mode</Label>
                <Select value={mode} onValueChange={(v) => setMode(v as TournamentMode)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="doubles">Doubles</SelectItem>
                    <SelectItem value="singles">Singles</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Format</Label>
                <Select value={format} onValueChange={(v) => setFormat(v as TournamentFormat)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="round_robin">Round robin</SelectItem>
                    <SelectItem value="single_elim">Single elimination</SelectItem>
                    {mode === 'doubles' && (
                      <SelectItem value="americano">Americano</SelectItem>
                    )}
                    <SelectItem value="king_of_court">King of the Court</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {mode === 'doubles' && (
          <Card>
            <CardHeader>
              <CardTitle>Partnering</CardTitle>
              <CardDescription>
                How partners are decided. Mixed mode enforces M/F pairs.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-1.5">
                <Label>Partner mode</Label>
                <Select
                  value={partnerMode}
                  onValueChange={(v) => setPartnerMode(v as PartnerMode)}
                  disabled={format === 'americano'}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Random (paired by engine)</SelectItem>
                    <SelectItem value="fixed">Fixed (you choose)</SelectItem>
                    <SelectItem value="rotating">Rotating (Americano-style)</SelectItem>
                  </SelectContent>
                </Select>
                {format === 'americano' && (
                  <p className="text-xs text-muted-foreground">
                    Americano always rotates partners.
                  </p>
                )}
              </div>
              <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
                <div>
                  <Label>Mixed</Label>
                  <p className="text-xs text-muted-foreground">
                    Every pair must be one M and one F.
                  </p>
                </div>
                <Switch checked={mixed} onCheckedChange={setMixed} />
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Rules</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Round format</Label>
              <Select value={roundSizeMode} onValueChange={(v) => setRoundSizeMode(v as RoundSizeMode)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="full">Everyone plays every round</SelectItem>
                  <SelectItem value="by_courts">Fill available courts (extras sit out)</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                {roundSizeMode === 'full'
                  ? 'Every player gets a match each round — uses as many courts as needed.'
                  : 'A round is just what fits on your courts. Extras sit out; the engine rotates them so everyone gets fair play time.'}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Courts</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={32}
                  value={courts}
                  onChange={(e) => setCourts(Math.max(1, Math.min(32, Number(e.target.value) || 1)))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Points to win</Label>
                <Input
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={99}
                  value={pointsToWin}
                  onChange={(e) => setPointsToWin(Math.max(1, Math.min(99, Number(e.target.value) || 11)))}
                />
              </div>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-border px-4 py-3">
              <div>
                <Label>Win by 2</Label>
                <p className="text-xs text-muted-foreground">
                  Match ends when a team leads by 2 at or past the target.
                </p>
              </div>
              <Switch checked={winByTwo} onCheckedChange={setWinByTwo} />
            </div>
            <div className="grid gap-1.5">
              <Label>Time cap (minutes, optional)</Label>
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={60}
                value={timeCap}
                onChange={(e) => setTimeCap(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder="e.g. 12"
              />
            </div>
          </CardContent>
        </Card>

        <div className="sticky bottom-0 z-10 -mx-4 border-t border-border bg-background/90 p-4 backdrop-blur-xl md:static md:border-0 md:bg-transparent md:p-0 safe-b">
          <Button onClick={save} size="lg" variant="accent" disabled={saving} className="w-full md:w-auto">
            {saving ? 'Creating...' : 'Create tournament'}
          </Button>
        </div>
      </div>
    </div>
  );
}
