import { describe, it, expect, vi } from "vitest";
import { isConstrained, pointBudget, topN, withSuspendedEvents } from "@/lib/map/device-profile";

describe("isConstrained", () => {
  it("phones, touch tablets and low-memory devices are constrained; desktops are not", () => {
    expect(isConstrained({ width: 390, coarsePointer: true, finePointer: false })).toBe(true);
    expect(isConstrained({ width: 1024, coarsePointer: true, finePointer: false })).toBe(true);
    expect(isConstrained({ width: 1024, coarsePointer: true, finePointer: true })).toBe(false);
    expect(isConstrained({ width: 1440, coarsePointer: false, finePointer: true })).toBe(false);
    expect(isConstrained({ width: 1440, coarsePointer: false, finePointer: true, deviceMemoryGb: 2 })).toBe(true);
    expect(isConstrained(null)).toBe(false);
  });
});

describe("pointBudget", () => {
  it("is smaller on constrained devices", () => {
    expect(pointBudget("fires", true)).toBeLessThan(pointBudget("fires", false));
    expect(pointBudget("lightning", false)).toBe(800);
  });
});

describe("topN", () => {
  it("keeps highest scores in original order", () => {
    expect(topN([1, 5, 3, 9, 2], 3, (x) => x)).toEqual([5, 3, 9]);
    expect(topN([1, 2], 5, (x) => x)).toEqual([1, 2]);
    expect(topN([1, 2, 3], 0, (x) => x)).toEqual([]);
  });
});

describe("withSuspendedEvents", () => {
  it("always resumes", () => {
    const e = { suspendEvents: vi.fn(), resumeEvents: vi.fn() };
    expect(() => withSuspendedEvents(e, () => { throw new Error("x"); })).toThrow();
    expect(e.resumeEvents).toHaveBeenCalledTimes(1);
    expect(withSuspendedEvents(null, () => 7)).toBe(7);
  });
});
