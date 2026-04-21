import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Minus, Plus, Undo2 } from 'lucide-react';
import { haptic, cn } from '@/lib/utils';
import { Button } from './ui/Button';

type Props = {
  label: string;
  score: number;
  onChange: (next: number) => void;
  onUndo?: () => void;
  disabled?: boolean;
  winner?: boolean;
  alignRight?: boolean;
  color?: 'a' | 'b';
};

export function ScoreControls({
  label,
  score,
  onChange,
  onUndo,
  disabled,
  winner,
  alignRight,
  color = 'a',
}: Props) {
  const [pulse, setPulse] = useState(false);
  const prev = useRef(score);
  useEffect(() => {
    if (prev.current !== score) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 250);
      prev.current = score;
      return () => clearTimeout(t);
    }
  }, [score]);

  const bump = (delta: number) => {
    if (disabled) return;
    const next = Math.max(0, score + delta);
    if (next !== score) {
      onChange(next);
      haptic(delta > 0 ? 'medium' : 'light');
    }
  };

  return (
    <div className={cn('relative flex h-full flex-col justify-between rounded-3xl p-4 md:p-6',
      color === 'a'
        ? 'bg-gradient-to-br from-muted/40 to-muted/20'
        : 'bg-gradient-to-br from-muted/40 to-muted/20',
    )}>
      <header className={cn('flex items-start', alignRight ? 'justify-end' : 'justify-start')}>
        <div className={cn(alignRight && 'text-right')}>
          <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Team {color.toUpperCase()}
          </div>
          <div className="mt-0.5 text-base md:text-lg font-medium leading-tight text-balance">
            {label}
          </div>
        </div>
      </header>

      <div className={cn('flex flex-1 items-center justify-center', alignRight ? 'md:justify-end' : 'md:justify-start')}>
        <div className="relative">
          <AnimatePresence>
            {winner && (
              <motion.div
                key="w"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="absolute -top-2 left-1/2 -translate-x-1/2 -translate-y-full rounded-full bg-accent px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-accent-foreground"
              >
                Winner
              </motion.div>
            )}
          </AnimatePresence>
          <motion.div
            key={score}
            animate={pulse ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 0.25 }}
            className={cn(
              'font-serif tnum leading-none select-none',
              'text-[clamp(5rem,22vw,12rem)]',
              winner && 'text-accent',
            )}
          >
            {score}
          </motion.div>
        </div>
      </div>

      <footer className="grid grid-cols-[1fr_auto] gap-2">
        <Button
          size="xl"
          variant="accent"
          onClick={() => bump(+1)}
          disabled={disabled}
          className="h-16 md:h-20 text-2xl"
          aria-label={`Add point to ${label}`}
        >
          <Plus className="h-6 w-6" /> Point
        </Button>
        <Button
          size="xl"
          variant="subtle"
          onClick={() => bump(-1)}
          disabled={disabled || score === 0}
          className="h-16 md:h-20 w-16 md:w-20"
          aria-label={`Remove point from ${label}`}
        >
          <Minus className="h-5 w-5" />
        </Button>
      </footer>
      {onUndo && (
        <Button variant="ghost" size="sm" onClick={onUndo} className="mt-1">
          <Undo2 className="h-3.5 w-3.5" /> Undo
        </Button>
      )}
    </div>
  );
}
