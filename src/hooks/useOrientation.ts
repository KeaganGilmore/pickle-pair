import { useEffect, useState } from 'react';

export function useOrientation(): 'portrait' | 'landscape' {
  const [o, setO] = useState<'portrait' | 'landscape'>(() =>
    typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches
      ? 'landscape'
      : 'portrait',
  );
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    const handler = () => setO(mq.matches ? 'landscape' : 'portrait');
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return o;
}

export function useIsNarrow(): boolean {
  const [narrow, setNarrow] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth < 768 : true,
  );
  useEffect(() => {
    const onResize = () => setNarrow(window.innerWidth < 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return narrow;
}
