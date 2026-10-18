/**
 * Smooth aircraft motion: dead reckoning between feed fixes, with a short
 * correction blend when a new fix arrives, plus a bounded track history.
 *
 * Adapted from gods-eye-view (src/layers/flights/motion.js and
 * src/data/motionModel.js), © 2026 Bilawal Sidhu, MIT License — see
 * docs/THIRD-PARTY-NOTICES.md. Simplified for Overwatch: flat local ENU projection
 * (accurate to metres over the <= 2 min coast window), no ground-floor
 * sampling, no turn-arc extrapolation.
 */

export interface AircraftFix {
  lat: number;
  lng: number;
  /** metres */
  altM: number;
  /** ground speed, m/s */
  speedMps: number;
  /** true track, degrees from north */
  trackDeg: number;
  /** vertical rate, m/s */
  vsMps: number;
  /** epoch ms the fix was valid at */
  tMs: number;
}

export interface LatLngAlt { lat: number; lng: number; altM: number }

const EARTH_R = 6_371_008.8;
const DEG = Math.PI / 180;

/** Max seconds to project past the last fix before freezing (GEV's stale-coast floor). */
export const MAX_COAST_SEC = 60;
/** Correction blend length when a new fix lands (GEV uses 900 ms for the tracked target). */
export const BLEND_MS = 1_500;
/** Below this speed, hold position (GPS jitter is not motion). */
export const HOLD_SPEED_MPS = 1.5;
/** Track points kept per aircraft. */
export const TRAIL_MAX_POINTS = 120;

export function norm360(d: number): number { return ((d % 360) + 360) % 360; }
export function norm180(d: number): number { const x = norm360(d); return x > 180 ? x - 360 : x; }
/** Shortest-arc angle lerp (from GEV motionModel.lerpAngleDeg). */
export function lerpAngleDeg(from: number, to: number, t: number): number {
  return norm360(from + norm180(to - from) * t);
}

/** Project a fix forward to `nowMs` along its track (flat ENU). */
export function deadReckon(fix: AircraftFix, nowMs: number, maxCoastSec = MAX_COAST_SEC): LatLngAlt {
  const dt = Math.min(Math.max(0, (nowMs - fix.tMs) / 1000), maxCoastSec);
  if (!(fix.speedMps > HOLD_SPEED_MPS) || dt === 0) {
    return { lat: fix.lat, lng: fix.lng, altM: fix.altM };
  }
  const d = fix.speedMps * dt;
  const east = d * Math.sin(fix.trackDeg * DEG);
  const north = d * Math.cos(fix.trackDeg * DEG);
  const lat = fix.lat + (north / EARTH_R) / DEG;
  const lng = fix.lng + (east / (EARTH_R * Math.cos(fix.lat * DEG))) / DEG;
  const altM = Math.max(0, fix.altM + (Number.isFinite(fix.vsMps) ? fix.vsMps * dt : 0));
  return { lat, lng, altM };
}

function lerp(a: number, b: number, t: number): number { return a + (b - a) * t; }

/** Per-aircraft motion state: current fix, blend-from point, trail. */
export class AircraftTrack {
  fix: AircraftFix;
  private blendFrom: LatLngAlt | null = null;
  private blendStart = 0;
  readonly trail: LatLngAlt[] = [];

  constructor(fix: AircraftFix) {
    this.fix = fix;
    this.trail.push({ lat: fix.lat, lng: fix.lng, altM: fix.altM });
  }

  /** Accept a new fix; start a blend from wherever we were drawing it. Returns false for stale/duplicate fixes. */
  update(fix: AircraftFix, nowMs: number): boolean {
    if (fix.tMs < this.fix.tMs) return false;
    if (fix.tMs === this.fix.tMs && fix.lat === this.fix.lat && fix.lng === this.fix.lng) return false;
    this.blendFrom = this.position(nowMs);
    this.blendStart = nowMs;
    this.fix = fix;
    const last = this.trail[this.trail.length - 1];
    if (!last || last.lat !== fix.lat || last.lng !== fix.lng) {
      this.trail.push({ lat: fix.lat, lng: fix.lng, altM: fix.altM });
      if (this.trail.length > TRAIL_MAX_POINTS) this.trail.splice(0, this.trail.length - TRAIL_MAX_POINTS);
    }
    return true;
  }

  /** Where to draw the aircraft at `nowMs`. */
  position(nowMs: number): LatLngAlt {
    const target = deadReckon(this.fix, nowMs);
    if (!this.blendFrom) return target;
    const t = (nowMs - this.blendStart) / BLEND_MS;
    if (t >= 1) { this.blendFrom = null; return target; }
    const e = t * t * (3 - 2 * t); // smoothstep
    return {
      lat: lerp(this.blendFrom.lat, target.lat, e),
      lng: lerp(this.blendFrom.lng, target.lng, e),
      altM: lerp(this.blendFrom.altM, target.altM, e),
    };
  }

  /** True when the last fix is too old to keep drawing. */
  isStale(nowMs: number, maxAgeMs = 120_000): boolean {
    return nowMs - this.fix.tMs > maxAgeMs;
  }
}

/** Great-circle distance in metres. */
export function distanceM(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Nearest item within `maxM` of `p`, or null. */
export function nearestWithin<T extends { lat: number; lng: number }>(p: { lat: number; lng: number }, items: readonly T[], maxM: number): { item: T; distanceM: number } | null {
  let best: { item: T; distanceM: number } | null = null;
  for (const it of items) {
    if (!Number.isFinite(it.lat) || !Number.isFinite(it.lng)) continue;
    const d = distanceM(p, it);
    if (d <= maxM && (!best || d < best.distanceM)) best = { item: it, distanceM: d };
  }
  return best;
}
