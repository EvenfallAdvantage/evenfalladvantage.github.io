import { describe, it, expect, vi } from "vitest";
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));
import { splitWorkweek, splitWorkweekByDay, splitHours, splitDays, toWorkweeks, DEFAULT_OT_CONFIG } from "@/lib/supabase/db-overtime";
import {
  OT_PRESETS,
  detectOtPreset,
  validateOvertimeConfig,
  parseRate,
  parseOptionalNumber,
  BREAK_PRESETS,
  detectBreakPreset,
  validateBreakPolicy,
} from "@/lib/policy-presets";
import {
  DEFAULT_BREAK_POLICY,
  resolveBreakPolicy,
  calculateBreakCompliance,
} from "@/lib/supabase/db-breaks";
import {
  calcBreakSummary,
  calcPayableHoursNum,
  calcPayableHours,
} from "@/components/timeclock/timeclock-utils";

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

describe("break policy presets & payable hours", () => {
  const federalBreak = BREAK_PRESETS.find((p) => p.id === "federal")!.config;

  it("defaults to California Labor Code break policy", () => {
    expect(resolveBreakPolicy(null)).toEqual(DEFAULT_BREAK_POLICY);
    expect(detectBreakPreset(DEFAULT_BREAK_POLICY)).toBe("california");
    expect(detectBreakPreset(federalBreak)).toBe("federal");
    expect(detectBreakPreset({ ...DEFAULT_BREAK_POLICY, mealBreakMinutes: 45 })).toBe("custom");
  });

  it("validates break policy rules", () => {
    expect(validateBreakPolicy(DEFAULT_BREAK_POLICY)).toBeNull();
    expect(validateBreakPolicy({ ...DEFAULT_BREAK_POLICY, mealBreakMinutes: 0 })).toMatch(/between 5 and 120/);
    expect(validateBreakPolicy({ ...DEFAULT_BREAK_POLICY, secondMealAfterHours: 4 })).toMatch(/2nd meal break threshold/);
    expect(validateBreakPolicy({ ...DEFAULT_BREAK_POLICY, maxRestBreaksPerShift: 11 })).toMatch(/Max rest breaks/);
  });

  it("deducts unpaid meal breaks and preserves paid rest breaks in payable hours", () => {
    const sheet = {
      clock_in: "2026-10-27T08:00:00Z",
      clock_out: "2026-10-27T16:30:00Z", // 8.5h gross
      timesheet_breaks: [
        {
          id: "b1",
          break_type: "meal" as const,
          start_time: "2026-10-27T12:00:00Z",
          end_time: "2026-10-27T12:30:00Z",
          duration_minutes: 30,
        },
        {
          id: "b2",
          break_type: "rest" as const,
          start_time: "2026-10-27T10:00:00Z",
          end_time: "2026-10-27T10:10:00Z",
          duration_minutes: 10,
        },
      ],
    };

    // CA default: meal break is unpaid (deducted), rest break is paid (not deducted)
    const caSummary = calcBreakSummary(sheet, DEFAULT_BREAK_POLICY);
    expect(caSummary.mealMinutes).toBe(30);
    expect(caSummary.restMinutes).toBe(10);
    expect(caSummary.unpaidMinutes).toBe(30);
    expect(caSummary.paidMinutes).toBe(10);
    expect(calcPayableHoursNum(sheet.clock_in, sheet.clock_out, sheet, DEFAULT_BREAK_POLICY)).toBe(8);
    expect(calcPayableHours(sheet.clock_in, sheet.clock_out, sheet, DEFAULT_BREAK_POLICY)).toBe("8.00");

    // Paid meal break company policy: neither break deducted (8.5h payable)
    const paidMealPolicy = { ...DEFAULT_BREAK_POLICY, mealBreakPaid: true };
    expect(calcPayableHoursNum(sheet.clock_in, sheet.clock_out, sheet, paidMealPolicy)).toBe(8.5);
  });

  it("evaluates break compliance against company break policy thresholds", () => {
    // 6-hour shift with 0 meal breaks -> violation under CA (>5h requires 1 meal break)
    const c1 = calculateBreakCompliance(
      "2026-10-27T08:00:00Z",
      "2026-10-27T14:00:00Z",
      [],
      DEFAULT_BREAK_POLICY,
    );
    expect(c1.mealBreaksRequired).toBe(1);
    expect(c1.mealBreakViolation).toBe(true);
    expect(c1.restBreaksEligible).toBe(2); // >=3.5h and >=6h

    // 6-hour shift with a 30m meal break -> no violation
    const c2 = calculateBreakCompliance(
      "2026-10-27T08:00:00Z",
      "2026-10-27T14:00:00Z",
      [
        {
          id: "b1",
          timesheet_id: "t1",
          break_type: "meal",
          start_time: "2026-10-27T12:00:00Z",
          end_time: "2026-10-27T12:30:00Z",
          duration_minutes: 30,
          paid: false,
          created_at: "2026-10-27T12:00:00Z",
        },
      ],
      DEFAULT_BREAK_POLICY,
    );
    expect(c2.mealBreakViolation).toBe(false);

    // Federal preset (firstMealAfterHours: 0) -> no mandatory meal break violation
    const c3 = calculateBreakCompliance(
      "2026-10-27T08:00:00Z",
      "2026-10-27T14:00:00Z",
      [],
      federalBreak,
    );
    expect(c3.mealBreaksRequired).toBe(0);
    expect(c3.mealBreakViolation).toBe(false);
  });
});
