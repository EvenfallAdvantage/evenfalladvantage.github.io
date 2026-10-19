import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { AIRCRAFT_MAX_SPAN_DEG, aircraftQueryBox, boxKey, inBox, viewCenter, type GeoBox } from "@/lib/map/aircraft-viewport";

const KANSAS = { lat: 39.83, lng: -98.58 };
const span = (b: GeoBox) => ({ lat: b.north - b.south, lng: b.east - b.west });
const valid = (b: GeoBox) => {
  expect(b.south).toBeLessThan(b.north);
  expect(b.west).toBeLessThan(b.east);
  expect(span(b).lat).toBeLessThanOrEqual(AIRCRAFT_MAX_SPAN_DEG);
  expect(span(b).lng).toBeLessThanOrEqual(AIRCRAFT_MAX_SPAN_DEG);
  expect(b.south).toBeGreaterThanOrEqual(-85);
  expect(b.north).toBeLessThanOrEqual(85);
  expect(b.west).toBeGreaterThanOrEqual(-180);
  expect(b.east).toBeLessThanOrEqual(180);
  for (const v of [b.south, b.north, b.west, b.east]) expect(Number.isInteger(v)).toBe(true);
};

describe("aircraftQueryBox", () => {
  it("follows the camera: a city view far from Kansas queries that city, not Kansas", () => {
    const nyc: GeoBox = { south: 40.55, north: 40.95, west: -74.2, east: -73.7 };
    const b = aircraftQueryBox(nyc, KANSAS);
    valid(b);
    expect(inBox(b, 40.75, -73.99)).toBe(true);
    expect(inBox(b, KANSAS.lat, KANSAS.lng)).toBe(false);
    expect(b).toEqual({ south: 40, north: 41, west: -75, east: -73 });
  });

  it("uses the visible rectangle when it fits the 10° proxy limit", () => {
    const b = aircraftQueryBox({ south: 33.2, north: 39.9, west: -122.6, east: -114.1 }, KANSAS);
    valid(b);
    expect(b).toEqual({ south: 33, north: 40, west: -123, east: -114 });
  });

  it("centres a 10° box on the view when zoomed out past the limit (never a 400 from the proxy)", () => {
    const europe: GeoBox = { south: 30, north: 65, west: -15, east: 35 };
    const b = aircraftQueryBox(europe, KANSAS);
    valid(b);
    const c = viewCenter(europe);
    expect(inBox(b, c.lat, c.lng)).toBe(true);
  });

  it("whole-globe view still returns a valid box around the view centre", () => {
    valid(aircraftQueryBox({ south: -90, north: 90, west: -180, east: 180 }, KANSAS));
  });

  it("handles a view crossing the antimeridian", () => {
    const pacific: GeoBox = { south: -20, north: 0, west: 175, east: -170 };
    expect(viewCenter(pacific).lng).toBeCloseTo(-177.5, 5);
    const b = aircraftQueryBox(pacific, KANSAS);
    valid(b);
    expect(inBox(b, -10, -177.5)).toBe(true);
  });

  it("stays inside ±85° latitude and ±180° longitude near the poles and dateline", () => {
    valid(aircraftQueryBox({ south: 80, north: 89, west: 178, east: 179.5 }, KANSAS));
    valid(aircraftQueryBox(null, { lat: -89, lng: -179.9 }));
    valid(aircraftQueryBox(null, { lat: 89, lng: 179.9 }));
  });

  it("falls back to the site (or US centre) when the camera has no view rectangle", () => {
    const b = aircraftQueryBox(null, { lat: 34.05, lng: -118.25 });
    valid(b);
    expect(inBox(b, 34.05, -118.25)).toBe(true);
    const bad = aircraftQueryBox({ south: Number.NaN, north: 1, west: 0, east: 1 }, KANSAS);
    expect(inBox(bad, KANSAS.lat, KANSAS.lng)).toBe(true);
  });

  it("snaps to a 1° grid so small pans reuse the same request", () => {
    const a = aircraftQueryBox({ south: 40.55, north: 40.95, west: -74.2, east: -73.7 }, KANSAS);
    const b = aircraftQueryBox({ south: 40.5, north: 40.9, west: -74.25, east: -73.75 }, KANSAS);
    expect(boxKey(a)).toBe(boxKey(b));
  });

  it("random views always produce a proxy-valid box containing the view centre", () => {
    let seed = 1;
    const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
    for (let i = 0; i < 2000; i++) {
      const south = rand() * 170 - 85, north = Math.min(85, south + rand() * 60 + 0.01);
      const west = rand() * 360 - 180, east = rand() < 0.1 ? west - rand() * 20 : Math.min(180, west + rand() * 80 + 0.01);
      const view = { south, north, west, east };
      const b = aircraftQueryBox(view, KANSAS);
      valid(b);
      const c = viewCenter(view);
      if (Math.abs(c.lat) < 80 && Math.abs(c.lng) < 175) expect(inBox(b, c.lat, c.lng)).toBe(true);
    }
  });
});

describe("guard: the aircraft layer queries the camera's box", () => {
  const src = fs.readFileSync(path.resolve(__dirname, "../components/tactical-map/hooks/use-aircraft-layer.ts"), "utf8");
  it("no longer uses a fixed box around centerRef", () => {
    expect(src).not.toMatch(/getBoundingBox\(centerRef/);
    expect(src).toMatch(/aircraftQueryBox\(readView\(\)/);
    expect(src).toMatch(/camera\.moveEnd\.addEventListener/);
  });
});
