import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";

// ─── Timesheets (Watch Log) ──────────────────────────────

export async function getActiveTimesheet() {
  const userId = await ensureInternalUser();
  if (!userId) return null;

  const supabase = createClient();
  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("user_id", userId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1)
    .maybeSingle();

  return data;
}

export async function clockIn() {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createClient();

  const { data, error } = await supabase
    .from("timesheets")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      clock_in: new Date().toISOString(),
      clock_method: "app",
      ...ts(),
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function clockOut(timesheetId: string) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("timesheets")
    .update({ clock_out: new Date().toISOString() })
    .eq("id", timesheetId)
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

export async function getRecentTimesheets(limit = 10) {
  const userId = await ensureInternalUser();
  if (!userId) return [];

  const supabase = createClient();

  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("user_id", userId)
    .order("clock_in", { ascending: false })
    .limit(limit);

  return data ?? [];
}

// ─── Timesheet approval (admin) ──────────────────────

export async function getCompanyTimesheets(companyId: string) {
  const supabase = createClient();
  // Get member user IDs first, then filter timesheets at DB level
  const { data: members } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");
  const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length === 0) return [];
  const { data } = await supabase
    .from("timesheets")
    .select("*, users!timesheets_user_id_fkey(first_name, last_name)")
    .in("user_id", userIds)
    .order("clock_in", { ascending: false })
    .limit(50);
  return data ?? [];
}

export async function approveTimesheet(timesheetId: string) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("timesheets")
    .update({ approved: true, approved_by_id: userId, approved_at: new Date().toISOString() })
    .eq("id", timesheetId)
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}
