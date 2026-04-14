import { describe, it, expect } from "vitest";
import {
  formatDuration,
  calcHoursNum,
  calcHours,
  getWeekDates,
  DAY_LABELS,
} from "@/components/timeclock/timeclock-utils";

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
      // 24 hours in ms
      expect(diff).toBe(86400000);
    }
  });

  it("offset -1 returns previous week", () => {
    const current = getWeekDates(0);
    const prev = getWeekDates(-1);
    // Previous week's Monday should be 7 days before current week's Monday
    const diffMs = current[0].getTime() - prev[0].getTime();
    expect(diffMs).toBe(7 * 86400000);
  });

  it("offset +1 returns next week", () => {
    const current = getWeekDates(0);
    const next = getWeekDates(1);
    const diffMs = next[0].getTime() - current[0].getTime();
    expect(diffMs).toBe(7 * 86400000);
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
