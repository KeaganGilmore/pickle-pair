import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark' | 'system';

type Ctx = {
  theme: Theme;
  resolved: 'light' | 'dark';
  setTheme: (t: Theme) => void;
};

const ThemeCtx = createContext<Ctx | null>(null);

function readStored(): Theme {
  if (typeof localStorage === 'undefined') return 'system';
  const v = localStorage.getItem('pp-theme');
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

function prefersDark() {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(() => readStored());
  const [resolved, setResolved] = useState<'light' | 'dark'>(() =>
    theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme,
  );

  useEffect(() => {
    const apply = () => {
      const next = theme === 'system' ? (prefersDark() ? 'dark' : 'light') : theme;
      setResolved(next);
      document.documentElement.classList.toggle('dark', next === 'dark');
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', next === 'dark' ? '#0b0b0c' : '#f7f6f3');
    };
    apply();
    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)');
      mq.addEventListener('change', apply);
      return () => mq.removeEventListener('change', apply);
    }
  }, [theme]);

  const setTheme = (t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem('pp-theme', t);
    } catch {
      /* ignore */
    }
  };

  return <ThemeCtx.Provider value={{ theme, resolved, setTheme }}>{children}</ThemeCtx.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeCtx);
  if (!ctx) throw new Error('useTheme outside provider');
  return ctx;
}
