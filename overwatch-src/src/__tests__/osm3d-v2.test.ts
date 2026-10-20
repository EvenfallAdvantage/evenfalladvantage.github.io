// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi } from "vitest";
import { cityLightsAlpha, sunElevationDeg, viewDarkness } from "@/lib/map/sun";
import { buildHeightRaster, buildingHeightAt, clearHeightRasters, occludedByBuildings, setHeightRaster } from "@/lib/map/building-heightfield";
import { applyHeightPoints, heightFromTags, overpassAllowed, parseLength, parseOverpass, overpassQuery, _resetOverpassGate, fetchOverpassHeights } from "@/lib/map/overpass-heights";
import { DESKTOP_BUDGET, buildingLookOf, governedBudget, lonLatToTileFloat, type Building } from "@/lib/map/osm-buildings";
import { boxAround, rooftopRadarUrl, sheetHeight } from "@/lib/map/rooftop-weather";

describe("sun / city lights gate", () => {
  it("NYC noon is daylight, 2 am is dark", () => {
    expect(sunElevationDeg(Date.parse("2026-10-19T17:30:00Z"), 40.75, -73.99)).toBeGreaterThan(30);
    expect(sunElevationDeg(Date.parse("2026-10-20T06:00:00Z"), 40.75, -73.99)).toBeLessThan(-30);
  });
  it("alpha is 0 by day, 1 when dark, between in twilight", () => {
    expect(cityLightsAlpha(10)).toBe(0);
    expect(cityLightsAlpha(-10)).toBe(1);
    const t = cityLightsAlpha(-3); expect(t).toBeGreaterThan(0); expect(t).toBeLessThan(1);
  });
  it("a view crossing the terminator shows no lights", () => {
    // ~18:00 local in NYC in late Oct: sunset; a continental view spans day and night
    const ms = Date.parse("2026-10-19T22:30:00Z");
    expect(viewDarkness(ms, 40.75, -73.99, 5_000_000)).toBe(0);
    expect(viewDarkness(Date.parse("2026-10-20T06:00:00Z"), 40.75, -73.99, 900)).toBe(1);
  });
});

const square = (lon: number, lat: number, d: number, height: number): Building => ({ rings: [[[lon, lat], [lon + d, lat], [lon + d, lat + d], [lon, lat + d]]], minHeight: 0, height, area: 1, center: [lon + d / 2, lat + d / 2] });

describe("heightfield + occlusion", () => {
  beforeEach(() => clearHeightRasters());
  it("rasterises a building and reports its height", () => {
    const lon = -73.99, lat = 40.75; const f = lonLatToTileFloat(lon, lat, 14); const tile = { z: 14, x: Math.floor(f.x), y: Math.floor(f.y) };
    setHeightRaster(buildHeightRaster(tile, [square(lon, lat, 0.0005, 120)]));
    expect(buildingHeightAt(lon + 0.00025, lat + 0.00025)).toBe(120);
    expect(buildingHeightAt(lon - 0.003, lat - 0.003)).toBe(0);
  });
  it("hides a ground point behind a tall wall, not in the open", () => {
    const wall = (lo: number) => (lo > -73.9905 && lo < -73.9895 ? 150 : 0);
    const cam = { lon: -73.985, lat: 40.75, heightAboveGround: 300 };
    expect(occludedByBuildings(-73.995, 40.75, cam, (lo) => wall(lo), 150)).toBe(true);
    expect(occludedByBuildings(-73.995, 40.75, cam, () => 0, 150)).toBe(false);
  });
});

describe("overpass raw heights", () => {
  it("parses lengths", () => {
    expect(parseLength("12 m")).toBe(12);
    expect(parseLength("40'")).toBeCloseTo(12.19, 1);
    expect(parseLength("abc")).toBeNull();
  });
  it("height > levels+roof > type", () => {
    expect(heightFromTags({ building: "yes", height: "48" }).height).toBe(48);
    expect(heightFromTags({ building: "yes", "building:levels": "4", "roof:levels": "1" }).height).toBe(14.5);
    expect(heightFromTags({ building: "garage" })).toMatchObject({ height: 3, source: "type" });
    expect(heightFromTags({ building: "yes" }).source).toBeNull();
    expect(heightFromTags({ building: "yes", height: "30", min_height: "10" }).minHeight).toBe(10);
  });
  it("applies points to containing footprints; type only over the 5 m default", () => {
    const a = square(0, 0, 0.001, 5), b = square(0.01, 0, 0.001, 18.3);
    const pts = parseOverpass({ elements: [
      { center: { lon: 0.0005, lat: 0.0005 }, tags: { building: "garage" } },
      { center: { lon: 0.0105, lat: 0.0005 }, tags: { building: "house" } },
    ] });
    expect(applyHeightPoints([a, b], pts)).toBe(1);
    expect(a.height).toBe(3); expect(b.height).toBe(18.3);
  });
  it("query has bbox in s,w,n,e order and tags-only output", () => {
    expect(overpassQuery({ w: 1, s: 2, e: 3, n: 4 })).toContain("(2.00000,1.00000,4.00000,3.00000)");
    expect(overpassQuery({ w: 1, s: 2, e: 3, n: 4 })).toContain("out tags center");
  });
  it("paces requests (10 s gap) and backs off on 429", async () => {
    _resetOverpassGate(); localStorage.clear();
    const f = vi.fn(async () => new Response("", { status: 429 }));
    vi.stubGlobal("fetch", f);
    const now = 1_000_000_000_000;
    expect(await fetchOverpassHeights({ w: 0, s: 0, e: 0.01, n: 0.01 }, undefined, now)).toBeNull();
    expect(overpassAllowed(now + 11_000)).toBe(false); // backoff after 429
    vi.unstubAllGlobals();
  });
});

describe("governor + look + rooftop", () => {
  it("budget shrinks with the governor", () => {
    expect(governedBudget(DESKTOP_BUDGET, 0)).toBe(DESKTOP_BUDGET);
    const low = governedBudget(DESKTOP_BUDGET, 2);
    expect(low.maxTilesInView).toBeLessThan(DESKTOP_BUDGET.maxTilesInView);
    expect(low.maxBuildingsPerTile).toBeLessThan(DESKTOP_BUDGET.maxBuildingsPerTile);
  });
  it("look from layer flags", () => {
    expect(buildingLookOf({ flirThermal: true, nvgGoggles: true })).toBe("thermal");
    expect(buildingLookOf({ nvgGoggles: true })).toBe("nvg");
    expect(buildingLookOf({ nightVision: true })).toBe("dark");
    expect(buildingLookOf({})).toBe("normal");
  });
  it("rooftop sheet above the tallest building; WMS uses lat,lon bbox", () => {
    expect(sheetHeight(10, 300)).toBe(330);
    const u = rooftopRadarUrl(boxAround(-96.8, 32.78), Date.parse("2026-10-19T17:30:00Z"));
    expect(u).toContain("crs=EPSG%3A4326");
    expect(decodeURIComponent(u)).toMatch(/bbox=32\.7\d+,-96\.8\d+,32\.8\d+,-96\.7\d+/);
  });
});
