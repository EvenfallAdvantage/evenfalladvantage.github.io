import { describe, it, expect } from "vitest";
import { sosReducer, SOS_INITIAL, SOS_HOLD_MS, SOS_COUNTDOWN_MS, sosProgress, shouldEscalate, shouldSendLocation, SOS_ESCALATE_AFTER_MS, SOS_LOCATION_MAX_MS } from "@/lib/sos/sos-machine";

describe("sosReducer", () => {
  it("a short tap never sends", () => {
    let s = sosReducer(SOS_INITIAL, { type: "HOLD_START", at: 0 });
    s = sosReducer(s, { type: "TICK", at: SOS_HOLD_MS - 1 });
    expect(s.phase).toBe("holding");
    s = sosReducer(s, { type: "HOLD_END", at: SOS_HOLD_MS - 1 });
    expect(s).toEqual(SOS_INITIAL);
  });
  it("hold -> countdown -> sending -> active", () => {
    let s = sosReducer(SOS_INITIAL, { type: "HOLD_START", at: 0 });
    s = sosReducer(s, { type: "TICK", at: SOS_HOLD_MS });
    expect(s.phase).toBe("countdown");
    s = sosReducer(s, { type: "HOLD_END", at: SOS_HOLD_MS + 10 });
    expect(s.phase).toBe("countdown");
    s = sosReducer(s, { type: "TICK", at: SOS_HOLD_MS + SOS_COUNTDOWN_MS });
    expect(s.phase).toBe("sending");
    s = sosReducer(s, { type: "SENT", alertId: "a1" });
    expect(s).toMatchObject({ phase: "active", alertId: "a1" });
    expect(sosReducer(s, { type: "SAFE" })).toEqual(SOS_INITIAL);
  });
  it("cancel during countdown returns to idle", () => {
    let s = sosReducer(SOS_INITIAL, { type: "HOLD_START", at: 0 });
    s = sosReducer(s, { type: "TICK", at: SOS_HOLD_MS });
    expect(sosReducer(s, { type: "CANCEL" })).toEqual(SOS_INITIAL);
  });
  it("send now skips the countdown, failure resets", () => {
    let s = sosReducer(SOS_INITIAL, { type: "HOLD_START", at: 0 });
    s = sosReducer(s, { type: "TICK", at: SOS_HOLD_MS });
    s = sosReducer(s, { type: "SEND_NOW", at: SOS_HOLD_MS + 1 });
    expect(s.phase).toBe("sending");
    expect(sosReducer(s, { type: "SEND_FAILED" })).toEqual(SOS_INITIAL);
  });
  it("progress is clamped", () => {
    const s = sosReducer(SOS_INITIAL, { type: "HOLD_START", at: 0 });
    expect(sosProgress(s, SOS_HOLD_MS / 2)).toBeCloseTo(0.5);
    expect(sosProgress(s, SOS_HOLD_MS * 3)).toBe(1);
  });
});

describe("escalation and location throttle", () => {
  it("escalates only unacked, unescalated alerts after the window", () => {
    const createdAt = new Date(0).toISOString();
    expect(shouldEscalate({ status: "active", escalated: false, createdAt }, SOS_ESCALATE_AFTER_MS)).toBe(true);
    expect(shouldEscalate({ status: "active", escalated: false, createdAt }, SOS_ESCALATE_AFTER_MS - 1)).toBe(false);
    expect(shouldEscalate({ status: "acknowledged", escalated: false, createdAt }, 1e9)).toBe(false);
    expect(shouldEscalate({ status: "active", escalated: true, createdAt }, 1e9)).toBe(false);
  });
  it("throttles location writes and stops after the max window", () => {
    expect(shouldSendLocation(null, 0, 0)).toBe(true);
    expect(shouldSendLocation(0, 5_000, 0)).toBe(false);
    expect(shouldSendLocation(0, 10_000, 0)).toBe(true);
    expect(shouldSendLocation(0, SOS_LOCATION_MAX_MS + 1, 0)).toBe(false);
  });
});
