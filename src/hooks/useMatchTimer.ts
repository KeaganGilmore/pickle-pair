import { useEffect, useState } from 'react';

export function useMatchTimer(startedAt: string | null | undefined, running: boolean) {
  const [elapsed, setElapsed] = useState(() =>
    startedAt ? Date.now() - new Date(startedAt).getTime() : 0,
  );
  useEffect(() => {
    if (!startedAt || !running) return;
    const tick = () => setElapsed(Date.now() - new Date(startedAt).getTime());
    tick();
    const id = setInterval(tick, 500);
    return () => clearInterval(id);
  }, [startedAt, running]);
  return elapsed;
}
