import { describe, it, expect } from "vitest";
import { routeRoundStatus } from "@/lib/patrol/route-status";
const now = new Date("2026-10-20T20:00:00Z");
const ago = (m: number) => new Date(now.getTime() - m * 60_000);
describe("routeRoundStatus", () => {
  it("none without frequency or scans", () => {
    expect(routeRoundStatus(0, ago(5), now).kind).toBe("none");
    expect(routeRoundStatus(30, null, now).kind).toBe("none");
  });
  it("ok / due / overdue around frequency + 10 min grace", () => {
    expect(routeRoundStatus(30, ago(12), now)).toEqual({ kind: "ok", minsAgo: 12, dueInMin: 18 });
    expect(routeRoundStatus(30, ago(30), now).kind).toBe("due");
    expect(routeRoundStatus(30, ago(40), now).kind).toBe("due");
    expect(routeRoundStatus(30, ago(41), now)).toEqual({ kind: "overdue", minsAgo: 41 });
  });
});
