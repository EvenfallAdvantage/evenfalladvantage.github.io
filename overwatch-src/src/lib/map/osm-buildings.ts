/**
 * 3D buildings from OpenStreetMap, via OpenFreeMap's free OpenMapTiles vector
 * tiles (no key, no request limits, commercial use allowed; data ODbL).
 * Pure logic only (tile math, decoding, clipping, caps, zoom gate); the
 * Cesium side lives in components/tactical-map/hooks/use-osm-buildings-layer.ts.
 *
 * Source:      https://tiles.openfreemap.org/planet (TileJSON -> z14 .pbf tiles)
 * Layer:       "building": render_height, render_min_height, colour, hide_3d
 * Attribution: "© OpenMapTiles © OpenStreetMap contributors" (required by
 *              OpenFreeMap; ODbL requires "© OpenStreetMap contributors").
 */

import { decodeMvtLayer, type MvtValue } from "./mvt";

export const OSM_BUILDINGS_TILEJSON_URL = "https://tiles.openfreemap.org/planet";
/** OpenMapTiles carries every building from z14 (its max zoom). */
export const OSM_BUILDINGS_ZOOM = 14;
export const OSM_BUILDINGS_ATTRIBUTION = "3D buildings: © OpenMapTiles © OpenStreetMap contributors";
export const OSM_COPYRIGHT_URL = "https://www.openstreetmap.org/copyright";
export const OPENFREEMAP_URL = "https://openfreemap.org/";

/** Height used when OSM has neither height nor levels (OpenMapTiles already defaults most). */
export const DEFAULT_BUILDING_HEIGHT_M = 6;
export const METERS_PER_LEVEL = 3.2;
/** Ignore absurd values (bad tagging). */
export const MAX_BUILDING_HEIGHT_M = 900;

export interface BuildingBudget {
  /** Show buildings only when the camera is at most this high above ground. */
  maxAltitudeM: number;
  /** Tiles drawn around the view centre (nearest first). */
  maxTilesInView: number;
  /** Built tiles kept in memory (LRU; includes the visible ones). */
  maxTilesCached: number;
  /** Buildings per tile (tallest first beyond this). */
  maxBuildingsPerTile: number;
  /** Concurrent tile downloads. */
  maxConcurrentFetches: number;
}

export const DESKTOP_BUDGET: BuildingBudget = {
  maxAltitudeM: 4000,
  maxTilesInView: 9,
  maxTilesCached: 15,
  maxBuildingsPerTile: 6000,
  maxConcurrentFetches: 4,
};

export const PHONE_BUDGET: BuildingBudget = {
  maxAltitudeM: 2500,
  maxTilesInView: 4,
  maxTilesCached: 6,
  maxBuildingsPerTile: 2500,
  maxConcurrentFetches: 2,
};

export function buildingBudget(constrained: boolean): BuildingBudget {
  return constrained ? PHONE_BUDGET : DESKTOP_BUDGET;
}

/**
 * Zoom gate with hysteresis so buildings don't flicker at the threshold:
 * show at or below maxAltitude, hide above 1.25x, keep the previous state between.
 */
export function buildingsVisibleAt(altitudeM: number, budget: BuildingBudget, wasVisible: boolean): boolean {
  if (!Number.isFinite(altitudeM)) return false;
  if (altitudeM <= budget.maxAltitudeM) return true;
  if (altitudeM > budget.maxAltitudeM * 1.25) return false;
  return wasVisible;
}

// ─── Tile math (Web Mercator / XYZ) ────────────────────────────────

export interface TileXY { z: number; x: number; y: number }

export const tileKey = (t: TileXY) => `${t.z}/${t.x}/${t.y}`;

export function lonLatToTileFloat(lon: number, lat: number, z: number): { x: number; y: number } {
  const n = 2 ** z;
  const clampedLat = Math.max(-85.0511, Math.min(85.0511, lat));
  const r = (clampedLat * Math.PI) / 180;
  return {
    x: ((((lon + 180) / 360) % 1) + 1) % 1 * n,
    y: ((1 - Math.asinh(Math.tan(r)) / Math.PI) / 2) * n,
  };
}

/** Tile pixel (0..extent) to lon/lat. */
export function tilePointToLonLat(t: TileXY, px: number, py: number, extent: number): [number, number] {
  const n = 2 ** t.z;
  const wx = (t.x + px / extent) / n;
  const wy = (t.y + py / extent) / n;
  const lon = wx * 360 - 180;
  const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180) / Math.PI;
  return [lon, lat];
}

/** The `count` tiles nearest the view centre (centre tile first), from its 5x5 neighbourhood. */
export function tilesAround(lon: number, lat: number, count: number, z = OSM_BUILDINGS_ZOOM): TileXY[] {
  const f = lonLatToTileFloat(lon, lat, z);
  const cx = Math.floor(f.x);
  const cy = Math.floor(f.y);
  const n = 2 ** z;
  const out: Array<TileXY & { d: number }> = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const y = cy + dy;
      if (y < 0 || y >= n) continue;
      const x = (((cx + dx) % n) + n) % n;
      // Distance from the view point to the nearest point of the tile.
      const nx = Math.max(cx + dx, Math.min(f.x, cx + dx + 1));
      const ny = Math.max(y, Math.min(f.y, y + 1));
      out.push({ z, x, y, d: Math.hypot(f.x - nx, f.y - ny) + (dx === 0 && dy === 0 ? -1 : 0) });
    }
  }
  out.sort((a, b) => a.d - b.d);
  return out.slice(0, Math.max(0, count)).map(({ z: tz, x, y }) => ({ z: tz, x, y }));
}

export function tileUrl(template: string, t: TileXY): string {
  return template.replace("{z}", String(t.z)).replace("{x}", String(t.x)).replace("{y}", String(t.y));
}

/** Pick the vector tile URL template from OpenFreeMap's TileJSON (it carries a dated path). */
export function tileTemplateFromTileJson(json: unknown): string | null {
  const tiles = (json as { tiles?: unknown })?.tiles;
  const t = Array.isArray(tiles) ? tiles[0] : null;
  if (typeof t !== "string") return null;
  try {
    const u = new URL(t.replace("{z}", "0").replace("{x}", "0").replace("{y}", "0"));
    if (u.protocol !== "https:" || !u.hostname.endsWith("openfreemap.org")) return null;
  } catch {
    return null;
  }
  return t.includes("{z}") && t.includes("{x}") && t.includes("{y}") ? t : null;
}

// ─── Geometry ──────────────────────────────────────────────────────

type Ring = Array<[number, number]>;

export function signedArea(ring: Ring): number {
  let s = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    s += (ring[j][0] - ring[i][0]) * (ring[i][1] + ring[j][1]);
  }
  return s / 2;
}

/** Group rings into polygons: a ring with the outer ring's winding starts a polygon, opposite winding = hole. */
export function classifyRings(rings: Ring[]): Ring[][] {
  const polys: Ring[][] = [];
  let current: Ring[] | null = null;
  let outerSign = 0;
  for (const r of rings) {
    const a = signedArea(r);
    if (a === 0) continue;
    const sign = Math.sign(a);
    if (outerSign === 0) outerSign = sign;
    if (sign === outerSign) {
      current = [r];
      polys.push(current);
    } else if (current) {
      current.push(r);
    }
  }
  return polys;
}

/**
 * Clip a ring to the tile square (Sutherland-Hodgman). Tiles include a small
 * buffer around their edges, so without this a building on a tile border
 * would be drawn twice and z-fight.
 */
export function clipRing(ring: Ring, min: number, max: number): Ring {
  let out = ring;
  const edges: Array<[(p: [number, number]) => boolean, (a: [number, number], b: [number, number]) => [number, number]]> = [
    [(p) => p[0] >= min, (a, b) => [min, a[1] + ((b[1] - a[1]) * (min - a[0])) / (b[0] - a[0])]],
    [(p) => p[0] <= max, (a, b) => [max, a[1] + ((b[1] - a[1]) * (max - a[0])) / (b[0] - a[0])]],
    [(p) => p[1] >= min, (a, b) => [a[0] + ((b[0] - a[0]) * (min - a[1])) / (b[1] - a[1]), min]],
    [(p) => p[1] <= max, (a, b) => [a[0] + ((b[0] - a[0]) * (max - a[1])) / (b[1] - a[1]), max]],
  ];
  for (const [inside, cut] of edges) {
    if (out.length === 0) break;
    const input = out;
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const ci = inside(cur);
      const pi = inside(prev);
      if (ci) {
        if (!pi) out.push(cut(prev, cur));
        out.push(cur);
      } else if (pi) {
        out.push(cut(prev, cur));
      }
    }
  }
  return out;
}

/** Drop consecutive duplicate points (and a closing duplicate). */
function dedupe(ring: Ring): Ring {
  const out: Ring = [];
  for (const p of ring) {
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  if (out.length > 1 && out[0][0] === out[out.length - 1][0] && out[0][1] === out[out.length - 1][1]) out.pop();
  return out;
}

// ─── Buildings ─────────────────────────────────────────────────────

export interface Building {
  /** Outer ring then holes, as [lon, lat] (unclosed). */
  rings: Array<Array<[number, number]>>;
  /** Metres above ground. */
  minHeight: number;
  height: number;
  /** Footprint area in tile units² (for ordering only). */
  area: number;
  /** Centroid of the outer ring [lon, lat]. */
  center: [number, number];
}

function num(v: MvtValue | undefined): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  return null;
}

/** Height/min height from OpenMapTiles properties, with sensible defaults and sanity limits. */
export function buildingHeights(props: Record<string, MvtValue>): { minHeight: number; height: number } {
  let height = num(props.render_height);
  if (height === null) {
    const levels = num(props["building:levels"] ?? props.levels);
    height = levels !== null ? levels * METERS_PER_LEVEL : DEFAULT_BUILDING_HEIGHT_M;
  }
  if (height <= 0) height = DEFAULT_BUILDING_HEIGHT_M;
  height = Math.min(height, MAX_BUILDING_HEIGHT_M);
  let minHeight = num(props.render_min_height) ?? 0;
  if (minHeight < 0 || minHeight >= height) minHeight = 0;
  return { minHeight, height };
}

function isHidden3d(v: MvtValue | undefined): boolean {
  return v === true || v === 1 || v === "true";
}

export interface DecodeResult {
  buildings: Building[];
  /** Buildings in the tile before the cap. */
  total: number;
}

/**
 * Decode a z14 OpenMapTiles tile into extrudable buildings: clipped to the
 * tile, outlines marked hide_3d dropped, capped (tallest, then largest first).
 */
export function decodeBuildingsTile(data: Uint8Array, tile: TileXY, maxBuildings: number): DecodeResult {
  const layer = decodeMvtLayer(data, "building", (props, type) => type === 3 && !isHidden3d(props.hide_3d));
  if (!layer) return { buildings: [], total: 0 };
  const extent = layer.extent;
  const out: Building[] = [];
  for (const f of layer.features) {
    const { minHeight, height } = buildingHeights(f.properties);
    for (const poly of classifyRings(f.geometry)) {
      const clipped = poly.map((r) => dedupe(clipRing(r, 0, extent))).filter((r) => r.length >= 3);
      if (clipped.length === 0) continue;
      const outer = clipped[0];
      const area = Math.abs(signedArea(outer));
      if (area < 1) continue; // degenerate sliver from clipping
      let cx = 0;
      let cy = 0;
      for (const p of outer) { cx += p[0]; cy += p[1]; }
      out.push({
        rings: clipped.map((r) => r.map(([x, y]) => tilePointToLonLat(tile, x, y, extent))),
        minHeight,
        height,
        area,
        center: tilePointToLonLat(tile, cx / outer.length, cy / outer.length, extent),
      });
    }
  }
  const total = out.length;
  if (out.length > maxBuildings) {
    out.sort((a, b) => b.height - a.height || b.area - a.area);
    out.length = maxBuildings;
  }
  return { buildings: out, total };
}

/**
 * Which cached tiles to evict: everything beyond `maxCached`, never a tile
 * that's wanted now, least recently used first.
 */
export function tilesToEvict(cached: Array<{ key: string; lastUsed: number }>, wanted: ReadonlySet<string>, maxCached: number): string[] {
  const excess = cached.length - maxCached;
  if (excess <= 0) return [];
  return cached
    .filter((c) => !wanted.has(c.key))
    .sort((a, b) => a.lastUsed - b.lastUsed)
    .slice(0, excess)
    .map((c) => c.key);
}

/** Bilinear interpolation over a (n+1)x(n+1) grid of ground heights covering a tile. */
export function interpolateGround(grid: number[], n: number, u: number, v: number): number {
  const fu = Math.max(0, Math.min(1, u)) * n;
  const fv = Math.max(0, Math.min(1, v)) * n;
  const i = Math.min(n - 1, Math.floor(fu));
  const j = Math.min(n - 1, Math.floor(fv));
  const tu = fu - i;
  const tv = fv - j;
  const at = (a: number, b: number) => grid[b * (n + 1) + a] ?? 0;
  return (at(i, j) * (1 - tu) + at(i + 1, j) * tu) * (1 - tv) + (at(i, j + 1) * (1 - tu) + at(i + 1, j + 1) * tu) * tv;
}

/** Fractional position (0..1, y down) of a lon/lat inside a tile. */
export function tileFraction(t: TileXY, lon: number, lat: number): { u: number; v: number } {
  const f = lonLatToTileFloat(lon, lat, t.z);
  return { u: f.x - t.x, v: f.y - t.y };
}

/**
 * Scale the budget with the performance governor (0 = full, 1 = reduced,
 * 2 = low): fewer tiles and buildings, and a lower zoom-in threshold.
 */
export function governedBudget(b: BuildingBudget, perfLevel: number): BuildingBudget {
  if (!(perfLevel >= 1)) return b;
  const k = perfLevel >= 2 ? 0.45 : 0.7;
  return {
    maxAltitudeM: Math.round(b.maxAltitudeM * (perfLevel >= 2 ? 0.75 : 0.9)),
    maxTilesInView: Math.max(1, Math.round(b.maxTilesInView * k)),
    maxTilesCached: Math.max(2, Math.round(b.maxTilesCached * k)),
    maxBuildingsPerTile: Math.round(b.maxBuildingsPerTile * k),
    maxConcurrentFetches: Math.max(1, Math.round(b.maxConcurrentFetches * (perfLevel >= 2 ? 0.5 : 1))),
  };
}

/** Visual mode the buildings are drawn for. */
export type BuildingLook = "normal" | "dark" | "nvg" | "thermal";
export function buildingLookOf(l: { nvgGoggles?: boolean; flirThermal?: boolean; nightVision?: boolean }): BuildingLook {
  return l.flirThermal ? "thermal" : l.nvgGoggles ? "nvg" : l.nightVision ? "dark" : "normal";
}
/** Shader mode number for a look. */
export const LOOK_MODE: Record<BuildingLook, number> = { normal: 0, dark: 0, nvg: 1, thermal: 2 };
/** Base colours: warm stone by day, slate on the dark basemap, mid-grey for NVG gain. */
export const LOOK_COLOR: Record<BuildingLook, string> = { normal: "#d2cbbd", dark: "#4a5666", nvg: "#8a8f94", thermal: "#ffffff" };
/** Roof-edge outlines help under NVG/thermal where the gain flattens shading. */
export const lookWantsEdges = (l: BuildingLook) => l === "nvg" || l === "thermal";
