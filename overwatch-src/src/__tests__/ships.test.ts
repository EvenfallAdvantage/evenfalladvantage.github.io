import { describe, it, expect } from "vitest";
import {
  SHIP_MAX_SPAN_DEG, capShips, inShipBox, selectShipModelIds, shipCategory, shipHeadingDeg, shipQueryBox, shipModelHeadingDeg, shipModelScale, type Ship,
} from "@/lib/map/ships";

const ship = (mmsi: number, lat: number, lon: number, extra: Partial<Ship> = {}): Ship => ({
  mmsi, lat, lon, sog: 10, cog: 90, heading: 91, nav_status: 0, name: null, callsign: null, ship_type: 70, length_m: 200,
  destination: null, source: "aisstream", updated_at: "2026-10-19T15:00:00Z", ...extra,
});

describe("shipQueryBox", () => {
  it("uses the snapped view when it fits", () => {
    expect(shipQueryBox({ south: 40.4, north: 41.2, west: -74.3, east: -73.6 }, { lat: 0, lng: 0 })).toEqual({ south: 40, north: 42, west: -75, east: -73 });
  });
  it("centres a 30° box on a wide view", () => {
    const b = shipQueryBox({ south: -60, north: 70, west: -170, east: 10 }, { lat: 0, lng: 0 });
    expect(b.north - b.south).toBe(SHIP_MAX_SPAN_DEG);
    expect(inShipBox(b, 5, -80)).toBe(true);
  });
  it("falls back to the given point without a view", () => {
    const b = shipQueryBox(null, { lat: 60, lng: 24 });
    expect(inShipBox(b, 60, 24)).toBe(true);
  });
  it("handles the antimeridian", () => {
    const b = shipQueryBox(null, { lat: 0, lng: 179 });
    expect(b.west).toBeGreaterThan(b.east);
    expect(inShipBox(b, 0, 179.5)).toBe(true);
    expect(inShipBox(b, 0, -175)).toBe(true);
    expect(inShipBox(b, 0, 0)).toBe(false);
    const v = shipQueryBox({ south: -5, north: 5, west: 175, east: -178 }, { lat: 0, lng: 0 });
    expect(inShipBox(v, 0, -179)).toBe(true);
  });
});

describe("ship helpers", () => {
  it("maps AIS type codes", () => {
    expect([shipCategory(70), shipCategory(84), shipCategory(60), shipCategory(30), shipCategory(52), shipCategory(37), shipCategory(35), shipCategory(null)])
      .toEqual(["cargo", "tanker", "passenger", "fishing", "tug", "pleasure", "military", "other"]);
  });
  it("picks heading, then course when moving", () => {
    expect(shipHeadingDeg({ heading: 10, cog: 90, sog: 5 })).toBe(10);
    expect(shipHeadingDeg({ heading: null, cog: 90, sog: 5 })).toBe(90);
    expect(shipHeadingDeg({ heading: null, cog: 90, sog: 0 })).toBe(0);
    expect(shipModelHeadingDeg(300)).toBe(300);
    expect(shipModelHeadingDeg(-10)).toBe(350);
    expect(shipModelScale(400)).toBeCloseTo(0.1);
    expect(shipModelScale(null)).toBeCloseTo(150 / 4000);
    expect(shipModelScale(2)).toBeCloseTo(150 / 4000);
  });
  it("caps newest first (phone cap)", () => {
    const list = Array.from({ length: 600 }, (_, i) => ship(200000000 + i, 0, 0, { updated_at: `2026-10-19T15:${String(i % 60).padStart(2, "0")}:00Z` }));
    const c = capShips(list, 500);
    expect(c).toHaveLength(500);
    expect(c[0].updated_at >= c[499].updated_at).toBe(true);
  });
  it("selects nearby ships for models, none from high up or at governor minimum", () => {
    const ships = [ship(1, 40.70, -74.01), ship(2, 40.72, -74.0), ship(3, 42, -70)];
    expect(selectShipModelIds({ lat: 40.7, lng: -74, heightM: 2000 }, ships)).toEqual([1, 2]);
    expect(selectShipModelIds({ lat: 40.7, lng: -74, heightM: 200_000 }, ships)).toEqual([]);
    expect(selectShipModelIds({ lat: 40.7, lng: -74, heightM: 2000 }, ships, 2)).toEqual([]);
  });
});
