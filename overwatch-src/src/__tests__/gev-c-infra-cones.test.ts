import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decodeInfraRow, infraCellKey, infraCellsForView, type InfraIndex } from "@/lib/map/infra-extract";
import { cameraPose, coneArc, directionToHeading, projectPoint } from "@/lib/map/camera-cone";
import { clampGibsDay, GIBS_FIRST_DAY, gibsTrueColorUrl } from "@/lib/map/basemap-sources";
import { applyPreset, effectiveLayers, groupDef, setGroup } from "@/lib/map/layer-registry";
import { DEFAULT_LAYERS } from "@/components/tactical-map/map-layers-panel";

describe("infra extract", () => {
  it("decodes rows and rejects junk", () => {
    expect(decodeInfraRow(["d", -96.7, 32.9, "DFW28", "Digital Realty"])).toMatchObject({ kind: "d", detail: "Data centre · Digital Realty" });
    expect(decodeInfraRow(["m", -89.85, 38.54, "Scott Air Force Base", "airfield|r122949"])).toMatchObject({
      detail: "Military airfield", osmUrl: "https://www.openstreetmap.org/relation/122949",
    });
    expect(decodeInfraRow(["s", 1, 2, "Sub", "345"])?.detail).toBe("Substation · 345 kV");
    expect(decodeInfraRow(["x", 1, 2, "?"])).toBeNull();
    expect(decodeInfraRow(["d", 200, 2, "bad"])).toBeNull();
    expect(decodeInfraRow("nope")).toBeNull();
    // An id that is not an OSM typed id never becomes a link.
    expect(decodeInfraRow(["m", 1, 2, "X", "base|javascript:alert(1)"])?.osmUrl).toBeUndefined();
  });

  it("maps a view to the cells that exist, including across the antimeridian", () => {
    expect(infraCellKey(-96.7, 32.9)).toBe("30_-100");
    const avail = { "30_-100": 5, "30_-110": 2, "50_170": 1, "50_-180": 1 };
    expect(infraCellsForView({ west: -105, south: 31, east: -95, north: 35 }, avail).sort()).toEqual(["30_-100", "30_-110"]);
    expect(infraCellsForView({ west: 175, south: 51, east: -175, north: 55 }, avail).sort()).toEqual(["50_-180", "50_170"]);
  });

  it("ships an index that matches the cell files and carries the ODbL credit", () => {
    const dir = path.resolve(__dirname, "../../public/data/infra");
    const index = JSON.parse(fs.readFileSync(path.join(dir, "index.json"), "utf8")) as InfraIndex;
    expect(index.credit).toMatch(/OpenStreetMap contributors.*ODbL/);
    expect(index.counts.datacenter).toBeGreaterThan(4000);
    for (const k of Object.keys(index.cells)) expect(fs.existsSync(path.join(dir, `c_${k}.json`))).toBe(true);
    const sample = JSON.parse(fs.readFileSync(path.join(dir, `c_${Object.keys(index.cells)[0]}.json`), "utf8"));
    expect(sample.f.every((r: unknown) => decodeInfraRow(r) !== null)).toBe(true);
    // No contact-type fields anywhere in the extract.
    const all = fs.readdirSync(dir).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    expect(all).not.toMatch(/@[a-z0-9-]+\.[a-z]{2,}|\+\d{6,}/i);
  });

  it("is one sub-option in the existing Infrastructure group, off by default", () => {
    expect(DEFAULT_LAYERS.osmInfrastructure).toBe(false);
    const g = groupDef("infrastructure");
    expect(g.subs.map((s) => s.id)).toEqual(["nuclear", "osm", "space"]);
    const on = { ...DEFAULT_LAYERS, osmInfrastructure: true };
    expect(effectiveLayers(setGroup(on, "infrastructure", false)).osmInfrastructure).toBe(false);
    expect(effectiveLayers(on).osmInfrastructure).toBe(true);
    // Presets never turn it on.
    expect(applyPreset(on, "securityOps").osmInfrastructure).toBe(false);
  });
});

describe("camera cones (ported from gods-eye-view, MIT)", () => {
  it("reads explicit travel directions and refuses conflicts or bare words in names", () => {
    expect(directionToHeading("I-110 : (817) Slauson Ave NB On-Ramp")).toBe(0);
    expect(directionToHeading("Westbound at Main")).toBe(270);
    expect(directionToHeading("I-110 : (183) NB 110 to WB 10")).toBeNaN();
    expect(directionToHeading("5TH ST / WEST AVE")).toBeNaN();
    expect(directionToHeading("West", true)).toBe(270);
    expect(directionToHeading("")).toBeNaN();
  });

  it("prefers a served heading, falls back to the name, else no cone", () => {
    expect(cameraPose({ heading_deg: -90, name: "NB" })).toEqual({ headingDeg: 270, fovDeg: 60, source: "served" });
    expect(cameraPose({ name: "Gage Ave SB On-Ramp", fov_deg: 500 })).toEqual({ headingDeg: 180, fovDeg: 160, source: "name" });
    expect(cameraPose({ name: "Downtown" })).toBeNull();
  });

  it("projects points and builds a symmetric arc", () => {
    const p = projectPoint(34, -118, 0, 1000);
    expect(p.lng).toBeCloseTo(-118, 6);
    expect((p.lat - 34) * 111_195).toBeCloseTo(1000, -1);
    const arc = coneArc(34, -118, { headingDeg: 90, fovDeg: 60, source: "name" }, 150, 4);
    expect(arc).toHaveLength(5);
    expect(arc[0][1]).toBeGreaterThan(34); // left edge of an east-facing cone is north
    expect(arc[4][1]).toBeLessThan(34);
    expect(arc[2][1]).toBeCloseTo(34, 6);
  });
});

describe("dated NASA GIBS imagery", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  it("clamps picked days to the record", () => {
    expect(clampGibsDay(null, now)).toBe("2026-10-17");
    expect(clampGibsDay("2026-12-01", now)).toBe("2026-10-17");
    expect(clampGibsDay("2001-01-01", now)).toBe(GIBS_FIRST_DAY);
    expect(clampGibsDay("2024-07-04", now)).toBe("2024-07-04");
    expect(clampGibsDay("07/04/2024", now)).toBe("2026-10-17");
    expect(clampGibsDay("2024-13-45", now)).toBe("2026-10-17");
    expect(gibsTrueColorUrl("2024-07-04")).toContain("/default/2024-07-04/");
  });
});
