import { describe, it, expect } from "vitest";
import {
  formatMemberName,
  memberInitials,
  memberNameKey,
  type PersonName,
} from "@/lib/format-names";

const snake: PersonName = { first_name: "Jane", last_name: "Doe", callsign: "Eagle" };
const camel: PersonName = { firstName: "Jane", lastName: "Doe", callsign: "Eagle" };
const noCallsign: PersonName = { first_name: "Jane", last_name: "Doe" };
const callsignOnly: PersonName = { callsign: "Ghost" };
const firstNameOnly: PersonName = { first_name: "Jane" };
const empty: PersonName = {};

describe("formatMemberName", () => {
  it("uses callsign + last name when callsign exists (snake_case)", () => {
    expect(formatMemberName(snake)).toBe("Eagle Doe");
  });
  it("uses callsign + last name when callsign exists (camelCase)", () => {
    expect(formatMemberName(camel)).toBe("Eagle Doe");
  });
  it("falls back to first + last when no callsign", () => {
    expect(formatMemberName(noCallsign)).toBe("Jane Doe");
  });
  it("returns callsign alone when no last name", () => {
    expect(formatMemberName(callsignOnly)).toBe("Ghost");
  });
  it("returns first name when only that is set", () => {
    expect(formatMemberName(firstNameOnly)).toBe("Jane");
  });
  it("returns Unknown for empty input", () => {
    expect(formatMemberName(empty)).toBe("Unknown");
  });
  it("trims whitespace", () => {
    expect(formatMemberName({ first_name: " Jane ", last_name: " Doe ", callsign: " Eagle " })).toBe("Eagle Doe");
  });
  it("ignores a blank callsign string", () => {
    expect(formatMemberName({ first_name: "Jane", last_name: "Doe", callsign: "  " })).toBe("Jane Doe");
  });
});

describe("memberInitials", () => {
  it("uses callsign first letter + last initial", () => {
    expect(memberInitials({ first_name: "Jane", last_name: "Doe", callsign: "Eagle" })).toBe("ED");
  });
  it("uses first + last when no callsign", () => {
    expect(memberInitials({ first_name: "Jane", last_name: "Doe" })).toBe("JD");
  });
  it("upper-cases lowercase input", () => {
    expect(memberInitials({ first_name: "jane", last_name: "doe" })).toBe("JD");
  });
  it("falls back to a single letter when only last name", () => {
    expect(memberInitials({ last_name: "Doe" })).toBe("D");
  });
  it("returns ? for empty input", () => {
    expect(memberInitials({})).toBe("?");
  });
});

describe("memberNameKey", () => {
  it("produces a stable slug", () => {
    expect(memberNameKey({ first_name: "Jane", last_name: "Doe", callsign: "Eagle" })).toBe("eagle-doe");
  });
  it("falls back to first-last slug", () => {
    expect(memberNameKey({ first_name: "Jane", last_name: "Doe" })).toBe("jane-doe");
  });
});