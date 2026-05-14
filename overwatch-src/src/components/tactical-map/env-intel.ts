/**
 * Environmental Intelligence — nearby POIs, sun position, geofence alerts.
 * All data fetched from free APIs (no keys required).
 */

import { logger } from "@/lib/logger";

// ─── Nearby POIs via Overpass API (OpenStreetMap) ─────────────

export type PoiType =
  | "hospital"
  | "police"
  | "fire_station"
  | "pharmacy"
  | "school"
  | "fuel"
  | "helipad"
  | "shelter";

export interface NearbyPOI {
  id: number;
  type: PoiType;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Overpass query filters per POI type. The map value is a complete tag
 * selector clause that follows `node` / `way`. We OR these together inside
 * a single bbox query for efficiency (one HTTP roundtrip per tile).
 */
const POI_QUERIES: Record<PoiType, string[]> = {
  hospital:     ['[amenity=hospital]'],
  police:       ['[amenity=police]'],
  fire_station: ['[amenity=fire_station]'],
  pharmacy:     ['[amenity=pharmacy]'],
  school:       ['[amenity=school]', '[amenity=university]', '[amenity=college]'],
  fuel:         ['[amenity=fuel]'],
  helipad:      ['[aeroway=helipad]', '[aeroway=heliport]'],
  shelter:      ['[amenity=shelter]', '[emergency=assembly_point]'],
};

// Cached results last 7 days.
const POI_CACHE_TTL = 7 * 24 * 60 * 60 * 1000;
/**
 * Tile grid resolution. Each cell is ~0.1° (~11km lat). All POI queries
 * are aligned to this grid so the same cell is requested at most once
 * regardless of where in the cell the user looks. 0.1° is a sweet spot:
 * small enough that a single Overpass query is fast, large enough that
 * a typical city viewport touches only a handful of cells.
 */
export const POI_TILE_DEG = 0.1;

/** Result of a tile fetch, plus an empty-success marker so we don't refetch dry tiles. */
interface TileEntry {
  data: NearbyPOI[];
  ts: number;
}

const tileCache = new Map<string, TileEntry>();
const inflight = new Map<string, Promise<NearbyPOI[]>>();

function tileKey(tileLat: number, tileLng: number, types: readonly PoiType[]): string {
  const sorted = [...types].sort().join(",");
  return `${tileLat.toFixed(1)},${tileLng.toFixed(1)}|${sorted}`;
}

function readTileFromStorage(key: string): TileEntry | null {
  try {
    const raw = localStorage.getItem(`poi-tile-${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.ts || Date.now() - parsed.ts >= POI_CACHE_TTL) return null;
    return parsed as TileEntry;
  } catch (e) {
    logger.swallow("env-intel:poi-tile-read", e, "debug");
    return null;
  }
}

function writeTileToStorage(key: string, entry: TileEntry) {
  try {
    localStorage.setItem(`poi-tile-${key}`, JSON.stringify(entry));
  } catch (e) {
    logger.swallow("env-intel:poi-tile-write", e, "debug");
  }
}

/**
 * Fetch all POI types for one tile cell. Cached per-tile so a single tile
 * is queried at most once across the session (within TTL).
 */
async function fetchTile(tileLat: number, tileLng: number, types: readonly PoiType[]): Promise<NearbyPOI[]> {
  const key = tileKey(tileLat, tileLng, types);

  const memHit = tileCache.get(key);
  if (memHit && Date.now() - memHit.ts < POI_CACHE_TTL) return memHit.data;

  const storageHit = readTileFromStorage(key);
  if (storageHit) {
    tileCache.set(key, storageHit);
    return storageHit.data;
  }

  // Coalesce concurrent requests for the same tile
  const existing = inflight.get(key);
  if (existing) return existing;

  const south = tileLat;
  const north = tileLat + POI_TILE_DEG;
  const west = tileLng;
  const east = tileLng + POI_TILE_DEG;
  const bbox = `${south},${west},${north},${east}`;

  const filters = types
    .flatMap(t => POI_QUERIES[t].map(clause => `node${clause}(${bbox});way${clause}(${bbox});`))
    .join("");
  const query = `[out:json][timeout:15];(${filters});out center 100;`;

  const promise = (async (): Promise<NearbyPOI[]> => {
    try {
      const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: `data=${encodeURIComponent(query)}`,
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        signal: AbortSignal.timeout(15000),
      });
      if (!res.ok) {
        logger.warn("env-intel", `Overpass tile ${key} returned ${res.status}`);
        return [];
      }
      const data = await res.json();
      const result: NearbyPOI[] = (data.elements ?? [])
        .map((el: Record<string, unknown>) => {
          const elLat = (el.lat ?? (el.center as Record<string, number>)?.lat) as number;
          const elLng = (el.lon ?? (el.center as Record<string, number>)?.lon) as number;
          const tags = el.tags as Record<string, string> ?? {};
          // Determine concrete type from tags (amenity, aeroway, emergency)
          const amenity = tags.amenity;
          const aeroway = tags.aeroway;
          const emergency = tags.emergency;
          let type: PoiType | null = null;
          if (amenity === "hospital") type = "hospital";
          else if (amenity === "police") type = "police";
          else if (amenity === "fire_station") type = "fire_station";
          else if (amenity === "pharmacy") type = "pharmacy";
          else if (amenity === "school" || amenity === "university" || amenity === "college") type = "school";
          else if (amenity === "fuel") type = "fuel";
          else if (aeroway === "helipad" || aeroway === "heliport") type = "helipad";
          else if (amenity === "shelter" || emergency === "assembly_point") type = "shelter";
          if (!type) return null;
          return {
            id: el.id as number,
            type,
            name: tags.name || type.replace("_", " "),
            lat: elLat,
            lng: elLng,
          };
        })
        .filter((p: NearbyPOI | null): p is NearbyPOI => !!p && !!p.lat && !!p.lng);

      const entry: TileEntry = { data: result, ts: Date.now() };
      tileCache.set(key, entry);
      writeTileToStorage(key, entry);
      return result;
    } catch (err) {
      logger.swallow("env-intel:poi-tile-fetch", err, "warn");
      return [];
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
}

/**
 * Compute the set of tile cells that intersect a lat/lng bounding box.
 * Returns the (south, west) corner of each cell.
 */
function tilesForBbox(south: number, north: number, west: number, east: number): Array<{ lat: number; lng: number }> {
  const tiles: Array<{ lat: number; lng: number }> = [];
  const lat0 = Math.floor(south / POI_TILE_DEG) * POI_TILE_DEG;
  const lng0 = Math.floor(west / POI_TILE_DEG) * POI_TILE_DEG;
  for (let lat = lat0; lat <= north; lat += POI_TILE_DEG) {
    for (let lng = lng0; lng <= east; lng += POI_TILE_DEG) {
      tiles.push({ lat: +lat.toFixed(2), lng: +lng.toFixed(2) });
    }
  }
  return tiles;
}

/**
 * Fetch every POI in a viewport bounding box, tile by tile. Tiles are
 * cached per session and persisted to localStorage so panning back to a
 * previously-visited area is instant.
 *
 * Throws no errors — returns whatever it can.
 */
export async function getPOIsInBbox(
  south: number, north: number, west: number, east: number,
  types: readonly PoiType[] = (Object.keys(POI_QUERIES) as PoiType[]),
): Promise<NearbyPOI[]> {
  const tiles = tilesForBbox(south, north, west, east);
  if (tiles.length === 0) return [];

  // Fan out per-tile fetches (cached/inflight de-duped inside fetchTile)
  const results = await Promise.all(tiles.map(t => fetchTile(t.lat, t.lng, types)));

  // Flatten, dedupe by id (a way and a node with the same id are rare but possible).
  const seen = new Map<number, NearbyPOI>();
  for (const arr of results) {
    for (const poi of arr) {
      if (poi.lat < south || poi.lat > north || poi.lng < west || poi.lng > east) continue;
      if (!seen.has(poi.id)) seen.set(poi.id, poi);
    }
  }
  return Array.from(seen.values());
}

/**
 * Fetch POIs within a radius (meters) of a point. Implemented on top of
 * the tile-grid fetcher so radius-based queries share cache with viewport
 * queries.
 */
export async function getNearbyPOIs(
  lat: number, lng: number, radiusM = 5000,
  types: readonly PoiType[] = (Object.keys(POI_QUERIES) as PoiType[]),
): Promise<NearbyPOI[]> {
  const dLat = radiusM / 111320;
  const dLng = radiusM / (111320 * Math.cos(lat * Math.PI / 180));
  return getPOIsInBbox(lat - dLat, lat + dLat, lng - dLng, lng + dLng, types);
}

// ─── Sun / Moon Position ──────────────────────────────────────

export interface SunPosition {
  azimuth: number; // degrees from north
  altitude: number; // degrees above horizon (negative = below)
  isDay: boolean;
  phase: "night" | "twilight" | "golden-hour" | "day";
}

export function getSunPosition(lat: number, lng: number, date = new Date()): SunPosition {
  // Simplified solar position calculation
  const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
  const hour = date.getUTCHours() + date.getUTCMinutes() / 60;

  const declination = -23.45 * Math.cos((360 / 365) * (dayOfYear + 10) * Math.PI / 180);
  const hourAngle = (hour - 12) * 15 + lng;

  const latRad = lat * Math.PI / 180;
  const decRad = declination * Math.PI / 180;
  const haRad = hourAngle * Math.PI / 180;

  const altitude = Math.asin(
    Math.sin(latRad) * Math.sin(decRad) +
    Math.cos(latRad) * Math.cos(decRad) * Math.cos(haRad)
  ) * 180 / Math.PI;

  const azimuth = Math.atan2(
    Math.sin(haRad),
    Math.cos(haRad) * Math.sin(latRad) - Math.tan(decRad) * Math.cos(latRad)
  ) * 180 / Math.PI + 180;

  const isDay = altitude > 0;
  const phase: SunPosition["phase"] =
    altitude < -6 ? "night" :
    altitude < 0 ? "twilight" :
    altitude < 10 ? "golden-hour" : "day";

  return { azimuth: azimuth % 360, altitude, isDay, phase };
}

// ─── Geofence Alert Feed ──────────────────────────────────────

export interface GeofenceAlert {
  id: string;
  eventName: string;
  userName: string;
  distanceM: number;
  alertType: "breach" | "return";
  createdAt: string;
}

export async function getRecentGeofenceAlerts(companyId: string, limit = 20): Promise<GeofenceAlert[]> {
  const { createClient } = await import("./../../lib/supabase/client");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("geofence_alerts")
    .select("*, events(name), users(first_name, last_name)")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) { console.warn("[EnvIntel] Geofence alerts fetch failed:", error); return []; }

  return (data ?? []).map((r: Record<string, unknown> & { events?: { name?: string }; users?: { first_name?: string; last_name?: string } }) => ({
    id: r.id as string,
    eventName: r.events?.name ?? "Unknown",
    userName: `${r.users?.first_name ?? ""} ${r.users?.last_name ?? ""}`.trim() || "Unknown",
    distanceM: r.distance_m as number,
    alertType: r.alert_type as "breach" | "return",
    createdAt: r.created_at as string,
  }));
}


