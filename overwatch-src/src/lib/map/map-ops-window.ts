/**
 * Pure helpers for which operations / staff positions the Operations map shows.
 * Kept free of Supabase/Cesium imports so they are unit-testable.
 */

/** Operations that ended within this many days stay on the map. */
export const RECENT_OPS_DAYS = 30;
/** Hard cap on operations loaded for the map. */
export const MAP_OPS_LIMIT = 50;
/** Staff positions older than this render greyed as "last seen". */
export const STAFF_STALE_MS = 15 * 60 * 1000;
/** Staff positions older than this are hidden entirely. */
export const STAFF_HIDDEN_MS = 12 * 60 * 60 * 1000;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** True for a real UUID string; rejects "", "null", "undefined", etc. */
export function isUuid(v: unknown): v is string {
  return typeof v === "string" && UUID_RE.test(v);
}

/** ISO cutoff: operations with end_date >= this are "recent or later". */
export function recentOpsCutoff(now: Date = new Date(), days = RECENT_OPS_DAYS): string {
  return new Date(now.getTime() - days * 24 * 60 * 60 * 1000).toISOString();
}

export type StaffFreshness = "live" | "stale" | "hidden";

export function classifyStaffFreshness(updatedAt: string | null | undefined, now: number = Date.now()): StaffFreshness {
  const t = updatedAt ? Date.parse(updatedAt) : NaN;
  if (!Number.isFinite(t)) return "hidden";
  const age = now - t;
  if (age > STAFF_HIDDEN_MS) return "hidden";
  if (age > STAFF_STALE_MS) return "stale";
  return "live";
}

/** Short human label, e.g. "just now", "4m ago", "2h 5m ago". */
export function formatLastSeen(updatedAt: string, now: number = Date.now()): string {
  const t = Date.parse(updatedAt);
  if (!Number.isFinite(t)) return "unknown";
  const mins = Math.max(0, Math.floor((now - t) / 60000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h}h ${m}m ago` : `${h}h ago`;
}

/** Valid finite coordinate pair (rejects null, NaN, 0/0 placeholder, out of range). */
export function hasValidCoords(lat: unknown, lng: unknown): boolean {
  const a = typeof lat === "string" ? Number(lat) : lat;
  const b = typeof lng === "string" ? Number(lng) : lng;
  if (typeof a !== "number" || typeof b !== "number") return false;
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  if (a === 0 && b === 0) return false;
  return Math.abs(a) <= 90 && Math.abs(b) <= 180;
}
