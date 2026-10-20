/**
 * Last-known-good cache for small field reads (active timesheet, shifts,
 * checkpoints, routes). Offline: return the cached copy immediately. Online:
 * read live and refresh the cache; if the live read throws, fall back to it.
 * Stored in localStorage per user+company; never used for anything sensitive
 * beyond what the signed-in officer already sees.
 */
const PREFIX = "ow:cache:";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export function isOffline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine === false;
}

function read<T>(key: string): { v: T; at: number } | null {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return null;
    const j = JSON.parse(raw) as { v: T; at: number };
    return Date.now() - j.at > MAX_AGE_MS ? null : j;
  } catch { return null; }
}

export function writeCache<T>(key: string, v: T): void {
  try { localStorage.setItem(PREFIX + key, JSON.stringify({ v, at: Date.now() })); } catch { /* quota */ }
}

export function readCache<T>(key: string): T | null {
  return read<T>(key)?.v ?? null;
}

export async function cachedRead<T>(key: string, live: () => Promise<T>): Promise<T> {
  const cached = read<T>(key);
  if (isOffline() && cached) return cached.v;
  try {
    const v = await live();
    writeCache(key, v);
    return v;
  } catch (e) {
    if (cached) return cached.v;
    throw e;
  }
}

/** Remove every cached entry (sign-out). */
export function clearFieldCache(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k?.startsWith(PREFIX)) keys.push(k); }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch { /* ignore */ }
}
