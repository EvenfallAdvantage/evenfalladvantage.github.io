/**
 * CSV Export Utility
 * Converts arrays of objects to CSV and triggers a browser download.
 */

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
  { key: "clock_in", label: "Clock In" },
  { key: "clock_out", label: "Clock Out" },
  { key: "break_minutes", label: "Break (min)" },
  { key: "approved", label: "Approved" },
  { key: "notes", label: "Notes" },
];

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
  { key: "users.first_name", label: "First Name" },
  { key: "users.last_name", label: "Last Name" },
  { key: "users.email", label: "Email" },
  { key: "users.phone", label: "Phone" },
  { key: "role", label: "Role" },
  { key: "status", label: "Status" },
  { key: "title", label: "Title" },
  { key: "guard_card_number", label: "Guard Card #" },
];
