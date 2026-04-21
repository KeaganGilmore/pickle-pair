import { useState } from 'react';
import { toast } from 'sonner';
import { Plus, UserMinus, UserPlus, ClipboardPaste, MoreVertical } from 'lucide-react';
import type { Player, Tournament, Gender } from '@/lib/types';
import { upsertPlayer, upsertPlayers, deletePlayer, audit } from '@/lib/repo';
import { nowIso, uid } from '@/lib/utils';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Label } from './ui/Label';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from './ui/Sheet';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/Select';
import { Badge } from './ui/Badge';
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

type Props = {
  tournament: Tournament;
  players: Player[];
  canEdit: boolean;
};

export function PlayerManager({ tournament, players, canEdit }: Props) {
  const active = players.filter((p) => !p.withdrawn);
  const withdrawn = players.filter((p) => p.withdrawn);

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Players · {active.length}
        </h2>
        {canEdit && (
          <div className="flex gap-2">
            <BulkAddSheet tournament={tournament} />
            <AddPlayerSheet tournament={tournament} existing={players} />
          </div>
        )}
      </div>
      <ul className="grid gap-2">
        {active.length === 0 && (
          <li className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
            No players yet. Tap + to add a few.
          </li>
        )}
        {active.map((p) => (
          <PlayerRow
            key={p.id}
            player={p}
            tournament={tournament}
            players={players}
            canEdit={canEdit}
          />
        ))}
        {withdrawn.length > 0 && (
          <>
            <li className="mt-4 text-xs uppercase tracking-wider text-muted-foreground">
              Withdrawn
            </li>
            {withdrawn.map((p) => (
              <PlayerRow
                key={p.id}
                player={p}
                tournament={tournament}
                players={players}
                canEdit={canEdit}
              />
            ))}
          </>
        )}
      </ul>
    </div>
  );
}

function PlayerRow({
  player,
  tournament,
  players,
  canEdit,
}: {
  player: Player;
  tournament: Tournament;
  players: Player[];
  canEdit: boolean;
}) {
  return (
    <li
      className={`flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2.5 ${
        player.withdrawn ? 'opacity-60' : ''
      }`}
    >
      <div className="flex items-center gap-3 min-w-0">
        <Avatar name={player.name} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{player.name}</span>
            {player.withdrawn && <Badge variant="warn">Withdrawn</Badge>}
            {tournament.mixed && player.gender === 'Unspecified' && (
              <Badge variant="warn">Gender?</Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground tnum">
            {player.gender !== 'Unspecified' && <span>{player.gender}</span>}
            {player.skill && <span> · {player.skill.toFixed(1)}</span>}
            {player.fixed_partner_id && (
              <span>
                {' · partner '}
                {players.find((q) => q.id === player.fixed_partner_id)?.name ?? '?'}
              </span>
            )}
          </div>
        </div>
      </div>
      {canEdit && (
        <EditPlayerSheet player={player} tournament={tournament} players={players} />
      )}
    </li>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return (
    <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-citrus-300/40 to-citrus-600/50 text-xs font-semibold text-foreground shadow-inset-border">
      {initials || '?'}
    </div>
  );
}

function AddPlayerSheet({ tournament, existing }: { tournament: Tournament; existing: Player[] }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState<Gender>('Unspecified');
  const [skill, setSkill] = useState<string>('');
  const [partnerId, setPartnerId] = useState<string>('');
  const [open, setOpen] = useState(false);

  const save = async () => {
    if (!name.trim()) return;
    const p: Player = {
      id: uid('p'),
      tournament_id: tournament.id,
      name: name.trim(),
      gender,
      skill: skill ? Number(skill) : null,
      withdrawn: false,
      fixed_partner_id: partnerId || null,
      created_at: nowIso(),
      updated_at: nowIso(),
    };
    await upsertPlayer(p);
    await audit(tournament.id, 'player_added', p.id, { name: p.name });
    toast.success(`${p.name} added.`);
    setName('');
    setSkill('');
    setPartnerId('');
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="accent" size="sm">
          <UserPlus className="h-4 w-4" /> Add
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Add player</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="First Last"
              autoFocus
            />
          </div>
          {tournament.mode === 'doubles' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unspecified">Unspecified</SelectItem>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Skill</Label>
                <Select value={skill} onValueChange={setSkill}>
                  <SelectTrigger>
                    <SelectValue placeholder="–" />
                  </SelectTrigger>
                  <SelectContent>
                    {['2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          {tournament.mode === 'doubles' && tournament.partner_mode === 'fixed' && (
            <div className="grid gap-1.5">
              <Label>Fixed partner</Label>
              <Select value={partnerId} onValueChange={setPartnerId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {existing
                    .filter((p) => !p.fixed_partner_id)
                    .map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button variant="accent" onClick={save}>Add player</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function EditPlayerSheet({
  player,
  tournament,
  players,
}: {
  player: Player;
  tournament: Tournament;
  players: Player[];
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState(player.name);
  const [gender, setGender] = useState<Gender>(player.gender);
  const [skill, setSkill] = useState<string>(player.skill ? player.skill.toFixed(1) : '');
  const [partnerId, setPartnerId] = useState<string>(player.fixed_partner_id ?? '');

  const save = async () => {
    await upsertPlayer({
      ...player,
      name: name.trim() || player.name,
      gender,
      skill: skill ? Number(skill) : null,
      fixed_partner_id: partnerId || null,
      updated_at: nowIso(),
    });
    await audit(tournament.id, 'player_updated', player.id, { name });
    setOpen(false);
    toast.success('Player updated.');
  };

  const withdraw = async () => {
    await upsertPlayer({
      ...player,
      withdrawn: !player.withdrawn,
      withdrawn_at: !player.withdrawn ? nowIso() : null,
      updated_at: nowIso(),
    });
    await audit(tournament.id, 'player_withdrawn', player.id, { withdrawn: !player.withdrawn });
    toast(player.withdrawn ? `${player.name} is back in.` : `${player.name} withdrew.`);
    setOpen(false);
  };

  const remove = async () => {
    await deletePlayer(player);
    await audit(tournament.id, 'player_updated', player.id, { removed: true });
    toast(`${player.name} removed.`);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon-sm">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit player</SheetTitle>
        </SheetHeader>
        <div className="grid gap-3">
          <div className="grid gap-1.5">
            <Label>Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          {tournament.mode === 'doubles' && (
            <>
              <div className="grid gap-1.5">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as Gender)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Unspecified">Unspecified</SelectItem>
                    <SelectItem value="M">M</SelectItem>
                    <SelectItem value="F">F</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Skill</Label>
                <Select value={skill} onValueChange={setSkill}>
                  <SelectTrigger>
                    <SelectValue placeholder="–" />
                  </SelectTrigger>
                  <SelectContent>
                    {['2.0', '2.5', '3.0', '3.5', '4.0', '4.5', '5.0'].map((v) => (
                      <SelectItem key={v} value={v}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {tournament.partner_mode === 'fixed' && (
                <div className="grid gap-1.5">
                  <Label>Fixed partner</Label>
                  <Select value={partnerId} onValueChange={setPartnerId}>
                    <SelectTrigger>
                      <SelectValue placeholder="—" />
                    </SelectTrigger>
                    <SelectContent>
                      {players
                        .filter((p) => p.id !== player.id)
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}
          <div className="mt-2 flex flex-col gap-2">
            <Button variant="accent" onClick={save}>Save changes</Button>
            <Button variant="subtle" onClick={withdraw}>
              <UserMinus className="h-4 w-4" />
              {player.withdrawn ? 'Reinstate player' : 'Withdraw'}
            </Button>
            <Dialog>
              <DialogTrigger asChild>
                <Button variant="destructive">Remove player</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Remove {player.name}?</DialogTitle>
                  <DialogDescription>
                    Permanently deletes this player. Match history is kept but their stats will
                    vanish. For injuries, use Withdraw instead.
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button variant="ghost">Cancel</Button>
                  </DialogClose>
                  <Button variant="destructive" onClick={remove}>Remove</Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function BulkAddSheet({ tournament }: { tournament: Tournament }) {
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);

  const parse = () => {
    const rows: Player[] = [];
    for (const raw of text.split(/\r?\n/)) {
      const line = raw.trim();
      if (!line) continue;
      const parts = line.split(/\s*,\s*/);
      const name = parts[0];
      if (!name) continue;
      let gender: Gender = 'Unspecified';
      let skill: number | null = null;
      for (const extra of parts.slice(1)) {
        const up = extra.toUpperCase();
        if (up === 'M' || up === 'F') gender = up;
        else if (up === 'OTHER') gender = 'Other';
        else {
          const n = Number(extra);
          if (!Number.isNaN(n) && n >= 2 && n <= 5) skill = n;
        }
      }
      rows.push({
        id: uid('p'),
        tournament_id: tournament.id,
        name,
        gender,
        skill,
        withdrawn: false,
        created_at: nowIso(),
        updated_at: nowIso(),
      });
    }
    return rows;
  };

  const save = async () => {
    const rows = parse();
    if (rows.length === 0) {
      toast.error('No players parsed.');
      return;
    }
    await upsertPlayers(rows);
    for (const p of rows) await audit(tournament.id, 'player_added', p.id, { name: p.name });
    toast.success(`Added ${rows.length} player${rows.length === 1 ? '' : 's'}.`);
    setText('');
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="subtle" size="sm">
          <ClipboardPaste className="h-4 w-4" /> Paste
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom">
        <SheetHeader>
          <SheetTitle>Paste players</SheetTitle>
        </SheetHeader>
        <p className="text-sm text-muted-foreground mb-2">
          One per line. Comma-separated extras: <code>Name, M, 3.5</code>. Order doesn't matter for M/F/skill.
        </p>
        <textarea
          className="h-52 w-full rounded-xl border border-input bg-background/50 p-3 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-ring"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Jane, F, 3.5\nAlex, M, 4.0\nSam, M'}
        />
        <div className="mt-3 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
          <Button variant="accent" onClick={save}>
            <Plus className="h-4 w-4" /> Add all
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
