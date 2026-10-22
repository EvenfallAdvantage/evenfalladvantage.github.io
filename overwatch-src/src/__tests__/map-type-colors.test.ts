import { describe, expect, it } from "vitest";
import fs from "fs";
import path from "path";
import { AIRCRAFT_CATEGORIES, AIRCRAFT_CATEGORY_COLOR, AIRCRAFT_EMERGENCY_COLOR, aircraftCategory } from "@/lib/map/aircraft-category";
import { CATEGORY_COLOR, SHIP_CATEGORIES, SHIP_CATEGORY_MODEL, shipCategory } from "@/lib/map/ships";
import { modelStyle } from "@/lib/map/contact-models";

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a: string, b: string) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };

describe("ship categories", () => {
  it("maps ITU-R M.1371 type codes", () => {
    const cases: Array<[number | null, string]> = [
      [70, "cargo"], [79, "cargo"], [80, "tanker"], [89, "tanker"], [60, "passenger"], [69, "passenger"], [30, "fishing"],
      [31, "tug"], [32, "tug"], [50, "tug"], [51, "tug"], [52, "tug"], [53, "tug"], [54, "tug"], [58, "tug"],
      [36, "pleasure"], [37, "pleasure"], [40, "highspeed"], [49, "highspeed"], [20, "highspeed"],
      [35, "military"], [55, "military"], [0, "other"], [null, "other"], [99, "other"], [33, "other"],
    ];
    for (const [t, c] of cases) expect([t, shipCategory(t)]).toEqual([t, c]);
  });
  it("has a model file for every category, all small", () => {
    for (const c of SHIP_CATEGORIES) {
      const url = SHIP_CATEGORY_MODEL[c].url.split("?")[0].replace(/^\/overwatch\//, "");
      const f = path.join(__dirname, "../../public", url);
      expect(fs.existsSync(f), f).toBe(true);
      if (c !== "cargo") expect(fs.statSync(f).size).toBeLessThan(16_000);
    }
  });
});

describe("aircraft categories", () => {
  it("uses the dbFlags military bit first", () => {
    expect(aircraftCategory({ military: true, callsign: "UAL12", typeCode: "B738" })).toBe("military");
  });
  it("uses callsign prefixes", () => {
    expect(aircraftCategory({ callsign: "RCH123", typeCode: "C17" })).toBe("military");
    expect(aircraftCategory({ callsign: "FDX1650", typeCode: "B763" })).toBe("cargo");
    expect(aircraftCategory({ callsign: "UPS2911" })).toBe("cargo");
    expect(aircraftCategory({ callsign: "CHP12", typeCode: "AS50" })).toBe("government");
    expect(aircraftCategory({ callsign: "LIFE3", typeCode: "EC35" })).toBe("government");
    // 3-letter prefixes need a digit after them: "SAMSON" is not SAM (US Air Force VIP).
    expect(aircraftCategory({ callsign: "SAMSON", category: "A1" })).toBe("ga");
  });
  it("uses the lifeguard emergency status for EMS", () => {
    expect(aircraftCategory({ callsign: "N123AB", emergencyStatus: "lifeguard" })).toBe("government");
  });
  it("uses the type designator and emitter category", () => {
    expect(aircraftCategory({ callsign: "N406CU", typeCode: "C650" })).toBe("ga");
    expect(aircraftCategory({ callsign: "LXJ609", typeCode: "E550" })).toBe("commercial");
    expect(aircraftCategory({ callsign: "N511AA", typeCode: "S22T" })).toBe("ga");
    expect(aircraftCategory({ callsign: "", typeCode: "R44" })).toBe("helicopter");
    expect(aircraftCategory({ callsign: "", category: "A7" })).toBe("helicopter");
    expect(aircraftCategory({ typeCode: "F16" })).toBe("military");
    expect(aircraftCategory({ callsign: "SWA4347", typeCode: "B38M", category: "A3" })).toBe("commercial");
    expect(aircraftCategory({ category: "A5" })).toBe("commercial");
    expect(aircraftCategory({ callsign: "N12345" })).toBe("ga");
    expect(aircraftCategory({})).toBe("unknown");
  });
});

describe("palette", () => {
  const MAP_BG = "#0b1220";
  it("every category colour reads on the dark map (WCAG 4.5:1)", () => {
    for (const c of [...Object.values(CATEGORY_COLOR), ...Object.values(AIRCRAFT_CATEGORY_COLOR), AIRCRAFT_EMERGENCY_COLOR]) {
      expect([c, contrast(c, MAP_BG) >= 4.5]).toEqual([c, true]);
    }
  });
  it("military is the same red-ish colour for ships and aircraft, distinct from emergency", () => {
    expect(CATEGORY_COLOR.military).toBe(AIRCRAFT_CATEGORY_COLOR.military);
    expect(AIRCRAFT_EMERGENCY_COLOR).not.toBe(AIRCRAFT_CATEGORY_COLOR.military);
  });
  it("aircraft categories have distinct colours", () => {
    expect(new Set(AIRCRAFT_CATEGORIES.map((c) => AIRCRAFT_CATEGORY_COLOR[c])).size).toBe(AIRCRAFT_CATEGORIES.length);
    expect(new Set(SHIP_CATEGORIES.map((c) => CATEGORY_COLOR[c])).size).toBe(SHIP_CATEGORIES.length);
  });
  it("models take the category colour, except under NVG/thermal", () => {
    expect(modelStyle(false, "#e69f00").color).toBe("#e69f00");
    expect(modelStyle(true, "#e69f00").color).toBe("#050805");
    expect(modelStyle(false).color).toBe("#ffffff");
  });
});
