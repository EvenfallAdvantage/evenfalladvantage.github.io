import { describe, expect, it } from "vitest";
import { formatAlt, formatLatLng, hudModeLabel } from "@/components/tactical-map/tactical-hud";
import { NOIR_EFFECT, NVG_EFFECT, SHARPEN_EFFECT } from "@/components/tactical-map/effects";

describe("tactical HUD", () => {
  it("formats readouts", () => {
    expect(formatLatLng(34.05, -118.25)).toBe("34.0500°N 118.2500°W");
    expect(formatAlt(850)).toBe("850 m");
    expect(formatAlt(12_345)).toBe("12.3 km");
    expect(formatAlt(2_000_000)).toBe("2,000 km");
  });
  it("labels the active mode", () => {
    expect(hudModeLabel({})).toBe("EO");
    expect(hudModeLabel({ nvgGoggles: true, flirThermal: true })).toBe("NVG");
    expect(hudModeLabel({ noir: true })).toBe("NOIR");
  });
});

describe("gods-eye-view effect ports", () => {
  it("declare every uniform their GLSL uses (time is supplied at runtime)", () => {
    for (const fx of [NVG_EFFECT, NOIR_EFFECT, SHARPEN_EFFECT]) {
      const declared = [...fx.fragmentShader.matchAll(/uniform float (\w+);/g)].map((m) => m[1]);
      for (const u of declared) {
        if (u === "time") expect(fx.animated).toBe(true);
        else expect(Object.keys(fx.uniforms)).toContain(u);
      }
      expect(fx.fragmentShader).toContain("out_FragColor");
    }
  });
});
