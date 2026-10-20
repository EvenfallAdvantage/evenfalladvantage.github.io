import { describe, it, expect, vi, afterEach } from "vitest";
import { timeAgo } from "@/lib/utils";
import { pushErrorMessage } from "@/lib/push/web-push";
import { shouldSendLocation, SOS_LOCATION_INTERVAL_MS } from "@/lib/sos/sos-machine";

afterEach(() => { vi.useRealTimers(); });

describe("timeAgo reads zone-less DB timestamps as UTC", () => {
  it("a 3-minute-old naive timestamp is 3m ago, not 'just now'", () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-10-20T16:31:43Z"));
    expect(timeAgo("2026-10-20T16:28:09.796")).toBe("3m ago");
    expect(timeAgo("2026-10-20T16:28:09.796Z")).toBe("3m ago");
    expect(timeAgo("2026-10-20T16:28:09.796+00:00")).toBe("3m ago");
  });
});

describe("pushErrorMessage", () => {
  it("explains a push-service refusal and keeps the raw reason", () => {
    const e = Object.assign(new Error("Registration failed - push service error"), { name: "AbortError" });
    const m = pushErrorMessage(e);
    expect(m).toMatch(/push service refused/);
    expect(m).toContain("Registration failed - push service error");
  });
  it("maps permission errors", () => {
    expect(pushErrorMessage(Object.assign(new Error("x"), { name: "NotAllowedError" }))).toMatch(/aren't allowed/);
  });
});

describe("SOS stationary re-send gate", () => {
  it("allows a re-send of the same fix every interval while active", () => {
    const start = 0; let last: number | null = null; let sent = 0;
    for (let t = 0; t <= 60_000; t += SOS_LOCATION_INTERVAL_MS) { if (shouldSendLocation(last, t, start)) { last = t; sent++; } }
    expect(sent).toBe(7);
  });
});

describe("pushErrorMessage ordering", () => {
  it("treats 'Registration failed - permission denied' (incognito) as a push-service refusal", () => {
    expect(pushErrorMessage(new Error("Registration failed - permission denied"))).toMatch(/push service refused/);
  });
});
