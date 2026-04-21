import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : `${Math.random().toString(36).slice(2)}-${Date.now().toString(36)}`;
  return prefix ? `${prefix}_${rnd}` : rnd;
}

// Short slug, e.g., "xK9p2"
export function shortToken(len = 6): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  let out = '';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function longToken(len = 24): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  const bytes = new Uint8Array(len);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < len; i++) out += alphabet[bytes[i] % alphabet.length];
  return out;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function shuffle<T>(arr: T[], seed?: number): T[] {
  const out = arr.slice();
  let s = seed ?? Math.floor(Math.random() * 1e9);
  const rand = () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function chunk<T>(arr: T[], size: number): T[][] {
  const res: T[][] = [];
  for (let i = 0; i < arr.length; i += size) res.push(arr.slice(i, i + size));
  return res;
}

export function groupBy<T, K extends string | number>(
  arr: T[],
  key: (t: T) => K,
): Record<K, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    (acc[k] ??= []).push(item);
    return acc;
  }, {} as Record<K, T[]>);
}

export function by<T>(key: keyof T | ((t: T) => unknown), dir: 'asc' | 'desc' = 'asc') {
  const s = dir === 'asc' ? 1 : -1;
  return (a: T, b: T) => {
    const va = typeof key === 'function' ? key(a) : a[key];
    const vb = typeof key === 'function' ? key(b) : b[key];
    if (va == null && vb == null) return 0;
    if (va == null) return 1;
    if (vb == null) return -1;
    if (va < vb) return -1 * s;
    if (va > vb) return 1 * s;
    return 0;
  };
}

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(s / 60);
  const ss = (s % 60).toString().padStart(2, '0');
  return `${m}:${ss}`;
}

export function pluralize(n: number, singular: string, plural?: string) {
  return `${n} ${n === 1 ? singular : plural ?? `${singular}s`}`;
}

export function haptic(kind: 'light' | 'medium' | 'heavy' = 'light') {
  if (typeof navigator === 'undefined' || !('vibrate' in navigator)) return;
  const map = { light: 8, medium: 16, heavy: 30 };
  try {
    navigator.vibrate(map[kind]);
  } catch {
    /* ignore */
  }
}

export function safeParse<T>(parser: { safeParse: (v: unknown) => { success: boolean; data?: T } }, v: unknown): T | null {
  const r = parser.safeParse(v);
  return r.success ? (r.data as T) : null;
}

export const isBrowser = typeof window !== 'undefined';
