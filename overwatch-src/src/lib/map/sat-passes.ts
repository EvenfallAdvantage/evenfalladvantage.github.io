/**
 * Satellite pass prediction over a site (rise / peak / set above a minimum
 * elevation) from CelesTrak TLEs, propagated with satellite.js (MIT).
 * The search is a coarse scan (default 30 s) refined by bisection, so it is
 * pure and testable with any elevation function.
 */

export interface Pass { riseMs: number; peakMs: number; setMs: number; maxElDeg: number }

export function findPasses(
  elevationAt: (tMs: number) => number,
  startMs: number, endMs: number,
  opts: { stepMs?: number; minElDeg?: number; horizonDeg?: number } = {},
): Pass[] {
  const step = opts.stepMs ?? 30_000;
  const minEl = opts.minElDeg ?? 10;
  const horizon = opts.horizonDeg ?? 0;
  const passes: Pass[] = [];
  const cross = (a: number, b: number, rising: boolean) => {
    let lo = a, hi = b;
    for (let i = 0; i < 12; i++) {
      const mid = (lo + hi) / 2;
      const up = elevationAt(mid) > horizon;
      if (up === rising) hi = mid; else lo = mid;
    }
    return Math.round((lo + hi) / 2);
  };
  let prevT = startMs;
  const el0 = elevationAt(startMs);
  let rise: number | null = el0 > horizon ? startMs : null;
  let peakT = startMs, peakEl = el0;
  for (let t = startMs + step; t <= endMs + step; t += step) {
    const tt = Math.min(t, endMs);
    const el = elevationAt(tt);
    if (rise == null && el > horizon) { rise = cross(prevT, tt, true); peakT = tt; peakEl = el; }
    else if (rise != null) {
      if (el > peakEl) { peakEl = el; peakT = tt; }
      if (el <= horizon || tt === endMs) {
        const set = el <= horizon ? cross(prevT, tt, false) : tt;
        // refine the peak with a golden-ish local search around the coarse max
        let a = Math.max(rise, peakT - step), b = Math.min(set, peakT + step);
        for (let i = 0; i < 20; i++) {
          const m1 = a + (b - a) / 3, m2 = b - (b - a) / 3;
          if (elevationAt(m1) < elevationAt(m2)) a = m1; else b = m2;
        }
        const pk = Math.round((a + b) / 2);
        const pkEl = Math.max(peakEl, elevationAt(pk));
        if (pkEl >= minEl) passes.push({ riseMs: rise, peakMs: pk, setMs: set, maxElDeg: +pkEl.toFixed(1) });
        rise = null; peakEl = -90;
      }
    }
    prevT = tt;
    if (tt === endMs) break;
  }
  return passes;
}

/** Subset of satellite.js used here. */
export interface SatLib {
  twoline2satrec(l1: string, l2: string): unknown;
  propagate(rec: unknown, d: Date): { position?: unknown } | null;
  gstime(d: Date): number;
  eciToEcf(p: unknown, gmst: number): unknown;
  ecfToLookAngles(observer: { latitude: number; longitude: number; height: number }, ecf: unknown): { elevation: number };
  degreesToRadians(d: number): number;
}

export function elevationFn(lib: SatLib, tle1: string, tle2: string, site: { lat: number; lng: number; altKm?: number }) {
  const rec = lib.twoline2satrec(tle1, tle2);
  const obs = { latitude: lib.degreesToRadians(site.lat), longitude: lib.degreesToRadians(site.lng), height: site.altKm ?? 0 };
  return (tMs: number) => {
    const d = new Date(tMs);
    const pv = lib.propagate(rec, d);
    const pos = pv?.position;
    if (!pos || typeof pos === "boolean") return -90;
    const look = lib.ecfToLookAngles(obs, lib.eciToEcf(pos, lib.gstime(d)));
    return (look.elevation * 180) / Math.PI;
  };
}

export interface SatPass extends Pass { name: string; kind: "station" | "imaging" }

export function formatDuration(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, "0")}s`;
}
