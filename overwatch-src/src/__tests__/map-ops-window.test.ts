import { describe, it, expect } from "vitest";
import {
  isUuid, recentOpsCutoff, classifyStaffFreshness, formatLastSeen, hasValidCoords,
  STAFF_STALE_MS, STAFF_HIDDEN_MS,
} from "@/lib/map/map-ops-window";

const NOW = Date.parse("2026-10-15T19:00:00Z");
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("isUuid", () => {
  it("accepts uuids and rejects null-ish strings", () => {
    expect(isUuid("0f03bc15-aa8d-4bd3-956f-90bdd7904091")).toBe(true);
    for (const v of ["null", "undefined", "", null, undefined, 42]) expect(isUuid(v)).toBe(false);
  });
});

describe("recentOpsCutoff", () => {
  it("is 30 days before now", () => {
    expect(recentOpsCutoff(new Date(NOW))).toBe("2026-09-15T19:00:00.000Z");
  });
});

describe("classifyStaffFreshness", () => {
  it("live / stale / hidden boundaries", () => {
    expect(classifyStaffFreshness(ago(60_000), NOW)).toBe("live");
    expect(classifyStaffFreshness(ago(STAFF_STALE_MS), NOW)).toBe("live");
    expect(classifyStaffFreshness(ago(STAFF_STALE_MS + 1000), NOW)).toBe("stale");
    expect(classifyStaffFreshness(ago(STAFF_HIDDEN_MS + 1000), NOW)).toBe("hidden");
    expect(classifyStaffFreshness("2026-04-16T20:37:55Z", NOW)).toBe("hidden");
    expect(classifyStaffFreshness(null, NOW)).toBe("hidden");
    expect(classifyStaffFreshness("garbage", NOW)).toBe("hidden");
  });
});

describe("formatLastSeen", () => {
  it("formats ages", () => {
    expect(formatLastSeen(ago(10_000), NOW)).toBe("just now");
    expect(formatLastSeen(ago(4 * 60_000), NOW)).toBe("4m ago");
    expect(formatLastSeen(ago(125 * 60_000), NOW)).toBe("2h 5m ago");
    expect(formatLastSeen(ago(120 * 60_000), NOW)).toBe("2h ago");
  });
});

describe("hasValidCoords", () => {
  it("filters bad coordinates", () => {
    expect(hasValidCoords(34.1, -118.2)).toBe(true);
    expect(hasValidCoords("34.1", "-118.2")).toBe(true);
    expect(hasValidCoords(null, -118)).toBe(false);
    expect(hasValidCoords(0, 0)).toBe(false);
    expect(hasValidCoords(NaN, 1)).toBe(false);
    expect(hasValidCoords(91, 1)).toBe(false);
  });
});
