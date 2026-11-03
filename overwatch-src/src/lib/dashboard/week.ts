/** Officer "My week" helpers (pure, unit-tested). */

/** Start of the current workweek (local midnight) for a 0=Sun..6=Sat start day. */
export function workweekStart(now: Date, weekStartDay: number): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - ((d.getDay() - weekStartDay + 7) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Worked hours on closed timesheets, minus recorded break minutes. */
export function sumWorkedHours(rows: { clock_in: string; clock_out: string | null; break_minutes?: number | null }[]): number {
  let h = 0;
  for (const r of rows) {
    if (!r.clock_out) continue;
    const ms = new Date(r.clock_out).getTime() - new Date(r.clock_in).getTime();
    if (ms > 0) h += ms / 3_600_000 - (r.break_minutes ?? 0) / 60;
  }
  return Math.max(0, Math.round(h * 10) / 10);
}

/** "Starting now" / "In 45m" / "In 5h" / "In 3d". */
export function countdownLabel(startMs: number, nowMs: number): string {
  const mins = Math.round((startMs - nowMs) / 60_000);
  if (mins <= 0) return "Starting now";
  if (mins < 60) return `In ${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `In ${hrs}h`;
  return `In ${Math.floor(hrs / 24)}d`;
}
