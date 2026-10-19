import { describe, it, expect } from "vitest";
import { parseWindCsv, sampleWind, windSlot, windFieldUrl, windParticleBudget, windFrameMs, serializeWindField, deserializeWindField, windStroke } from "@/lib/map/wind-field";

function csv() {
  const rows: string[] = [];
  for (const lat of [-10, 0, 10, 20]) for (const lon of [0, 90, 180, 270]) rows.push(`2026-10-19T18:00:00Z,${lat},${lon},${lon / 90},${lat / 10}`);
  return rows.join("\n");
}

describe("wind field", () => {
  it("parses csv0 into a north-to-south grid", () => {
    const f = parseWindCsv(csv())!;
    expect(f).toMatchObject({ nx: 4, ny: 4, la1: 20, lo1: 0, dx: 90, dy: 10, time: "2026-10-19T18:00:00Z" });
    expect(sampleWind(f, 90, 20)).toEqual({ u: 1, v: 2 });
  });
  it("wraps longitude across the seam and clamps latitude", () => {
    const f = parseWindCsv(csv())!;
    expect(sampleWind(f, 315, 0).u).toBeCloseTo(1.5);      // between 270 (3) and 360=0 (0)
    expect(sampleWind(f, -45, 0).u).toBeCloseTo(1.5);
    expect(sampleWind(f, 0, 80).v).toBeCloseTo(2);
  });
  it("rejects incomplete grids", () => { expect(parseWindCsv("a,b\n1,2,3,4,5")).toBeNull(); });
  it("picks 3-hourly slots", () => {
    const now = Date.UTC(2026, 9, 19, 19, 48);
    expect(windSlot(now)).toBe("2026-10-19T18:00:00Z");
    expect(windSlot(now, 1)).toBe("2026-10-19T15:00:00Z");
    expect(windFieldUrl("2026-10-19T18:00:00Z", 5)).toContain("ncep_global.csv0?ugrd10m");
  });
  it("budgets fewer particles on phones and under the governor", () => {
    expect(windParticleBudget(true, 0)).toBeLessThan(windParticleBudget(false, 0));
    expect(windParticleBudget(false, 2)).toBeLessThan(windParticleBudget(false, 1));
    expect(windFrameMs(true, 0)).toBeGreaterThan(windFrameMs(false, 0));
  });
  it("round-trips the session cache", () => {
    const f = parseWindCsv(csv())!;
    const g = deserializeWindField(serializeWindField(f))!;
    expect(Array.from(g.u)).toEqual(Array.from(f.u));
  });
  it("tints for NVG", () => { expect(windStroke({ nvgGoggles: true }, 5)).toMatch(/^rgba\(150,255,150/); });
});
