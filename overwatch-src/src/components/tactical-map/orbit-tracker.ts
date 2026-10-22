/**
 * Satellite Orbit Visualization via CelesTrak TLE Data
 *
 * Uses satellite.js (loaded from CDN) for SGP4 orbit propagation.
 * TLE data from CelesTrak (free, no key required).
 */

import { logger } from "@/lib/logger";
import { elevationFn, findPasses, type SatLib, type SatPass } from "@/lib/map/sat-passes";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- satellite.js has no TS types
let satLib: any = null;

/** Load satellite.js from CDN (avoids Turbopack bundling issues) */
async function loadSatelliteLib(): Promise<typeof satLib> {
  if (satLib) return satLib;
  if (typeof window === "undefined") throw new Error("Browser only");

  if (window.satellite) { satLib = window.satellite; return satLib; }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js";
    script.async = true;
    script.onload = () => { satLib = window.satellite; resolve(satLib); };
    script.onerror = () => reject(new Error("Failed to load satellite.js"));
    document.head.appendChild(script);
  });
}

export interface SatelliteInfo {
  name: string;
  type: "sar" | "optical" | "military" | "comms";
  /** CelesTrak group the TLE came from (drives the map category and model). */
  group?: string;
  lat: number;
  lng: number;
  altitude: number;
  velocity: number;
  tle1: string;
  tle2: string;
}

const HIGHLIGHT_SATS = new Set([
  "SENTINEL-1A", "SENTINEL-1B", "SENTINEL-2A", "SENTINEL-2B",
  "LANDSAT 8", "LANDSAT 9",
  "WORLDVIEW-1", "WORLDVIEW-2", "WORLDVIEW-3", "WORLDVIEW-4",
  "GEOEYE-1", "PLEIADES-1A", "PLEIADES-1B",
]);

type CachedTle = { name: string; tle1: string; tle2: string; type: SatelliteInfo["type"]; group?: string };
let cachedTLEs: CachedTle[] = [];
let lastFetch = 0;
const TLE_CACHE_KEY = "tle-cache-v2";

/**
 * CelesTrak groups and how many of each the map draws (30 in total, the same
 * propagation load as before). Each group file is small and cached 12 h.
 */
/** ISS / Tiangong modules and visiting vehicles listed in the CelesTrak stations group. */
export const STATION_DUP_RE = /\b(ISS|ZARYA|POISK|NAUKA|PRICHAL|CSS|TIANHE|WENTIAN|MENGTIAN|PROGRESS|SOYUZ|DRAGON|CYGNUS|STARLINER|SHENZHOU|TIANZHOU|HTV|MODULE|SZ-\d+)\b/i;
/** Stations group: the core ISS / Tiangong modules first, then other objects minus their modules and docked craft. */
export function stationPool<T extends { name: string }>(all: T[]): T[] {
  const core = all.filter((t) => STATION_CORE.has(t.name.trim()));
  return [...core, ...all.filter((t) => !STATION_CORE.has(t.name.trim()) && !STATION_DUP_RE.test(t.name) && !/\bDEB\b|R\/B/.test(t.name))];
}
const STATION_CORE = new Set(["ISS (ZARYA)", "CSS (TIANHE)"]);
export const TLE_GROUPS: ReadonlyArray<{ group: string; take: number }> = [
  { group: "resource", take: 12 }, { group: "stations", take: 3 }, { group: "gps-ops", take: 4 },
  { group: "weather", take: 4 }, { group: "military", take: 4 }, { group: "intelsat", take: 3 },
];

// Restore from localStorage on module load
try {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem(TLE_CACHE_KEY) : null;
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed.ts && Date.now() - parsed.ts < 43200000) {
      cachedTLEs = parsed.data;
      lastFetch = parsed.ts;
    }
  }
} catch (_e) {
  // localStorage may be unavailable (private browsing)
}

function parseTle(text: string, group: string): CachedTle[] {
  const out: CachedTle[] = [];
  const lines = text.trim().split("\n");
  for (let i = 0; i < lines.length - 2; i += 3) {
    const name = lines[i].trim();
    const tle1 = lines[i + 1]?.trim();
    const tle2 = lines[i + 2]?.trim();
    if (tle1?.startsWith("1 ") && tle2?.startsWith("2 ")) {
      out.push({ name, tle1, tle2, group, type: group === "military" ? "military" : group === "intelsat" ? "comms" : HIGHLIGHT_SATS.has(name) ? "sar" : "optical" });
    }
  }
  return out;
}

async function fetchTLEs() {
  // TLE data updates ~daily. Cache for 12 hours.
  if (cachedTLEs.length > 0 && Date.now() - lastFetch < 43200000) return cachedTLEs;

  const lists = await Promise.all(TLE_GROUPS.map(async ({ group, take }) => {
    try {
      const res = await fetch(
        `https://celestrak.org/NORAD/elements/gp.php?GROUP=${group}&FORMAT=tle`,
        { signal: AbortSignal.timeout(10000) }
      );
      if (!res.ok) return [];
      const all = parseTle(await res.text(), group);
      // Highlighted imaging satellites first in the resource group.
      // ISS/CSS come from the catalog-number fetch; drop their modules and docked craft (same position).
      const pool = group === "stations" ? stationPool(all) : all;
      const sorted = group === "resource" ? [...pool].sort((a, b) => (HIGHLIGHT_SATS.has(a.name) ? 0 : 1) - (HIGHLIGHT_SATS.has(b.name) ? 0 : 1)) : pool;
      return sorted.slice(0, take);
    } catch (err) {
      console.warn("[OrbitTracker] TLE fetch failed:", group, err);
      return [];
    }
  }));
  const results = lists.flat();

  cachedTLEs = results;
  lastFetch = Date.now();

  // Persist to localStorage for cross-reload caching
  try {
    localStorage.setItem(TLE_CACHE_KEY, JSON.stringify({ data: results, ts: lastFetch }));
  } catch (e) { logger.swallow("orbit-tracker:cache-write", e, "debug"); }

  return results;
}

/**
 * Compute satellite positions at a given timestamp.
 *
 * @param maxCount Max satellites to return (default 50).
 * @param atTimestamp Epoch ms to propagate to. Defaults to now.
 *   Note: TLE accuracy decays over time; results > 14 days from the TLE
 *   epoch may drift by tens of kilometers. For typical Time Machine
 *   windows (≤7 days) accuracy is on the order of ~1 km, sufficient for
 *   visualization.
 */
export async function getSatellitePositions(
  maxCount = 50,
  atTimestamp?: number,
): Promise<SatelliteInfo[]> {
  const [tles, s] = await Promise.all([fetchTLEs(), loadSatelliteLib()]);
  const at = new Date(atTimestamp ?? Date.now());
  const positions: SatelliteInfo[] = [];

  const sorted = [...tles].sort((a, b) => {
    return (HIGHLIGHT_SATS.has(a.name) ? 0 : 1) - (HIGHLIGHT_SATS.has(b.name) ? 0 : 1);
  });

  for (const tle of sorted.slice(0, maxCount)) {
    try {
      const satrec = s.twoline2satrec(tle.tle1, tle.tle2);
      const posVel = s.propagate(satrec, at);
      if (!posVel.position || typeof posVel.position === "boolean") continue;

      const gmst = s.gstime(at);
      const geo = s.eciToGeodetic(posVel.position, gmst);
      const lat = s.degreesLat(geo.latitude);
      const lng = s.degreesLong(geo.longitude);
      const altitude = geo.height;
      if (isNaN(lat) || isNaN(lng) || isNaN(altitude)) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vel = posVel.velocity as any;
      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);

      positions.push({ name: tle.name, type: tle.type, group: tle.group, lat, lng, altitude, velocity: speed, tle1: tle.tle1, tle2: tle.tle2 });
    } catch (e) { logger.swallow("orbit-tracker:propagate", e); }
  }

  return positions;
}

/**
 * Compute the ground track polyline starting from `atTimestamp` (default
 * now) and walking `minutesAhead` forward.
 */
export async function computeGroundTrack(
  tle1: string, tle2: string, minutesAhead = 90, stepMinutes = 1,
  atTimestamp?: number,
): Promise<[number, number][]> {
  try {
    const s = await loadSatelliteLib();
    const satrec = s.twoline2satrec(tle1, tle2);
    const points: [number, number][] = [];
    const start = atTimestamp ?? Date.now();

    for (let m = 0; m <= minutesAhead; m += stepMinutes) {
      const time = new Date(start + m * 60000);
      const posVel = s.propagate(satrec, time);
      if (!posVel.position || typeof posVel.position === "boolean") continue;
      const gmst = s.gstime(time);
      const geo = s.eciToGeodetic(posVel.position, gmst);
      const lat = s.degreesLat(geo.latitude);
      const lng = s.degreesLong(geo.longitude);
      if (!isNaN(lat) && !isNaN(lng)) points.push([lng, lat]);
    }
    return points;
  } catch {
    return [];
  }
}

// ── Pass prediction over a site ──────────────────────────────────────────
// Imaging satellites from the cached CelesTrak "resource" group plus crewed
// stations (ISS, Tiangong) fetched by catalog number. CelesTrak asks clients
// not to refetch unchanged data; both lists are cached for 12 h.

const STATIONS: { catnr: number; name: string }[] = [
  { catnr: 25544, name: "ISS (ZARYA)" },
  { catnr: 48274, name: "CSS (TIANHE)" },
];
const STATION_CACHE_KEY = "tle-stations-cache";

async function fetchStationTLEs(): Promise<{ name: string; tle1: string; tle2: string }[]> {
  try {
    const stored = JSON.parse(localStorage.getItem(STATION_CACHE_KEY) ?? "null");
    if (stored?.ts && Date.now() - stored.ts < 43_200_000 && Array.isArray(stored.data)) return stored.data;
  } catch (e) { logger.swallow("orbit-tracker:station-cache-read", e, "debug"); }
  const out: { name: string; tle1: string; tle2: string }[] = [];
  for (const s of STATIONS) {
    try {
      const res = await fetch(`https://celestrak.org/NORAD/elements/gp.php?CATNR=${s.catnr}&FORMAT=tle`, { signal: AbortSignal.timeout(10_000) });
      const lines = (await res.text()).trim().split("\n").map((l) => l.trim());
      if (lines[1]?.startsWith("1 ") && lines[2]?.startsWith("2 ")) out.push({ name: lines[0] || s.name, tle1: lines[1], tle2: lines[2] });
    } catch (e) { logger.swallow("orbit-tracker:station-fetch", e, "debug"); }
  }
  if (out.length) {
    try { localStorage.setItem(STATION_CACHE_KEY, JSON.stringify({ data: out, ts: Date.now() })); }
    catch (e) { logger.swallow("orbit-tracker:station-cache-write", e, "debug"); }
  }
  return out;
}

/**
 * Passes above `minElDeg` over a site in the next `hours`, soonest first.
 * Imaging satellites are the curated HIGHLIGHT_SATS (Sentinel, Landsat,
 * WorldView, GeoEye, Pléiades) — i.e. "who could image this site, and when".
 */
export async function predictSitePasses(
  site: { lat: number; lng: number }, hours = 24, minElDeg = 10,
): Promise<{ passes: SatPass[]; satellites: number }> {
  const [tles, stations, s] = await Promise.all([fetchTLEs(), fetchStationTLEs(), loadSatelliteLib()]);
  const list: { name: string; tle1: string; tle2: string; kind: SatPass["kind"] }[] = [
    ...stations.map((t) => ({ ...t, kind: "station" as const })),
    ...tles.filter((t) => HIGHLIGHT_SATS.has(t.name)).map((t) => ({ name: t.name, tle1: t.tle1, tle2: t.tle2, kind: "imaging" as const })),
  ];
  const start = Date.now();
  const end = start + hours * 3_600_000;
  const passes: SatPass[] = [];
  for (const sat of list) {
    try {
      const el = elevationFn(s as SatLib, sat.tle1, sat.tle2, site);
      for (const p of findPasses(el, start, end, { minElDeg })) passes.push({ ...p, name: sat.name, kind: sat.kind });
    } catch (e) { logger.swallow("orbit-tracker:passes", e, "debug"); }
  }
  passes.sort((a, b) => a.riseMs - b.riseMs);
  return { passes, satellites: list.length };
}
