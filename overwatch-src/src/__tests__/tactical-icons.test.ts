// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  getAircraftIcon,
  getPoiIcon,
  getHazardIcon,
  getInfraIcon,
  getTacticalIcon,
  clearTacticalIconCache,
  getTacticalIconCacheSize,
} from "@/lib/map/tactical-icons";
import { createPinCanvas } from "@/components/tactical-map/pin-canvas";

describe("Tactical Map HiDPI Sprite Atlas (tactical-icons)", () => {
  beforeEach(() => {
    clearTacticalIconCache();
  });

  it("caches and reuses canvases across identical aircraft, POI, hazard, infra, and misc calls", () => {
    const a1 = getAircraftIcon("commercial", "#38bdf8");
    const a2 = getAircraftIcon("commercial", "#38bdf8");
    const aMil = getAircraftIcon("military", "#ef4444");
    expect(a1).toBe(a2);
    expect(a1).not.toBe(aMil);
    expect(a1.width).toBe(52); // 26 * 2x HiDPI

    const p1 = getPoiIcon("hospital", "#ef4444");
    const p2 = getPoiIcon("hospital", "#ef4444");
    expect(p1).toBe(p2);

    const h1 = getHazardIcon("quake", "#f59e0b", { magnitude: 5.2 });
    const h2 = getHazardIcon("quake", "#f59e0b", { magnitude: 5.2 });
    const hFire = getHazardIcon("fire", "#ef4444");
    expect(h1).toBe(h2);
    expect(h1).not.toBe(hFire);

    const i1 = getInfraIcon("p", "#facc15");
    const i2 = getInfraIcon("p", "#facc15");
    expect(i1).toBe(i2);

    const m1 = getTacticalIcon("cctv", "#22d3ee");
    const m2 = getTacticalIcon("cctv", "#22d3ee");
    const mHc = getTacticalIcon("cctv", "#22d3ee", { highContrast: true });
    expect(m1).toBe(m2);
    expect(m1).not.toBe(mHc);

    const pin1 = createPinCanvas("#22c55e", "person");
    const pin2 = createPinCanvas("#22c55e", "person");
    expect(pin1).toBe(pin2);
    expect(getTacticalIconCacheSize()).toBeGreaterThanOrEqual(7);
  });
});
