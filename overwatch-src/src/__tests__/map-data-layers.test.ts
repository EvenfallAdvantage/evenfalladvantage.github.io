import { describe, expect, it } from "vitest";
import { loopDelayMs, radarFrameTimes, radarReplayTime } from "@/lib/map/nowcoast";
import { aggregateGnss, matchesAircraftFilter } from "@/lib/map/aircraft-filter";
import { hazardColor, hazardSourcesFor, hazardVisible } from "@/lib/map/hazard-style";
import { parseStates } from "@/components/tactical-map/flight-tracker";

describe("nowCOAST radar loop timing", () => {
  it("returns aligned frames, oldest first, ending a few minutes back", () => {
    const now = Date.parse("2026-10-18T11:07:30Z");
    expect(radarFrameTimes(now, 3)).toEqual(["2026-10-18T10:40:00Z", "2026-10-18T10:50:00Z", "2026-10-18T11:00:00Z"]);
    expect(radarFrameTimes(Date.parse("2026-10-18T11:02:00Z"), 1)).toEqual(["2026-10-18T10:50:00Z"]);
  });
  it("replay frames only within nowCOAST's ~4 h", () => {
    const now = Date.parse("2026-10-18T12:00:00Z");
    expect(radarReplayTime(Date.parse("2026-10-18T10:12:00Z"), now)).toBe("2026-10-18T10:10:00Z");
    expect(radarReplayTime(Date.parse("2026-10-18T07:00:00Z"), now)).toBeUndefined();
  });
  it("dwells on the newest frame", () => {
    expect(loopDelayMs(6, 7)).toBeGreaterThan(loopDelayMs(0, 7));
  });
});

describe("aircraft filter + GPS interference", () => {
  it("filters military / emergency", () => {
    const planes = [{ military: true }, { emergency: true }, {}];
    expect(planes.filter((p) => matchesAircraftFilter(p, "all"))).toHaveLength(3);
    expect(planes.filter((p) => matchesAircraftFilter(p, "military"))).toEqual([{ military: true }]);
    expect(planes.filter((p) => matchesAircraftFilter(p, "emergency"))).toEqual([{ emergency: true }]);
  });
  it("flags cells where many aircraft report poor NACp, ignores ground and unknown", () => {
    const bad = (lat: number, lng: number) => ({ lat, lng, nacp: 4 });
    const good = (lat: number, lng: number) => ({ lat, lng, nacp: 10 });
    const cells = aggregateGnss([
      bad(34.1, 35.1), bad(34.2, 35.2), good(34.3, 35.3), good(34.4, 35.4), // 50% → flagged
      good(40.1, -100.1), good(40.2, -100.2), good(40.3, -100.3), bad(40.4, -100.4), good(40.1, -100.3), // 20% → not
      bad(50.1, 10.1), bad(50.2, 10.2), // too few
      { lat: 34.1, lng: 35.1, nacp: null }, { lat: 34.1, lng: 35.1, nacp: 2, onGround: true },
    ]);
    expect(cells).toEqual([{ lat0: 34, lng0: 35, sizeDeg: 0.5, total: 4, degraded: 2, ratio: 0.5 }]);
  });
  it("parses Overwatch extensions from opensky-proxy and tolerates plain OpenSky rows", () => {
    const [ext, plain] = parseStates({ states: [
      ["ae1234", "RCH123 ", "", 0, 0, -118, 34, 6000, false, 200, 90, 0, null, 6100, "7700", false, 0, 3, 6, 5, "C17", "general"],
      ["a1", "UAL1", "", 0, 0, -118, 34, 6000, false, 200, 90, 0, null, 6100, "1200", false, 0],
    ] });
    expect(ext).toMatchObject({ military: true, emergency: true, squawk: "7700", nacp: 6, typeCode: "C17", emergencyStatus: "general" });
    expect(plain).toMatchObject({ military: false, emergency: false, nacp: null, typeCode: null });
  });
});

describe("hazard styling and request planning", () => {
  it("asks only for the sources that are on", () => {
    expect(hazardSourcesFor({})).toEqual([]);
    expect(hazardSourcesFor({ nwsWarnings: true, tropical: true })).toEqual(["warnings", "tropical"]);
    expect(hazardSourcesFor({ naturalHazards: true })).toEqual(["quakes", "fires", "perimeters", "volcanoes"]);
  });
  it("draws kinds by switch", () => {
    expect(hazardVisible({ kind: "watch" }, { nwsWarnings: true })).toBe(true);
    expect(hazardVisible({ kind: "cyclone_cone" }, { nwsWarnings: true })).toBe(false);
    expect(hazardVisible({ kind: "perimeter" }, { naturalHazards: true })).toBe(true);
  });
  it("warnings red, watches amber", () => {
    expect(hazardColor({ kind: "warning", severity: 3 })).toBe("#ef4444");
    expect(hazardColor({ kind: "watch", severity: 2 })).toBe("#f59e0b");
  });
});
