/** One quick GPS fix for clock-in/out and scans. Never throws; null = no fix. */
export interface Fix { lat: number; lng: number; accuracy: number | null }

export function getQuickFix(timeoutMs = 8000): Promise<Fix | null> {
  if (typeof navigator === "undefined" || !("geolocation" in navigator)) return Promise.resolve(null);
  return new Promise((resolve) => {
    const done = (v: Fix | null) => { clearTimeout(t); resolve(v); };
    const t = setTimeout(() => done(null), timeoutMs + 500);
    navigator.geolocation.getCurrentPosition(
      (p) => done({ lat: p.coords.latitude, lng: p.coords.longitude, accuracy: p.coords.accuracy ?? null }),
      () => done(null),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 },
    );
  });
}

export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000, toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

export type FenceVerdict = "inside" | "outside" | "no_fence" | "no_gps";

/** Client-side preview of the server verdict for an operation's post radius. */
export function previewPostFence(fix: Fix | null, post: { lat?: number | null; lng?: number | null; radius?: number | null } | null): { verdict: FenceVerdict; distance: number | null } {
  if (!post || post.lat == null || post.lng == null || !post.radius) return { verdict: fix ? "no_fence" : "no_gps", distance: null };
  if (!fix) return { verdict: "no_gps", distance: null };
  const d = Math.round(haversineMeters(fix.lat, fix.lng, post.lat, post.lng));
  return { verdict: d <= post.radius ? "inside" : "outside", distance: d };
}

export function formatDistance(m: number | null): string {
  if (m == null) return "";
  return m < 1000 ? `${m} m` : `${(m / 1000).toFixed(m < 10_000 ? 1 : 0)} km`;
}
