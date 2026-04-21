import { useMemo } from 'react';
import type { Match, Player } from '@/lib/types';
import { teamDisplayName } from '@/lib/standings';
import { cn } from '@/lib/utils';

type Props = {
  matches: Match[];
  players: Map<string, Player>;
  onMatchClick?: (m: Match) => void;
};

export function BracketSvg({ matches, players, onMatchClick }: Props) {
  const rounds = useMemo(() => groupByRound(matches), [matches]);
  const maxRound = Math.max(...rounds.keys());
  const firstRoundCount = (rounds.get(1) ?? []).length;

  const CARD_W = 190;
  const CARD_H = 56;
  const GAP_X = 80;
  const BASE_GAP_Y = 18;

  const width = (maxRound) * (CARD_W + GAP_X) + CARD_W;
  const firstRoundHeight = firstRoundCount * (CARD_H + BASE_GAP_Y);
  const height = Math.max(280, firstRoundHeight + BASE_GAP_Y);

  const coords: { match: Match; x: number; y: number }[] = [];
  for (let r = 1; r <= maxRound; r++) {
    const list = (rounds.get(r) ?? []).slice().sort(bySlot);
    const count = list.length;
    list.forEach((m, i) => {
      const spacing = firstRoundHeight / count;
      const y = i * spacing + (spacing - CARD_H) / 2;
      const x = (r - 1) * (CARD_W + GAP_X);
      coords.push({ match: m, x, y });
    });
  }

  const byId = new Map(coords.map((c) => [c.match.id, c]));

  return (
    <div className="overflow-x-auto">
      <svg width={width} height={height} className="min-w-full">
        {/* Connectors */}
        {coords.map(({ match, x, y }) => {
          if (match.round === 1) return null;
          // Find source matches: prior round, same half by slot
          const slot = parseSlot(match.bracket_slot);
          if (!slot) return null;
          const prev1 = coords.find(
            (c) => c.match.round === match.round - 1 && parseSlot(c.match.bracket_slot)?.idx === slot.idx * 2 - 1,
          );
          const prev2 = coords.find(
            (c) => c.match.round === match.round - 1 && parseSlot(c.match.bracket_slot)?.idx === slot.idx * 2,
          );
          const midX = x - GAP_X / 2;
          const centerY = y + CARD_H / 2;
          return (
            <g key={`c-${match.id}`} stroke="hsl(var(--border))" strokeWidth="1.5" fill="none">
              {prev1 && (
                <path
                  d={`M ${prev1.x + CARD_W} ${prev1.y + CARD_H / 2} H ${midX} V ${centerY} H ${x}`}
                />
              )}
              {prev2 && (
                <path
                  d={`M ${prev2.x + CARD_W} ${prev2.y + CARD_H / 2} H ${midX} V ${centerY} H ${x}`}
                />
              )}
            </g>
          );
        })}

        {/* Match cards */}
        {coords.map(({ match, x, y }) => (
          <MatchNode
            key={match.id}
            match={match}
            players={players}
            x={x}
            y={y}
            w={CARD_W}
            h={CARD_H}
            onClick={onMatchClick}
          />
        ))}

        {/* Round labels */}
        {Array.from(rounds.keys()).sort((a, b) => a - b).map((r) => (
          <text
            key={`label-${r}`}
            x={(r - 1) * (CARD_W + GAP_X) + CARD_W / 2}
            y={12}
            textAnchor="middle"
            fill="hsl(var(--muted-foreground))"
            fontSize="11"
            fontWeight="600"
            style={{ letterSpacing: '0.08em', textTransform: 'uppercase' }}
          >
            {roundLabel(r, byId.size ? byId : null, r, Array.from(rounds.keys()))}
          </text>
        ))}
      </svg>
    </div>
  );
}

function MatchNode({
  match,
  players,
  x,
  y,
  w,
  h,
  onClick,
}: {
  match: Match;
  players: Map<string, Player>;
  x: number;
  y: number;
  w: number;
  h: number;
  onClick?: (m: Match) => void;
}) {
  const aName = teamDisplayName(match.team_a, players);
  const bName = teamDisplayName(match.team_b, players);
  const aWin = match.status === 'completed' && match.score_a > match.score_b;
  const bWin = match.status === 'completed' && match.score_b > match.score_a;
  const live = match.status === 'in_progress';

  return (
    <g
      transform={`translate(${x},${y})`}
      className={cn('cursor-pointer transition-opacity', !onClick && 'cursor-default')}
      onClick={() => onClick?.(match)}
    >
      <rect
        width={w}
        height={h}
        rx={10}
        ry={10}
        fill="hsl(var(--card))"
        stroke={live ? 'hsl(var(--accent))' : 'hsl(var(--border))'}
        strokeWidth={live ? 1.5 : 1}
      />
      <line x1={0} x2={w} y1={h / 2} y2={h / 2} stroke="hsl(var(--border))" strokeDasharray="2 2" />
      <Row x={8} y={h / 4 + 4} w={w - 16} label={aName || 'TBD'} score={match.score_a} winner={aWin} />
      <Row x={8} y={(3 * h) / 4 + 4} w={w - 16} label={bName || 'TBD'} score={match.score_b} winner={bWin} />
    </g>
  );
}

function Row({
  x,
  y,
  w,
  label,
  score,
  winner,
}: {
  x: number;
  y: number;
  w: number;
  label: string;
  score: number;
  winner: boolean;
}) {
  const labelWidth = w - 28;
  return (
    <g>
      <foreignObject x={x} y={y - 14} width={labelWidth} height={22}>
        <div
          style={{
            fontSize: 12,
            fontFamily: 'Inter, sans-serif',
            fontWeight: winner ? 600 : 500,
            color: winner ? 'hsl(var(--accent))' : 'hsl(var(--foreground))',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {label}
        </div>
      </foreignObject>
      <text
        x={x + w - 8}
        y={y}
        textAnchor="end"
        fill={winner ? 'hsl(var(--accent))' : 'hsl(var(--foreground))'}
        fontSize="13"
        fontWeight={winner ? 700 : 500}
        style={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {score}
      </text>
    </g>
  );
}

function groupByRound(matches: Match[]): Map<number, Match[]> {
  const map = new Map<number, Match[]>();
  for (const m of matches) {
    if (!m.bracket_slot) continue;
    const list = map.get(m.round) ?? [];
    list.push(m);
    map.set(m.round, list);
  }
  return map;
}

function parseSlot(slot: string | null | undefined): { round: number; idx: number } | null {
  if (!slot) return null;
  const m = /R(\d+)-(\d+)/.exec(slot);
  if (!m) return null;
  return { round: parseInt(m[1], 10), idx: parseInt(m[2], 10) };
}

function bySlot(a: Match, b: Match) {
  return (parseSlot(a.bracket_slot)?.idx ?? 0) - (parseSlot(b.bracket_slot)?.idx ?? 0);
}

function roundLabel(r: number, _: unknown, __: number, allRounds: number[]): string {
  const total = Math.max(...allRounds);
  if (r === total) return 'Final';
  if (r === total - 1) return 'Semifinals';
  if (r === total - 2) return 'Quarterfinals';
  return `Round ${r}`;
}
