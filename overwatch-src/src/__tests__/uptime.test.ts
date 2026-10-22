import { describe, it, expect } from "vitest";
import { toUptime, uptimeLevel, dayLevel, formatPct, MIN_CHECKS } from "@/lib/status/uptime";

describe("uptime summary", () => {
  it("parses the RPC payload", () => {
    const u = toUptime({ target: 99.5, uptime_7d: "100.000", uptime_30d: 99.537, uptime_90d: null, checks_30d: 8640, last_check: "2026-10-21T00:00:00Z", daily: [{ day: "2026-10-20", pct: "99.65", checks: 288 }, { day: "2026-10-21", pct: null, checks: 0 }] });
    expect(u?.uptime7d).toBe(100);
    expect(u?.uptime30d).toBe(99.537);
    expect(u?.uptime90d).toBeNull();
    expect(u?.daily).toEqual([{ day: "2026-10-20", pct: 99.65, checks: 288 }, { day: "2026-10-21", pct: null, checks: 0 }]);
  });
  it("returns null for junk", () => {
    expect(toUptime(null)).toBeNull();
    expect(toUptime("x")).toBeNull();
  });
  it("levels against the 99.5% target", () => {
    expect(uptimeLevel(99.5)).toBe("green");
    expect(uptimeLevel(99.2)).toBe("amber");
    expect(uptimeLevel(98.9)).toBe("red");
    expect(uptimeLevel(null)).toBe("none");
    expect(uptimeLevel(100, 99.5, MIN_CHECKS - 1)).toBe("none");
    expect(dayLevel({ day: "d", pct: null, checks: 0 })).toBe("none");
  });
  it("formats without rounding up", () => {
    expect(formatPct(99.999)).toBe("99.99%");
    expect(formatPct(100)).toBe("100%");
    expect(formatPct(99.4999)).toBe("99.49%");
    expect(formatPct(null)).toBe("—");
  });
});
