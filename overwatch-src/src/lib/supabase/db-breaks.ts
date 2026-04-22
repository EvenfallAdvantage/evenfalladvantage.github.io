/**
 * Break Tracking + Geofenced Clock-In
 *
 * Tracks meal/rest breaks for labor law compliance (CA/NY/CO).
 * Also provides geofence enforcement on clock-in.
 *
 * Table: timesheet_breaks (must be created via SQL migration)
 *   id, timesheet_id, break_type, start_time, end_time, duration_minutes
 *
 * Geofence enforcement uses events.geofence_radius_meters (already exists)
 * to validate clock-in location against event coordinates.
 */

import { createClient } from "./client";
import { ts } from "./db-helpers";
import { logDbReadError } from "./db-error";

export type BreakType = "meal" | "rest" | "other";

export interface TimesheetBreak {
  id: string;
  timesheetId: string;
  breakType: BreakType;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
}

// ─── Break CRUD ───────────────────────────────────────────

/**
 * Start a break (meal or rest).
 */
export async function startBreak(
  timesheetId: string,
  breakType: BreakType
): Promise<string | null> {
  const supabase = createClient();
  const id = crypto.randomUUID();
  const { error } = await supabase
    .from("timesheet_breaks")
    .insert({
      id,
      timesheet_id: timesheetId,
      break_type: breakType,
      start_time: new Date().toISOString(),
      end_time: null,
      duration_minutes: null,
      ...ts(),
    });
  if (error) {
    console.error("[Breaks] Start failed:", error.message);
    return null;
  }
  return id;
}

/**
 * End a break. Calculates duration automatically.
 */
export async function endBreak(breakId: string): Promise<boolean> {
  const supabase = createClient();
  const now = new Date();

  // Get break start time
  const { data: brk } = await supabase
    .from("timesheet_breaks")
    .select("start_time")
    .eq("id", breakId)
    .maybeSingle();

  if (!brk?.start_time) return false;

  const startMs = new Date(brk.start_time).getTime();
  const durationMinutes = Math.round((now.getTime() - startMs) / 60000);

  const { error } = await supabase
    .from("timesheet_breaks")
    .update({
      end_time: now.toISOString(),
      duration_minutes: durationMinutes,
      updated_at: now.toISOString(),
    })
    .eq("id", breakId);

  return !error;
}

/**
 * Get breaks for a timesheet.
 */
export async function getTimesheetBreaks(timesheetId: string): Promise<TimesheetBreak[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("timesheet_breaks")
    .select("*")
    .eq("timesheet_id", timesheetId)
    .order("start_time");

  if (error) { logDbReadError("breaks", error); return []; }

  return (data ?? []).map((b: { id: string; timesheet_id: string; break_type: string; start_time: string; end_time: string | null; duration_minutes: number | null }) => ({
    id: b.id,
    timesheetId: b.timesheet_id,
    breakType: b.break_type as BreakType,
    startTime: b.start_time,
    endTime: b.end_time,
    durationMinutes: b.duration_minutes,
  }));
}

/**
 * Get active (unclosed) break for a timesheet.
 */
export async function getActiveBreak(timesheetId: string): Promise<TimesheetBreak | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("timesheet_breaks")
    .select("*")
    .eq("timesheet_id", timesheetId)
    .is("end_time", null)
    .maybeSingle();

  if (!data) return null;
  return {
    id: data.id,
    timesheetId: data.timesheet_id,
    breakType: data.break_type as BreakType,
    startTime: data.start_time,
    endTime: null,
    durationMinutes: null,
  };
}

// ─── Geofence Enforcement ─────────────────────────────────

/**
 * Check if a GPS position is within the geofence of an event.
 * Returns { allowed: true } or { allowed: false, distance, maxDistance }.
 */
export async function checkGeofence(
  eventId: string,
  lat: number,
  lng: number
): Promise<{ allowed: boolean; distance?: number; maxDistance?: number }> {
  const supabase = createClient();
  const { data: event } = await supabase
    .from("events")
    .select("latitude, longitude, geofence_radius_meters")
    .eq("id", eventId)
    .maybeSingle();

  if (!event?.latitude || !event?.longitude || !event?.geofence_radius_meters) {
    // No geofence configured — always allowed
    return { allowed: true };
  }

  const maxDistance = Number(event.geofence_radius_meters);
  const distance = haversineMeters(lat, lng, Number(event.latitude), Number(event.longitude));

  return {
    allowed: distance <= maxDistance,
    distance: Math.round(distance),
    maxDistance,
  };
}

/**
 * Haversine distance in meters between two lat/lng points.
 */
function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Break Compliance Summary ─────────────────────────────

export interface BreakComplianceSummary {
  timesheetId: string;
  totalWorkedMinutes: number;
  mealBreakMinutes: number;
  restBreakMinutes: number;
  mealBreakRequired: boolean;   // true if shift > 5h (CA law)
  restBreakRequired: boolean;   // true if shift > 3.5h (CA law)
  mealBreakCompliant: boolean;
  restBreakCompliant: boolean;
}

/**
 * Check break compliance for a timesheet against CA labor law rules.
 * CA: 30-min meal break for shifts > 5h, 10-min rest break per 4h.
 */
export async function getBreakCompliance(timesheetId: string): Promise<BreakComplianceSummary | null> {
  const supabase = createClient();

  const { data: sheet } = await supabase
    .from("timesheets")
    .select("clock_in, clock_out")
    .eq("id", timesheetId)
    .maybeSingle();

  if (!sheet?.clock_in || !sheet?.clock_out) return null;

  const worked = (new Date(sheet.clock_out).getTime() - new Date(sheet.clock_in).getTime()) / 60000;
  const breaks = await getTimesheetBreaks(timesheetId);

  const mealMinutes = breaks
    .filter((b) => b.breakType === "meal" && b.durationMinutes)
    .reduce((sum, b) => sum + (b.durationMinutes ?? 0), 0);

  const restMinutes = breaks
    .filter((b) => b.breakType === "rest" && b.durationMinutes)
    .reduce((sum, b) => sum + (b.durationMinutes ?? 0), 0);

  const mealRequired = worked > 300;   // > 5 hours
  const restRequired = worked > 210;   // > 3.5 hours

  return {
    timesheetId,
    totalWorkedMinutes: Math.round(worked),
    mealBreakMinutes: mealMinutes,
    restBreakMinutes: restMinutes,
    mealBreakRequired: mealRequired,
    restBreakRequired: restRequired,
    mealBreakCompliant: !mealRequired || mealMinutes >= 30,
    restBreakCompliant: !restRequired || restMinutes >= 10,
  };
}
