import { describe, expect, it } from "vitest";
import { activeBooleanLayers, applySharedLayers, decodeShareHash, encodeShareHash } from "@/lib/map/share-link";

describe("share links", () => {
  it("round-trips camera + layers in gods-eye-view's hash format", () => {
    const hash = encodeShareHash({ lat: 37.77, lng: -122.42, altM: 800, headingDeg: 10, pitchDeg: -35, layers: ["aircraft", "cctv"] });
    expect(hash).toBe("#lat=37.77000&lon=-122.42000&alt=800&heading=10.0&pitch=-35.0&layers=aircraft,cctv");
    expect(decodeShareHash(hash)).toEqual({ lat: 37.77, lng: -122.42, altM: 800, headingDeg: 10, pitchDeg: -35, layers: ["aircraft", "cctv"] });
  });
  it("rejects missing or insane values and unknown layers", () => {
    expect(decodeShareHash("#lat=1&lon=2")).toBeNull();
    expect(decodeShareHash("#lat=91&lon=0&alt=10")).toBeNull();
    expect(decodeShareHash("#lat=0&lon=0&alt=-5")).toBeNull();
    const v = decodeShareHash("#lat=0&lon=0&alt=10&layers=aircraft,<script>,bogus", new Set(["aircraft"]));
    expect(v?.layers).toEqual(["aircraft"]);
    expect(decodeShareHash("#lat=0&lon=0&alt=10")?.layers).toBeUndefined();
  });
  it("applies only boolean toggles", () => {
    const prev = { aircraft: false, cctv: true, terrain: true, siteOverlays: { a: true }, siteOverlayOpacity: 0.7 };
    expect(activeBooleanLayers(prev)).toEqual(["cctv", "terrain"]);
    expect(applySharedLayers(prev, ["aircraft", "terrain"])).toEqual({ aircraft: true, cctv: false, terrain: true, siteOverlays: { a: true }, siteOverlayOpacity: 0.7 });
  });
});
