import { createClient } from "./client";
import { ensureInternalUser } from "./db-helpers";

// ─── Time Off ─────────────────────────────────────────

export async function getTimeOffRequests() {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("time_off_requests")
    .select("*, time_off_policies(name, type)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

// ─── Time Off (create request) ───────────────────────

export async function getTimeOffPolicies(companyId: string) {
  const supabase = createClient();
  const { data } = await supabase
    .from("time_off_policies")
    .select("*")
    .eq("company_id", companyId)
    .order("name", { ascending: true });
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

export async function createTimeOffPolicy(params: {
  companyId: string;
  name: string;
  type: string;
}) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_off_policies")
    .insert({
      id: crypto.randomUUID(),
      company_id: params.companyId,
      name: params.name,
      type: params.type,
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
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
    .select("*, time_off_policies!inner(name, type, company_id), users:user_id(first_name, last_name, avatar_url)")
    .eq("time_off_policies.company_id", companyId)
    .order("created_at", { ascending: false });
  if (error) console.error("getAllTimeOffRequests error:", error);
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
  // Find all shifts assigned to this user that overlap with the leave window.
  // A shift overlaps if: shift.start_time < leave_end AND shift.end_time > leave_start
  const leaveStart = new Date(startDate);
  leaveStart.setHours(0, 0, 0, 0);
  const leaveEnd = new Date(endDate);
  leaveEnd.setHours(23, 59, 59, 999);

  const { data: conflicting } = await supabase
    .from("shifts")
    .select("*, events(id, name, location, company_id)")
    .eq("assigned_user_id", userId)
    .lt("start_time", leaveEnd.toISOString())
    .gt("end_time", leaveStart.toISOString());

  if (!conflicting?.length) return [];

  // Unassign the user from each conflicting shift (set to open)
  for (const shift of conflicting) {
    await supabase
      .from("shifts")
      .update({ assigned_user_id: null, status: "open" })
      .eq("id", shift.id);
  }

  return conflicting;
}
