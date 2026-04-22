/**
 * DAR (Daily Activity Report) Auto-Generation
 *
 * Compiles end-of-shift narrative combining:
 *   - Clock in/out times
 *   - Patrol checkpoints scanned
 *   - Incidents filed
 *   - Breaks taken
 *   - Notes from the shift
 *
 * Intended to be delivered to clients via email or client portal.
 */

import { createClient } from "./client";
import { logDbReadError } from "./db-error";

export interface DAREntry {
  time: string;
  type: "clock_in" | "clock_out" | "patrol" | "incident" | "break_start" | "break_end" | "note";
  description: string;
}

export interface DailyActivityReport {
  eventId: string;
  eventName: string;
  date: string;
  staffName: string;
  clockIn: string;
  clockOut: string;
  totalHours: number;
  entries: DAREntry[];
  patrolCount: number;
  incidentCount: number;
  breakMinutes: number;
}

/**
 * Generate a DAR for a specific timesheet/shift.
 * Aggregates all activity within the clock-in to clock-out window.
 */
export async function generateDAR(timesheetId: string): Promise<DailyActivityReport | null> {
  const supabase = createClient();

  // Get the timesheet with user + event info
  const { data: sheet, error: sheetErr } = await supabase
    .from("timesheets")
    .select(`
      id, clock_in, clock_out, event_id, user_id, notes,
      users!timesheets_user_id_fkey(first_name, last_name),
      events(name)
    `)
    .eq("id", timesheetId)
    .maybeSingle();

  if (sheetErr || !sheet?.clock_in || !sheet?.clock_out) {
    if (sheetErr) logDbReadError("dar:timesheet", sheetErr);
    return null;
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ts = sheet as any;
  const staffName = ts.users ? `${ts.users.first_name} ${ts.users.last_name}` : "Staff";
  const eventName = ts.events?.name ?? "General";
  const clockIn = new Date(ts.clock_in);
  const clockOut = new Date(ts.clock_out);
  const totalHours = (clockOut.getTime() - clockIn.getTime()) / 3600000;

  const entries: DAREntry[] = [];

  // Entry: clock in
  entries.push({
    time: clockIn.toISOString(),
    type: "clock_in",
    description: `Clocked in for ${eventName}`,
  });

  // Get patrol logs during the shift
  const { data: patrols } = await supabase
    .from("patrol_logs")
    .select("id, checkpoint_id, scanned_at, notes, checkpoints(name)")
    .eq("user_id", ts.user_id)
    .gte("scanned_at", ts.clock_in)
    .lte("scanned_at", ts.clock_out)
    .order("scanned_at");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const p of (patrols ?? []) as any[]) {
    entries.push({
      time: p.scanned_at,
      type: "patrol",
      description: `Patrol checkpoint: ${p.checkpoints?.name ?? "Unknown"}${p.notes ? ` — ${p.notes}` : ""}`,
    });
  }

  // Get incidents filed during the shift
  const { data: incidents } = await supabase
    .from("incidents")
    .select("id, title, severity, created_at")
    .eq("reporter_id", ts.user_id)
    .gte("created_at", ts.clock_in)
    .lte("created_at", ts.clock_out)
    .order("created_at");

  for (const inc of incidents ?? []) {
    entries.push({
      time: inc.created_at,
      type: "incident",
      description: `Incident reported: ${inc.title} (${inc.severity})`,
    });
  }

  // Get breaks during the shift
  const { data: breaks } = await supabase
    .from("timesheet_breaks")
    .select("id, break_type, start_time, end_time, duration_minutes")
    .eq("timesheet_id", timesheetId)
    .order("start_time");

  let breakMinutes = 0;
  for (const b of breaks ?? []) {
    entries.push({
      time: b.start_time,
      type: "break_start",
      description: `${b.break_type === "meal" ? "Meal" : "Rest"} break started`,
    });
    if (b.end_time) {
      entries.push({
        time: b.end_time,
        type: "break_end",
        description: `Break ended (${b.duration_minutes ?? 0} min)`,
      });
      breakMinutes += b.duration_minutes ?? 0;
    }
  }

  // Entry: clock out
  entries.push({
    time: clockOut.toISOString(),
    type: "clock_out",
    description: `Clocked out — ${totalHours.toFixed(1)} hours worked`,
  });

  // Add shift notes if present
  if (ts.notes) {
    entries.push({
      time: clockOut.toISOString(),
      type: "note",
      description: `Shift notes: ${ts.notes}`,
    });
  }

  // Sort chronologically
  entries.sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime());

  return {
    eventId: ts.event_id ?? "",
    eventName,
    date: clockIn.toISOString().split("T")[0],
    staffName,
    clockIn: ts.clock_in,
    clockOut: ts.clock_out,
    totalHours: Math.round(totalHours * 100) / 100,
    entries,
    patrolCount: (patrols ?? []).length,
    incidentCount: (incidents ?? []).length,
    breakMinutes,
  };
}

/**
 * Generate DARs for all completed timesheets for an event on a given date.
 */
export async function generateEventDARs(
  eventId: string,
  date: string
): Promise<DailyActivityReport[]> {
  const supabase = createClient();

  const startOfDay = `${date}T00:00:00.000Z`;
  const endOfDay = `${date}T23:59:59.999Z`;

  const { data: sheets, error } = await supabase
    .from("timesheets")
    .select("id")
    .eq("event_id", eventId)
    .not("clock_out", "is", null)
    .gte("clock_in", startOfDay)
    .lte("clock_in", endOfDay);

  if (error) { logDbReadError("dar:event-sheets", error); return []; }

  const dars: DailyActivityReport[] = [];
  for (const sheet of sheets ?? []) {
    const dar = await generateDAR(sheet.id);
    if (dar) dars.push(dar);
  }

  return dars;
}
