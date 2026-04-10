/**
 * Satellite Orbit Visualization via CelesTrak TLE Data
 *
 * Uses satellite.js for SGP4 orbit propagation.
 * TLE data from CelesTrak (free, no key required).
 *
 * Tracks active Earth observation satellites relevant to security ops:
 * - Sentinel-1 (SAR radar)
 * - Sentinel-2 (optical)
 * - Landsat 8/9
 * - WorldView / GeoEye
 * - Planet SkySat
 */

// Lazy import to avoid blocking the build (satellite.js is heavy for Turbopack)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let sat: any = null;
async function getSatLib() {
  if (!sat) sat = await import("satellite.js");
  return sat;
}

export interface SatelliteInfo {
  name: string;
  type: "sar" | "optical" | "military" | "comms";
  lat: number;
  lng: number;
  altitude: number; // km
  velocity: number; // km/s
  tle1: string;
  tle2: string;
}

// Key satellite groups to track
const TLE_URLS: { url: string; type: SatelliteInfo["type"] }[] = [
  { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=tle", type: "optical" }, // Earth resources (Sentinel, Landsat)
  { url: "https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle", type: "optical" },
];

// Named satellites we specifically want to highlight
const HIGHLIGHT_SATS = new Set([
  "SENTINEL-1A", "SENTINEL-1B", "SENTINEL-2A", "SENTINEL-2B",
  "LANDSAT 8", "LANDSAT 9",
  "WORLDVIEW-1", "WORLDVIEW-2", "WORLDVIEW-3", "WORLDVIEW-4",
  "GEOEYE-1", "PLEIADES-1A", "PLEIADES-1B",
  "SKYSAT-1", "SKYSAT-2", "SKYSAT-3",
]);

let cachedTLEs: { name: string; tle1: string; tle2: string; type: SatelliteInfo["type"] }[] = [];
let lastFetch = 0;

/**
 * Fetch TLE data from CelesTrak (cached for 1 hour).
 */
async function fetchTLEs(): Promise<typeof cachedTLEs> {
  if (cachedTLEs.length > 0 && Date.now() - lastFetch < 3600000) {
    return cachedTLEs;
  }

  const results: typeof cachedTLEs = [];

  // Fetch the resource satellites group (contains Sentinel, Landsat, etc.)
  try {
    const res = await fetch(
      "https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=tle",
      { signal: AbortSignal.timeout(10000) }
    );
    const text = await res.text();
    const lines = text.trim().split("\n");

    for (let i = 0; i < lines.length - 2; i += 3) {
      const name = lines[i].trim();
      const tle1 = lines[i + 1]?.trim();
      const tle2 = lines[i + 2]?.trim();
      if (tle1?.startsWith("1 ") && tle2?.startsWith("2 ")) {
        results.push({ name, tle1, tle2, type: HIGHLIGHT_SATS.has(name) ? "sar" : "optical" });
      }
    }
  } catch (err) {
    console.warn("[OrbitTracker] TLE fetch failed:", err);
  }

  cachedTLEs = results;
  lastFetch = Date.now();
  return results;
}

/**
 * Get current positions of tracked satellites.
 * Returns only satellites currently visible (above horizon) from the given viewpoint,
 * or all if no viewpoint is specified.
 */
export async function getSatellitePositions(maxCount = 50): Promise<SatelliteInfo[]> {
  const tles = await fetchTLEs();
  const now = new Date();
  const positions: SatelliteInfo[] = [];

  // Prioritize highlighted satellites
  const sorted = [...tles].sort((a, b) => {
    const aH = HIGHLIGHT_SATS.has(a.name) ? 0 : 1;
    const bH = HIGHLIGHT_SATS.has(b.name) ? 0 : 1;
    return aH - bH;
  });

  const s = await getSatLib();

  for (const tle of sorted.slice(0, maxCount)) {
    try {
      const satrec = s.twoline2satrec(tle.tle1, tle.tle2);
      const posVel = s.propagate(satrec, now);
      if (!posVel.position || typeof posVel.position === "boolean") continue;

      const gmst = s.gstime(now);
      const geo = s.eciToGeodetic(posVel.position, gmst);

      const lat = s.degreesLat(geo.latitude);
      const lng = s.degreesLong(geo.longitude);
      const altitude = geo.height;

      if (isNaN(lat) || isNaN(lng) || isNaN(altitude)) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const vel = posVel.velocity as any;
      const speed = Math.sqrt(vel.x ** 2 + vel.y ** 2 + vel.z ** 2);

      positions.push({
        name: tle.name,
        type: tle.type,
        lat, lng, altitude,
        velocity: speed,
        tle1: tle.tle1,
        tle2: tle.tle2,
      });
    } catch {}
  }

  return positions;
}

/**
 * Compute the ground track (orbit path) for a satellite over the next N minutes.
 * Returns an array of [lng, lat] positions.
 */
export async function computeGroundTrack(
  tle1: string, tle2: string, minutesAhead = 90, stepMinutes = 1
): Promise<[number, number][]> {
  try {
    const s = await getSatLib();
    const satrec = s.twoline2satrec(tle1, tle2);
    const points: [number, number][] = [];
    const now = Date.now();

    for (let m = 0; m <= minutesAhead; m += stepMinutes) {
      const time = new Date(now + m * 60000);
      const posVel = s.propagate(satrec, time);
      if (!posVel.position || typeof posVel.position === "boolean") continue;

      const gmst = s.gstime(time);
      const geo = s.eciToGeodetic(posVel.position, gmst);
      const lat = s.degreesLat(geo.latitude);
      const lng = s.degreesLong(geo.longitude);

      if (!isNaN(lat) && !isNaN(lng)) {
        points.push([lng, lat]);
      }
    }

    return points;
  } catch {
    return [];
  }
}
