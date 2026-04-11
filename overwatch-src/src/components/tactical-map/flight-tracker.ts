/**
 * Live Flight Tracking via OpenSky Network
 *
 * Free API, no key required. Rate limited to ~100 requests/10 seconds.
 * Returns all aircraft positions within a bounding box.
 *
 * Docs: https://openskynetwork.github.io/opensky-api/rest.html
 */

export interface Aircraft {
  icao24: string;
  callsign: string;
  lat: number;
  lng: number;
  altitude: number; // meters (geometric)
  velocity: number; // m/s ground speed
  heading: number; // degrees from north
  verticalRate: number; // m/s
  onGround: boolean;
  lastContact: number; // unix timestamp
}

/**
 * Fetch live aircraft positions within a bounding box.
 * Box is defined by [south, north, west, east] in degrees.
 */
let corsBlocked = false;

export async function getAircraft(
  south: number, north: number, west: number, east: number
): Promise<Aircraft[]> {
  // Don't retry after CORS failure — OpenSky doesn't support cross-origin requests
  if (corsBlocked) return [];

  try {
    const params = `lamin=${south}&lamax=${north}&lomin=${west}&lomax=${east}`;
    const url = `https://opensky-network.org/api/states/all?${params}`;

    let res: Response;
    try {
      res = await fetch(url, { signal: AbortSignal.timeout(6000), mode: "cors" });
    } catch {
      corsBlocked = true;
      console.warn("[FlightTracker] CORS blocked by OpenSky. Flight tracking disabled until a proxy Edge Function is configured.");
      return [];
    }
    if (!res.ok) return [];
    const data = await res.json();

    if (!data.states) return [];

    return data.states
      .filter((s: (string | number | boolean | null)[]) => s[5] != null && s[6] != null)
      .map((s: (string | number | boolean | null)[]) => ({
        icao24: String(s[0] ?? ""),
        callsign: String(s[1] ?? "").trim(),
        lat: Number(s[6]),
        lng: Number(s[5]),
        altitude: Number(s[13] ?? s[7] ?? 0), // geometric alt, fallback to barometric
        velocity: Number(s[9] ?? 0),
        heading: Number(s[10] ?? 0),
        verticalRate: Number(s[11] ?? 0),
        onGround: Boolean(s[8]),
        lastContact: Number(s[4] ?? 0),
      }));
  } catch (err) {
    console.warn("[FlightTracker] Fetch failed:", err);
    return [];
  }
}

/**
 * Get a bounding box around a center point with a given radius in km.
 */
export function getBoundingBox(lat: number, lng: number, radiusKm: number): {
  south: number; north: number; west: number; east: number;
} {
  const dLat = radiusKm / 111.32;
  const dLng = radiusKm / (111.32 * Math.cos(lat * Math.PI / 180));
  return {
    south: lat - dLat,
    north: lat + dLat,
    west: lng - dLng,
    east: lng + dLng,
  };
}

/**
 * Format altitude for display.
 */
export function formatAltitude(meters: number): string {
  const feet = Math.round(meters * 3.281);
  return feet > 1000 ? `FL${Math.round(feet / 100)}` : `${feet}ft`;
}

/**
 * Format speed for display.
 */
export function formatSpeed(ms: number): string {
  const knots = Math.round(ms * 1.944);
  return `${knots}kt`;
}
