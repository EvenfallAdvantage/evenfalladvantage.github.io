import { describe, expect, it } from "vitest";
import { HYBRID_HALO, HYBRID_MIN_LEVEL, hybridHaloRadius, isBlueText, isBrownText, isPurpleText, invertLightness, isAreaFill, processOverlayPixels } from "@/lib/map/osm-overlay";
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
    // wide views (low tile level) leave labels alone
    const wide = new Uint8ClampedArray([30, 30, 30, 255, 255, 255, 255, 255]);
    processOverlayPixels(wide, "hybrid", 2, HYBRID_MIN_LEVEL - 1);
    expect(Array.from(wide)).toEqual([30, 30, 30, 255, 255, 255, 255, 255]);
    expect(hybridHaloRadius(HYBRID_MIN_LEVEL - 1)).toBe(0);
    expect(hybridHaloRadius(undefined)).toBe(1);
    expect(hybridHaloRadius(HYBRID_MIN_LEVEL)).toBe(2);
    // blue labels restyled too; navy one-way arrows are not text
    expect(isBlueText(0, 146, 218)).toBe(true);
    expect(isBlueText(0, 0, 128)).toBe(false);
    const blue = new Uint8ClampedArray([0, 146, 218, 255, 255, 255, 255, 255]);
    processOverlayPixels(blue, "hybrid", 2, 17);
    expect(blue[0]).toBeGreaterThan(130);
    expect([blue[4], blue[5], blue[6]]).toEqual([...HYBRID_HALO]);
    // purple and brown labels restyled too; magenta and road colours are not text
    expect(isPurpleText(0x84, 0x61, 0xc4)).toBe(true);
    expect(isPurpleText(172, 58, 172)).toBe(false);
    expect(isBrownText(0x73, 0x4a, 0x08)).toBe(true);
    expect(isBrownText(0xfc, 0xd6, 0xa4)).toBe(false);
    for (const c of [[0x84, 0x61, 0xc4], [0x73, 0x4a, 0x08]]) {
      const px = new Uint8ClampedArray([...c, 255, 255, 255, 255, 255]);
      processOverlayPixels(px, "hybrid", 2, 17);
      expect(px[0]).toBeGreaterThan(c[0]);
      expect(px[0] !== px[1] || px[1] !== px[2]).toBe(true); // hue kept
      expect([px[4], px[5], px[6]]).toEqual([...HYBRID_HALO]);
    }
    // a solid 4x4 brown icon keeps its colour
    const bicon = new Uint8ClampedArray(16 * 4);
    for (let i = 0; i < 16; i++) bicon.set([0x73, 0x4a, 0x08, 255], i * 4);
    processOverlayPixels(bicon, "hybrid", 4, 17);
    expect([bicon[20], bicon[21], bicon[22]]).toEqual([0x73, 0x4a, 0x08]);
    // a solid 4x4 blue icon keeps its colour
    const icon = new Uint8ClampedArray(16 * 4);
    for (let i = 0; i < 16; i++) icon.set([0, 146, 218, 255], i * 4);
    processOverlayPixels(icon, "hybrid", 4, 17);
    expect([icon[20], icon[21], icon[22]]).toEqual([0, 146, 218]);
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
