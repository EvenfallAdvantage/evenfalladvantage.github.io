import { describe, expect, it } from "vitest";
import { findPasses, formatDuration } from "@/lib/map/sat-passes";

// Synthetic sky: a pass every 100 min, 10 min long, peak alternating 60° / 5°.
const PERIOD = 100 * 60_000, LEN = 10 * 60_000;
const elev = (t: number) => {
  const k = Math.floor(t / PERIOD);
  const x = (t - k * PERIOD) / LEN; // 0..1 inside a pass
  const peak = k % 2 === 0 ? 60 : 5;
  return x >= 0 && x <= 1 ? peak * Math.sin(Math.PI * x) - 0.0001 : -20;
};

describe("findPasses", () => {
  it("finds rise/peak/set and filters by minimum elevation", () => {
    const passes = findPasses(elev, 0, 24 * 3_600_000, { minElDeg: 10 });
    expect(passes.length).toBe(8); // 15 passes in 24 h (0..14), even k only → 8
    const p = passes[1];
    expect(Math.abs(p.riseMs - 2 * PERIOD)).toBeLessThan(1_000);
    expect(Math.abs(p.setMs - (2 * PERIOD + LEN))).toBeLessThan(1_000);
    expect(Math.abs(p.peakMs - (2 * PERIOD + LEN / 2))).toBeLessThan(2_000);
    expect(p.maxElDeg).toBeCloseTo(60, 0);
  });
  it("keeps a pass already in progress at the start", () => {
    const passes = findPasses(elev, LEN / 2, PERIOD, { minElDeg: 10 });
    expect(passes).toHaveLength(1);
    expect(passes[0].riseMs).toBe(LEN / 2);
  });
  it("formats durations", () => {
    expect(formatDuration(65_000)).toBe("1m 05s");
  });
});
