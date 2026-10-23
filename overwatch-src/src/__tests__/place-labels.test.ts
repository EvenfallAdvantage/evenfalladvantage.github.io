import { describe, expect, it } from "vitest";
import { declutter, maxRankForZoom, mergePlaceLabels, PLACE_TILE_MAX_ZOOM, placeZoomForHeight, tilesForRect, type PlaceLabel } from "@/lib/map/place-labels";

const L = (name: string, rank: number, lon = 0, lat = 0): PlaceLabel => ({ key: name, name, rank, lon, lat, cls: "city" });

describe("hybrid place labels", () => {
  it("picks a vector zoom from camera height, capped at z14", () => {
    expect(placeZoomForHeight(50_000)).toBeLessThan(placeZoomForHeight(15_000));
    expect(placeZoomForHeight(15_000)).toBeLessThan(placeZoomForHeight(4_500));
    expect(placeZoomForHeight(1_200)).toBe(PLACE_TILE_MAX_ZOOM);
    expect(placeZoomForHeight(2e7)).toBeGreaterThanOrEqual(2);
  });
  it("shows only big places in wide views", () => {
    expect(maxRankForZoom(4)).toBeLessThan(maxRankForZoom(9));
    expect(maxRankForZoom(14)).toBe(10);
  });
  it("covers a rectangle with capped, centre-first tiles", () => {
    const t = tilesForRect(-118.4, 33.9, -118.1, 34.2, 10);
    expect(t.length).toBeGreaterThan(0);
    expect(t.length).toBeLessThanOrEqual(12);
    expect(t.every((x) => x.z === 10)).toBe(true);
    expect(tilesForRect(179.5, -1, -179.5, 1, 8).length).toBeGreaterThan(0); // antimeridian
  });
  it("dedupes, ranks and declutters", () => {
    const m = mergePlaceLabels([[L("B", 400), L("A", 300)], [L("A", 300)]]);
    expect(m.map((x) => x.name)).toEqual(["A", "B"]);
    const shown = declutter(m, () => [100, 100]);
    expect(shown.map((x) => x.name)).toEqual(["A"]);
    expect(declutter(m, () => null)).toEqual([]);
  });
});
