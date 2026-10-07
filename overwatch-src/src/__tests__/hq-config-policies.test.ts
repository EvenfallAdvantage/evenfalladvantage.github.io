import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
import { splitWorkweek, splitWorkweekByDay, splitHours, splitDays, toWorkweeks, DEFAULT_OT_CONFIG } from "@/lib/supabase/db-overtime";
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
  it("california 7th consecutive day: first 8h at 1.5x, rest at 2x", () => {
    // 6 x 6h (36 reg) then 10h on day 7 -> 8 OT + 2 DT, nothing regular
    const days = splitWorkweekByDay([6, 6, 6, 6, 6, 6, 10], ca);
    expect(days[6]).toEqual({ regular: 0, overtime: 8, doubletime: 2 });
    expect(splitWorkweek([6, 6, 6, 6, 6, 6, 10], ca)).toEqual({ regular: 36, overtime: 8, doubletime: 2 });
    // 7th day under 8h -> all OT
    expect(splitWorkweekByDay([8, 8, 8, 8, 8, 8, 5], ca)[6]).toEqual({ regular: 0, overtime: 5, doubletime: 0 });
  });
  it("7th-day rule needs all 7 days worked and the rule enabled", () => {
    // day 3 off -> day 7 is not the 7th consecutive day
    expect(splitWorkweekByDay([8, 8, 0, 8, 8, 8, 6], ca)[6]).toEqual({ regular: 0, overtime: 6, doubletime: 0 }); // weekly cap (40 reached)
    expect(splitWorkweekByDay([4, 4, 0, 4, 4, 4, 6], ca)[6]).toEqual({ regular: 6, overtime: 0, doubletime: 0 });
    expect(splitWorkweekByDay([4, 4, 4, 4, 4, 4, 6], { ...ca, seventhDayRule: false })[6]).toEqual({ regular: 6, overtime: 0, doubletime: 0 });
    expect(splitWorkweekByDay([4, 4, 4, 4, 4, 4, 6], ca)[6]).toEqual({ regular: 0, overtime: 6, doubletime: 0 });
  });
  it("groups days into workweeks by week start", () => {
    // 2026-10-04 is a Sunday. Sun..Sat all worked -> one full week
    const m = new Map<string, number>();
    for (let d = 4; d <= 10; d++) m.set(`2026-10-${String(d).padStart(2, "0")}`, d === 10 ? 9 : 5);
    const weeks = toWorkweeks(m, 0);
    expect(weeks.size).toBe(1);
    expect([...weeks.values()][0].slots).toEqual([5, 5, 5, 5, 5, 5, 9]);
    expect(splitDays(m, ca)).toEqual({ regular: 30, overtime: 8, doubletime: 1 });
    // Monday week start splits the same days into two weeks -> no 7th day
    expect(toWorkweeks(m, 1).size).toBe(2);
    expect(splitDays(m, { ...ca, weekStartDay: 1 }).doubletime).toBe(0);
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
    expect(detectOtPreset({ ...ca, seventhDayRule: false })).toBe("custom");
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
