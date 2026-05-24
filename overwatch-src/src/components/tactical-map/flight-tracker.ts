/**
 * Live Flight Tracking via OpenSky Network
 *
 * Free API, no key required. Rate limited to ~100 requests/10 seconds.
 * Returns all aircraft positions within a bounding box.
 *
 * Docs: https://openskynetwork.github.io/opensky-api/rest.html
 *
 * IMPORTANT: OpenSky does NOT send CORS headers for arbitrary origins —
 * the response includes Access-Control-Allow-Origin set to opensky-network.org
 * itself, which is invalid from a browser's perspective. Calling the API
 * directly from the browser always fails CORS. We always route through the
 * `opensky-proxy` Supabase Edge Function, which adds proper CORS, caches
 * for 15 s, and limits bounding-box size to prevent abuse.
 */

import { logger } from "@/lib/logger";

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

function getProxyUrl(south: number, north: number, west: number, east: number): string {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return `${supabaseUrl}/functions/v1/opensky-proxy?lamin=${south}&lamax=${north}&lomin=${west}&lomax=${east}`;
}

function parseStates(data: { states?: (string | number | boolean | null)[][] }): Aircraft[] {
  if (!data.states) return [];
  return data.states
    .filter((s) => s[5] != null && s[6] != null)
    .map((s) => ({
      icao24: String(s[0] ?? ""),
      callsign: String(s[1] ?? "").trim(),
      lat: Number(s[6]),
      lng: Number(s[5]),
      altitude: Number(s[13] ?? s[7] ?? 0),
      velocity: Number(s[9] ?? 0),
      heading: Number(s[10] ?? 0),
      verticalRate: Number(s[11] ?? 0),
      onGround: Boolean(s[8]),
      lastContact: Number(s[4] ?? 0),
    }));
}

/**
 * Fetch live aircraft positions within a bounding box via the Supabase
 * `opensky-proxy` Edge Function. Box is [south, north, west, east] in degrees.
 *
 * Bounding boxes larger than 10 degrees per axis are rejected by the proxy
 * (returns 400) to keep OpenSky rate-limit quota under control.
 */
export async function getAircraft(
  south: number, north: number, west: number, east: number
): Promise<Aircraft[]> {
  try {
    const proxyUrl = getProxyUrl(south, north, west, east);
    const res = await fetch(proxyUrl, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) return [];
    const data = await res.json();
    return parseStates(data);
  } catch (err) {
    logger.swallow("flight-tracker:proxy", err, "debug");
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
