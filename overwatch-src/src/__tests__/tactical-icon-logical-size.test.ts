// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from "vitest";
import {
  TACTICAL_ICON_DPR,
  clearTacticalIconCache,
  getAircraftIcon,
  getHazardIcon,
  getInfraIcon,
  getPoiIcon,
  getTacticalIcon,
  iconSize,
} from "@/lib/map/tactical-icons";
import { PIN_LOGICAL_SIZE, clearPinCanvasCache, createPinCanvas } from "@/components/tactical-map/pin-canvas";

describe("tactical icon logical (CSS px) size", () => {
  beforeEach(() => {
    clearTacticalIconCache();
    clearPinCanvasCache();
  });

  const cases: Array<[string, () => HTMLCanvasElement]> = [
    ["aircraft", () => getAircraftIcon("commercial", "#38bdf8")],
    ["poi", () => getPoiIcon("hospital", "#ef4444")],
    ["hazard", () => getHazardIcon("quake", "#f97316", { severity: 3, size: 15 })],
    ["infra", () => getInfraIcon("s", "#facc15")],
    ["cctv", () => getTacticalIcon("cctv", "#10b981")],
    ["conflict", () => getTacticalIcon("conflict", "#ef4444", { size: 32 })],
    ["port", () => getTacticalIcon("port", "#38bdf8", { size: 16 })],
    ["pin", () => createPinCanvas("#22d3ee", "person")],
  ];

  it.each(cases)("%s: logical size = canvas size / dpr", (_name, make) => {
    const c = make();
    const s = iconSize(c);
    expect(s.width).toBe(c.width / TACTICAL_ICON_DPR);
    expect(s.height).toBe(c.height / TACTICAL_ICON_DPR);
  });

  it("honours requested sizes and pre-#215 pin size", () => {
    expect(iconSize(getTacticalIcon("conflict", "#ef4444", { size: 32 }))).toEqual({ width: 32, height: 32 });
    expect(iconSize(getTacticalIcon("news", "#fbbf24", { size: 14 }))).toEqual({ width: 14, height: 14 });
    expect(PIN_LOGICAL_SIZE).toBe(28);
    expect(iconSize(createPinCanvas("#ef4444", "alert"))).toEqual({ width: 28, height: 28 });
  });

  it("falls back to canvas/dpr for canvases without metadata", () => {
    const c = document.createElement("canvas");
    c.width = 40;
    c.height = 24;
    expect(iconSize(c)).toEqual({ width: 20, height: 12 });
  });
});
