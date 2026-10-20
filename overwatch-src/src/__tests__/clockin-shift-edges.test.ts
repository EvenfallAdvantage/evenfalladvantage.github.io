import { describe, it, expect } from "vitest";
import { shiftEdgeKind } from "@/lib/supabase/db-timesheets";

describe("shiftEdgeKind", () => {
  const now = new Date("2026-10-20T22:30:00Z");
  it("marks a shift that already ended as late", () => {
    expect(shiftEdgeKind({ start_time: "2026-10-20T16:01:00Z", end_time: "2026-10-20T22:16:00Z" }, now)).toBe("late");
  });
  it("marks a later shift as early", () => {
    expect(shiftEdgeKind({ start_time: "2026-10-21T01:00:00Z", end_time: "2026-10-21T09:00:00Z" }, now)).toBe("early");
  });
});

describe("shiftEdgeKind with zone-less DB timestamps", () => {
  it("treats '2026-10-20 22:16:00' as UTC", () => {
    expect(shiftEdgeKind({ start_time: "2026-10-20 16:01:00", end_time: "2026-10-20 22:16:00" }, new Date("2026-10-20T22:30:00Z"))).toBe("late");
  });
});
