import { describe, expect, it } from "vitest";
import { HYBRID_HALO, invertLightness, isAreaFill, processOverlayPixels } from "@/lib/map/osm-overlay";
import { BASEMAP_LABELS, basemapOf, setBasemap, type RegistryState } from "@/lib/map/layer-registry";
import { applyDarkLabels, DARK_LABEL } from "@/components/tactical-map/hooks/use-dark-labels";

describe("osm overlay pixels", () => {
  it("keys out OSM area fills, keeps roads and text", () => {
    expect(isAreaFill(0xf2, 0xef, 0xe9)).toBe(true);
    expect(isAreaFill(0xaa, 0xd3, 0xdf)).toBe(true);
    expect(isAreaFill(0x33, 0x33, 0x33)).toBe(false);
    expect(isAreaFill(0xf7, 0xfa, 0xbf)).toBe(false);
  });
  it("inverts lightness and keeps hue", () => {
    expect(invertLightness(0, 0, 0)).toEqual([255, 255, 255]);
    expect(invertLightness(255, 255, 255)).toEqual([0, 0, 0]);
    const [r, g, b] = invertLightness(200, 100, 50);
    expect(r).toBeGreaterThan(g); expect(g).toBeGreaterThan(b);
  });
  it("processes tiles per style", () => {
    const px = () => new Uint8ClampedArray([0xf2, 0xef, 0xe9, 255, 20, 20, 20, 255]);
    const h = px(); expect(processOverlayPixels(h, "hybrid")).toBe(1);
    expect(h[3]).toBe(0); expect([h[4], h[5], h[6], h[7]]).toEqual([20, 20, 20, 255]);
    const d = px(); processOverlayPixels(d, "dark");
    expect([d[4], d[5], d[6]]).toEqual([235, 235, 235]);
  });
  it("hybrid restyles labels only: light text on a dark halo, roads kept", () => {
    // no width: hybrid only keys area fills
    const h = new Uint8ClampedArray([20, 20, 20, 255, 255, 255, 255, 255]);
    processOverlayPixels(h, "hybrid");
    expect(Array.from(h)).toEqual([20, 20, 20, 255, 255, 255, 255, 255]);
    // 8px row: text at 0, white halo at 1, white minor road far away at 7, area fill at 6
    const row = new Uint8ClampedArray(8 * 4);
    for (let i = 0; i < 8; i++) row.set([255, 255, 255, 255], i * 4);
    row.set([30, 30, 30, 255], 0); row.set([0xf2, 0xef, 0xe9, 255], 24);
    expect(processOverlayPixels(row, "hybrid", 8)).toBe(1);
    expect(row[0]).toBeGreaterThan(200);
    expect([row[4], row[5], row[6]]).toEqual([...HYBRID_HALO]);
    expect(row[27]).toBe(0);
    expect([row[28], row[29], row[30], row[31]]).toEqual([255, 255, 255, 255]);
    // coloured road pixel away from text is untouched
    const road = new Uint8ClampedArray([0xe8, 0x92, 0xa2, 255]); processOverlayPixels(road, "hybrid", 1);
    expect(Array.from(road)).toEqual([0xe8, 0x92, 0xa2, 255]);
  });
});

describe("hybrid basemap", () => {
  it("round-trips through the registry", () => {
    const base = { satellite: true, nightVision: false, sentinel1: false, sentinel2: false, hybrid: false } as unknown as RegistryState;
    const h = setBasemap(base, "hybrid");
    expect(h.satellite).toBe(true); expect(h.hybrid).toBe(true);
    expect(basemapOf(h)).toBe("hybrid");
    expect(basemapOf(setBasemap(h, "dark"))).toBe("dark");
    expect(setBasemap(h, "satellite").hybrid).toBe(false);
    expect(BASEMAP_LABELS.hybrid).toBe("Hybrid");
  });
});

describe("dark labels", () => {
  const C = {
    JulianDate: { now: () => 0 },
    Color: class { constructor(public r: number, public g: number, public b: number, public a: number) {} },
    Cartesian2: class { constructor(public x: number, public y: number) {} },
  };
  it("adds a backing plate, keeps fill colour, and restores", () => {
    const fill = { css: "#38bdf8" };
    const label: Record<string, unknown> = { fillColor: fill, showBackground: undefined, outlineWidth: { getValue: () => 1 } };
    const viewer = { entities: { values: [{ label }, { billboard: {} }] } };
    expect(applyDarkLabels(viewer, C, true)).toBe(true);
    expect(label.showBackground).toBe(true);
    expect((label.backgroundColor as { a: number }).a).toBe(DARK_LABEL.backgroundAlpha);
    expect(label.outlineWidth).toBe(DARK_LABEL.minOutlineWidth);
    expect(label.fillColor).toBe(fill);
    expect(applyDarkLabels(viewer, C, true)).toBe(false);
    expect(applyDarkLabels(viewer, C, false)).toBe(true);
    expect(label.showBackground).toBeUndefined();
    expect((label.outlineWidth as { getValue: () => number }).getValue()).toBe(1);
  });
});
