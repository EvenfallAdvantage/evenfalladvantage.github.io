import { describe, it, expect } from "vitest";
import { formatInTimezone, utcToLocalInput } from "@/lib/timezone";
import { formatTime, formatFullDate } from "@/components/timeclock/timeclock-utils";

// Zone-less DB timestamps are UTC. 2026-10-24 20:06 UTC = 1:06 PM PDT.
const ZONELESS = "2026-10-24 20:06:00";
const LA = "America/Los_Angeles";

describe("zone-less DB timestamps are read as UTC", () => {
  it("formatInTimezone", () => {
    expect(formatInTimezone(ZONELESS, LA, { hour: "2-digit", minute: "2-digit" })).toBe("01:06 PM");
    expect(formatInTimezone("2026-10-24T20:06:00Z", LA, { hour: "2-digit", minute: "2-digit" })).toBe("01:06 PM");
  });
  it("Upcoming Shift card helpers (event timezone)", () => {
    expect(formatTime(ZONELESS, LA)).toBe("01:06 PM");
    expect(formatFullDate(ZONELESS, LA)).toBe("Saturday, October 24, 2026");
  });
  it("utcToLocalInput (admin edit forms)", () => {
    expect(utcToLocalInput(ZONELESS, LA)).toBe("2026-10-24T13:06");
  });
});
