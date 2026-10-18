import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { join } from "node:path";
import { decodeGeometry, decodeMvtLayer } from "@/lib/map/mvt";
import {
  DESKTOP_BUDGET, PHONE_BUDGET, buildingBudget, buildingHeights, buildingsVisibleAt, classifyRings, clipRing,
  decodeBuildingsTile, interpolateGround, lonLatToTileFloat, signedArea, tileFraction, tileKey,
  tilePointToLonLat, tileTemplateFromTileJson, tileUrl, tilesAround, tilesToEvict, DEFAULT_BUILDING_HEIGHT_M,
} from "@/lib/map/osm-buildings";

const TILE = { z: 14, x: 4889, y: 5941 }; // Montpelier, VT
const fixture = () => new Uint8Array(gunzipSync(readFileSync(join(__dirname, "fixtures", "openfreemap-z14-4889-5941.pbf.gz"))));

describe("MVT decoder", () => {
  it("decodes geometry commands (MoveTo/LineTo/ClosePath, zigzag deltas)", () => {
    // MoveTo(1) (5,5); LineTo(3) (+10,0) (0,+10) (-10,0); ClosePath
    const z = (n: number) => (n << 1) ^ (n >> 31);
    const cmds = [9, z(5), z(5), 26, z(10), z(0), z(0), z(10), z(-10), z(0), 15];
    expect(decodeGeometry(cmds)).toEqual([[[5, 5], [15, 5], [15, 15], [5, 15]]]);
  });

  it("reads the building layer of a real OpenFreeMap tile", () => {
    const layer = decodeMvtLayer(fixture(), "building");
    expect(layer).not.toBeNull();
    expect(layer!.extent).toBe(4096);
    // OpenFreeMap merges buildings with identical attributes into multipolygons.
    const polygons = layer!.features.reduce((n, f) => n + classifyRings(f.geometry).length, 0);
    expect(polygons).toBeGreaterThan(500);
    expect(layer!.features.every((f) => f.type === 3)).toBe(true);
    expect(layer!.features.some((f) => typeof f.properties.render_height === "number")).toBe(true);
  });

  it("returns null for a missing layer and honours the filter", () => {
    expect(decodeMvtLayer(fixture(), "no_such_layer")).toBeNull();
    expect(decodeMvtLayer(fixture(), "building", () => false)!.features).toHaveLength(0);
  });

  it("throws on truncated data instead of hanging", () => {
    const d = fixture().subarray(0, 1000);
    expect(() => decodeMvtLayer(d, "building")).toThrow();
  });
});

describe("tile math", () => {
  it("lon/lat <-> tile round trip", () => {
    const f = lonLatToTileFloat(-72.5754, 44.2601, 14);
    expect(Math.floor(f.x)).toBe(4889);
    expect(Math.floor(f.y)).toBe(5941);
    const [lon, lat] = tilePointToLonLat(TILE, 2048, 2048, 4096);
    const back = lonLatToTileFloat(lon, lat, 14);
    expect(back.x).toBeCloseTo(4889.5, 6);
    expect(back.y).toBeCloseTo(5941.5, 6);
    const { u, v } = tileFraction(TILE, lon, lat);
    expect(u).toBeCloseTo(0.5, 6);
    expect(v).toBeCloseTo(0.5, 6);
  });

  it("tilesAround: centre tile first, nearest neighbours next, capped", () => {
    const t = tilesAround(-72.5754, 44.2601, 9);
    expect(t).toHaveLength(9);
    expect(tileKey(t[0])).toBe("14/4889/5941");
    expect(new Set(t.map(tileKey)).size).toBe(9);
    for (const x of t) {
      expect(Math.abs(x.x - 4889)).toBeLessThanOrEqual(2);
      expect(Math.abs(x.y - 5941)).toBeLessThanOrEqual(2);
    }
    // In the middle of a tile, the 9 nearest are exactly the 3x3 block.
    const [clon, clat] = tilePointToLonLat(TILE, 2048, 2048, 4096);
    for (const x of tilesAround(clon, clat, 9)) {
      expect(Math.abs(x.x - 4889)).toBeLessThanOrEqual(1);
      expect(Math.abs(x.y - 5941)).toBeLessThanOrEqual(1);
    }
    expect(tilesAround(-72.5754, 44.2601, 4)).toHaveLength(4);
    expect(tilesAround(-72.5754, 44.2601, 0)).toHaveLength(0);
  });

  it("tilesAround wraps across the antimeridian", () => {
    const t = tilesAround(179.999, 0, 9);
    expect(t.some((x) => x.x === 0)).toBe(true);
    expect(t.every((x) => x.x >= 0 && x.x < 2 ** 14)).toBe(true);
  });

  it("tile URL template comes only from an https openfreemap.org TileJSON", () => {
    const tpl = "https://tiles.openfreemap.org/planet/20261011_080001_pt/{z}/{x}/{y}.pbf";
    expect(tileTemplateFromTileJson({ tiles: [tpl] })).toBe(tpl);
    expect(tileUrl(tpl, TILE)).toBe("https://tiles.openfreemap.org/planet/20261011_080001_pt/14/4889/5941.pbf");
    expect(tileTemplateFromTileJson({ tiles: ["https://evil.example/{z}/{x}/{y}.pbf"] })).toBeNull();
    expect(tileTemplateFromTileJson({ tiles: ["http://tiles.openfreemap.org/{z}/{x}/{y}.pbf"] })).toBeNull();
    expect(tileTemplateFromTileJson({})).toBeNull();
  });
});

describe("zoom gate and budgets", () => {
  it("shows only at city scale, with hysteresis", () => {
    const b = DESKTOP_BUDGET;
    expect(buildingsVisibleAt(1500, b, false)).toBe(true);
    expect(buildingsVisibleAt(4500, b, false)).toBe(false);
    expect(buildingsVisibleAt(4500, b, true)).toBe(true);
    expect(buildingsVisibleAt(5100, b, true)).toBe(false);
    expect(buildingsVisibleAt(Number.NaN, b, true)).toBe(false);
  });

  it("phones get a smaller budget", () => {
    expect(buildingBudget(true)).toBe(PHONE_BUDGET);
    expect(buildingBudget(false)).toBe(DESKTOP_BUDGET);
    expect(PHONE_BUDGET.maxTilesInView).toBeLessThan(DESKTOP_BUDGET.maxTilesInView);
    expect(PHONE_BUDGET.maxBuildingsPerTile * PHONE_BUDGET.maxTilesCached).toBeLessThanOrEqual(15_000);
    expect(DESKTOP_BUDGET.maxBuildingsPerTile * DESKTOP_BUDGET.maxTilesCached).toBeLessThanOrEqual(90_000);
  });

  it("LRU eviction never drops a wanted tile", () => {
    const cached = [
      { key: "a", lastUsed: 1 }, { key: "b", lastUsed: 2 }, { key: "c", lastUsed: 3 }, { key: "d", lastUsed: 4 },
    ];
    expect(tilesToEvict(cached, new Set(["a"]), 2)).toEqual(["b", "c"]);
    expect(tilesToEvict(cached, new Set(), 4)).toEqual([]);
    expect(tilesToEvict(cached, new Set(["a", "b", "c", "d"]), 2)).toEqual([]);
  });
});

describe("geometry", () => {
  const square = (x0: number, y0: number, s: number): Array<[number, number]> => [[x0, y0], [x0 + s, y0], [x0 + s, y0 + s], [x0, y0 + s]];

  it("classifies outer rings and holes by winding", () => {
    const outer = square(0, 0, 100);
    const hole = [...square(25, 25, 50)].reverse() as Array<[number, number]>;
    const outer2 = square(200, 200, 10);
    const polys = classifyRings([outer, hole, outer2]);
    expect(polys).toHaveLength(2);
    expect(polys[0]).toHaveLength(2);
    expect(Math.sign(signedArea(polys[0][1]))).toBe(-Math.sign(signedArea(polys[0][0])));
  });

  it("clips rings to the tile square (no double-drawn border buildings)", () => {
    const r = clipRing(square(-50, 100, 100), 0, 4096);
    expect(Math.abs(signedArea(r))).toBeCloseTo(50 * 100, 6);
    expect(r.every(([x]) => x >= 0)).toBe(true);
    expect(clipRing(square(-200, -200, 100), 0, 4096)).toHaveLength(0);
    expect(Math.abs(signedArea(clipRing(square(10, 10, 20), 0, 4096)))).toBe(400);
  });

  it("bilinear ground interpolation", () => {
    // 2x2 cells (3x3 grid) rising west->east 0,10,20
    const grid = [0, 10, 20, 0, 10, 20, 0, 10, 20];
    expect(interpolateGround(grid, 2, 0, 0)).toBe(0);
    expect(interpolateGround(grid, 2, 0.25, 0.7)).toBeCloseTo(5, 6);
    expect(interpolateGround(grid, 2, 1, 1)).toBe(20);
    expect(interpolateGround(grid, 2, 2, -1)).toBe(20);
  });
});

describe("buildings", () => {
  it("heights: render_height, levels fallback, defaults and limits", () => {
    expect(buildingHeights({ render_height: 30, render_min_height: 10 })).toEqual({ minHeight: 10, height: 30 });
    expect(buildingHeights({})).toEqual({ minHeight: 0, height: DEFAULT_BUILDING_HEIGHT_M });
    expect(buildingHeights({ "building:levels": 4 }).height).toBeCloseTo(12.8, 6);
    expect(buildingHeights({ render_height: "45" }).height).toBe(45);
    expect(buildingHeights({ render_height: 0 }).height).toBe(DEFAULT_BUILDING_HEIGHT_M);
    expect(buildingHeights({ render_height: 5000 }).height).toBe(900);
    expect(buildingHeights({ render_height: 10, render_min_height: 20 }).minHeight).toBe(0);
  });

  it("decodes a real tile into clipped, located, capped buildings", () => {
    const { buildings, total } = decodeBuildingsTile(fixture(), TILE, 100_000);
    expect(total).toBeGreaterThan(500);
    expect(buildings).toHaveLength(total);
    // Every vertex lies inside the tile's lon/lat bounds (clipped).
    const [w, n] = tilePointToLonLat(TILE, 0, 0, 4096);
    const [e, s] = tilePointToLonLat(TILE, 4096, 4096, 4096);
    for (const b of buildings) {
      expect(b.height).toBeGreaterThan(b.minHeight);
      for (const ring of b.rings) {
        expect(ring.length).toBeGreaterThanOrEqual(3);
        for (const [lon, lat] of ring) {
          expect(lon).toBeGreaterThanOrEqual(w - 1e-9);
          expect(lon).toBeLessThanOrEqual(e + 1e-9);
          expect(lat).toBeLessThanOrEqual(n + 1e-9);
          expect(lat).toBeGreaterThanOrEqual(s - 1e-9);
        }
      }
    }
    // Montpelier is around 44.26N, 72.58W.
    expect(buildings[0].center[1]).toBeCloseTo(44.26, 1);
    expect(buildings[0].center[0]).toBeCloseTo(-72.58, 1);
  });

  it("caps per tile, keeping the tallest", () => {
    const all = decodeBuildingsTile(fixture(), TILE, 100_000).buildings;
    const capped = decodeBuildingsTile(fixture(), TILE, 50);
    expect(capped.buildings).toHaveLength(50);
    expect(capped.total).toBe(all.length);
    const tallest = Math.max(...all.map((b) => b.height));
    expect(capped.buildings[0].height).toBe(tallest);
    const minKept = Math.min(...capped.buildings.map((b) => b.height));
    expect(all.filter((b) => b.height > minKept).length).toBeLessThanOrEqual(50);
  });
});
