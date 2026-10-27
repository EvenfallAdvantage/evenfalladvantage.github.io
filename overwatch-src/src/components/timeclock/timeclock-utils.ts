import { parseUTC } from "@/lib/parse-utc";
import { formatInTimezone } from "@/lib/timezone";
import { resolveBreakPolicy, type BreakPolicyConfig, type BreakType } from "@/lib/supabase/db-breaks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Timesheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Shift = any;

export interface NormalizedBreak {
  id: string;
  breakType: BreakType;
  startTime: string;
  endTime: string | null;
  durationMinutes: number;
  paid: boolean;
}

export interface BreakSummary {
  mealMinutes: number;
  restMinutes: number;
  otherMinutes: number;
  totalMinutes: number;
  unpaidMinutes: number;
  paidMinutes: number;
  mealCount: number;
  restCount: number;
  activeBreak: NormalizedBreak | null;
  breaks: NormalizedBreak[];
}

export function formatDuration(ms: number) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function formatTime(iso: string, timezone?: string) {
  if (timezone) {
    return formatInTimezone(iso, timezone, { hour: "2-digit", minute: "2-digit" });
  }
  return parseUTC(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function formatDate(iso: string, timezone?: string) {
  if (timezone) {
    return formatInTimezone(iso, timezone, { month: "short", day: "numeric" });
  }
  return parseUTC(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

export function formatFullDate(iso: string, timezone?: string) {
  if (timezone) {
    return formatInTimezone(iso, timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
  }
  return parseUTC(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function isSameDay(startISO: string, endISO?: string | null, timezone?: string): boolean {
  if (!startISO || !endISO) return true;
  if (timezone) {
    const opts: Intl.DateTimeFormatOptions = { year: "numeric", month: "2-digit", day: "2-digit" };
    return formatInTimezone(startISO, timezone, opts) === formatInTimezone(endISO, timezone, opts);
  }
  const a = parseUTC(startISO);
  const b = parseUTC(endISO);
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatDateRange(startISO: string, endISO?: string | null, timezone?: string): string {
  const start = formatDate(startISO, timezone);
  if (!endISO || isSameDay(startISO, endISO, timezone)) return start;
  return `${start} → ${formatDate(endISO, timezone)}`;
}

export function formatFullDateRange(startISO: string, endISO?: string | null, timezone?: string): string {
  const start = formatFullDate(startISO, timezone);
  if (!endISO || isSameDay(startISO, endISO, timezone)) return start;
  return `${start} → ${formatFullDate(endISO, timezone)}`;
}

export function formatLocaleDateRange(
  startISO: string,
  endISO?: string | null,
  options?: Intl.DateTimeFormatOptions,
): string {
  const start = parseUTC(startISO).toLocaleDateString([], options);
  if (!endISO || isSameDay(startISO, endISO)) return start;
  return `${start} → ${parseUTC(endISO).toLocaleDateString([], options)}`;
}

export function calcHoursNum(clockInISO: string, clockOutISO: string) {
  return Math.max(0, (parseUTC(clockOutISO).getTime() - parseUTC(clockInISO).getTime()) / 3600000);
}

export function calcHours(clockInISO: string, clockOutISO: string) {
  return calcHoursNum(clockInISO, clockOutISO).toFixed(2);
}

/**
 * Extract normalized break items from either a timesheet object (containing
 * `timesheet_breaks` or `breaks`) or a raw array of break records.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractTimesheetBreaks(timesheetOrBreaks: any, policyInput?: Partial<BreakPolicyConfig> | Record<string, unknown> | null): NormalizedBreak[] {
  const policy = resolveBreakPolicy(policyInput);
  if (!timesheetOrBreaks) return [];
  const rawList = Array.isArray(timesheetOrBreaks)
    ? timesheetOrBreaks
    : Array.isArray(timesheetOrBreaks.timesheet_breaks)
      ? timesheetOrBreaks.timesheet_breaks
      : Array.isArray(timesheetOrBreaks.breaks)
        ? timesheetOrBreaks.breaks
        : [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rawList.map((b: any, idx: number): NormalizedBreak => {
    const breakType = ((b.breakType ?? b.break_type ?? "other") as BreakType);
    const startTime = String(b.startTime ?? b.start_time ?? "");
    const endTime = (b.endTime ?? b.end_time ?? null) ? String(b.endTime ?? b.end_time) : null;
    const rawMins = b.durationMinutes ?? b.duration_minutes;
    let durationMinutes = 0;
    if (rawMins != null && Number.isFinite(Number(rawMins))) {
      durationMinutes = Math.max(0, Math.round(Number(rawMins)));
    } else if (startTime && endTime) {
      durationMinutes = Math.max(
        0,
        Math.round((parseUTC(endTime).getTime() - parseUTC(startTime).getTime()) / 60000)
      );
    }
    return {
      id: String(b.id ?? `brk-${idx}`),
      breakType,
      startTime,
      endTime,
      durationMinutes,
      paid: breakType === "meal" ? policy.mealBreakPaid : policy.restBreakPaid,
    };
  });
}

/**
 * Summarize breaks for a timesheet (meal vs rest minutes, paid vs unpaid minutes,
 * counts, and any currently open break) using the company's BreakPolicyConfig.
 */
export function calcBreakSummary(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timesheetOrBreaks: any,
  policyInput?: Partial<BreakPolicyConfig> | Record<string, unknown> | null
): BreakSummary {
  const policy = resolveBreakPolicy(policyInput);
  const breaks = extractTimesheetBreaks(timesheetOrBreaks, policy);

  let mealMinutes = 0;
  let restMinutes = 0;
  let otherMinutes = 0;
  let mealCount = 0;
  let restCount = 0;
  let activeBreak: NormalizedBreak | null = null;

  for (const brk of breaks) {
    if (!brk.endTime) {
      activeBreak = brk;
      continue;
    }
    if (brk.breakType === "meal") {
      mealMinutes += brk.durationMinutes;
      mealCount++;
    } else if (brk.breakType === "rest") {
      restMinutes += brk.durationMinutes;
      restCount++;
    } else {
      otherMinutes += brk.durationMinutes;
    }
  }

  let unpaidMinutes =
    (!policy.mealBreakPaid ? mealMinutes : 0) +
    (!policy.restBreakPaid ? restMinutes : 0);
  const paidMinutes =
    (policy.mealBreakPaid ? mealMinutes : 0) +
    (policy.restBreakPaid ? restMinutes : 0);

  // Fallback to legacy timesheets.break_minutes column when no child break rows exist
  if (
    breaks.length === 0 &&
    timesheetOrBreaks &&
    !Array.isArray(timesheetOrBreaks) &&
    typeof timesheetOrBreaks === "object"
  ) {
    const legacyBreakMins = Number(timesheetOrBreaks.break_minutes ?? 0);
    if (Number.isFinite(legacyBreakMins) && legacyBreakMins > 0) {
      mealMinutes = Math.round(legacyBreakMins);
      unpaidMinutes = !policy.mealBreakPaid ? mealMinutes : 0;
    }
  }

  return {
    mealMinutes,
    restMinutes,
    otherMinutes,
    totalMinutes: mealMinutes + restMinutes + otherMinutes,
    unpaidMinutes,
    paidMinutes,
    mealCount,
    restCount,
    activeBreak,
    breaks,
  };
}

/**
 * Calculate unpaid break minutes to deduct from gross shift duration.
 */
export function calcUnpaidBreakMinutes(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timesheetOrBreaks: any,
  policyInput?: Partial<BreakPolicyConfig> | Record<string, unknown> | null
): number {
  return calcBreakSummary(timesheetOrBreaks, policyInput).unpaidMinutes;
}

/**
 * Net payable hours for a shift: gross hours minus unpaid break hours.
 */
export function calcPayableHoursNum(
  clockInISO: string,
  clockOutISO: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timesheetOrBreaks?: any,
  policyInput?: Partial<BreakPolicyConfig> | Record<string, unknown> | null
): number {
  const grossHours = calcHoursNum(clockInISO, clockOutISO);
  if (!timesheetOrBreaks) return grossHours;
  const unpaidMins = calcUnpaidBreakMinutes(timesheetOrBreaks, policyInput);
  return Math.max(0, grossHours - unpaidMins / 60);
}

export function calcPayableHours(
  clockInISO: string,
  clockOutISO: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timesheetOrBreaks?: any,
  policyInput?: Partial<BreakPolicyConfig> | Record<string, unknown> | null
): string {
  return calcPayableHoursNum(clockInISO, clockOutISO, timesheetOrBreaks, policyInput).toFixed(2);
}

export function getWeekDates(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day === 0 ? 7 : day) - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function toDatetimeLocal(iso: string): string {
  const d = parseUTC(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
