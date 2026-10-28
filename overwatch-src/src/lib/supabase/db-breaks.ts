/**
 * Break Tracking + Break Policy Configuration + Geofenced Clock-In
 *
 * Tracks meal/rest breaks for labor law compliance (CA/Federal/Custom).
 * Also provides geofence enforcement on clock-in.
 */

import { createClient } from "./client";
import { ts } from "./db-helpers";
import { logDbReadError } from "./db-error";
import { updateCompanySettings } from "./db-users";

export type BreakType = "meal" | "rest" | "other";

export type BreakRecord = TimesheetBreak;

export interface TimesheetBreak {
  id: string;
  timesheetId: string;
  breakType: BreakType;
  startTime: string;
  endTime: string | null;
  durationMinutes: number | null;
}

// ─── Company Break Policy Config ──────────────────────────

export interface BreakPolicyConfig {
  breaksEnabled: boolean;          // default true
  mealBreakMinutes: number;        // default 30 (e.g. 30m lunch)
  mealBreakPaid: boolean;          // default false (unpaid in CA -> deducted from payable hours)
  firstMealAfterHours: number;     // default 5 (1st meal break required when shift > 5h; 0 = disabled)
  secondMealAfterHours: number;    // default 10 (2nd meal break required when shift > 10h; 0 = disabled)
  restBreakMinutes: number;        // default 10 (e.g. "Take 10")
  restBreakPaid: boolean;          // default true (paid in CA -> NOT deducted from payable hours)
  maxRestBreaksPerShift: number;   // default 3 (up to 3 rest breaks per shift)
  firstRestAfterHours: number;     // default 3.5 (1st rest break after 3.5h; 0 = disabled)
  secondRestAfterHours: number;    // default 6 (2nd rest break after 6h; 0 = disabled)
  thirdRestAfterHours: number;     // default 10 (3rd rest break after 10h; 0 = disabled)
}

/** Out-of-the-box default: California (CA Labor Code § 512 / IWC Wage Orders) */
export const DEFAULT_BREAK_POLICY: BreakPolicyConfig = {
  breaksEnabled: true,
  mealBreakMinutes: 30,
  mealBreakPaid: false,
  firstMealAfterHours: 5,
  secondMealAfterHours: 10,
  restBreakMinutes: 10,
  restBreakPaid: true,
  maxRestBreaksPerShift: 3,
  firstRestAfterHours: 3.5,
  secondRestAfterHours: 6,
  thirdRestAfterHours: 10,
};

function numOr(val: unknown, fallback: number): number {
  const n = typeof val === "number" ? val : typeof val === "string" && val.trim() !== "" ? Number(val) : NaN;
  return Number.isFinite(n) ? n : fallback;
}

function boolOr(val: unknown, fallback: boolean): boolean {
  return typeof val === "boolean" ? val : fallback;
}

/**
 * Normalize either a BreakPolicyConfig, a partial config, or a company `settings`
 * JSON object (containing `break_policy`) into a complete BreakPolicyConfig.
 */
export function resolveBreakPolicy(input?: unknown): BreakPolicyConfig {
  if (!input || typeof input !== "object") return { ...DEFAULT_BREAK_POLICY };
  const obj = input as Record<string, unknown>;
  const raw =
    obj.break_policy && typeof obj.break_policy === "object"
      ? (obj.break_policy as Record<string, unknown>)
      : obj;

  return {
    breaksEnabled: boolOr(raw.breaksEnabled, DEFAULT_BREAK_POLICY.breaksEnabled),
    mealBreakMinutes: Math.max(5, Math.min(120, Math.round(numOr(raw.mealBreakMinutes, DEFAULT_BREAK_POLICY.mealBreakMinutes)))),
    mealBreakPaid: boolOr(raw.mealBreakPaid, DEFAULT_BREAK_POLICY.mealBreakPaid),
    firstMealAfterHours: Math.max(0, Math.min(24, numOr(raw.firstMealAfterHours, DEFAULT_BREAK_POLICY.firstMealAfterHours))),
    secondMealAfterHours: Math.max(0, Math.min(24, numOr(raw.secondMealAfterHours, DEFAULT_BREAK_POLICY.secondMealAfterHours))),
    restBreakMinutes: Math.max(5, Math.min(60, Math.round(numOr(raw.restBreakMinutes, DEFAULT_BREAK_POLICY.restBreakMinutes)))),
    restBreakPaid: boolOr(raw.restBreakPaid, DEFAULT_BREAK_POLICY.restBreakPaid),
    maxRestBreaksPerShift: Math.max(0, Math.min(10, Math.round(numOr(raw.maxRestBreaksPerShift, DEFAULT_BREAK_POLICY.maxRestBreaksPerShift)))),
    firstRestAfterHours: Math.max(0, Math.min(24, numOr(raw.firstRestAfterHours, DEFAULT_BREAK_POLICY.firstRestAfterHours))),
    secondRestAfterHours: Math.max(0, Math.min(24, numOr(raw.secondRestAfterHours, DEFAULT_BREAK_POLICY.secondRestAfterHours))),
    thirdRestAfterHours: Math.max(0, Math.min(24, numOr(raw.thirdRestAfterHours, DEFAULT_BREAK_POLICY.thirdRestAfterHours))),
  };
}

/**
 * Get break policy configuration for a company from companies.settings.break_policy.
 */
export async function getBreakPolicy(companyId: string): Promise<BreakPolicyConfig> {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();

  return resolveBreakPolicy(data?.settings);
}

const isMissingRpc = (e: { code?: string; message?: string }) =>
  e.code === "PGRST202" || e.code === "42883" || /set_company_break_policy/i.test(e.message ?? "");

/**
 * Save break policy configuration for a company (manager and above via the
 * set_company_break_policy RPC; falls back to updateCompanySettings before migration).
 */
export async function saveBreakPolicy(
  companyId: string,
  config: BreakPolicyConfig
): Promise<void> {
  const clean = resolveBreakPolicy(config);
  const supabase = createClient();
  const { error } = await supabase.rpc("set_company_break_policy", {
    p_company_id: companyId,
    p_config: clean,
  });
  if (!error) return;
  if (!isMissingRpc(error)) throw error;
  await updateCompanySettings(companyId, { break_policy: clean });
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
export async function endBreak(breakId: string, endTimeISO?: string): Promise<boolean> {
  const supabase = createClient();
  const endDate = endTimeISO ? new Date(endTimeISO) : new Date();

  // Get break start time
  const { data: brk } = await supabase
    .from("timesheet_breaks")
    .select("start_time")
    .eq("id", breakId)
    .maybeSingle();

  if (!brk?.start_time) return false;

  const startMs = new Date(brk.start_time).getTime();
  const endMs = Math.max(startMs, endDate.getTime());
  const durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));

  const { error } = await supabase
    .from("timesheet_breaks")
    .update({
      end_time: new Date(endMs).toISOString(),
      duration_minutes: durationMinutes,
      updated_at: new Date().toISOString(),
    })
    .eq("id", breakId);

  return !error;
}

/**
 * Close any open (unended) breaks for a timesheet (e.g. when clocking out).
 * Returns the number of open breaks that were closed.
 */
export async function closeActiveBreaksForTimesheet(
  timesheetId: string,
  endTimeISO?: string
): Promise<number> {
  const supabase = createClient();
  const { data: openBreaks } = await supabase
    .from("timesheet_breaks")
    .select("id, start_time")
    .eq("timesheet_id", timesheetId)
    .is("end_time", null);

  if (!openBreaks || openBreaks.length === 0) return 0;

  const endDate = endTimeISO ? new Date(endTimeISO) : new Date();
  const nowISO = new Date().toISOString();
  let closed = 0;

  for (const brk of openBreaks) {
    const startMs = new Date(brk.start_time).getTime();
    const endMs = Math.max(startMs, endDate.getTime());
    const durationMinutes = Math.max(0, Math.round((endMs - startMs) / 60000));
    const { error } = await supabase
      .from("timesheet_breaks")
      .update({
        end_time: new Date(endMs).toISOString(),
        duration_minutes: durationMinutes,
        updated_at: nowISO,
      })
      .eq("id", brk.id);
    if (!error) closed++;
  }

  return closed;
}

/**
 * Get breaks for a timesheet.
 */
export const getBreaksForTimesheet = getTimesheetBreaks;

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
    .order("start_time", { ascending: false })
    .limit(1)
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
    .select("location_lat, location_lng, geofence_radius_meters")
    .eq("id", eventId)
    .maybeSingle();

  if (event?.location_lat == null || event?.location_lng == null || !event?.geofence_radius_meters) {
    // No geofence configured — always allowed
    return { allowed: true };
  }

  const maxDistance = Number(event.geofence_radius_meters);
  const distance = haversineMeters(lat, lng, Number(event.location_lat), Number(event.location_lng));

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
  shiftHours: number;
  mealBreakMinutes: number;
  restBreakMinutes: number;
  mealBreaksTaken: number;
  restBreaksTaken: number;
  mealBreaksRequired: number;
  restBreaksRequired: number;
  restBreaksEligible: number;
  mealBreakRequired: boolean;
  restBreakRequired: boolean;
  mealBreakCompliant: boolean;
  restBreakCompliant: boolean;
  mealBreakViolation: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type BreakLike = Record<string, any>;

/**
 * Pure compliance calculation for a shift against a company's BreakPolicyConfig
 * (defaults to California Labor Code rules).
 */
export function calculateBreakCompliance(
  clockIn: string,
  clockOut: string,
  breaks: BreakLike[] = [],
  policyInput?: Partial<BreakPolicyConfig> | Record<string, unknown> | null,
  timesheetId = ""
): BreakComplianceSummary {
  const policy = resolveBreakPolicy(policyInput);
  const workedMinutes = Math.max(0, (new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 60000);
  const workedHours = workedMinutes / 60;

  let mealBreakMinutes = 0;
  let restBreakMinutes = 0;
  let mealBreaksTaken = 0;
  let restBreaksTaken = 0;

  for (const b of breaks) {
    const type = b.breakType ?? b.break_type;
    const rawDur = b.durationMinutes ?? b.duration_minutes;
    const start = b.startTime ?? b.start_time;
    const end = b.endTime ?? b.end_time;
    const mins =
      rawDur != null
        ? Math.max(0, Number(rawDur))
        : start && end
          ? Math.max(0, Math.round((new Date(end).getTime() - new Date(start).getTime()) / 60000))
          : 0;
    if (type === "meal") {
      mealBreakMinutes += mins;
      if (mins > 0 || end) mealBreaksTaken++;
    } else if (type === "rest") {
      restBreakMinutes += mins;
      if (mins > 0 || end) restBreaksTaken++;
    }
  }

  const shiftHours = Math.round(workedHours * 100) / 100;

  if (!policy.breaksEnabled) {
    return {
      timesheetId,
      totalWorkedMinutes: Math.round(workedMinutes),
      shiftHours,
      mealBreakMinutes,
      restBreakMinutes,
      mealBreaksTaken,
      restBreaksTaken,
      mealBreaksRequired: 0,
      restBreaksRequired: 0,
      restBreaksEligible: 0,
      mealBreakRequired: false,
      restBreakRequired: false,
      mealBreakCompliant: true,
      restBreakCompliant: true,
      mealBreakViolation: false,
    };
  }

  let mealBreaksRequired = 0;
  if (policy.firstMealAfterHours > 0 && workedHours > policy.firstMealAfterHours) {
    mealBreaksRequired = 1;
  }
  if (policy.secondMealAfterHours > 0 && workedHours > policy.secondMealAfterHours) {
    mealBreaksRequired = Math.max(mealBreaksRequired, 2);
  }

  let restBreaksRequired = 0;
  const restThresholds = [
    policy.firstRestAfterHours,
    policy.secondRestAfterHours,
    policy.thirdRestAfterHours,
  ].filter((t) => t > 0);
  for (const threshold of restThresholds) {
    if (workedHours >= threshold) restBreaksRequired++;
  }
  restBreaksRequired = Math.min(restBreaksRequired, policy.maxRestBreaksPerShift);

  const requiredMealMinutes = mealBreaksRequired * policy.mealBreakMinutes;
  const requiredRestMinutes = restBreaksRequired * policy.restBreakMinutes;

  const mealBreakRequired = mealBreaksRequired > 0;
  const restBreakRequired = restBreaksRequired > 0;
  const mealBreakCompliant = !mealBreakRequired || mealBreakMinutes >= requiredMealMinutes;
  const restBreakCompliant = !restBreakRequired || restBreakMinutes >= requiredRestMinutes;

  return {
    timesheetId,
    totalWorkedMinutes: Math.round(workedMinutes),
    shiftHours,
    mealBreakMinutes,
    restBreakMinutes,
    mealBreaksTaken,
    restBreaksTaken,
    mealBreaksRequired,
    restBreaksRequired,
    restBreaksEligible: restBreaksRequired,
    mealBreakRequired,
    restBreakRequired,
    mealBreakCompliant,
    restBreakCompliant,
    mealBreakViolation: !mealBreakCompliant,
  };
}

/**
 * Check break compliance for a timesheet against the company's break policy
 * (defaulting to California labor law rules).
 */
export async function getBreakCompliance(
  timesheetId: string,
  policyInput?: Partial<BreakPolicyConfig> | null
): Promise<BreakComplianceSummary | null> {
  const supabase = createClient();

  const { data: sheet } = await supabase
    .from("timesheets")
    .select("clock_in, clock_out, company_id")
    .eq("id", timesheetId)
    .maybeSingle();

  if (!sheet?.clock_in || !sheet?.clock_out) return null;

  const [breaks, policy] = await Promise.all([
    getTimesheetBreaks(timesheetId),
    policyInput
      ? Promise.resolve(resolveBreakPolicy(policyInput))
      : sheet.company_id
        ? getBreakPolicy(sheet.company_id)
        : Promise.resolve(DEFAULT_BREAK_POLICY),
  ]);

  return calculateBreakCompliance(sheet.clock_in, sheet.clock_out, breaks, policy, timesheetId);
}
