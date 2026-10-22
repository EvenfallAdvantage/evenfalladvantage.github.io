/**
 * Satellite category (colour + 3D model) from the CelesTrak group and name.
 * Same palette approach as aircraft/ships (Okabe–Ito, lightened for the dark map;
 * military is vermillion everywhere).
 */
export type SatCategory = "military" | "comms" | "nav" | "science" | "station" | "unknown";
export const SAT_CATEGORIES: readonly SatCategory[] = ["military", "comms", "nav", "science", "station", "unknown"];

export const SAT_CATEGORY_COLOR: Record<SatCategory, string> = {
  military: "#ff5a36", // vermillion
  comms: "#56b4e9",    // sky blue
  nav: "#f0e442",      // yellow
  science: "#2ec4a0",  // bluish green (Earth observation, weather, science)
  station: "#e69f00",  // orange
  unknown: "#b8bec8",  // grey
};
export const SAT_CATEGORY_LABEL: Record<SatCategory, string> = {
  military: "Military / recon", comms: "Comms", nav: "Navigation", science: "Earth obs. / weather", station: "Space station", unknown: "Other",
};

const MIL_NAME = /^(USA[ -]?\d|NROL|COSMOS|KOSMOS|YAOGAN|OFEQ|OFFEQ|SBIRS|DMSP|WGS|MUOS|AEHF|MILSTAR|SICRAL|SYRACUSE|SKYNET|HELIOS|CSO-|SAR-LUPE|IGS|LACROSSE|NOSS)/;
const NAV_NAME = /^(GPS|NAVSTAR|GLONASS|COSMOS 2[45]\d\d \(GLONASS|GALILEO|GSAT0|BEIDOU|QZS|IRNSS|NAVIC)/;
const STATION_NAME = /^(ISS|CSS|TIANHE|TIANGONG|WENTIAN|MENGTIAN|ZARYA)/;
const COMMS_NAME = /^(INTELSAT|IS-|SES|EUTELSAT|ASTRA|STARLINK|ONEWEB|IRIDIUM|GLOBALSTAR|ORBCOMM|VIASAT|INMARSAT|TELSTAR|ECHOSTAR|DIRECTV|SIRIUS|XM-|AMAZONAS|HISPASAT|ARABSAT|TURKSAT|THURAYA)/;
const SCIENCE_NAME = /^(SENTINEL|LANDSAT|WORLDVIEW|GEOEYE|PLEIADES|NOAA|GOES|METOP|METEOSAT|HIMAWARI|FENGYUN|FY-|TERRA|AQUA|AURA|SUOMI|JPSS|SPOT|RADARSAT|ICEYE|CAPELLA|SKYSAT|FLOCK|HUBBLE|SWOT|GRACE|ICESAT|CBERS|KOMPSAT|ALOS)/;

export function satCategory(p: { name?: string | null; group?: string | null }): SatCategory {
  const n = String(p.name ?? "").trim().toUpperCase();
  const g = String(p.group ?? "").toLowerCase();
  if (g === "stations" && STATION_NAME.test(n)) return "station";
  if (STATION_NAME.test(n)) return "station";
  if (g === "gps-ops" || g === "gnss" || g === "galileo" || g === "beidou" || g === "glo-ops" || NAV_NAME.test(n)) return "nav";
  if (g === "military" || MIL_NAME.test(n)) return "military";
  if (g === "intelsat" || g === "geo" || COMMS_NAME.test(n)) return "comms";
  if (g === "resource" || g === "weather" || g === "science" || SCIENCE_NAME.test(n)) return "science";
  return "unknown";
}

/** Small craft (CubeSats) by name; they get the cubesat model whatever their category. */
const CUBESAT_NAME = /(CUBESAT|FLOCK|LEMUR|DOVE|\b[1-6]U\b|CUBE)/;

/**
 * Model per satellite (CC0, scripts/gen-sat-models.py, ~42 KB total).
 * Model +X = direction of flight, +Y = radial (away from Earth).
 */
export function satModelUrl(p: { name?: string | null; group?: string | null }): string {
  const c = satCategory(p);
  const n = String(p.name ?? "").toUpperCase();
  const file = c === "station" ? "station" : c === "nav" ? "gps" : CUBESAT_NAME.test(n) ? "cubesat" : c === "unknown" ? "cubesat" : "comms";
  return `/overwatch/models/sats/${file}.glb?v=1`;
}

/** Models replace the dot when the camera is within this distance of the satellite. */
export const SAT_MODEL_MAX_DISTANCE_M = 3_000_000;
export const SAT_MODEL_MIN_PIXELS = 28;

type V3 = { x: number; y: number; z: number };
const sub = (a: V3, b: V3): V3 => ({ x: a.x - b.x, y: a.y - b.y, z: a.z - b.z });
const dot = (a: V3, b: V3) => a.x * b.x + a.y * b.y + a.z * b.z;
const norm = (a: V3): V3 | null => { const l = Math.hypot(a.x, a.y, a.z); return l > 1e-9 && Number.isFinite(l) ? { x: a.x / l, y: a.y / l, z: a.z / l } : null; };
const cross = (a: V3, b: V3): V3 => ({ x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x });

/**
 * Unit quaternion (x, y, z, w) for a satellite model at ECEF `pos` heading to `next`:
 * model +X = direction of flight, +Y = radial (away from Earth), +Z = orbit normal.
 * Built as an explicit orthonormal frame; Cesium's rotationMatrixFromPositionVelocity
 * gave non-unit quaternions here, which blew the model up to planet size.
 */
export function satOrientation(pos: V3, next: V3): [number, number, number, number] | null {
  const up = norm(pos); if (!up) return null;
  const v = sub(next, pos);
  const fwd = norm(sub(v, { x: up.x * dot(v, up), y: up.y * dot(v, up), z: up.z * dot(v, up) }));
  if (!fwd) return null;
  const z = cross(fwd, up);
  // Rotation matrix columns [fwd, up, z] -> quaternion.
  const m00 = fwd.x, m10 = fwd.y, m20 = fwd.z, m01 = up.x, m11 = up.y, m21 = up.z, m02 = z.x, m12 = z.y, m22 = z.z;
  const tr = m00 + m11 + m22;
  let q: [number, number, number, number];
  if (tr > 0) { const s = Math.sqrt(tr + 1) * 2; q = [(m21 - m12) / s, (m02 - m20) / s, (m10 - m01) / s, s / 4]; }
  else if (m00 > m11 && m00 > m22) { const s = Math.sqrt(1 + m00 - m11 - m22) * 2; q = [s / 4, (m01 + m10) / s, (m02 + m20) / s, (m21 - m12) / s]; }
  else if (m11 > m22) { const s = Math.sqrt(1 + m11 - m00 - m22) * 2; q = [(m01 + m10) / s, s / 4, (m12 + m21) / s, (m02 - m20) / s]; }
  else { const s = Math.sqrt(1 + m22 - m00 - m11) * 2; q = [(m02 + m20) / s, (m12 + m21) / s, s / 4, (m10 - m01) / s]; }
  const l = Math.hypot(...q);
  return q.map((n) => n / l) as [number, number, number, number];
}
