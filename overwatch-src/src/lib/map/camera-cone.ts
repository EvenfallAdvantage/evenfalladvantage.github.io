/**
 * Field-of-view cones for public cameras.
 *
 * Ported from gods-eye-view (MIT, © 2026 Bilawal Sidhu):
 * src/data/directionText.js `directionToHeading` and the spherical
 * `projectPoint` in src/data/cctvFootprint.js. Simplified to a flat wedge
 * plus apex for Cesium entities; no Google 3D Tiles ground sampling.
 *
 * Our camera catalog has no heading column yet, so the facing comes from a
 * served `heading_deg` when present, otherwise from an explicit travel
 * direction in the camera name ("NB", "Westbound"). Cameras without either
 * get no cone, rather than a guessed one.
 */

const EARTH_RADIUS_M = 6_371_000;
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

/**
 * Compass heading from direction text, or NaN. Travel forms ("NORTHBOUND",
 * "NB") win over diagonals; bare "NORTH" only counts when `allowBare` (a
 * dedicated direction field), because in names it is usually a street.
 * Conflicting directions give NaN.
 */
export function directionToHeading(value: unknown, allowBare = false): number {
  const text = String(value ?? "").trim().toUpperCase();
  if (!text) return NaN;
  const tiers: Array<Array<[RegExp, number]>> = [
    [[/\bNORTHBOUND\b|\bNB\b/, 0], [/\bSOUTHBOUND\b|\bSB\b/, 180], [/\bEASTBOUND\b|\bEB\b/, 90], [/\bWESTBOUND\b|\bWB\b/, 270]],
    [[/\bNORTHEAST\b|\bNE\b/, 45], [/\bNORTHWEST\b|\bNW\b/, 315], [/\bSOUTHEAST\b|\bSE\b/, 135], [/\bSOUTHWEST\b|\bSW\b/, 225]],
  ];
  if (allowBare) tiers.push([[/\bNORTH\b/, 0], [/\bSOUTH\b/, 180], [/\bEAST\b/, 90], [/\bWEST\b/, 270]]);
  for (const forms of tiers) {
    const hits = new Set<number>();
    for (const [re, h] of forms) if (re.test(text)) hits.add(h);
    if (hits.size) return hits.size === 1 ? [...hits][0] : NaN;
  }
  return NaN;
}

/** Offset a point by a distance along a compass heading (spherical earth). */
export function projectPoint(lat: number, lng: number, headingDeg: number, distM: number): { lat: number; lng: number } {
  const b = toRad(headingDeg), la = toRad(lat), lo = toRad(lng), ad = distM / EARTH_RADIUS_M;
  const la2 = Math.asin(Math.sin(la) * Math.cos(ad) + Math.cos(la) * Math.sin(ad) * Math.cos(b));
  const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(ad) * Math.cos(la), Math.cos(ad) - Math.sin(la) * Math.sin(la2));
  return { lat: toDeg(la2), lng: ((toDeg(lo2) + 540) % 360) - 180 };
}

export interface ConeSource { heading_deg?: number | null; fov_deg?: number | null; name?: string }

export interface ConePose { headingDeg: number; fovDeg: number; source: "served" | "name" }

export const DEFAULT_FOV_DEG = 60;
export const CONE_RANGE_M = 150;
export const CONE_MOUNT_M = 10;

/** The pose to draw for a camera, or null when its facing is unknown. */
export function cameraPose(cam: ConeSource): ConePose | null {
  const fov = Number.isFinite(cam.fov_deg) ? Math.min(160, Math.max(8, cam.fov_deg as number)) : DEFAULT_FOV_DEG;
  if (typeof cam.heading_deg === "number" && Number.isFinite(cam.heading_deg)) {
    return { headingDeg: ((cam.heading_deg % 360) + 360) % 360, fovDeg: fov, source: "served" };
  }
  const h = directionToHeading(cam.name);
  return Number.isFinite(h) ? { headingDeg: h, fovDeg: fov, source: "name" } : null;
}

/** Far-edge arc of the cone, left to right, as [lng, lat] pairs. */
export function coneArc(lat: number, lng: number, pose: ConePose, rangeM = CONE_RANGE_M, steps = 8): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const start = pose.headingDeg - pose.fovDeg / 2;
  for (let i = 0; i <= steps; i++) {
    const p = projectPoint(lat, lng, start + (pose.fovDeg * i) / steps, rangeM);
    out.push([p.lng, p.lat]);
  }
  return out;
}
