/** Round status for a patrol route, matching the server's overdue rule
 *  (frequency + 10 min grace; see patrol_overdue_alerts()). */
export const OVERDUE_GRACE_MIN = 10;

export type RouteRoundStatus =
  | { kind: "none" }
  | { kind: "ok"; minsAgo: number; dueInMin: number }
  | { kind: "due"; minsAgo: number }
  | { kind: "overdue"; minsAgo: number };

export function routeRoundStatus(
  frequencyMin: number | null | undefined,
  lastScanAt: Date | null,
  now = new Date(),
): RouteRoundStatus {
  if (!frequencyMin || frequencyMin <= 0 || !lastScanAt) return { kind: "none" };
  const minsAgo = Math.max(0, Math.floor((now.getTime() - lastScanAt.getTime()) / 60_000));
  if (minsAgo > frequencyMin + OVERDUE_GRACE_MIN) return { kind: "overdue", minsAgo };
  if (minsAgo >= frequencyMin) return { kind: "due", minsAgo };
  return { kind: "ok", minsAgo, dueInMin: frequencyMin - minsAgo };
}
