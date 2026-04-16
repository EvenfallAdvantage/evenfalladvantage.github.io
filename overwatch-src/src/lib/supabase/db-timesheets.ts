import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Timesheets (Watch Log) ──────────────────────────────

export async function getActiveTimesheet(companyId?: string) {
  const userId = await ensureInternalUser();
  if (!userId) return null;

  const supabase = createClient();
  let query = supabase
    .from("timesheets")
    .select("*, shifts(id, role, start_time, end_time, events(id, name, location)), events(id, name, location)")
    .eq("user_id", userId)
    .is("clock_out", null)
    .order("clock_in", { ascending: false })
    .limit(1);

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query.maybeSingle();
  if (error) { logDbReadError("active timesheet", error); return null; }
  return data;
}

export async function clockIn(params?: {
  shiftId?: string;
  eventId?: string;
  companyId?: string;
  clockInType?: "shift" | "admin" | "manual";
  notes?: string;
}) {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");

  const supabase = createClient();

  // Resolve company_id: from params, or from the event, or from the shift
  let companyId = params?.companyId ?? null;
  if (!companyId && params?.eventId) {
    const { data: ev } = await supabase.from("events").select("company_id").eq("id", params.eventId).maybeSingle();
    companyId = ev?.company_id ?? null;
  }
  if (!companyId && params?.shiftId) {
    const { data: sh } = await supabase.from("shifts").select("events(company_id)").eq("id", params.shiftId).maybeSingle();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    companyId = (sh as any)?.events?.company_id ?? null;
  }

  const { data, error } = await supabase
    .from("timesheets")
    .insert({
      id: crypto.randomUUID(),
      user_id: userId,
      clock_in: new Date().toISOString(),
      clock_method: "app",
      shift_id: params?.shiftId ?? null,
      event_id: params?.eventId ?? null,
      company_id: companyId,
      clock_in_type: params?.clockInType ?? "shift",
      notes: params?.notes ?? null,
      ...ts(),
    })
    .select()
    .maybeSingle();

  if (error) throw error;
  return data;
}

/**
 * Find shifts for the current user that are active now or starting within ±30 min.
 * Used to auto-detect which operation a user should clock in for.
 */
export async function getActiveShiftsForClockIn(companyId: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() - 30 * 60 * 1000).toISOString();
  const windowEnd = new Date(now.getTime() + 30 * 60 * 1000).toISOString();

  // Shifts where: start_time is within ±30min of now, OR shift is currently active (started but not ended)
  const { data, error } = await supabase
    .from("shifts")
    .select("*, events!inner(id, name, location, company_id)")
    .eq("assigned_user_id", userId)
    .eq("events.company_id", companyId)
    .or(`and(start_time.gte.${windowStart},start_time.lte.${windowEnd}),and(start_time.lte.${now.toISOString()},end_time.gte.${now.toISOString()})`)
    .order("start_time", { ascending: true });

  if (error) { logDbReadError("active shifts for clock-in", error); return []; }
  return data ?? [];
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

export async function getRecentTimesheets(limit = 10, companyId?: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];

  const supabase = createClient();

  let query = supabase
    .from("timesheets")
    .select("*, events(id, name, location, company_id)")
    .eq("user_id", userId)
    .order("clock_in", { ascending: false })
    .limit(companyId ? limit * 2 : limit); // fetch extra for post-filter

  // Filter by company_id if available
  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const { data, error } = await query;
  if (error) { logDbReadError("recent timesheets", error); return []; }
  let results = data ?? [];

  // Fallback: for legacy timesheets without company_id, filter by event.company_id
  if (companyId && results.length === 0) {
    const { data: fallback } = await supabase
      .from("timesheets")
      .select("*, events(id, name, location, company_id)")
      .eq("user_id", userId)
      .is("company_id", null)
      .order("clock_in", { ascending: false })
      .limit(limit * 2);

    results = (fallback ?? []).filter((t: { events?: unknown }) => {
      const ev = t.events as { company_id?: string } | null;
      if (!ev) return false;
      return ev.company_id === companyId;
    });
  }

  return results.slice(0, limit);
}

// ─── Timesheet approval (admin) ──────────────────────

export async function getCompanyTimesheets(companyId: string) {
  const supabase = createClient();

  // Primary: filter by company_id (set on newer timesheets)
  const { data: directData, error: directErr } = await supabase
    .from("timesheets")
    .select("*, users!timesheets_user_id_fkey(first_name, last_name, avatar_url), events(id, name, location, pay_rate), shifts(id, role, events(id, name, location))")
    .eq("company_id", companyId)
    .order("clock_in", { ascending: false })
    .limit(50);

  if (directErr) { logDbReadError("company timesheets", directErr); return []; }
  if (directData && directData.length > 0) return directData;

  // Fallback for legacy timesheets without company_id:
  // Get member user IDs, then filter by user AND (event belongs to company OR no event)
  const { data: members } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");
  const userIds = (members ?? []).map((m: { user_id: string }) => m.user_id);
  if (userIds.length === 0) return [];

  const { data: allTimesheets } = await supabase
    .from("timesheets")
    .select("*, users!timesheets_user_id_fkey(first_name, last_name, avatar_url), events(id, name, location, pay_rate, company_id), shifts(id, role, events(id, name, location))")
    .in("user_id", userIds)
    .is("company_id", null)
    .order("clock_in", { ascending: false })
    .limit(100);

  // Filter: only include timesheets where event belongs to this company
  // Timesheets with no event AND no company_id are orphaned dev data — exclude them
  const filtered = (allTimesheets ?? []).filter((t: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ev = t.events as any;
    if (!ev) return false; // No event + no company_id = orphaned, don't show
    return ev.company_id === companyId;
  });

  return filtered.slice(0, 50);
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

export async function getTimesheetsForDateRange(startISO: string, endISO: string, companyId?: string) {
  const userId = await ensureInternalUser();
  if (!userId) return [];
  const supabase = createClient();
  let query = supabase
    .from("timesheets")
    .select("*")
    .eq("user_id", userId)
    .not("clock_out", "is", null)
    .gte("clock_in", startISO)
    .lte("clock_in", endISO)
    .order("clock_in", { ascending: true });

  if (companyId) {
    query = query.eq("company_id", companyId);
  }

  const result = await query;
  if (result.error) { logDbReadError("timesheets for date range", result.error); return []; }
  return result.data ?? [];
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
    if (error) { logDbReadError("time change requests", error); return []; }
    return data ?? [];
  } catch (err) { logDbReadError("time change requests", err); return []; }
}

export async function getCompanyTimeChangeRequests(companyId: string) {
  try {
    const supabase = createClient();
    const { data, error } = await supabase
      .from("time_change_requests")
      .select("*, timesheets(clock_in, clock_out), users!user_id(first_name, last_name, avatar_url)")
      .eq("company_id", companyId)
      .order("created_at", { ascending: false })
    .limit(1000);
    if (error) { logDbReadError("company time change requests", error); return []; }
    return data ?? [];
  } catch (err) { logDbReadError("company time change requests", err); return []; }
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
