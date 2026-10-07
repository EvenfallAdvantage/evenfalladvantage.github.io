/**
 * Overtime Detection & Payroll Split
 *
 * Calculates regular/OT/DT hours based on configurable thresholds.
 * Used by:
 *   - Dashboard widget ("3 staff approaching overtime")
 *   - Shift assignment warning
 *   - Payroll sync (split hours before sending to Gusto/QB/ADP/Paychex)
 */

import { createClient } from "./client";
import { logDbReadError } from "./db-error";
import { formatMemberName } from "@/lib/format-names";
import { updateCompanySettings } from "./db-users";

// ─── Configuration ────────────────────────────────────────

export interface OvertimeConfig {
  weeklyThreshold: number;    // e.g. 40 (federal standard)
  dailyThreshold: number;     // e.g. 8 (CA) or 0 (disabled)
  doubletimeThreshold: number; // e.g. 12 (CA) or 0 (disabled)
  weekStartDay: number;       // 0=Sunday, 1=Monday
  /**
   * California 7th-consecutive-day rule: when someone works all 7 days of a
   * workweek, the first 8h on the 7th day are overtime (1.5x) and anything
   * over 8h that day is double time (2x).
   */
  seventhDayRule: boolean;
}

export const DEFAULT_OT_CONFIG: OvertimeConfig = {
  weeklyThreshold: 40,
  dailyThreshold: 0,     // disabled by default (only CA/NV/CO require daily OT)
  doubletimeThreshold: 0, // disabled by default
  weekStartDay: 0,       // Sunday
  seventhDayRule: false,  // CA only
};

/**
 * Get overtime config for a company. Falls back to federal defaults.
 */
export async function getOvertimeConfig(companyId: string): Promise<OvertimeConfig> {
  const supabase = createClient();
  const { data } = await supabase
    .from("companies")
    .select("settings")
    .eq("id", companyId)
    .maybeSingle();

  const settings = data?.settings as Record<string, unknown> | null;
  if (!settings?.overtime_config) return DEFAULT_OT_CONFIG;

  const cfg = settings.overtime_config as Partial<OvertimeConfig>;
  return { ...DEFAULT_OT_CONFIG, ...cfg };
}

/** PostgREST "function not found": the pay-settings migration isn't applied yet. */
export const isMissingRpc = (e: { code?: string } | null) => !!e && (e.code === "PGRST202" || e.code === "42883");

/**
 * Save overtime rules (manager and above). Uses the set_company_overtime_config
 * RPC (validates and merges into companies.settings server-side). Before that
 * migration is applied it falls back to the direct update (owner/admin only).
 */
export async function saveOvertimeConfig(companyId: string, cfg: OvertimeConfig): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.rpc("set_company_overtime_config", {
    p_company_id: companyId,
    p_config: cfg,
  });
  if (!error) return;
  if (!isMissingRpc(error)) throw error;
  await updateCompanySettings(companyId, { overtime_config: cfg });
}

// ─── Weekly Hours Calculation ─────────────────────────────

export interface WeeklyHours {
  userId: string;
  userName: string;
  totalHours: number;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  approachingOT: boolean;   // within 5h of threshold
  overThreshold: boolean;
}

/**
 * Calculate weekly hours for all staff in a company.
 * Uses approved timesheets for the current pay week.
 */
export async function getWeeklyHoursReport(companyId: string): Promise<WeeklyHours[]> {
  const config = await getOvertimeConfig(companyId);
  const supabase = createClient();

  // Determine current week boundaries
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysToStart = (dayOfWeek - config.weekStartDay + 7) % 7;
  const weekStart = new Date(now);
  weekStart.setDate(weekStart.getDate() - daysToStart);
  weekStart.setHours(0, 0, 0, 0);

  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  // Get all timesheets for this week
  const { data: timesheets, error } = await supabase
    .from("timesheets")
    .select("user_id, clock_in, clock_out, users!timesheets_user_id_fkey(first_name, last_name, callsign)")
    .eq("company_id", companyId)
    .not("clock_out", "is", null)
    .gte("clock_in", weekStart.toISOString())
    .lt("clock_in", weekEnd.toISOString());

  if (error) { logDbReadError("overtime:weekly-hours", error); return []; }
  if (!timesheets?.length) return [];

  // Aggregate hours per user
  const hoursByUser = new Map<string, { name: string; total: number; days: Map<string, number> }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ts of timesheets as any[]) {
    const userId = ts.user_id;
    const clockIn = new Date(ts.clock_in);
    const clockOut = new Date(ts.clock_out);
    const hours = (clockOut.getTime() - clockIn.getTime()) / 3600000;
    const u = ts.users;
    const name = formatMemberName(u ?? {}) || "Unknown";

    const existing = hoursByUser.get(userId) ?? { name, total: 0, days: new Map<string, number>() };
    existing.total += hours;
    const day = localDayKey(clockIn);
    existing.days.set(day, (existing.days.get(day) ?? 0) + hours);
    if (!hoursByUser.has(userId)) existing.name = name;
    hoursByUser.set(userId, existing);
  }

  // Calculate OT/DT split
  return Array.from(hoursByUser.entries()).map(([userId, { name, total, days }]) => {
    const { regular, overtime, doubletime } = splitDays(days, config);
    return {
      userId,
      userName: name,
      totalHours: Math.round(total * 100) / 100,
      regularHours: Math.round(regular * 100) / 100,
      overtimeHours: Math.round(overtime * 100) / 100,
      doubletimeHours: Math.round(doubletime * 100) / 100,
      approachingOT: total >= config.weeklyThreshold - 5 && total < config.weeklyThreshold,
      overThreshold: total >= config.weeklyThreshold,
    };
  }).sort((a, b) => b.totalHours - a.totalHours);
}

const localDayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const keyToDate = (k: string) => { const [y, m, d] = k.split("-").map(Number); return new Date(y, m - 1, d); };

/**
 * Group per-day hours ("YYYY-MM-DD" -> hours) into workweeks of 7 slots
 * (slot 0 = weekStartDay). Days not worked are 0.
 */
export function toWorkweeks(days: Map<string, number>, weekStartDay: number): Map<string, { slots: number[]; keys: string[] }> {
  const weeks = new Map<string, { slots: number[]; keys: string[] }>();
  for (const [key, hours] of days) {
    const d = keyToDate(key);
    const idx = (d.getDay() - weekStartDay + 7) % 7;
    const start = new Date(d); start.setDate(d.getDate() - idx);
    const wk = localDayKey(start);
    if (!weeks.has(wk)) {
      const keys = Array.from({ length: 7 }, (_, i) => { const x = new Date(start); x.setDate(start.getDate() + i); return localDayKey(x); });
      weeks.set(wk, { slots: Array(7).fill(0), keys });
    }
    weeks.get(wk)!.slots[idx] += hours;
  }
  return weeks;
}

export type DaySplit = { regular: number; overtime: number; doubletime: number };

/**
 * Split one workweek into regular / OT / DT per day.
 *
 * `dailyHours` is the workweek in order (index 0 = first day of the
 * workweek; 0 = not worked). Rules, as enabled in `config`:
 *   - daily: hours over `dailyThreshold` are OT, over `doubletimeThreshold` DT
 *   - weekly: regular hours beyond `weeklyThreshold` become OT (hours already
 *     counted as daily OT/DT are not counted twice)
 *   - 7th consecutive day (CA): if all 7 days are worked, the first 8h on the
 *     7th day are OT and the rest DT (none of it is regular)
 */
export function splitWorkweekByDay(dailyHours: number[], config: OvertimeConfig): DaySplit[] {
  const daily = config.dailyThreshold > 0 ? config.dailyThreshold : Infinity;
  const dt = config.doubletimeThreshold > 0 ? config.doubletimeThreshold : Infinity;
  const weekly = config.weeklyThreshold > 0 ? config.weeklyThreshold : Infinity;
  const seventh = !!config.seventhDayRule && dailyHours.length === 7 && dailyHours.every((h) => h > 0);
  let regularSoFar = 0;
  return dailyHours.map((raw, i) => {
    const h = Math.max(0, raw);
    if (seventh && i === 6) {
      return { regular: 0, overtime: Math.min(h, 8), doubletime: Math.max(0, h - 8) };
    }
    const dDt = Math.max(0, h - dt);
    let dOt = Math.max(0, Math.min(h, dt) - daily);
    let dReg = h - dDt - dOt;
    const room = Math.max(0, weekly - regularSoFar);
    if (dReg > room) { dOt += dReg - room; dReg = room; }
    regularSoFar += dReg;
    return { regular: dReg, overtime: dOt, doubletime: dDt };
  });
}

/** Totals for one workweek (see splitWorkweekByDay). */
export function splitWorkweek(dailyHours: number[], config: OvertimeConfig): DaySplit {
  return splitWorkweekByDay(dailyHours, config).reduce(
    (a, d) => ({ regular: a.regular + d.regular, overtime: a.overtime + d.overtime, doubletime: a.doubletime + d.doubletime }),
    { regular: 0, overtime: 0, doubletime: 0 },
  );
}

/** Totals across any number of days, split per workweek. */
export function splitDays(days: Map<string, number>, config: OvertimeConfig): DaySplit {
  const total: DaySplit = { regular: 0, overtime: 0, doubletime: 0 };
  for (const { slots } of toWorkweeks(days, config.weekStartDay).values()) {
    const w = splitWorkweek(slots, config);
    total.regular += w.regular; total.overtime += w.overtime; total.doubletime += w.doubletime;
  }
  return total;
}

/**
 * Split a weekly total when per-day hours aren't known. Only the weekly rule
 * can apply. (Previously the daily doubletime threshold was applied to the
 * weekly total, which would have counted everything over 12h/week as DT.)
 */
export function splitHours(
  totalHours: number,
  config: OvertimeConfig
): { regular: number; overtime: number; doubletime: number } {
  return splitWorkweek([totalHours], { ...config, dailyThreshold: 0, doubletimeThreshold: 0, seventhDayRule: false });
}

// ─── Payroll Hours for Sync ───────────────────────────────

export interface PayrollHoursEntry {
  employeeEmail: string;
  date: string;
  regularHours: number;
  overtimeHours: number;
  doubletimeHours: number;
  totalHours: number;
}

/**
 * Prepare approved timesheets for payroll sync with OT/DT split.
 * Aggregates by employee and splits based on company OT config.
 */
export async function getPayrollHours(
  companyId: string,
  startDate: string,
  endDate: string
): Promise<PayrollHoursEntry[]> {
  const config = await getOvertimeConfig(companyId);
  const supabase = createClient();

  const { data: timesheets, error } = await supabase
    .from("timesheets")
    .select("user_id, clock_in, clock_out, approved, users!timesheets_user_id_fkey(email)")
    .eq("company_id", companyId)
    .eq("approved", true)
    .not("clock_out", "is", null)
    .gte("clock_in", startDate)
    .lte("clock_in", endDate);

  if (error) { logDbReadError("overtime:payroll-hours", error); return []; }

  // Group by user -> aggregate weekly totals -> split
  type TimesheetEntry = { date: string; hours: number };
  const byUser = new Map<string, { email: string; entries: TimesheetEntry[] }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ts of (timesheets ?? []) as any[]) {
    const email = ts.users?.email ?? "";
    if (!email) continue;
    const hours = (new Date(ts.clock_out).getTime() - new Date(ts.clock_in).getTime()) / 3600000;
    const date = localDayKey(new Date(ts.clock_in));
    const existing = byUser.get(ts.user_id) ?? { email, entries: [] as TimesheetEntry[] };
    existing.entries.push({ date, hours });
    byUser.set(ts.user_id, existing);
  }

  const results: PayrollHoursEntry[] = [];
  for (const [, { email, entries }] of byUser) {
    const days = new Map<string, number>();
    for (const e of entries) days.set(e.date, (days.get(e.date) ?? 0) + e.hours);
    // Per-day split, week by week, then share each day's split across that day's entries.
    const byDay = new Map<string, DaySplit>();
    for (const { slots, keys } of toWorkweeks(days, config.weekStartDay).values()) {
      splitWorkweekByDay(slots, config).forEach((d, i) => { if (slots[i] > 0) byDay.set(keys[i], d); });
    }
    for (const entry of entries) {
      const dayTotal = days.get(entry.date) ?? entry.hours;
      const split = byDay.get(entry.date) ?? { regular: entry.hours, overtime: 0, doubletime: 0 };
      const ratio = dayTotal > 0 ? entry.hours / dayTotal : 0;
      results.push({
        employeeEmail: email,
        date: entry.date,
        regularHours: Math.round(split.regular * ratio * 100) / 100,
        overtimeHours: Math.round(split.overtime * ratio * 100) / 100,
        doubletimeHours: Math.round(split.doubletime * ratio * 100) / 100,
        totalHours: Math.round(entry.hours * 100) / 100,
      });
    }
  }

  return results;
}
