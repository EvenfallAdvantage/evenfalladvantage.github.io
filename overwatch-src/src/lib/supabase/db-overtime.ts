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

// ─── Configuration ────────────────────────────────────────

export interface OvertimeConfig {
  weeklyThreshold: number;    // e.g. 40 (federal standard)
  dailyThreshold: number;     // e.g. 8 (CA) or 0 (disabled)
  doubletimeThreshold: number; // e.g. 12 (CA) or 0 (disabled)
  weekStartDay: number;       // 0=Sunday, 1=Monday
}

const DEFAULT_OT_CONFIG: OvertimeConfig = {
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
    .select("user_id, clock_in, clock_out, users!timesheets_user_id_fkey(first_name, last_name)")
    .eq("company_id", companyId)
    .not("clock_out", "is", null)
    .gte("clock_in", weekStart.toISOString())
    .lt("clock_in", weekEnd.toISOString());

  if (error) { logDbReadError("overtime:weekly-hours", error); return []; }
  if (!timesheets?.length) return [];

  // Aggregate hours per user
  const hoursByUser = new Map<string, { name: string; total: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  for (const ts of timesheets as any[]) {
    const userId = ts.user_id;
    const clockIn = new Date(ts.clock_in);
    const clockOut = new Date(ts.clock_out);
    const hours = (clockOut.getTime() - clockIn.getTime()) / 3600000;
    const u = ts.users;
    const name = u ? `${u.first_name} ${u.last_name}` : "Unknown";

    const existing = hoursByUser.get(userId) ?? { name, total: 0 };
    existing.total += hours;
    if (!hoursByUser.has(userId)) existing.name = name;
    hoursByUser.set(userId, existing);
  }

  // Calculate OT/DT split
  return Array.from(hoursByUser.entries()).map(([userId, { name, total }]) => {
    const { regular, overtime, doubletime } = splitHours(total, config);
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

/**
 * Split total hours into regular / overtime / doubletime.
 */
export function splitHours(
  totalHours: number,
  config: OvertimeConfig
): { regular: number; overtime: number; doubletime: number } {
  let regular = totalHours;
  let overtime = 0;
  let doubletime = 0;

  // Doubletime (e.g., hours > 12 in CA)
  if (config.doubletimeThreshold > 0 && totalHours > config.doubletimeThreshold) {
    doubletime = totalHours - config.doubletimeThreshold;
    totalHours = config.doubletimeThreshold;
  }

  // Overtime (weekly threshold)
  if (config.weeklyThreshold > 0 && totalHours > config.weeklyThreshold) {
    overtime = totalHours - config.weeklyThreshold;
    regular = config.weeklyThreshold;
  } else {
    regular = totalHours;
  }

  return { regular, overtime, doubletime };
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
    const { regular, overtime, doubletime } = splitHours(total, config);

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
