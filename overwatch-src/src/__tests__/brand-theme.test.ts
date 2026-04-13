import { describe, it, expect } from "vitest";
import { hexToRgb, adjustBrightness, getLuminance } from "@/lib/brand-utils";

describe("Brand Theme — hexToRgb", () => {
  it("converts valid hex colors", () => {
    expect(hexToRgb("#ff0000")).toEqual([255, 0, 0]);
    expect(hexToRgb("#00ff00")).toEqual([0, 255, 0]);
    expect(hexToRgb("#0000ff")).toEqual([0, 0, 255]);
    expect(hexToRgb("#ffffff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#000000")).toEqual([0, 0, 0]);
  });

  it("handles hex without #", () => {
    expect(hexToRgb("ff0000")).toEqual([255, 0, 0]);
  });

  it("returns fallback for invalid hex", () => {
    expect(hexToRgb("")).toEqual([29, 52, 81]);
    expect(hexToRgb("#fff")).toEqual([29, 52, 81]); // 3-char hex not supported
  });
});

describe("Brand Theme — adjustBrightness", () => {
  it("brightens a color", () => {
    const brighter = adjustBrightness("#808080", 1.5);
    const [r, g, b] = hexToRgb(brighter);
    expect(r).toBeGreaterThan(128);
    expect(g).toBeGreaterThan(128);
    expect(b).toBeGreaterThan(128);
  });

  it("darkens a color", () => {
    const darker = adjustBrightness("#808080", 0.5);
    const [r, g, b] = hexToRgb(darker);
    expect(r).toBeLessThan(128);
    expect(g).toBeLessThan(128);
    expect(b).toBeLessThan(128);
  });

  it("clamps to valid range", () => {
    const maxed = adjustBrightness("#ffffff", 2.0);
    expect(maxed).toBe("#ffffff"); // can't go above 255
    
    const zeroed = adjustBrightness("#000000", 0.5);
    expect(zeroed).toBe("#000000"); // 0 * anything = 0
  });

  it("returns valid hex format", () => {
    const result = adjustBrightness("#1d3451", 1.3);
    expect(result).toMatch(/^#[0-9a-f]{6}$/);
  });
});

describe("Brand Theme — Luminance Guardrails", () => {
  it("dark colors have low luminance", () => {
    expect(getLuminance("#1d3451")).toBeLessThan(0.1); // navy
    expect(getLuminance("#080626")).toBeLessThan(0.05); // deep purple
    expect(getLuminance("#000000")).toBe(0);
  });

  it("bright colors have high luminance", () => {
    expect(getLuminance("#dd8c33")).toBeGreaterThan(0.15); // amber
    expect(getLuminance("#d63d3d")).toBeGreaterThan(0.05); // red
    expect(getLuminance("#ffffff")).toBeCloseTo(1, 1);
  });

  it("primary color should be dark (luminance < 0.15)", () => {
    const primaryExamples = ["#1d3451", "#080626", "#0a1929", "#1a0f2e"];
    for (const hex of primaryExamples) {
      expect(getLuminance(hex)).toBeLessThan(0.15);
    }
  });

  it("accent color should be visible (luminance > 0.05)", () => {
    const accentExamples = ["#dd8c33", "#d63d3d", "#22c55e", "#3b82f6"];
    for (const hex of accentExamples) {
      expect(getLuminance(hex)).toBeGreaterThan(0.05);
    }
  });
});
