/**
 * Hybrid place labels: a dedicated, free label layer for the satellite
 * basemap. OSM's raster tiles bake small dark text into the streets overlay,
 * which can't be read over imagery at wide zooms. Instead we read place names
 * (city, town, suburb, neighbourhood...) from OpenFreeMap's OpenMapTiles
 * vector tiles (free, no key, commercial use allowed; attribution
 * "© OpenMapTiles © OpenStreetMap contributors") and draw them as Cesium
 * labels: light text on a dark plate, crisp at any height, never clipped at
 * tile edges.
 */
import { decodeMvtLayer, type MvtValue } from "./mvt";
import { lonLatToTileFloat, tilePointToLonLat, type TileXY } from "./osm-buildings";

/** OpenMapTiles vector tiles stop at z14 (higher zooms overzoom). */
export const PLACE_TILE_MAX_ZOOM = 14;
export const PLACE_TILE_MIN_ZOOM = 2;
/** Cap on labels drawn at once (keeps wide views tidy and cheap). */
export const MAX_PLACE_LABELS = 120;
/** Cap on tiles fetched for one view. */
export const MAX_PLACE_TILES = 16;

/** Label priority by OpenMapTiles place class (lower draws first / wins). */
export const PLACE_CLASS_RANK: Readonly<Record<string, number>> = {
  continent: 0, country: 1, state: 2, province: 2, city: 3, town: 4,
  village: 5, suburb: 6, quarter: 7, hamlet: 8, neighbourhood: 9, isolated_dwelling: 10, locality: 10,
};
/** Font size (px) per class rank band. */
export function placeFontPx(rank: number): number {
  return rank <= 3 ? 15 : rank <= 4 ? 14 : 12;
}

export interface PlaceLabel { key: string; name: string; lon: number; lat: number; rank: number; cls: string }

/**
 * Vector tile zoom to use for a camera height (metres above ground).
 * ~ the zoom whose tiles are about one screen-width across at that height.
 */
export function placeZoomForHeight(heightM: number): number {
  const h = Math.max(50, heightM);
  const z = Math.round(Math.log2(40_000_000 / h) - 0.5);
  return Math.max(PLACE_TILE_MIN_ZOOM, Math.min(PLACE_TILE_MAX_ZOOM, z));
}

/** Which classes to show at a tile zoom (wide views: only big places). */
export function maxRankForZoom(z: number): number {
  if (z <= 4) return 2;
  if (z <= 7) return 4;
  if (z <= 10) return 6;
  if (z <= 12) return 7;
  return 10;
}

/** Tiles covering a lon/lat rectangle (degrees) at zoom z, centre-first, capped. */
export function tilesForRect(west: number, south: number, east: number, north: number, z: number, cap = MAX_PLACE_TILES): TileXY[] {
  const n = 2 ** z;
  if (east < west) east += 360; // crosses the antimeridian
  const a = lonLatToTileFloat(west, north, z), b = lonLatToTileFloat(Math.min(east, west + 359.999), south, z);
  const x0 = Math.floor(a.x), y0 = Math.max(0, Math.floor(a.y)), y1 = Math.min(n - 1, Math.floor(b.y));
  let x1 = Math.floor(b.x); if (x1 < x0) x1 += n;
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const out: Array<TileXY & { d: number }> = [];
  for (let y = y0; y <= y1; y++) for (let xx = x0; xx <= x1 && xx - x0 < n; xx++) {
    out.push({ z, x: ((xx % n) + n) % n, y, d: Math.hypot(xx - cx, y - cy) });
  }
  out.sort((p, q) => p.d - q.d);
  return out.slice(0, cap).map(({ z: tz, x, y }) => ({ z: tz, x, y }));
}

const nameOf = (p: Record<string, MvtValue>): string => {
  const v = p["name:latin"] ?? p["name"] ?? p["name:en"];
  return typeof v === "string" ? v.trim() : "";
};

/** Decode the `place` layer of one OpenMapTiles tile into labels. */
export function decodePlaceLabels(data: Uint8Array, tile: TileXY, maxRank = 10): PlaceLabel[] {
  const layer = decodeMvtLayer(data, "place", (p, type) => type === 1 && (PLACE_CLASS_RANK[String(p.class)] ?? 99) <= maxRank && !!nameOf(p));
  if (!layer) return [];
  const out: PlaceLabel[] = [];
  for (const f of layer.features) {
    const pt = f.geometry[0]?.[0];
    if (!pt) continue;
    const [x, y] = pt;
    if (x < 0 || y < 0 || x > layer.extent || y > layer.extent) continue; // buffer copies of neighbours
    const [lon, lat] = tilePointToLonLat(tile, x, y, layer.extent);
    const cls = String(f.properties.class);
    const name = nameOf(f.properties);
    const r = Number(f.properties.rank);
    out.push({ key: `${cls}:${name}:${lon.toFixed(3)}:${lat.toFixed(3)}`, name, lon, lat, cls, rank: (PLACE_CLASS_RANK[cls] ?? 99) * 100 + (Number.isFinite(r) ? r : 50) });
  }
  return out;
}

/** Merge labels from several tiles: dedupe, best rank first, capped. */
export function mergePlaceLabels(lists: PlaceLabel[][], cap = MAX_PLACE_LABELS): PlaceLabel[] {
  const seen = new Map<string, PlaceLabel>();
  for (const l of lists) for (const p of l) if (!seen.has(p.key)) seen.set(p.key, p);
  return [...seen.values()].sort((a, b) => a.rank - b.rank).slice(0, cap);
}

/**
 * Drop labels whose screen boxes would overlap a higher-ranked label.
 * `project` maps lon/lat to screen px (or null if off-screen).
 */
export function declutter(labels: PlaceLabel[], project: (lon: number, lat: number) => [number, number] | null): PlaceLabel[] {
  const boxes: Array<[number, number, number, number]> = [];
  const out: PlaceLabel[] = [];
  for (const l of labels) {
    const p = project(l.lon, l.lat);
    if (!p) continue;
    const fs = placeFontPx(Math.floor(l.rank / 100));
    const w = l.name.length * fs * 0.6 + 12, h = fs + 8;
    const b: [number, number, number, number] = [p[0] - w / 2, p[1] - h / 2, p[0] + w / 2, p[1] + h / 2];
    if (boxes.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])) continue;
    boxes.push(b); out.push(l);
  }
  return out;
}
