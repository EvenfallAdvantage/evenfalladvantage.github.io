/**
 * Satellite Orbit Visualization via CelesTrak TLE Data
 *
 * Uses satellite.js (loaded from CDN) for SGP4 orbit propagation.
 * TLE data from CelesTrak (free, no key required).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let satLib: any = null;

/** Load satellite.js from CDN (avoids Turbopack bundling issues) */
async function loadSatelliteLib(): Promise<typeof satLib> {
  if (satLib) return satLib;
  if (typeof window === "undefined") throw new Error("Browser only");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const w = window as any;
  if (w.satellite) { satLib = w.satellite; return satLib; }

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/satellite.js@5.0.0/dist/satellite.min.js";
    script.async = true;
    script.onload = () => { satLib = w.satellite; resolve(satLib); };
    script.onerror = () => reject(new Error("Failed to load satellite.js"));
    document.head.appendChild(script);
  });
}

export interface SatelliteInfo {
  name: string;
  type: "sar" | "optical" | "military" | "comms";
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

let cachedTLEs: { name: string; tle1: string; tle2: string; type: SatelliteInfo["type"] }[] = [];
let lastFetch = 0;

// Restore from localStorage on module load
try {
  const stored = typeof localStorage !== "undefined" ? localStorage.getItem("tle-cache") : null;
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed.ts && Date.now() - parsed.ts < 43200000) {
      cachedTLEs = parsed.data;
      lastFetch = parsed.ts;
    }
  }
} catch {}

async function fetchTLEs() {
  // TLE data updates ~daily. Cache for 12 hours.
  if (cachedTLEs.length > 0 && Date.now() - lastFetch < 43200000) return cachedTLEs;

  const results: typeof cachedTLEs = [];
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

  // Persist to localStorage for cross-reload caching
  try {
    localStorage.setItem("tle-cache", JSON.stringify({ data: results, ts: lastFetch }));
  } catch {}

  return results;
}

export async function getSatellitePositions(maxCount = 50): Promise<SatelliteInfo[]> {
  const [tles, s] = await Promise.all([fetchTLEs(), loadSatelliteLib()]);
  const now = new Date();
  const positions: SatelliteInfo[] = [];

  const sorted = [...tles].sort((a, b) => {
    return (HIGHLIGHT_SATS.has(a.name) ? 0 : 1) - (HIGHLIGHT_SATS.has(b.name) ? 0 : 1);
  });

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

      positions.push({ name: tle.name, type: tle.type, lat, lng, altitude, velocity: speed, tle1: tle.tle1, tle2: tle.tle2 });
    } catch {}
  }

  return positions;
}

export async function computeGroundTrack(
  tle1: string, tle2: string, minutesAhead = 90, stepMinutes = 1
): Promise<[number, number][]> {
  try {
    const s = await loadSatelliteLib();
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
      if (!isNaN(lat) && !isNaN(lng)) points.push([lng, lat]);
    }
    return points;
  } catch {
    return [];
  }
}
