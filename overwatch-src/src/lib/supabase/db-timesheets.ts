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

export async function getTimesheetsForDateRange(startISO: string, endISO: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const { data } = await supabase
    .from("timesheets")
    .select("*")
    .eq("user_id", userId)
    .not("clock_out", "is", null)
    .gte("clock_in", startISO)
    .lte("clock_in", endISO)
    .order("clock_in", { ascending: true });
  return data ?? [];
}

// ─── Time Change Requests ────────────────────────────

export async function createTimeChangeRequest(params: {
  timesheetId: string;
  companyId: string;
  requestedClockIn?: string;
  requestedClockOut?: string;
  reason: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("time_change_requests")
    .insert({
      id: crypto.randomUUID(),
      timesheet_id: params.timesheetId,
      user_id: userId,
      company_id: params.companyId,
      requested_clock_in: params.requestedClockIn ?? null,
      requested_clock_out: params.requestedClockOut ?? null,
      reason: params.reason,
      status: "pending",
      created_at: new Date().toISOString(),
    })
    .select()
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getMyTimeChangeRequests() {
  try {
    const userId = await ensureInternalUser();
    if (!userId) return [];
    const supabase = createClient();
    const { data, error } = await supabase
      .from("time_change_requests")
      .select("*, timesheets(clock_in, clock_out)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    if (error) return [];
    return data ?? [];
  } catch { return []; }
}

export async function getCompanyTimeChangeRequests(companyId: string) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("time_change_requests")
      .select("*, timesheets(clock_in, clock_out), users(first_name, last_name)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return [];
    return data ?? [];
  } catch { return []; }
}

export async function reviewTimeChangeRequest(requestId: string, status: "approved" | "denied") {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();

  const { data: req, error: fetchErr } = await supabase
    .from("time_change_requests")
    .update({
      status,
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", requestId)
    .select("*, timesheets(id)")
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  // If approved, update the actual timesheet
  if (status === "approved" && req) {
    const updates: Record<string, unknown> = {};
    if (req.requested_clock_in) updates.clock_in = req.requested_clock_in;
    if (req.requested_clock_out) updates.clock_out = req.requested_clock_out;
    if (Object.keys(updates).length > 0) {
      await supabase
        .from("timesheets")
        .update(updates)
        .eq("id", req.timesheet_id);
    }
  }

  return req;
}
