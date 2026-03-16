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
  const { data } = await supabase
    .from("time_off_requests")
    .select("*, time_off_policies!inner(name, type, company_id), users(first_name, last_name)")
    .eq("time_off_policies.company_id", companyId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

export async function deleteTimeOffRequest(requestId: string) {
  const supabase = createClient();
  const { error } = await supabase.from("time_off_requests").delete().eq("id", requestId);
  if (error) throw error;
}
