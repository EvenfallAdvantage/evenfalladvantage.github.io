import { parseUTC } from "@/lib/parse-utc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shift = any;

/** The shift that matters right now: the one in progress, else the next within 7 days. */
export function pickMyPost(shifts: Shift[], now = new Date()): { shift: Shift; state: "on_now" | "upcoming" } | null {
  const t = now.getTime();
  const on = shifts.find((s) => parseUTC(s.start_time).getTime() - 30 * 60000 <= t && parseUTC(s.end_time).getTime() > t);
  if (on) return { shift: on, state: "on_now" };
  const next = shifts
    .filter((s) => parseUTC(s.start_time).getTime() > t && parseUTC(s.start_time).getTime() - t < 7 * 864e5)
    .sort((a, b) => parseUTC(a.start_time).getTime() - parseUTC(b.start_time).getTime())[0];
  return next ? { shift: next, state: "upcoming" } : null;
}

export function hasPostOrders(s: Shift): boolean {
  return !!(s?.events?.post_orders?.trim() || s?.post_orders?.trim());
}

export function startsIn(s: Shift, now = new Date()): string {
  const ms = parseUTC(s.start_time).getTime() - now.getTime();
  if (ms <= 0) return "On now";
  const m = Math.round(ms / 60000);
  if (m < 60) return `Starts in ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `Starts in ${h}h ${m % 60 ? `${m % 60}m` : ""}`.trim();
  return `Starts in ${Math.floor(h / 24)}d`;
}

export function directionsUrl(e: { location_lat?: number | null; location_lng?: number | null; location?: string | null }): string | null {
  if (e?.location_lat != null && e?.location_lng != null) return `https://www.google.com/maps/dir/?api=1&destination=${e.location_lat},${e.location_lng}`;
  if (e?.location) return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(e.location)}`;
  return null;
}
