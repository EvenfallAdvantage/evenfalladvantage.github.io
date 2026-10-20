/**
 * Coarse rooftop heightfield of the OSM 3D buildings currently built, shared
 * with screen-space overlays (wind particles) so they can hide behind
 * buildings. One raster per z14 tile: max building top (metres above ground)
 * per cell. Pure apart from the module-level registry.
 */
import { lonLatToTileFloat, OSM_BUILDINGS_ZOOM, tileKey, type Building, type TileXY } from "./osm-buildings";

export const RASTER_N = 128;

export interface HeightRaster { tile: TileXY; n: number; h: Float32Array; max: number }

function inRing(x: number, y: number, ring: Array<[number, number]>): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/** Rasterise building tops (outer rings) into an n×n grid over the tile. */
export function buildHeightRaster(tile: TileXY, buildings: readonly Building[], n = RASTER_N): HeightRaster {
  const h = new Float32Array(n * n);
  let max = 0;
  for (const b of buildings) {
    const outer = b.rings[0];
    if (!outer || outer.length < 3) continue;
    // ring in tile-fraction coords
    const pts = outer.map(([lon, lat]) => { const f = lonLatToTileFloat(lon, lat, tile.z); return [(f.x - tile.x) * n, (f.y - tile.y) * n] as [number, number]; });
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const [x, y] of pts) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    const ci0 = Math.max(0, Math.floor(x0)), ci1 = Math.min(n - 1, Math.floor(x1));
    const cj0 = Math.max(0, Math.floor(y0)), cj1 = Math.min(n - 1, Math.floor(y1));
    let hit = false;
    for (let j = cj0; j <= cj1; j++) {
      for (let i = ci0; i <= ci1; i++) {
        if (inRing(i + 0.5, j + 0.5, pts)) { const k = j * n + i; if (b.height > h[k]) h[k] = b.height; hit = true; }
      }
    }
    if (!hit && ci0 <= ci1 && cj0 <= cj1) { // footprint smaller than a cell
      const k = Math.min(n - 1, Math.max(0, Math.floor((y0 + y1) / 2))) * n + Math.min(n - 1, Math.max(0, Math.floor((x0 + x1) / 2)));
      if (b.height > h[k]) h[k] = b.height;
    }
    if (b.height > max) max = b.height;
  }
  return { tile, n, h, max };
}

const registry = new Map<string, HeightRaster>();
export function setHeightRaster(r: HeightRaster): void { registry.set(tileKey(r.tile), r); }
export function removeHeightRaster(key: string): void { registry.delete(key); }
export function clearHeightRasters(): void { registry.clear(); }
export function hasHeightRasters(): boolean { return registry.size > 0; }
export function maxBuildingHeight(): number { let m = 0; for (const r of registry.values()) m = Math.max(m, r.max); return m; }

/** Building top (m above ground) at a point, 0 if none or not loaded. */
export function buildingHeightAt(lon: number, lat: number): number {
  const z = OSM_BUILDINGS_ZOOM;
  const f = lonLatToTileFloat(lon, lat, z);
  const t = { z, x: Math.floor(f.x), y: Math.floor(f.y) };
  const r = registry.get(tileKey(t));
  if (!r) return 0;
  const i = Math.min(r.n - 1, Math.floor((f.x - t.x) * r.n));
  const j = Math.min(r.n - 1, Math.floor((f.y - t.y) * r.n));
  return r.h[j * r.n + i];
}

const M_PER_DEG = 111_320;

/**
 * Is a ground point hidden from the camera by a building? Marches the
 * sight line from the point toward the camera across the heightfield until
 * the line is above the tallest loaded building.
 */
export function occludedByBuildings(
  lon: number, lat: number,
  cam: { lon: number; lat: number; heightAboveGround: number },
  heightAt: (lon: number, lat: number) => number = buildingHeightAt,
  maxH = maxBuildingHeight(), stepM = 12,
): boolean {
  if (maxH <= 0 || cam.heightAboveGround <= 0) return false;
  const k = Math.cos(lat * Math.PI / 180);
  const dx = (cam.lon - lon) * M_PER_DEG * k;
  const dy = (cam.lat - lat) * M_PER_DEG;
  const D = Math.hypot(dx, dy);
  if (heightAt(lon, lat) > 0.5) return true;
  if (D < 1) return false;
  const limit = Math.min(D, (maxH / cam.heightAboveGround) * D);
  const steps = Math.ceil(limit / stepM);
  for (let s = 1; s <= steps; s++) {
    const d = Math.min(limit, s * stepM);
    const ray = (cam.heightAboveGround * d) / D;
    const f = d / D;
    if (heightAt(lon + (cam.lon - lon) * f, lat + (cam.lat - lat) * f) > ray) return true;
  }
  return false;
}
