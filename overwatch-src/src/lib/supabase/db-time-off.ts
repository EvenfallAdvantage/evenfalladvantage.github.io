import { createClient } from "./client";
import { ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Time Off ─────────────────────────────────────────

export async function getTimeOffRequests() {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_requests")
    .select("*, time_off_policies(name, type)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) { logDbReadError("time off requests", error); return []; }
  return data ?? [];
}

// ─── Time Off (create request) ───────────────────────

export async function getTimeOffPolicies(companyId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_policies")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
  if (error) { logDbReadError("time off policies", error); return []; }
  return data ?? [];
}

export async function createTimeOffRequest(params: {
  policyId: string;
  startDate: string;
  endDate: string;
  note?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_requests")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      policy_id: params.policyId,
      start_date: params.startDate,
      end_date: params.endDate,
      note: params.note ?? null,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select("*, time_off_policies(name, type)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

// ─── Time-off policy CRUD (admin) ────────────────────

export type TimeOffPolicyFields = {
  name?: string;
  type?: string;
  accrualRate?: number | null;
  accrualPeriod?: string | null;
  maxBalance?: number | null;
  isPaid?: boolean;
};

function policyRow(f: TimeOffPolicyFields) {
  const row: Record<string, unknown> = {};
  if (f.name !== undefined) row.name = f.name;
  if (f.type !== undefined) row.type = f.type;
  if (f.accrualRate !== undefined) row.accrual_rate = f.accrualRate;
  if (f.accrualPeriod !== undefined) row.accrual_period = f.accrualPeriod;
  if (f.maxBalance !== undefined) row.max_balance = f.maxBalance;
  // is_paid is added by migration 20261007180000; only send when set.
  if (f.isPaid !== undefined) row.is_paid = f.isPaid;
  return row;
}

/** PostgREST "column not found" (schema cache): is_paid before the migration is applied. */
const isMissingColumn = (e: { code?: string; message?: string } | null) =>
  !!e && (e.code === "PGRST204" || /is_paid/.test(e.message ?? ""));

export async function updateTimeOffPolicy(policyId: string, fields: TimeOffPolicyFields) {
  const supabase = createClient();
  const run = (row: Record<string, unknown>) =>
    supabase.from("time_off_policies").update(row).eq("id", policyId).select().maybeSingle();
  let { data, error } = await run(policyRow(fields));
  if (isMissingColumn(error) && fields.isPaid !== undefined) {
    ({ data, error } = await run(policyRow({ ...fields, isPaid: undefined })));
  }
  if (error) throw error;
  if (!data) throw new Error("Policy not updated (no permission?)");
  return data;
}

export async function createTimeOffPolicy(params: {
  companyId: string;
  name: string;
  type: string;
} & Omit<TimeOffPolicyFields, "name" | "type">) {
  const supabase = createClient();
  const row = {
    id: crypto.randomUUID(),
    company_id: params.companyId,
    ...policyRow({ accrualRate: params.accrualRate, accrualPeriod: params.accrualPeriod, maxBalance: params.maxBalance, isPaid: params.isPaid }),
    name: params.name,
    type: params.type,
    created_at: new Date().toISOString(),
  };
  const run = (r: Record<string, unknown>) =>
    supabase.from("time_off_policies").insert(r).select().maybeSingle();
  let { data, error } = await run(row);
  if (isMissingColumn(error) && "is_paid" in row) {
    const { is_paid: _ignored, ...rest } = row as Record<string, unknown>;
    void _ignored;
    ({ data, error } = await run(rest));
  }
  if (error) throw error;
  return data;
}

export async function deleteTimeOffPolicy(policyId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("time_off_policies").delete().eq("id", policyId);
  if (error) throw error;
}

// ─── Leave request approve / deny (admin) ────────────

export async function reviewTimeOffRequest(requestId: string, status: "approved" | "denied") {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_requests")
    .update({ status, reviewed_by_id: userId, reviewed_at: new Date().toISOString() })
    .eq("id", requestId)
    .select("*, time_off_policies(name, type)")
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getAllTimeOffRequests(companyId: string) {
  const supabase = createClient();
  // time_off_requests has TWO FKs to users (user_id + reviewed_by_id),
  // so we must disambiguate with !time_off_requests_user_id_fkey
  const { data, error } = await supabase
    .from("time_off_requests")
    .select("*, time_off_policies!inner(name, type, company_id), users:user_id(first_name, last_name, callsign, avatar_url)")
    .eq("time_off_policies.company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) { logDbReadError("all time off requests", error); return []; }
  return data ?? [];
}

export async function deleteTimeOffRequest(requestId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("time_off_requests").delete().eq("id", requestId);
  if (error) throw error;
}

// ─── Remove shifts that conflict with approved leave ──

export async function removeConflictingShifts(userId: string, startDate: string, endDate: string) {
  const supabase = createClient();
  // Build UTC boundaries directly from date strings to avoid local-timezone issues.
  // startDate / endDate are "YYYY-MM-DD" strings from the leave request.
  const leaveStartISO = `${startDate}T00:00:00.000Z`;
  const leaveEndISO = `${endDate}T23:59:59.999Z`;

  // A shift overlaps if: shift.start_time <= leave_end AND shift.end_time >= leave_start
  const { data: conflicting, error: qErr } = await supabase
    .from("shifts")
    .select("*, events(id, name, location, company_id)")
    .eq("assigned_user_id", userId)
    .lte("start_time", leaveEndISO)
    .gte("end_time", leaveStartISO);

  if (qErr) console.error("removeConflictingShifts query error:", qErr);
  if (!conflicting?.length) return [];

  // Unassign the user from all conflicting shifts in a single bulk update
  const shiftIds = conflicting.map((s: { id: string }) => s.id);
  if (shiftIds.length > 0) {
    const { error: uErr } = await supabase
      .from("shifts")
      .update({ assigned_user_id: null, status: "open" })
      .in("id", shiftIds);
    if (uErr) console.error("Failed to unassign shifts:", uErr);
  }

  return conflicting;
}
