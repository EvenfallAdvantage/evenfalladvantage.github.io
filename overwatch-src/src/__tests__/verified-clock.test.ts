import { describe, it, expect } from "vitest";
import { haversineMeters, previewPostFence, formatDistance } from "@/lib/geo/position";
import { lngLatToWorld, worldToLngLat, ringToPolygon, polygonToRing } from "@/lib/geo/mercator";

describe("geo helpers", () => {
  it("haversine ~100 m for 0.0009° latitude", () => {
    expect(Math.round(haversineMeters(34.0522, -118.2437, 34.0531, -118.2437))).toBeGreaterThan(98);
    expect(Math.round(haversineMeters(34.0522, -118.2437, 34.0531, -118.2437))).toBeLessThan(102);
  });
  it("previews the post-radius verdict like the server", () => {
    const post = { lat: 34.0522, lng: -118.2437, radius: 100 };
    expect(previewPostFence({ lat: 34.05265, lng: -118.2437, accuracy: 5 }, post).verdict).toBe("inside");
    expect(previewPostFence({ lat: 34.07, lng: -118.2437, accuracy: 5 }, post)).toMatchObject({ verdict: "outside" });
    expect(previewPostFence(null, post).verdict).toBe("no_gps");
    expect(previewPostFence({ lat: 1, lng: 1, accuracy: 5 }, { lat: null, lng: null, radius: null }).verdict).toBe("no_fence");
  });
  it("formats distances", () => {
    expect(formatDistance(42)).toBe("42 m");
    expect(formatDistance(1530)).toBe("1.5 km");
    expect(formatDistance(null)).toBe("");
  });
  it("mercator round-trips", () => {
    const w = lngLatToWorld(-118.2437, 34.0522, 17);
    const ll = worldToLngLat(w.x, w.y, 17);
    expect(ll.lng).toBeCloseTo(-118.2437, 6);
    expect(ll.lat).toBeCloseTo(34.0522, 6);
  });
  it("closes and reopens polygon rings", () => {
    expect(ringToPolygon([[0, 0], [1, 0]])).toBeNull();
    const g = ringToPolygon([[0, 0], [1, 0], [1, 1]])!;
    expect(g.coordinates[0]).toHaveLength(4);
    expect(polygonToRing(g)).toEqual([[0, 0], [1, 0], [1, 1]]);
    expect(polygonToRing({ type: "MultiPolygon", coordinates: [] })).toEqual([]);
  });
});
