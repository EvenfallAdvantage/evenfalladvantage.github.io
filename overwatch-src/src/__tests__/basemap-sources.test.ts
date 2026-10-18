import { describe, expect, it, vi } from "vitest";
import {
  addFreeBaseImagery, EOX_S2_2016_URL, gibsDate, gibsTrueColorUrl, ionAssetsEnabled,
  clearNoDataPixels, isNoDataTile, lightningCacheKey, USGS_IMAGERY_EXTENTS,
} from "@/lib/map/basemap-sources";
import { lightningWmsTime } from "@/components/tactical-map/hooks/use-lightning-layer";
import { applyGrade, NIGHT_GRADE } from "@/components/tactical-map/hooks/use-night-vision";

describe("ionAssetsEnabled (Phase 0 licensing)", () => {
  it("ignores a leftover Cesium token without the explicit commercial opt-in", () => {
    expect(ionAssetsEnabled({ NEXT_PUBLIC_CESIUM_TOKEN: "eyJabc" })).toBe(false);
    expect(ionAssetsEnabled({ NEXT_PUBLIC_CESIUM_ION_COMMERCIAL: "false", NEXT_PUBLIC_CESIUM_TOKEN: "eyJabc" })).toBe(false);
  });
  it("needs both the opt-in and a token", () => {
    expect(ionAssetsEnabled({ NEXT_PUBLIC_CESIUM_ION_COMMERCIAL: "true" })).toBe(false);
    expect(ionAssetsEnabled({ NEXT_PUBLIC_CESIUM_ION_COMMERCIAL: "true", NEXT_PUBLIC_CESIUM_TOKEN: "eyJabc" })).toBe(true);
  });
});

describe("free sources", () => {
  it("uses the CC BY 4.0 EOX 2016 layer, never the NC-licensed later years", () => {
    expect(EOX_S2_2016_URL).toContain("/s2cloudless_3857/");
    expect(EOX_S2_2016_URL).not.toMatch(/s2cloudless-20(1[89]|2\d)/);
  });

  it("GIBS date is yesterday (UTC) and URL is well-formed", () => {
    expect(gibsDate(new Date("2026-10-17T03:00:00Z"))).toBe("2026-10-16");
    expect(gibsTrueColorUrl("2026-10-16")).toBe(
      "https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/VIIRS_SNPP_CorrectedReflectance_TrueColor/default/2026-10-16/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg",
    );
  });

  it("lightning keys snap to 15 minutes; replay only within nowCOAST's horizon", () => {
    expect(lightningCacheKey(new Date("2026-10-17T10:44:59Z"))).toBe("2026-10-17T10:30:00.000Z");
    const now = Date.parse("2026-10-17T12:00:00Z");
    expect(lightningWmsTime(Date.parse("2026-10-17T11:07:00Z"), now)).toBe("2026-10-17T11:00:00Z");
    expect(lightningWmsTime(Date.parse("2026-10-17T06:00:00Z"), now)).toBeUndefined();
    expect(lightningWmsTime(null, now)).toBeUndefined();
  });

  it("adds EOX at index 0 plus one USGS layer per US extent", () => {
    const added: unknown[] = [];
    const viewer = { imageryLayers: { addImageryProvider: vi.fn((p: unknown) => ({ p })), add: vi.fn((l: unknown) => added.push(l)) } };
    const Cesium = {
      UrlTemplateImageryProvider: vi.fn(function (this: Record<string, unknown>, o: Record<string, unknown>) { Object.assign(this, o); }),
      Credit: vi.fn(),
      Rectangle: { fromDegrees: vi.fn(() => ({})) },
      ImageryLayer: vi.fn(function (this: Record<string, unknown>, p: unknown, o: Record<string, unknown>) { this.p = p; this.o = o; }),
    };
    const layers = addFreeBaseImagery(viewer, Cesium);
    expect(viewer.imageryLayers.addImageryProvider).toHaveBeenCalledWith(expect.objectContaining({ url: EOX_S2_2016_URL }), 0);
    expect(added).toHaveLength(USGS_IMAGERY_EXTENTS.length);
    expect(layers).toHaveLength(USGS_IMAGERY_EXTENTS.length + 1);
    expect((added[0] as { o: { minimumTerrainLevel: number } }).o.minimumTerrainLevel).toBe(8);
    // USGS no-data tiles are discarded so EOX shows through (no white patches)
    const usgs = (added[0] as { p: { tileDiscardPolicy?: { isReady(): boolean } } }).p;
    expect(usgs.tileDiscardPolicy?.isReady()).toBe(true);
  });
});

describe("USGS no-data tiles", () => {
  const tile = (rgba: [number, number, number, number], n = 64, override?: (i: number) => [number, number, number, number] | null) => {
    const a = new Uint8ClampedArray(n * 4);
    for (let i = 0; i < n; i++) a.set(override?.(i) ?? rgba, i * 4);
    return a;
  };
  it("flags solid-white and fully transparent fills", () => {
    expect(isNoDataTile(tile([255, 255, 255, 255]))).toBe(true);
    expect(isNoDataTile(tile([0, 0, 0, 0]))).toBe(true);
  });
  it("keeps real imagery, including bright scenes with any non-white sample", () => {
    expect(isNoDataTile(tile([120, 110, 90, 255]))).toBe(false);
    expect(isNoDataTile(tile([255, 255, 255, 255], 64, (i) => (i === 37 ? [240, 245, 250, 255] : null)))).toBe(false);
    expect(isNoDataTile(tile([0, 0, 0, 0], 64, (i) => (i === 5 ? [10, 40, 80, 255] : null)))).toBe(false);
    expect(isNoDataTile(tile([0, 0, 0, 255]))).toBe(false);
    expect(isNoDataTile(new Uint8ClampedArray(0))).toBe(false);
  });
  it("clears only the white fill on tiles that straddle the coverage edge", () => {
    const a = tile([90, 100, 80, 255], 64, (i) => (i >= 32 ? [255, 253, 251, 255] : null));
    expect(clearNoDataPixels(a)).toBe(32);
    expect(a[3]).toBe(255);          // imagery pixel kept
    expect(a[40 * 4 + 3]).toBe(0);   // white fill now transparent
    expect(clearNoDataPixels(tile([200, 230, 249, 255]))).toBe(0);
  });
});

describe("night mode", () => {
  it("re-grades existing imagery instead of loading CARTO tiles", () => {
    const layer = { brightness: 1, contrast: 1, saturation: 1, gamma: 1, hue: 0 };
    applyGrade(layer, NIGHT_GRADE);
    expect(layer.brightness).toBeLessThan(0.5);
    expect(layer.saturation).toBeLessThan(0.5);
  });
});
