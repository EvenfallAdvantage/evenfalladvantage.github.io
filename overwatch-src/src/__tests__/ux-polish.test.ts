import { describe, it, expect } from "vitest";
import { isEarlyRelease, SOS_HOLD_MS, SOS_INITIAL } from "@/lib/sos/sos-machine";
import { isLikelyAccidental, countsAsPending } from "@/lib/timesheets/accidental";

describe("SOS early release", () => {
  it("flags a tap, not a full hold or idle", () => {
    const holding = { phase: "holding" as const, startedAt: 1000, alertId: null };
    expect(isEarlyRelease(holding, 1200)).toBe(true);
    expect(isEarlyRelease(holding, 1000 + SOS_HOLD_MS)).toBe(false);
    expect(isEarlyRelease(SOS_INITIAL, 1200)).toBe(false);
  });
});
describe("sub-minute timesheets", () => {
  it("are likely accidental and not pending", () => {
    const t = { clock_in: "2026-10-20 20:00:00", clock_out: "2026-10-20 20:00:40", approved: false };
    expect(isLikelyAccidental(t)).toBe(true);
    expect(countsAsPending(t)).toBe(false);
    expect(countsAsPending({ ...t, clock_out: "2026-10-20 20:05:00" })).toBe(true);
    expect(countsAsPending({ ...t, clock_out: null })).toBe(false);
    expect(countsAsPending({ ...t, clock_out: "2026-10-20 21:00:00", approved: true })).toBe(false);
  });
});
