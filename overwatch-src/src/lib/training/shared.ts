/**
 * Training data (courses, modules, slides, assessments, classes, learners) now lives in
 * OverwatchDB. EADB and the legacy-bridge-write function are retired (EADB retirement,
 * phase 6). Everything here is scoped to the ACTIVE company; RLS limits it to members
 * (read) and owner/admin/manager/instructor (write) of that company.
 */
import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

export type WriteResult = { success: boolean; id?: string; error?: string };

export function db() {
  return createClient();
}

export function activeCompanyId(): string | null {
  return useAuthStore.getState().activeCompanyId ?? null;
}

type PgError = { code?: string; message?: string; details?: string | null } | null | undefined;

/** Server error -> the short codes trainingWriteErrorMessage() knows. */
export function errorCode(e: PgError): string {
  if (!e) return "unknown";
  const m = (e.message ?? "").trim();
  if (/^(course_in_use|assessment_in_use|not_found|forbidden|quiz_not_found|no_attempts_left)$/.test(m)) return m;
  if (m.startsWith("missing:") || m.startsWith("invalid_value:")) return m;
  if (e.code === "quiz_not_found" || e.code === "no_attempts_left") return e.code;
  if (e.code === "42501") return "forbidden";
  if (e.code === "23505") return "conflict";
  if (e.code === "23514" || e.code === "22023") return m || "invalid_value";
  if (e.code === "PGRST116") return "not_found";
  return m || e.code || "unknown";
}

export function fail(context: string, e: PgError): WriteResult {
  console.error(`Training: ${context} error:`, e);
  return { success: false, error: errorCode(e) };
}

/** For UPDATE/DELETE: RLS hides rows you can't change, so 0 rows means "not yours or gone". */
export function rowsOrMissing(rows: unknown[] | null): WriteResult {
  return rows && rows.length > 0 ? { success: true } : { success: false, error: "not_saved" };
}

export function nowIso(): string {
  return new Date().toISOString();
}

/** Plain-words message for a failed Instructor HQ save (shown in an alert). */
export function trainingWriteErrorMessage(action: string, error?: string): string {
  const why: Record<string, string> = {
    forbidden: "your role in this company can't edit training content",
    not_signed_in: "you're signed out; sign in again",
    missing_company: "no active company is selected",
    course_in_use: "students or payments are attached to it. Edit it and untick Active to hide it instead",
    assessment_in_use: "students have already taken it, and deleting it would erase their results. Edit it and set \"No linked module\" to take it out of the course instead",
    conflict: "that code or name is already used",
    not_found: "it no longer exists (refresh the page)",
    not_saved: "it no longer exists or your role can't change it (refresh the page)",
  };
  const reason = error ? (why[error] ?? (error.startsWith("invalid_value:") || error.startsWith("missing:")
    ? `check the "${error.split(":")[1].replace(/_/g, " ")}" field` : error)) : "unknown error";
  return `Couldn't ${action}: ${reason}.`;
}
