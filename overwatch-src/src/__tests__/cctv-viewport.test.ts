import { describe, expect, it } from "vitest";
import { attributionLine, bboxKey, clusterLabel, diffIds, rectToBBox, roundBBox, zoomFromHeight } from "@/lib/map/cctv-viewport";

describe("cctv-viewport", () => {
  it("zoomFromHeight is monotonic and clamped", () => {
    expect(zoomFromHeight(35_000_000)).toBe(0);
    expect(zoomFromHeight(1e9)).toBe(0);
    expect(zoomFromHeight(1)).toBe(22);
    expect(zoomFromHeight(0)).toBe(22);
    expect(zoomFromHeight(500_000)).toBeGreaterThan(zoomFromHeight(5_000_000));
    expect(zoomFromHeight(5_000_000)).toBeLessThan(7); // continental view clusters
  });

  it("rectToBBox keeps antimeridian crossing (west > east)", () => {
    const b = rectToBBox({ west: (170 * Math.PI) / 180, south: -0.4, east: (-170 * Math.PI) / 180, north: 0.1 });
    expect(b.west).toBe(170);
    expect(b.east).toBe(-170);
  });

  it("roundBBox rounds outward and shares keys for small pans", () => {
    const a = roundBBox({ west: -122.43, south: 37.71, east: -122.35, north: 37.81 }, 12);
    const b = roundBBox({ west: -122.429, south: 37.712, east: -122.351, north: 37.809 }, 12);
    expect(a.west).toBeLessThanOrEqual(-122.43);
    expect(a.north).toBeGreaterThanOrEqual(37.81);
    expect(bboxKey(a, 12)).toBe(bboxKey(b, 12));
    const w = roundBBox({ west: -180, south: -90, east: 180, north: 90 }, 0);
    expect(w).toEqual({ west: -180, south: -90, east: 180, north: 90 });
  });

  it("diffIds", () => {
    expect(diffIds(["a", "b"], ["b", "c"])).toEqual({ add: ["c"], remove: ["a"] });
    expect(diffIds([], [])).toEqual({ add: [], remove: [] });
  });

  it("clusterLabel", () => {
    expect(clusterLabel(7)).toBe("7");
    expect(clusterLabel(1234)).toBe("1.2k");
    expect(clusterLabel(23456)).toBe("23k");
  });

  it("attributionLine", () => {
    expect(attributionLine(undefined)).toBe("");
    expect(attributionLine({ b: "B", a: "A", c: "A" })).toBe("CCTV: A · B");
  });
});
