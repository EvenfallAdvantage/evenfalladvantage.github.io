/** Job retry schedule: 1m, 5m, 15m, 1h, 4h, 12h (+-10% jitter), then dead. */
const STEPS_MIN = [1, 5, 15, 60, 240, 720];

export function nextRunAt(attempts: number, now: Date, rand: () => number = Math.random): Date {
  const base = STEPS_MIN[Math.min(Math.max(attempts - 1, 0), STEPS_MIN.length - 1)] * 60_000;
  const jitter = base * 0.1 * (rand() * 2 - 1);
  return new Date(now.getTime() + Math.round(base + jitter));
}

export function jobOutcome(attempts: number, maxAttempts: number, retryable: boolean): "failed" | "dead" {
  return retryable && attempts < maxAttempts ? "failed" : "dead";
}

/** Refresh is due when the token expires within the window (default 15 min). */
export function refreshDue(expiresAt: string | null | undefined, now: Date, windowMs = 15 * 60_000): boolean {
  if (!expiresAt) return false;
  const t = Date.parse(expiresAt);
  return Number.isFinite(t) && t - now.getTime() <= windowMs;
}

/** After this many consecutive refresh failures the connection becomes "error". */
export const MAX_REFRESH_FAILURES = 3;
