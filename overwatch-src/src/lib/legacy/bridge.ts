/**
 * Server-side write path to the legacy EADB (edge function
 * `legacy-bridge-write`, deployed on EADB). Replaces direct writes with the
 * EADB anon key so EADB's anon write policies can be removed
 * (supabase/migrations/eadb/20261006120500_eadb_remove_anon_writes.sql).
 *
 * The function verifies the caller's Overwatch session and company role
 * itself; we send the Overwatch access token and the active company id.
 *
 * NEXT_PUBLIC_LEGACY_BRIDGE_MODE:
 *   "auto" (default) - use the function; if it is not deployed yet (404,
 *                       503 or a network/CORS failure) fall back to the old
 *                       direct anon write. Lets this ship before the deploy.
 *   "server"         - function only, never fall back. Set this once the
 *                       function is deployed and the EADB migration applied.
 */

import { createClient } from "@/lib/supabase/client";
import { useAuthStore } from "@/stores/auth-store";

export type LegacyBridgeOp =
  | "course.create" | "course.update" | "course.delete"
  | "module.create" | "module.update"
  | "slide.create" | "slide.update" | "slide.delete"
  | "class.create" | "class.update" | "class.enroll" | "class.unenroll" | "class.attendance"
  | "assessment.create" | "assessment.update" | "assessment.set_questions" | "assessment.get_questions"
  | "certificate.issue" | "instructor.ensure" | "student.ensure";

export type LegacyBridgeArgs = {
  keys?: Record<string, unknown>;
  values?: Record<string, unknown>;
};

export type LegacyBridgeResult =
  | { status: "ok"; id?: string; data?: unknown }
  | { status: "error"; error: string; httpStatus?: number }
  | { status: "unavailable" };

const UNAVAILABLE_TTL_MS = 5 * 60_000;
let unavailableUntil = 0;

function mode(): "auto" | "server" {
  return process.env.NEXT_PUBLIC_LEGACY_BRIDGE_MODE === "server" ? "server" : "auto";
}

/** Test hook. */
export function _resetLegacyBridgeState() {
  unavailableUntil = 0;
}

function unavailable(reason: string, httpStatus?: number): LegacyBridgeResult {
  if (mode() === "server") return { status: "error", error: reason, httpStatus };
  unavailableUntil = Date.now() + UNAVAILABLE_TTL_MS;
  return { status: "unavailable" };
}

export async function legacyBridgeWrite(op: LegacyBridgeOp, args: LegacyBridgeArgs = {}): Promise<LegacyBridgeResult> {
  const legacyUrl = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_URL ?? "";
  const legacyAnon = process.env.NEXT_PUBLIC_LEGACY_SUPABASE_ANON_KEY ?? "";
  if (!legacyUrl) return unavailable("legacy_not_configured");
  if (mode() === "auto" && Date.now() < unavailableUntil) return { status: "unavailable" };

  const { data } = await createClient().auth.getSession();
  const token = data.session?.access_token;
  if (!token) return { status: "error", error: "not_signed_in" };
  const companyId = useAuthStore.getState().activeCompanyId;

  let res: Response;
  try {
    res = await fetch(`${legacyUrl}/functions/v1/legacy-bridge-write`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        ...(legacyAnon ? { apikey: legacyAnon } : {}),
        ...(companyId ? { "x-overwatch-company": companyId } : {}),
      },
      body: JSON.stringify({ op, args }),
    });
  } catch {
    // Not deployed yet usually shows up as a CORS/network failure.
    return unavailable("network");
  }

  const body = (await res.json().catch(() => ({}))) as { ok?: boolean; id?: string; data?: unknown; error?: string };
  if (res.status === 404 && body.error !== "unknown_op") return unavailable("bridge_not_deployed", 404);
  if (res.status === 503) return unavailable(body.error ?? "bridge_unavailable", 503);
  if (!res.ok) return { status: "error", error: body.error ?? `http_${res.status}`, httpStatus: res.status };
  return { status: "ok", ...(body.id ? { id: body.id } : {}), ...(body.data !== undefined ? { data: body.data } : {}) };
}

/**
 * Convenience for the legacy write helpers: returns the result in their
 * `{ success, id? }` shape, or null when the caller should fall back to the
 * direct write.
 */
export async function viaLegacyBridge(
  op: LegacyBridgeOp,
  args: LegacyBridgeArgs,
): Promise<{ success: boolean; id?: string; data?: unknown; error?: string } | null> {
  const r = await legacyBridgeWrite(op, args);
  if (r.status === "unavailable") return null;
  if (r.status === "error") {
    console.error(`Legacy bridge ${op} error:`, r.error);
    return { success: false, error: r.error };
  }
  return { success: true, ...(r.id ? { id: r.id } : {}), ...(r.data !== undefined ? { data: r.data } : {}) };
}

/** Plain-words message for a failed Instructor HQ save (shown in an alert). */
export function legacyWriteErrorMessage(action: string, error?: string): string {
  const why: Record<string, string> = {
    forbidden: "your role in this company can't edit training content",
    not_signed_in: "you're signed out; sign in again",
    invalid_session: "your session expired; sign in again",
    missing_company: "no active company is selected",
    course_in_use: "students, payments or reviews are attached to it. Edit it and untick Active to hide it instead",
    bridge_required: "this needs the Instructor HQ server, which isn't reachable right now",
    unknown_op: "the Instructor HQ server needs an update for this",
    conflict: "that code or name is already used",
    not_found: "it no longer exists (refresh the page)",
  };
  const reason = error ? (why[error] ?? (error.startsWith("invalid_value:") || error.startsWith("missing:")
    ? `check the "${error.split(":")[1].replace(/_/g, " ")}" field` : error)) : "unknown error";
  return `Couldn't ${action}: ${reason}.`;
}
