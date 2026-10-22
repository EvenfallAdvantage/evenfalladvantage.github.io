import { describe, it, expect, vi, afterEach } from "vitest";
import { toTileImage } from "@/lib/map/basemap-sources";

describe("toTileImage (tile orientation regression)", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("re-wraps canvases as ImageBitmap when Cesium supplied a pre-flipped ImageBitmap", async () => {
    class FakeBitmap {}
    const out = new FakeBitmap();
    const create = vi.fn(async () => out);
    vi.stubGlobal("ImageBitmap", FakeBitmap);
    vi.stubGlobal("createImageBitmap", create);
    const canvas = {} as HTMLCanvasElement;
    const res = toTileImage(canvas, new FakeBitmap());
    expect(res).toBeInstanceOf(Promise);
    expect(await res).toBe(out);
    // no re-orientation: pixels already in Cesium's flipped layout
    expect(create).toHaveBeenCalledWith(canvas);
  });

  it("returns the canvas unchanged for HTMLImageElement sources", () => {
    class FakeBitmap {}
    vi.stubGlobal("ImageBitmap", FakeBitmap);
    const canvas = {} as HTMLCanvasElement;
    expect(toTileImage(canvas, {})).toBe(canvas);
  });
});
