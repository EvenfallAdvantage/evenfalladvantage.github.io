/**
 * CSV Export Utility
 * Converts arrays of objects to CSV and triggers a browser download.
 */

import { parseUTC } from "@/lib/parse-utc";
import { calcBreakSummary, calcPayableHoursNum } from "@/components/timeclock/timeclock-utils";
import { calculateBreakCompliance, resolveBreakPolicy, type BreakPolicyConfig } from "@/lib/supabase/db-breaks";
import { clockInFlag } from "@/lib/supabase/db-timesheets";

type Row = Record<string, unknown>;

function escapeCSV(val: unknown): string {
  if (val === null || val === undefined) return "";
  const str = String(val);
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportCSV(
  rows: Row[],
  columns: { key: string; label: string }[],
  filename: string,
) {
  if (!rows.length) return;

  const header = columns.map((c) => escapeCSV(c.label)).join(",");
  const body = rows
    .map((row) =>
      columns
        .map((c) => {
          // Support nested keys like "users.first_name"
          const parts = c.key.split(".");
          let val: unknown = row;
          for (const p of parts) {
            if (val && typeof val === "object") {
              val = (val as Record<string, unknown>)[p];
            } else {
              val = undefined;
              break;
            }
          }
          return escapeCSV(val);
        })
        .join(","),
    )
    .join("\n");

  const csv = `\uFEFF${header}\n${body}`;
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── Preset column configs ──────────────────────────

export const TIMESHEET_COLUMNS = [
  { key: "users.first_name", label: "First Name" },
  { key: "users.last_name", label: "Last Name" },
  { key: "users.email", label: "Email" },
  { key: "operation_name", label: "Operation" },
  { key: "clock_in_type", label: "Clock In Type" },
  { key: "clock_in", label: "Clock In" },
  { key: "clock_out", label: "Clock Out" },
  { key: "gross_hours", label: "Gross Hours" },
  { key: "payable_hours", label: "Payable Hours" },
  { key: "meal_break_count", label: "Meal Breaks" },
  { key: "meal_break_minutes", label: "Meal Break (min)" },
  { key: "rest_break_count", label: "Rest Breaks" },
  { key: "rest_break_minutes", label: "Rest Break (min)" },
  { key: "unpaid_break_minutes", label: "Unpaid Break Deducted (min)" },
  { key: "break_minutes", label: "Total Break (min)" },
  { key: "break_compliance", label: "Break Compliance" },
  { key: "clock_in_flag", label: "Clock-In Timing" },
  { key: "location_verdict", label: "Location Verification" },
  { key: "shift_notes_signed", label: "Shift Notes Signed" },
  { key: "approved", label: "Approved" },
  { key: "notes", label: "Notes" },
];

/**
 * Enrich raw timesheet rows with computed hours, break summaries, compliance,
 * clock-in flags, geofence verification, and DAR signoff status for CSV export.
 */
export function buildTimesheetCsvRows(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  timesheets: Record<string, any>[],
  policyInput?: Partial<BreakPolicyConfig> | Record<string, unknown> | null,
  signedIds: ReadonlySet<string> = new Set(),
): Row[] {
  const policy = resolveBreakPolicy(policyInput);
  return timesheets.map((t) => {
    const breakSummary = calcBreakSummary(t, policy);
    const compliance = t.clock_out
      ? calculateBreakCompliance(
          String(t.clock_in),
          String(t.clock_out),
          Array.isArray(t.timesheet_breaks) ? t.timesheet_breaks : [],
          policy,
          String(t.id ?? ""),
        )
      : null;
    const grossHours = t.clock_out
      ? Math.max(
          0,
          (parseUTC(String(t.clock_out)).getTime() - parseUTC(String(t.clock_in)).getTime()) / 3600000,
        ).toFixed(2)
      : "";
    const payableHours = t.clock_out
      ? calcPayableHoursNum(String(t.clock_in), String(t.clock_out), t, policy).toFixed(2)
      : "";
    const notesStr = typeof t.notes === "string" ? t.notes : "";
    return {
      ...t,
      operation_name: t.events?.name ?? t.shifts?.events?.name ?? "Other",
      clock_in_type: typeof t.clock_in_type === "string" && t.clock_in_type ? t.clock_in_type : "shift",
      gross_hours: grossHours,
      payable_hours: payableHours,
      meal_break_count: breakSummary.mealCount,
      meal_break_minutes: breakSummary.mealMinutes,
      rest_break_count: breakSummary.restCount,
      rest_break_minutes: breakSummary.restMinutes,
      unpaid_break_minutes: breakSummary.unpaidMinutes,
      break_minutes: breakSummary.totalMinutes,
      break_compliance: compliance?.mealBreakViolation ? "Meal Break Violation" : "Compliant",
      clock_in_flag: clockInFlag(notesStr) ?? "on_time",
      location_verdict:
        typeof t.clock_in_verdict === "string" && t.clock_in_verdict
          ? t.clock_in_verdict
          : t.clock_in_lat != null
            ? "gps_recorded"
            : "",
      shift_notes_signed: signedIds.has(String(t.id ?? "")) ? "Yes" : "No",
      approved: t.approved ? "Yes" : "No",
      notes: notesStr,
    };
  });
}

export const INCIDENT_COLUMNS = [
  { key: "incident_number", label: "Number" },
  { key: "title", label: "Title" },
  { key: "type", label: "Type" },
  { key: "severity", label: "Severity" },
  { key: "priority", label: "Priority" },
  { key: "status", label: "Status" },
  { key: "source", label: "Source" },
  { key: "location", label: "Location" },
  { key: "reported_user.first_name", label: "Reported By (First)" },
  { key: "reported_user.last_name", label: "Reported By (Last)" },
  { key: "assigned_user.first_name", label: "Assigned (First)" },
  { key: "assigned_user.last_name", label: "Assigned (Last)" },
  { key: "team_id", label: "Team ID" },
  { key: "description", label: "Description" },
  { key: "created_at", label: "Reported At" },
  { key: "due_at", label: "Due At" },
  { key: "closed_at", label: "Closed At" },
  { key: "updated_at", label: "Updated At" },
];

export const MEMBER_COLUMNS = [
  { key: "users.callsign", label: "Callsign" },
  { key: "users.first_name", label: "First Name" },
  { key: "users.last_name", label: "Last Name" },
  { key: "users.email", label: "Email" },
  { key: "users.phone", label: "Phone" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "title", label: "Title" },
  { key: "guard_card_number", label: "Guard Card #" },
];

export const TASK_COLUMNS = [
  { key: "title", label: "Title" },
  { key: "status", label: "Status" },
  { key: "priority", label: "Priority" },
  { key: "team_id", label: "Team ID" },
  { key: "assigned_to", label: "Assignee" },
  { key: "due_at", label: "Due" },
  { key: "completed_at", label: "Completed" },
  { key: "created_at", label: "Created" },
  { key: "updated_at", label: "Updated" },
];

export const ANALYTICS_COLUMNS = [
  { key: "bucket", label: "Bucket" },
  { key: "count", label: "Count" },
];
