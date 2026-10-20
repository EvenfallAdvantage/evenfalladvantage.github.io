/** Checkpoint tag payloads (QR / NFC / deep link), GPS verification and tour progress. */
export type ScanMethod = "qr" | "nfc" | "link" | "manual";

const BASE_PATH = "/overwatch";

/** URL printed into QR codes / written to NFC tags. Opening it on a phone deep-links into the scan. */
export function checkpointUrl(origin: string, code: string): string {
  return `${origin.replace(/\/$/, "")}${BASE_PATH}/patrols/?cp=${encodeURIComponent(code)}`;
}

/** Accepts a raw code ("CP-1A2B3C4D") or any URL carrying ?cp=CODE. */
export function parseCheckpointPayload(raw: string | null | undefined): string | null {
  const s = (raw ?? "").trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) {
    try { const v = new URL(s).searchParams.get("cp"); return v ? v.trim().toUpperCase() : null; } catch { return null; }
  }
  return /^[A-Z0-9][A-Z0-9_-]{2,63}$/i.test(s) ? s.toUpperCase() : null;
}

export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const R = 6371008.8, toR = Math.PI / 180;
  const dLat = (bLat - aLat) * toR, dLng = (bLng - aLng) * toR;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(aLat * toR) * Math.cos(bLat * toR) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export const CHECKPOINT_RADIUS_M = 75;

/** gps_verified: true within radius (+ accuracy, capped), false outside, null when either side has no position. */
export function verifyScanPosition(
  cp: { lat?: number | null; lng?: number | null; location_lat?: number | null; location_lng?: number | null },
  fix: { lat: number; lng: number; accuracy?: number | null } | null,
): { verified: boolean | null; distance: number | null } {
  const lat = cp.lat ?? cp.location_lat, lng = cp.lng ?? cp.location_lng;
  if (lat == null || lng == null || !fix) return { verified: null, distance: null };
  const d = haversineM(lat, lng, fix.lat, fix.lng);
  const slack = Math.min(fix.accuracy ?? 0, 100);
  return { verified: d <= CHECKPOINT_RADIUS_M + slack, distance: Math.round(d) };
}

export type TourStop = { id: string; name: string; location?: string | null; done: boolean; at: string | null; outOfOrder: boolean };

/** Ordered stops for a route with which are done since `since`, the next stop and out-of-order flags. */
export function tourProgress(
  route: { checkpoint_ids?: string[] | null } | null,
  checkpoints: { id: string; name: string; location?: string | null }[],
  logs: { checkpoint_id: string; scanned_at: string; route_id?: string | null }[],
  since: Date,
): { stops: TourStop[]; nextId: string | null; done: number; total: number } {
  const ids = (route?.checkpoint_ids ?? []).filter((id) => checkpoints.some((c) => c.id === id));
  const firstAt = new Map<string, string>();
  [...logs].filter((l) => new Date(l.scanned_at) >= since)
    .sort((a, b) => a.scanned_at.localeCompare(b.scanned_at))
    .forEach((l) => { if (!firstAt.has(l.checkpoint_id)) firstAt.set(l.checkpoint_id, l.scanned_at); });
  let maxAt = "";
  const stops = ids.map((id) => {
    const c = checkpoints.find((x) => x.id === id)!;
    const at = firstAt.get(id) ?? null;
    const outOfOrder = !!at && at < maxAt;
    if (at && at > maxAt) maxAt = at;
    return { id, name: c.name, location: c.location ?? null, done: !!at, at, outOfOrder };
  });
  return { stops, nextId: stops.find((s) => !s.done)?.id ?? null, done: stops.filter((s) => s.done).length, total: stops.length };
}
