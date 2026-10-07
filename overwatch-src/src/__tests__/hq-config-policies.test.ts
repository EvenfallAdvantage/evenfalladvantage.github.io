import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
import { splitWorkweek, splitHours, DEFAULT_OT_CONFIG } from "@/lib/supabase/db-overtime";
import { OT_PRESETS, detectOtPreset, validateOvertimeConfig, parseRate, parseOptionalNumber } from "@/lib/policy-presets";

const ca = { ...DEFAULT_OT_CONFIG, ...OT_PRESETS.find((p) => p.id === "california")!.config };

describe("overtime split", () => {
  it("federal: weekly only", () => {
    expect(splitWorkweek([10, 10, 10, 10, 5], DEFAULT_OT_CONFIG)).toEqual({ regular: 40, overtime: 5, doubletime: 0 });
  });
  it("california: daily OT and DT", () => {
    // 14h day: 8 reg, 4 OT, 2 DT
    expect(splitWorkweek([14], ca)).toEqual({ regular: 8, overtime: 4, doubletime: 2 });
  });
  it("california: weekly cap on regular hours, no double counting", () => {
    // 6 days x 8h = 48 → 40 reg + 8 OT
    expect(splitWorkweek([8, 8, 8, 8, 8, 8], ca)).toEqual({ regular: 40, overtime: 8, doubletime: 0 });
    // 5 x 10h = 50 → daily OT 10, reg 40
    expect(splitWorkweek([10, 10, 10, 10, 10], ca)).toEqual({ regular: 40, overtime: 10, doubletime: 0 });
  });
  it("weekly total split never applies daily DT to weekly hours", () => {
    expect(splitHours(30, ca)).toEqual({ regular: 30, overtime: 0, doubletime: 0 });
  });
});

describe("policy presets", () => {
  it("detects presets", () => {
    expect(detectOtPreset(DEFAULT_OT_CONFIG)).toBe("federal");
    expect(detectOtPreset(ca)).toBe("california");
    expect(detectOtPreset({ ...ca, dailyThreshold: 10 })).toBe("custom");
  });
  it("validates", () => {
    expect(validateOvertimeConfig(ca)).toBeNull();
    expect(validateOvertimeConfig({ ...ca, doubletimeThreshold: 6 })).toMatch(/Double time/);
    expect(validateOvertimeConfig({ ...ca, weeklyThreshold: -1 })).toMatch(/zero/);
  });
  it("parses rates", () => {
    expect(parseRate("")).toBeNull();
    expect(parseRate("$22.5")).toBe(22.5);
    expect(parseRate("abc")).toBeUndefined();
    expect(parseRate("1.234")).toBeUndefined();
    expect(parseOptionalNumber("80")).toBe(80);
    expect(parseOptionalNumber("-1")).toBeUndefined();
  });
});
