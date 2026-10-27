import { describe, it, expect } from "vitest";
import {
  groupByDay,
  getDaysInRange,
  toISO,
  shiftDayInTz,
  type Shift,
} from "@/app/admin/events/components/shared";

describe("shift timezone bucketing & date range helpers", () => {
  it("buckets evening shifts in America/Los_Angeles under local date (2026-10-27), not UTC next day (2026-10-28)", () => {
    // 2026-10-27 18:30 PDT = 2026-10-28 01:30:00 UTC (stored without Z in timestamp without time zone)
    const shifts: Shift[] = [
      {
        id: "sh-1",
        event_id: "ev-1",
        role: "Staff 1 — Shift",
        start_time: "2026-10-28 01:30:00",
        end_time: "2026-10-28 06:30:00",
      },
      {
        id: "sh-2",
        event_id: "ev-1",
        role: "Manager",
        start_time: "2026-10-28T01:30:00",
        end_time: "2026-10-28T06:30:00",
      },
    ];

    const byDay = groupByDay(shifts, "America/Los_Angeles");
    expect(Array.from(byDay.keys())).toEqual(["2026-10-27"]);
    expect(byDay.get("2026-10-27")).toHaveLength(2);
    expect(byDay.has("2026-10-28")).toBe(false);
  });

  it("round-trips toISO + shiftDayInTz for evening shifts in America/Los_Angeles and America/New_York", () => {
    const startUtcLA = toISO("2026-10-27", 18, 30, false, "America/Los_Angeles");
    expect(startUtcLA).toBe("2026-10-28T01:30:00.000Z");
    expect(shiftDayInTz(startUtcLA, "America/Los_Angeles")).toBe("2026-10-27");

    const startUtcNY = toISO("2026-10-27", 22, 0, false, "America/New_York");
    expect(startUtcNY).toBe("2026-10-28T02:00:00.000Z");
    expect(shiftDayInTz(startUtcNY, "America/New_York")).toBe("2026-10-27");
  });

  it("extracts exact calendar days in getDaysInRange without UTC date-shift", () => {
    expect(
      getDaysInRange("2026-10-27 18:30:00", "2026-10-27 23:30:00", "America/Los_Angeles")
    ).toEqual(["2026-10-27"]);

    expect(
      getDaysInRange("2026-10-27", "2026-10-29", "America/Los_Angeles")
    ).toEqual(["2026-10-27", "2026-10-28", "2026-10-29"]);
  });
});
