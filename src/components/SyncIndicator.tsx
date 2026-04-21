import { useEffect, useState } from 'react';
import { Check, CloudOff, RefreshCw, WifiOff, AlertTriangle } from 'lucide-react';
import { subscribeSync, getSyncState, runSync } from '@/lib/sync';
import { cn } from '@/lib/utils';
import { Button } from './ui/Button';

export function SyncIndicator({ compact = false }: { compact?: boolean }) {
  const [s, setS] = useState(getSyncState());
  useEffect(() => {
    const unsub = subscribeSync(setS);
    return () => {
      unsub();
    };
  }, []);

  if (!s.configured) {
    return (
      <div
        className={cn(
          'inline-flex items-center gap-1.5 text-xs font-medium text-amber-500/90',
          compact && 'text-[10px]',
        )}
        title="Supabase not configured — running in offline-only mode."
      >
        <AlertTriangle className="h-3.5 w-3.5" />
        Local only
      </div>
    );
  }

  const base = cn(
    'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
    compact && 'px-2 py-0.5 text-[10px]',
  );

  if (!s.online) {
    return (
      <div className={cn(base, 'bg-amber-500/15 text-amber-600 dark:text-amber-400')}>
        <WifiOff className="h-3.5 w-3.5" />
        Offline{s.pendingCount > 0 ? ` — ${s.pendingCount} pending` : ''}
      </div>
    );
  }
  if (s.error) {
    return (
      <button
        className={cn(base, 'bg-red-500/15 text-red-500 pressable')}
        onClick={() => runSync(true)}
      >
        <CloudOff className="h-3.5 w-3.5" />
        Retry sync
      </button>
    );
  }
  if (s.syncing || s.pendingCount > 0) {
    return (
      <div className={cn(base, 'bg-muted text-muted-foreground')}>
        <RefreshCw className={cn('h-3.5 w-3.5', s.syncing && 'animate-spin')} />
        {s.pendingCount > 0 ? `Syncing ${s.pendingCount}` : 'Syncing'}
      </div>
    );
  }
  return (
    <div className={cn(base, 'bg-emerald-500/15 text-emerald-500')} title="All changes synced">
      <Check className="h-3.5 w-3.5" />
      Synced
    </div>
  );
}

export function FloatingSyncIndicator() {
  return (
    <div className="fixed bottom-20 right-3 z-40 md:bottom-6 pointer-events-none opacity-90">
      <div className="pointer-events-auto">
        <SyncIndicator />
      </div>
    </div>
  );
}

export function SyncIndicatorButton() {
  return (
    <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2" onClick={() => runSync(true)}>
      <SyncIndicator compact />
    </Button>
  );
}
