import { describe, expect, it } from "vitest";
import { AircraftTrack, BLEND_MS, deadReckon, distanceM, lerpAngleDeg, MAX_COAST_SEC, nearestWithin, TRAIL_MAX_POINTS } from "@/lib/map/aircraft-motion";

const fix = { lat: 34, lng: -118, altM: 10_000, speedMps: 250, trackDeg: 90, vsMps: 0, tMs: 0 };

describe("aircraft motion", () => {
  it("dead-reckons along the track", () => {
    const p = deadReckon(fix, 10_000);
    expect(distanceM(fix, p)).toBeCloseTo(2_500, -1);
    expect(p.lat).toBeCloseTo(34, 4);
    expect(p.lng).toBeGreaterThan(-118);
  });
  it("caps coasting and holds slow targets", () => {
    const far = deadReckon(fix, 10 * 60_000);
    expect(distanceM(fix, far)).toBeCloseTo(250 * MAX_COAST_SEC, -1);
    expect(deadReckon({ ...fix, speedMps: 1 }, 30_000)).toMatchObject({ lat: 34, lng: -118 });
  });
  it("blends to a corrected fix instead of snapping", () => {
    const t = new AircraftTrack(fix);
    const before = t.position(5_000);
    t.update({ ...fix, lat: 34.01, tMs: 5_000 }, 5_000);
    const now = t.position(5_000);
    expect(now.lat).toBeCloseTo(before.lat, 6);
    const after = t.position(5_000 + BLEND_MS);
    expect(after.lat).toBeCloseTo(34.01, 4);
  });
  it("ignores stale fixes and bounds the trail", () => {
    const t = new AircraftTrack(fix);
    expect(t.update({ ...fix, tMs: -1 }, 0)).toBe(false);
    for (let i = 1; i <= TRAIL_MAX_POINTS + 10; i++) t.update({ ...fix, lng: -118 + i * 0.01, tMs: i * 1000 }, i * 1000);
    expect(t.trail.length).toBe(TRAIL_MAX_POINTS);
  });
  it("angle lerp takes the short way", () => {
    expect(lerpAngleDeg(350, 10, 0.5)).toBeCloseTo(0, 6);
  });
  it("finds the nearest camera within range", () => {
    const cams = [{ id: "a", lat: 34.1, lng: -118 }, { id: "b", lat: 34.01, lng: -118 }];
    expect(nearestWithin(fix, cams, 25_000)?.item.id).toBe("b");
    expect(nearestWithin(fix, cams, 100)).toBeNull();
  });
});
