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
}

export const DEFAULT_OT_CONFIG: OvertimeConfig = {
  weeklyThreshold: 40,
  dailyThreshold: 0,     // disabled by default (only CA/NV/CO require daily OT)
  doubletimeThreshold: 0, // disabled by default
  weekStartDay: 0,       // Sunday
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

/** Save overtime rules to companies.settings.overtime_config (owner/admin, RLS). */
export async function saveOvertimeConfig(companyId: string, cfg: OvertimeConfig): Promise<void> {
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
    const { regular, overtime, doubletime } = splitWorkweek(orderedDays(days), config);
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
const orderedDays = (days: Map<string, number>) =>
  Array.from(days.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([, h]) => h);

/**
 * Split one workweek (hours per workday, in order) into regular / OT / DT.
 *
 * Daily rules (when enabled): hours over `dailyThreshold` in a day are OT,
 * hours over `doubletimeThreshold` in a day are DT. Weekly rule: regular hours
 * beyond `weeklyThreshold` for the week become OT (hours already counted as
 * daily OT/DT are not double counted). This matches the California pattern
 * (8/day, 12/day DT, 40/week). Not modelled: the CA 7th-consecutive-day rule.
 */
export function splitWorkweek(
  dailyHours: number[],
  config: OvertimeConfig,
): { regular: number; overtime: number; doubletime: number } {
  const daily = config.dailyThreshold > 0 ? config.dailyThreshold : Infinity;
  const dt = config.doubletimeThreshold > 0 ? config.doubletimeThreshold : Infinity;
  const weekly = config.weeklyThreshold > 0 ? config.weeklyThreshold : Infinity;
  let regular = 0, overtime = 0, doubletime = 0;
  for (const raw of dailyHours) {
    const h = Math.max(0, raw);
    const dDt = Math.max(0, h - dt);
    const dOt = Math.max(0, Math.min(h, dt) - daily);
    let dReg = h - dDt - dOt;
    // Weekly cap on regular hours
    const room = Math.max(0, weekly - regular);
    if (dReg > room) { overtime += dReg - room; dReg = room; }
    regular += dReg; overtime += dOt; doubletime += dDt;
  }
  return { regular, overtime, doubletime };
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
  return splitWorkweek([totalHours], { ...config, dailyThreshold: 0, doubletimeThreshold: 0 });
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
    const date = new Date(ts.clock_in).toISOString().split("T")[0];
    const existing = byUser.get(ts.user_id) ?? { email, entries: [] as TimesheetEntry[] };
    existing.entries.push({ date, hours });
    byUser.set(ts.user_id, existing);
  }

  const results: PayrollHoursEntry[] = [];
  for (const [, { email, entries }] of byUser) {
    const total = entries.reduce((sum, e) => sum + e.hours, 0);
    const days = new Map<string, number>();
    for (const e of entries) days.set(e.date, (days.get(e.date) ?? 0) + e.hours);
    const { regular, overtime, doubletime } = splitWorkweek(orderedDays(days), config);

    // Distribute the split proportionally across entries
    for (const entry of entries) {
      const ratio = entry.hours / total;
      results.push({
        employeeEmail: email,
        date: entry.date,
        regularHours: Math.round(regular * ratio * 100) / 100,
        overtimeHours: Math.round(overtime * ratio * 100) / 100,
        doubletimeHours: Math.round(doubletime * ratio * 100) / 100,
        totalHours: Math.round(entry.hours * 100) / 100,
      });
    }
  }

  return results;
}
