import { describe, it, expect } from "vitest";
import fs from "node:fs";
import {
  SHIP_CAP_BY_LEVEL, SHIP_MODEL_URL, SHIP_MODEL_WATERLINE_UNITS, SHIP_RPC_PAGE,
  mergeShipPages, selectShipLabelIds, shipCap, shipPageRanges, type Ship,
} from "@/lib/map/ships";

const ship = (mmsi: number, lat: number, lon: number, extra: Partial<Ship> = {}): Ship => ({
  mmsi, lat, lon, sog: 10, cog: 90, heading: 91, nav_status: 0, name: null, callsign: null, ship_type: 70, length_m: 200,
  destination: null, source: "aisstream", updated_at: "2026-10-19T15:00:00Z", ...extra,
});

describe("ship caps by governor level", () => {
  it("raises the old 1000 cap at full quality and steps down with the governor", () => {
    expect(shipCap(false, 0)).toBe(5000);
    expect(shipCap(false, 1)).toBe(3000);
    expect(shipCap(false, 2)).toBe(1500);
    expect(shipCap(true, 0)).toBe(1500);
    expect(shipCap(true, 2)).toBe(500);
    // Out-of-range levels clamp.
    expect(shipCap(true, 9)).toBe(500);
    expect(shipCap(false, -1)).toBe(5000);
    for (const k of ["desktop", "phone"] as const) {
      const c = SHIP_CAP_BY_LEVEL[k];
      expect(c[0]).toBeGreaterThan(c[1]); expect(c[1]).toBeGreaterThan(c[2]);
      expect(c[0]).toBeLessThanOrEqual(5000); // ships_in_bbox ceiling
    }
  });
});

describe("RPC paging (PostgREST max_rows = 1000)", () => {
  it("covers the cap in 1000-row inclusive ranges", () => {
    expect(SHIP_RPC_PAGE).toBe(1000);
    expect(shipPageRanges(5000)).toEqual([[0, 999], [1000, 1999], [2000, 2999], [3000, 3999], [4000, 4999]]);
    expect(shipPageRanges(1500)).toEqual([[0, 999], [1000, 1499]]);
    expect(shipPageRanges(500)).toEqual([[0, 499]]);
    expect(shipPageRanges(0)).toEqual([]);
  });
  it("merges pages by MMSI, newest fix wins (rows shift while the collector writes)", () => {
    const a = [ship(1, 0, 0, { updated_at: "2026-10-20T07:00:00Z" }), ship(2, 0, 0)];
    const b = [ship(1, 1, 1, { updated_at: "2026-10-20T07:01:00Z" }), ship(3, 0, 0)];
    const m = mergeShipPages([a, null, b]);
    expect(m.map((s) => s.mmsi).sort()).toEqual([1, 2, 3]);
    expect(m.find((s) => s.mmsi === 1)!.lat).toBe(1);
  });
});

describe("name labels (level of detail)", () => {
  const many = Array.from({ length: 400 }, (_, i) => ship(100000000 + i, 51.9 + i * 0.0001, 4.05));
  it("labels only the nearest ships, capped per platform and governor level", () => {
    const cam = { lat: 51.9, lng: 4.05, heightM: 3000 };
    expect(selectShipLabelIds(cam, many, false, 0)).toHaveLength(150);
    expect(selectShipLabelIds(cam, many, false, 1)).toHaveLength(60);
    expect(selectShipLabelIds(cam, many, false, 2)).toHaveLength(25);
    expect(selectShipLabelIds(cam, many, true, 0)).toHaveLength(40);
    expect(selectShipLabelIds(cam, many, true, 2)).toEqual([]);
    expect(selectShipLabelIds(cam, many, false, 0)[0]).toBe(100000000);
  });
  it("no labels when the camera is high", () => {
    expect(selectShipLabelIds({ lat: 51.9, lng: 4.05, heightM: 500_000 }, many, false, 0)).toEqual([]);
  });
});

describe("ship.glb sits on the waterline", () => {
  const glb = fs.readFileSync("public/models/ship.glb");
  const jlen = glb.readUInt32LE(12);
  const j = JSON.parse(glb.subarray(20, 20 + jlen).toString("utf8"));
  it("has the waterline root node above the Sketchfab root", () => {
    const scene = j.scenes[j.scene ?? 0];
    expect(scene.nodes).toHaveLength(1);
    const root = j.nodes[scene.nodes[0]];
    expect(root.name).toBe("overwatch_waterline");
    expect(root.translation).toEqual([0, SHIP_MODEL_WATERLINE_UNITS, 0]);
    expect(j.nodes[root.children[0]].name).toBe("Sketchfab_model");
  });
  it("keel is below and the main deck above the origin after re-rooting", () => {
    // Mesh vertical extent through the node chain is +-655 units about the old origin (keel -655, deck ~-131).
    const keel = -655 + SHIP_MODEL_WATERLINE_UNITS, deck = -131 + SHIP_MODEL_WATERLINE_UNITS;
    expect(keel).toBeLessThan(0);
    expect(deck).toBeGreaterThan(0);
    expect(glb.readUInt32LE(8)).toBe(glb.length);
  });
  it("busts caches of the old file", () => {
    expect(SHIP_MODEL_URL).toMatch(/ship\.glb\?v=2$/);
  });
});
