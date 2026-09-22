import { describe, it, expect } from "vitest";
import {
  localToUTC,
  utcToLocalInput,
  formatInTimezone,
  resolveTimezone,
  tzAbbrev,
} from "@/lib/timezone";

describe("localToUTC", () => {
  it("converts Pacific summer time (PDT, UTC-7) to UTC", () => {
    expect(localToUTC("2026-04-18T09:00", "America/Los_Angeles")).toBe(
      "2026-04-18T16:00:00.000Z",
    );
  });

  it("converts Pacific winter time (PST, UTC-8) to UTC", () => {
    expect(localToUTC("2026-01-18T09:00", "America/Los_Angeles")).toBe(
      "2026-01-18T17:00:00.000Z",
    );
  });

  it("converts Eastern summer time (EDT, UTC-4) to UTC", () => {
    expect(localToUTC("2026-06-01T12:00", "America/New_York")).toBe(
      "2026-06-01T16:00:00.000Z",
    );
  });

  it("converts Eastern winter time (EST, UTC-5) to UTC", () => {
    expect(localToUTC("2026-02-01T12:00", "America/New_York")).toBe(
      "2026-02-01T17:00:00.000Z",
    );
  });

  it("handles midnight correctly", () => {
    expect(localToUTC("2026-04-18T00:00", "America/Los_Angeles")).toBe(
      "2026-04-18T07:00:00.000Z",
    );
  });

  it("handles a time in Arizona (UTC-7 year round)", () => {
    expect(localToUTC("2026-07-04T10:00", "America/Phoenix")).toBe(
      "2026-07-04T17:00:00.000Z",
    );
  });

  it("converts UTC timezone without shifting", () => {
    expect(localToUTC("2026-08-15T09:00", "UTC")).toBe(
      "2026-08-15T09:00:00.000Z",
    );
  });

  it("round-trips through display formatting", () => {
    expect(utcToLocalInput(localToUTC("2026-04-18T09:00", "America/Los_Angeles"), "America/Los_Angeles")).toBe(
      "2026-04-18T09:00",
    );
    expect(utcToLocalInput(localToUTC("2026-01-18T09:00", "America/Los_Angeles"), "America/Los_Angeles")).toBe(
      "2026-01-18T09:00",
    );
    expect(utcToLocalInput(localToUTC("2026-06-01T12:00", "America/New_York"), "America/New_York")).toBe(
      "2026-06-01T12:00",
    );
  });

  it("is deterministic across a DST fall-back boundary", () => {
    // Nov 1 2026: DST ends at 2:00 AM PDT → 1:00 AM PST. 1:30 AM exists twice;
    // the fix must return a stable instant that formats back to 01:30.
    const utc = localToUTC("2026-11-01T01:30", "America/Los_Angeles");
    expect(utc === "2026-11-01T08:30:00.000Z" || utc === "2026-11-01T09:30:00.000Z").toBe(true);
    expect(utcToLocalInput(utc, "America/Los_Angeles")).toBe("2026-11-01T01:30");
  });

  it("does not shift across a DST spring-forward boundary", () => {
    // Mar 8 2026: DST begins at 2:00 AM PST → 3:00 AM PDT. 10 AM exists once.
    expect(localToUTC("2026-03-08T10:00", "America/Los_Angeles")).toBe(
      "2026-03-08T17:00:00.000Z",
    );
  });

  it("falls back to legacy parsing for malformed input", () => {
    expect(localToUTC("not-a-date", "America/Los_Angeles")).toBe("");
  });
});

describe("formatInTimezone", () => {
  it("formats a UTC instant in the target timezone", () => {
    expect(
      formatInTimezone("2026-04-18T16:00:00Z", "America/Los_Angeles", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
    ).toBe("09:00");
  });
});

describe("resolveTimezone", () => {
  it("prefers event timezone, then company, then browser default", () => {
    expect(resolveTimezone("America/Denver", "America/New_York")).toBe("America/Denver");
    expect(resolveTimezone(null, "America/New_York")).toBe("America/New_York");
    expect(resolveTimezone(undefined, null)).toBeDefined();
  });
});

describe("tzAbbrev", () => {
  it("maps known US timezones to short abbreviations", () => {
    expect(tzAbbrev("America/New_York")).toBe("ET");
    expect(tzAbbrev("America/Los_Angeles")).toBe("PT");
    expect(tzAbbrev("Pacific/Honolulu")).toBe("HT");
  });

  it("falls back to IANA id for unknown zones", () => {
    expect(tzAbbrev("Somewhere/Else")).toBe("Somewhere/Else");
  });
});