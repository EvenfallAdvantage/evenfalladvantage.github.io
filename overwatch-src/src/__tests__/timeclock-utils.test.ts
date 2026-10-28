import { describe, it, expect } from "vitest";
import {
  formatDuration,
  calcHoursNum,
  calcHours,
  getWeekDates,
  DAY_LABELS,
  isSameDay,
  formatDate,
  formatDateRange,
  formatFullDate,
  formatFullDateRange,
  formatLocaleDateRange,
} from "@/components/timeclock/timeclock-utils";
import { fmtDate, fmtDateRange } from "@/app/schedule/components/schedule-helpers";

describe("formatDuration", () => {
  it("formats zero milliseconds", () => {
    expect(formatDuration(0)).toBe("00:00:00");
  });

  it("formats exact hours", () => {
    expect(formatDuration(3600000)).toBe("01:00:00");
  });

  it("formats hours, minutes, and seconds", () => {
    // 2h 30m 15s = 9015000 ms
    expect(formatDuration(9015000)).toBe("02:30:15");
  });

  it("handles negative values by clamping to zero", () => {
    expect(formatDuration(-5000)).toBe("00:00:00");
  });

  it("pads single digits", () => {
    // 5 seconds = 5000 ms
    expect(formatDuration(5000)).toBe("00:00:05");
  });

  it("handles large durations", () => {
    // 100 hours
    expect(formatDuration(360000000)).toBe("100:00:00");
  });
});

describe("calcHoursNum", () => {
  it("calculates hours between two ISO timestamps", () => {
    const result = calcHoursNum("2025-01-15T08:00:00Z", "2025-01-15T16:00:00Z");
    expect(result).toBe(8);
  });

  it("returns fractional hours", () => {
    const result = calcHoursNum("2025-01-15T08:00:00Z", "2025-01-15T09:30:00Z");
    expect(result).toBe(1.5);
  });

  it("returns zero when clock-out equals clock-in", () => {
    const result = calcHoursNum("2025-01-15T08:00:00Z", "2025-01-15T08:00:00Z");
    expect(result).toBe(0);
  });

  it("returns zero (not negative) when clock-out is before clock-in", () => {
    const result = calcHoursNum("2025-01-15T16:00:00Z", "2025-01-15T08:00:00Z");
    expect(result).toBe(0);
  });
});

describe("calcHours", () => {
  it("returns a string with two decimal places", () => {
    const result = calcHours("2025-01-15T08:00:00Z", "2025-01-15T16:00:00Z");
    expect(result).toBe("8.00");
  });

  it("formats fractional hours", () => {
    const result = calcHours("2025-01-15T08:00:00Z", "2025-01-15T09:15:00Z");
    expect(result).toBe("1.25");
  });
});

describe("getWeekDates", () => {
  it("returns 7 days for offset 0", () => {
    const days = getWeekDates(0);
    expect(days).toHaveLength(7);
  });

  it("starts on Monday (day index 1)", () => {
    const days = getWeekDates(0);
    // Monday = 1
    expect(days[0].getDay()).toBe(1);
  });

  it("ends on Sunday (day index 0)", () => {
    const days = getWeekDates(0);
    expect(days[6].getDay()).toBe(0);
  });

  it("days are consecutive", () => {
    const days = getWeekDates(0);
    for (let i = 1; i < days.length; i++) {
      const diff = days[i].getTime() - days[i - 1].getTime();
      // 1 calendar day (23h–25h across DST transitions)
      expect(Math.round(diff / 86400000)).toBe(1);
    }
  });

  it("offset -1 returns previous week", () => {
    const current = getWeekDates(0);
    const prev = getWeekDates(-1);
    // Previous week's Monday should be 7 calendar days before current week's Monday
    const diffMs = current[0].getTime() - prev[0].getTime();
    expect(Math.round(diffMs / 86400000)).toBe(7);
  });

  it("offset +1 returns next week", () => {
    const current = getWeekDates(0);
    const next = getWeekDates(1);
    const diffMs = next[0].getTime() - current[0].getTime();
    expect(Math.round(diffMs / 86400000)).toBe(7);
  });
});

describe("DAY_LABELS", () => {
  it("has 7 labels", () => {
    expect(DAY_LABELS).toHaveLength(7);
  });

  it("starts with Mon and ends with Sun", () => {
    expect(DAY_LABELS[0]).toBe("Mon");
    expect(DAY_LABELS[6]).toBe("Sun");
  });
});

describe("overnight / multi-day date range helpers", () => {
  it("isSameDay returns true when start and end fall on the same day in timezone", () => {
    expect(
      isSameDay("2026-10-25T13:00:00Z", "2026-10-25T21:00:00Z", "America/New_York")
    ).toBe(true);
  });

  it("isSameDay returns false for overnight shifts crossing midnight", () => {
    // 10 PM EDT Oct 25 -> 6 AM EDT Oct 26
    expect(
      isSameDay("2026-10-26T02:00:00Z", "2026-10-26T10:00:00Z", "America/New_York")
    ).toBe(false);
    expect(
      isSameDay("2026-10-25T22:00:00", "2026-10-26T14:00:00")
    ).toBe(false);
  });

  it("isSameDay returns true when endISO is null or undefined", () => {
    expect(isSameDay("2026-10-25T13:00:00Z", null)).toBe(true);
    expect(isSameDay("2026-10-25T13:00:00Z", undefined)).toBe(true);
  });

  it("formatDateRange shows single date for same-day shifts and start → end for overnight shifts", () => {
    const sameDayStart = "2026-10-25T13:00:00Z";
    const sameDayEnd = "2026-10-25T21:00:00Z";
    expect(formatDateRange(sameDayStart, sameDayEnd, "America/New_York")).toBe(
      formatDate(sameDayStart, "America/New_York")
    );

    const overnightStart = "2026-10-26T02:00:00Z"; // Oct 25 10:00 PM EDT
    const overnightEnd = "2026-10-26T10:00:00Z";   // Oct 26 06:00 AM EDT
    expect(formatDateRange(overnightStart, overnightEnd, "America/New_York")).toBe(
      `${formatDate(overnightStart, "America/New_York")} → ${formatDate(overnightEnd, "America/New_York")}`
    );
  });

  it("formatFullDateRange and formatLocaleDateRange append end date when different from start date", () => {
    const overnightStart = "2026-10-25T22:00:00Z";
    const overnightEnd = "2026-10-26T14:00:00Z";
    expect(formatFullDateRange(overnightStart, overnightEnd, "UTC")).toBe(
      `${formatFullDate(overnightStart, "UTC")} → ${formatFullDate(overnightEnd, "UTC")}`
    );
    expect(formatLocaleDateRange(overnightStart, overnightEnd)).toContain(" → ");
  });

  it("fmtDateRange shows single date for same-day shift and start → end for overnight shift", () => {
    const overnightStart = "2026-10-26T02:00:00Z"; // Oct 25 10:00 PM EDT
    const overnightEnd = "2026-10-26T10:00:00Z";   // Oct 26 06:00 AM EDT
    expect(fmtDateRange(overnightStart, overnightEnd, "America/New_York")).toBe(
      `${fmtDate(overnightStart, "America/New_York")} → ${fmtDate(overnightEnd, "America/New_York")}`
    );
  });
});
