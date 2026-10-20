/**
 * SOS state machine (pure, unit-tested).
 *
 * idle --hold start--> holding --hold >= HOLD_MS--> countdown --COUNTDOWN_MS--> sending --> active
 *                         |  release early              | cancel
 *                         v                             v
 *                        idle                          idle
 * active --"I'm safe"--> idle  (sender marks false_alarm)
 */
export const SOS_HOLD_MS = 1500;
export const SOS_COUNTDOWN_MS = 5000;
/** Supervisors escalate an alert nobody acknowledged within this window. */
export const SOS_ESCALATE_AFTER_MS = 60_000;
/** Minimum spacing between live-location writes while an alert is active. */
export const SOS_LOCATION_INTERVAL_MS = 10_000;
/** Stop sharing live location after this long even if nobody resolves it. */
export const SOS_LOCATION_MAX_MS = 30 * 60_000;

export type SosPhase = "idle" | "holding" | "countdown" | "sending" | "active";
export interface SosState { phase: SosPhase; startedAt: number | null; alertId: string | null }
export type SosEvent =
  | { type: "HOLD_START"; at: number }
  | { type: "HOLD_END"; at: number }
  | { type: "TICK"; at: number }
  | { type: "CANCEL" }
  | { type: "SEND_NOW"; at: number }
  | { type: "SENT"; alertId: string }
  | { type: "SEND_FAILED" }
  | { type: "SAFE" };

export const SOS_INITIAL: SosState = { phase: "idle", startedAt: null, alertId: null };

export function sosReducer(s: SosState, e: SosEvent): SosState {
  switch (e.type) {
    case "HOLD_START":
      return s.phase === "idle" ? { ...s, phase: "holding", startedAt: e.at } : s;
    case "HOLD_END":
      return s.phase === "holding" ? SOS_INITIAL : s;
    case "TICK":
      if (s.phase === "holding" && s.startedAt != null && e.at - s.startedAt >= SOS_HOLD_MS)
        return { ...s, phase: "countdown", startedAt: e.at };
      if (s.phase === "countdown" && s.startedAt != null && e.at - s.startedAt >= SOS_COUNTDOWN_MS)
        return { ...s, phase: "sending" };
      return s;
    case "SEND_NOW":
      return s.phase === "countdown" ? { ...s, phase: "sending" } : s;
    case "CANCEL":
      return s.phase === "countdown" || s.phase === "holding" ? SOS_INITIAL : s;
    case "SENT":
      return s.phase === "sending" ? { phase: "active", startedAt: null, alertId: e.alertId } : s;
    case "SEND_FAILED":
      return s.phase === "sending" ? SOS_INITIAL : s;
    case "SAFE":
      return s.phase === "active" ? SOS_INITIAL : s;
  }
}

/** 0..1 progress of the hold or countdown (for the ring / bar). */
export function sosProgress(s: SosState, now: number): number {
  if (s.startedAt == null) return 0;
  const span = s.phase === "holding" ? SOS_HOLD_MS : s.phase === "countdown" ? SOS_COUNTDOWN_MS : 0;
  return span ? Math.min(1, Math.max(0, (now - s.startedAt) / span)) : 0;
}

/** Whether a supervisor client should escalate this alert now. */
export function shouldEscalate(a: { status: string; escalated: boolean; createdAt: string }, now: number): boolean {
  return a.status === "active" && !a.escalated && now - Date.parse(a.createdAt) >= SOS_ESCALATE_AFTER_MS;
}

/** Throttle helper for live-location writes. */
export function shouldSendLocation(lastSentAt: number | null, now: number, startedAt: number): boolean {
  if (now - startedAt > SOS_LOCATION_MAX_MS) return false;
  return lastSentAt == null || now - lastSentAt >= SOS_LOCATION_INTERVAL_MS;
}
