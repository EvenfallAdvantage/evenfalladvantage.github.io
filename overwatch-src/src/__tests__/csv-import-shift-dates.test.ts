/**
 * Unit tests for the permissive shift CSV date/time parser.
 *
 * Covers the common Excel/Google Sheets export formats. Goal: users
 * should never have to reformat their CSV before importing.
 *
 * Output format is always strict ISO (`YYYY-MM-DD`, `HH:MM:SS`) so
 * downstream import code doesn't need to know which input format the
 * user provided.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { validateShiftRows, inferYear } from "@/lib/csv-import";

function row(date: string, start: string, end: string) {
  return { date, start_time: start, end_time: end };
}

describe("validateShiftRows — date format detection", () => {
  it("accepts ISO YYYY-MM-DD", () => {
    const { valid, errors, conventionWasGuessed } = validateShiftRows([
      row("2026-05-21", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-21");
    expect(conventionWasGuessed).toBe(false);
  });

  it("accepts YYYY/MM/DD and YYYY.MM.DD as ISO", () => {
    const r1 = validateShiftRows([row("2026/05/21", "09:00", "17:00")]);
    expect(r1.errors).toEqual([]);
    expect(r1.valid[0].date).toBe("2026-05-21");

    const r2 = validateShiftRows([row("2026.05.21", "09:00", "17:00")]);
    expect(r2.errors).toEqual([]);
    expect(r2.valid[0].date).toBe("2026-05-21");
  });

  it("accepts ISO without zero-padding (2026-5-7)", () => {
    const { valid, errors } = validateShiftRows([row("2026-5-7", "09:00", "17:00")]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-07");
  });

  it("pins M/D/Y when an unambiguous row has day > 12 (5/21/2026)", () => {
    const { valid, errors, dateConvention, conventionWasGuessed } = validateShiftRows([
      row("5/21/2026", "09:00", "17:00"),
      row("5/6/2026", "10:00", "18:00"),
    ]);
    expect(errors).toEqual([]);
    expect(dateConvention).toBe("MDY");
    expect(conventionWasGuessed).toBe(false);
    expect(valid[0].date).toBe("2026-05-21");
    expect(valid[1].date).toBe("2026-05-06"); // 5/6 → May 6 (US)
  });

  it("pins D/M/Y when an unambiguous row has first field > 12 (21/5/2026)", () => {
    const { valid, errors, dateConvention } = validateShiftRows([
      row("21/5/2026", "09:00", "17:00"),
      row("6/5/2026", "10:00", "18:00"),
    ]);
    expect(errors).toEqual([]);
    expect(dateConvention).toBe("DMY");
    expect(valid[0].date).toBe("2026-05-21");
    expect(valid[1].date).toBe("2026-05-06"); // 6/5 → May 6 (EU)
  });

  it("flags conflict if rows want both M/D and D/M", () => {
    const { errors } = validateShiftRows([
      row("5/21/2026", "09:00", "17:00"), // pins MDY
      row("21/5/2026", "10:00", "18:00"), // tries to pin DMY → conflict
    ]);
    // 21/5/2026 will be reported as conflicting with the first row
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].message).toContain("conflict");
  });

  it("defaults to M/D/Y and flags as guessed when all rows are ambiguous", () => {
    const { valid, dateConvention, conventionWasGuessed } = validateShiftRows([
      row("5/6/2026", "09:00", "17:00"),
      row("3/4/2026", "10:00", "18:00"),
    ]);
    expect(dateConvention).toBe("MDY");
    expect(conventionWasGuessed).toBe(true);
    expect(valid[0].date).toBe("2026-05-06"); // May 6
    expect(valid[1].date).toBe("2026-03-04"); // March 4
  });

  it("accepts 2-digit years and interprets as 20xx", () => {
    const { valid, errors } = validateShiftRows([
      row("5/21/26", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-21");
  });

  it("accepts dashes as separator (5-21-2026)", () => {
    // Note: ambiguous between ISO and M-D-Y. The numeric regex matches
    // the first field with 1-2 digits, so "5-21-2026" goes to ambiguous_numeric.
    const { valid, errors } = validateShiftRows([
      row("5-21-2026", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-21");
  });

  it("accepts text-month month-first ('May 21, 2026')", () => {
    const { valid, errors } = validateShiftRows([
      row("May 21, 2026", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-21");
  });

  it("accepts text-month without comma ('May 21 2026')", () => {
    const { valid, errors } = validateShiftRows([
      row("May 21 2026", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-21");
  });

  it("accepts text-month day-first ('21 May 2026')", () => {
    const { valid, errors } = validateShiftRows([
      row("21 May 2026", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-21");
  });

  it("accepts text-month with dashes ('21-May-2026')", () => {
    const { valid, errors } = validateShiftRows([
      row("21-May-2026", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-21");
  });

  it("rejects calendar-invalid dates (Feb 30)", () => {
    const { errors, valid } = validateShiftRows([
      row("2026-02-30", "09:00", "17:00"),
    ]);
    expect(valid).toEqual([]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("not a real calendar date");
  });

  it("rejects truly unrecognized date strings", () => {
    const { errors } = validateShiftRows([
      row("next Tuesday", "09:00", "17:00"),
    ]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("unrecognized format");
  });
});

describe("validateShiftRows — time format detection", () => {
  it("accepts 24-hour HH:MM", () => {
    const { valid, errors } = validateShiftRows([row("2026-05-21", "09:30", "21:00")]);
    expect(errors).toEqual([]);
    expect(valid[0].start_time).toBe("09:30:00");
    expect(valid[0].end_time).toBe("21:00:00");
  });

  it("accepts 24-hour HH:MM:SS", () => {
    const { valid, errors } = validateShiftRows([row("2026-05-21", "09:30:45", "21:00:15")]);
    expect(errors).toEqual([]);
    expect(valid[0].start_time).toBe("09:30:45");
    expect(valid[0].end_time).toBe("21:00:15");
  });

  it("accepts 24-hour without zero-padding (9:30)", () => {
    const { valid, errors } = validateShiftRows([row("2026-05-21", "9:30", "21:00")]);
    expect(errors).toEqual([]);
    expect(valid[0].start_time).toBe("09:30:00");
  });

  it("accepts 12-hour AM/PM ('9:30 AM' → 09:30:00)", () => {
    const { valid, errors } = validateShiftRows([row("2026-05-21", "9:30 AM", "5:00 PM")]);
    expect(errors).toEqual([]);
    expect(valid[0].start_time).toBe("09:30:00");
    expect(valid[0].end_time).toBe("17:00:00");
  });

  it("accepts 12-hour with seconds ('9:30:00 AM')", () => {
    const { valid, errors } = validateShiftRows([row("2026-05-21", "9:30:00 AM", "5:00:00 PM")]);
    expect(errors).toEqual([]);
    expect(valid[0].start_time).toBe("09:30:00");
    expect(valid[0].end_time).toBe("17:00:00");
  });

  it("accepts 12-hour without minutes ('9 AM' → 09:00:00)", () => {
    const { valid, errors } = validateShiftRows([row("2026-05-21", "9 AM", "5 PM")]);
    expect(errors).toEqual([]);
    expect(valid[0].start_time).toBe("09:00:00");
    expect(valid[0].end_time).toBe("17:00:00");
  });

  it("handles 12 AM (midnight) and 12 PM (noon) correctly", () => {
    const { valid, errors } = validateShiftRows([row("2026-05-21", "12:00 AM", "12:00 PM")]);
    expect(errors).toEqual([]);
    expect(valid[0].start_time).toBe("00:00:00"); // midnight
    expect(valid[0].end_time).toBe("12:00:00"); // noon
  });

  it("accepts AM/PM with periods ('9:30 a.m.')", () => {
    const { valid, errors } = validateShiftRows([row("2026-05-21", "9:30 a.m.", "5:00 p.m.")]);
    expect(errors).toEqual([]);
    expect(valid[0].start_time).toBe("09:30:00");
    expect(valid[0].end_time).toBe("17:00:00");
  });

  it("rejects out-of-range times", () => {
    const { errors } = validateShiftRows([row("2026-05-21", "25:00", "17:00")]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("Start time");
  });
});

describe("validateShiftRows — combined real-world cases", () => {
  it("handles the user's original failing CSV ('5/21' style + '9:30:00 AM')", () => {
    // The CSV that originally crashed with RangeError. Now it should
    // parse cleanly. The dates are M/D (US) because day=21 > 12.
    const { valid, errors, dateConvention } = validateShiftRows([
      row("5/21/2026", "9:30:00 AM", "5:00:00 PM"),
      row("5/22/2026", "9:30:00 AM", "5:00:00 PM"),
    ]);
    expect(errors).toEqual([]);
    expect(dateConvention).toBe("MDY");
    expect(valid).toHaveLength(2);
    expect(valid[0]).toEqual({
      date: "2026-05-21",
      start_time: "09:30:00",
      end_time: "17:00:00",
    });
  });

  it("preserves optional fields (role, staff_email, notes)", () => {
    const { valid } = validateShiftRows([
      { date: "5/21/2026", start_time: "9 AM", end_time: "5 PM", role: "Patrol", staff_email: "a@b.com", notes: "Test" },
    ]);
    expect(valid[0]).toMatchObject({
      role: "Patrol",
      staff_email: "a@b.com",
      notes: "Test",
    });
  });
});

describe("inferYear — pure year inference logic", () => {
  it("uses current year when date is today", () => {
    // Reference: May 21, 2026
    const today = new Date(2026, 4, 21); // month is 0-indexed in JS
    expect(inferYear(5, 21, today)).toBe(2026);
  });

  it("uses current year when date is later this year", () => {
    const today = new Date(2026, 4, 21);
    expect(inferYear(5, 22, today)).toBe(2026); // tomorrow
    expect(inferYear(6, 1, today)).toBe(2026); // next month
    expect(inferYear(12, 31, today)).toBe(2026); // end of year
  });

  it("uses NEXT year when date has already passed this year", () => {
    const today = new Date(2026, 4, 21);
    expect(inferYear(5, 20, today)).toBe(2027); // yesterday
    expect(inferYear(4, 30, today)).toBe(2027); // last month
    expect(inferYear(1, 1, today)).toBe(2027); // start of year
  });

  it("handles year-boundary case: Dec 31 today + Jan 1 input → next year", () => {
    const today = new Date(2026, 11, 31); // Dec 31, 2026
    expect(inferYear(1, 1, today)).toBe(2027);
  });

  it("handles year-boundary case: Jan 1 today + Dec 31 input → still 2027", () => {
    // Jan 1 today, user enters "12/31". 12/31 hasn't passed (it's
    // later this year), so → 2026.
    const today = new Date(2026, 0, 1);
    expect(inferYear(12, 31, today)).toBe(2026);
  });
});

describe("validateShiftRows — year inference", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("infers current year for upcoming M/D dates", () => {
    vi.setSystemTime(new Date(2026, 4, 1)); // May 1, 2026
    const { valid, errors } = validateShiftRows([
      row("5/21", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-21");
  });

  it("infers next year for already-passed M/D dates", () => {
    vi.setSystemTime(new Date(2026, 6, 15)); // Jul 15, 2026
    const { valid, errors } = validateShiftRows([
      row("5/21", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2027-05-21");
  });

  it("infers year for text-month no-year ('May 21')", () => {
    vi.setSystemTime(new Date(2026, 0, 1));
    const { valid, errors } = validateShiftRows([
      row("May 21", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-21");
  });

  it("infers year for day-first text no-year ('21 May')", () => {
    vi.setSystemTime(new Date(2026, 0, 1));
    const { valid, errors } = validateShiftRows([
      row("21 May", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-05-21");
  });

  it("mixed CSV: some rows have year, some don't — all use the same M/D convention", () => {
    vi.setSystemTime(new Date(2026, 0, 1)); // Jan 1, 2026
    const { valid, errors, dateConvention } = validateShiftRows([
      row("5/21/2026", "09:00", "17:00"), // pins MDY (21 > 12)
      row("6/15", "10:00", "18:00"),       // no year — infer 2026
    ]);
    expect(errors).toEqual([]);
    expect(dateConvention).toBe("MDY");
    expect(valid[0].date).toBe("2026-05-21");
    expect(valid[1].date).toBe("2026-06-15"); // 6/15 → June 15
  });

  it("a no-year row can ALSO pin the convention if its first field > 12", () => {
    // "21/5" alone — 21 can't be a month → must be D/M → May 21.
    vi.setSystemTime(new Date(2026, 0, 1));
    const { valid, errors, dateConvention } = validateShiftRows([
      row("21/5", "09:00", "17:00"),
    ]);
    expect(errors).toEqual([]);
    expect(dateConvention).toBe("DMY");
    expect(valid[0].date).toBe("2026-05-21");
  });

  it("rejects no-year date when inferred year makes the calendar invalid (Feb 29 in non-leap year)", () => {
    // Mar 1, 2026 → Feb 29 has passed → infer 2027 → Feb 29 2027 is
    // not a real date (2027 isn't a leap year). Reject with clear error.
    vi.setSystemTime(new Date(2026, 2, 1));
    const { errors, valid } = validateShiftRows([
      row("2/29", "09:00", "17:00"),
    ]);
    expect(valid).toEqual([]);
    expect(errors.length).toBe(1);
    expect(errors[0].message).toContain("not a real calendar date");
  });

  it("handles year-boundary CSV correctly (Dec rows + Jan rows in same sheet, late Dec)", () => {
    vi.setSystemTime(new Date(2026, 11, 28)); // Dec 28, 2026
    const { valid, errors } = validateShiftRows([
      row("12/30", "09:00", "17:00"), // 12/30 hasn't passed → 2026
      row("12/31", "09:00", "17:00"), // 12/31 hasn't passed → 2026
      row("1/2", "09:00", "17:00"),   // 1/2 has passed (in 2026 frame) → 2027
      row("1/5", "09:00", "17:00"),   // same
    ]);
    expect(errors).toEqual([]);
    expect(valid[0].date).toBe("2026-12-30");
    expect(valid[1].date).toBe("2026-12-31");
    expect(valid[2].date).toBe("2027-01-02");
    expect(valid[3].date).toBe("2027-01-05");
  });
});
