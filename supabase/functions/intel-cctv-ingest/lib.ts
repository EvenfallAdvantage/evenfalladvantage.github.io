import type { CctvCamera } from "../_shared/cctv/parsers.ts";

export interface CctvRow {
  id: string; source: string; lat: number; lng: number; name: string | null; city: string | null;
  country: string | null; feed_url: string | null; stream_url: string | null; external_url: string | null;
  attribution: string | null; online: boolean; last_seen_at: string; updated_at: string;
}

/** Map parser output to DB rows; drops duplicate ids (last wins). */
export function toRows(cams: CctvCamera[], attribution: string, nowIso: string): CctvRow[] {
  const byId = new Map<string, CctvRow>();
  for (const c of cams) {
    if (!c.id || !Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
    if (c.lat < -90 || c.lat > 90 || c.lng < -180 || c.lng > 180) continue;
    byId.set(c.id, {
      id: c.id, source: c.source, lat: c.lat, lng: c.lng, name: c.name ?? null, city: c.city ?? null,
      country: c.country ?? null, feed_url: c.feed_url ?? null,
      stream_url: (c as { stream_url?: string }).stream_url ?? null,
      external_url: c.external_url ?? null, attribution, online: true, last_seen_at: nowIso, updated_at: nowIso,
    });
  }
  return [...byId.values()];
}

export function chunk<T>(xs: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < xs.length; i += n) out.push(xs.slice(i, i + n));
  return out;
}

/** Constant-time-ish string compare for the shared secret. */
export function secretMatches(given: string | null, expected: string | undefined): boolean {
  const a = (given ?? "").trim(), b = (expected ?? "").trim();
  if (!a || !b || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
