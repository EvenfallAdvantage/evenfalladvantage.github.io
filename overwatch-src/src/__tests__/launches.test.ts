import { describe, it, expect } from "vitest";
import { parseLaunches, launchAzimuth, typicalInclination, estimatedAscent, destination, launchesUrl, ascentAt } from "@/lib/map/launches";

const rec = (o: Record<string, unknown> = {}) => ({ id: "x1", name: "Falcon 9 | Test", net: "2026-10-16T00:01:05Z", status: { abbrev: "Success", name: "Launch Successful" }, pad: { latitude: "28.56", longitude: "-80.57", name: "SLC-40", location: { name: "Cape Canaveral" } }, mission: { orbit: { name: "Low Earth Orbit", abbrev: "LEO" } }, rocket: { configuration: { full_name: "Falcon 9 Block 5" } }, launch_service_provider: { name: "SpaceX" }, ...o });

describe("launches", () => {
  it("parses LL2 results and skips records without a pad position", () => {
    const l = parseLaunches({ results: [rec(), rec({ id: "x2", pad: {} })] });
    expect(l).toHaveLength(1);
    expect(l[0]).toMatchObject({ outcome: "success", lat: 28.56, rocket: "Falcon 9 Block 5", orbitAbbrev: "LEO" });
  });
  it("builds a 30-day query", () => { expect(launchesUrl(Date.UTC(2026, 9, 19))).toContain("net__gte=2026-09-19T00%3A00%3A00Z"); });
  it("launches east from the Cape and south for SSO from Vandenberg", () => {
    expect(launchAzimuth(28.56, typicalInclination("LEO", 28.56))).toBeCloseTo(90, 0);
    const az = launchAzimuth(34.63, typicalInclination("SSO", 34.63));
    expect(az).toBeGreaterThan(180); expect(az).toBeLessThan(200);
  });
  it("ascent rises then pitches over, ending in orbit-ish altitude", () => {
    expect(ascentAt(0)).toEqual({ altM: 0, downrangeM: 0 });
    expect(ascentAt(0.2).altM).toBeGreaterThan(ascentAt(0.2).downrangeM / 20);
    const p = estimatedAscent({ lat: 28.56, lng: -80.57, orbitAbbrev: "LEO", outcome: "success" })!;
    expect(p[p.length - 1].altM).toBeCloseTo(210_000, -3);
    expect(p[p.length - 1].lng).toBeGreaterThan(-80);
  });
  it("draws no path for failed launches", () => { expect(estimatedAscent({ lat: 0, lng: 0, orbitAbbrev: null, outcome: "failure" })).toBeNull(); });
  it("great-circle destination", () => { const d = destination(0, 0, 90, 111_195); expect(d.lng).toBeCloseTo(1, 2); expect(d.lat).toBeCloseTo(0, 5); });
});
