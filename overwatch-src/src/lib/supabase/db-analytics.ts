import { createClient } from "./client";
import { parseUTC } from "@/lib/parse-utc";

// ─── Company stats (for Intel page) ─────────────────

export async function getCompanyStats(companyId: string) {
  const supabase = createClient();

  // Get member user IDs for this company to scope timesheets
  const { data: memberRows } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");
  const memberUserIds = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);

  const [members, events, assets, forms] = await Promise.all([
    supabase.from("company_memberships").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("forms").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
  ]);

  let totalHours = 0;
  if (memberUserIds.length > 0) {
    const { data: sheets } = await supabase
      .from("timesheets")
      .select("clock_in, clock_out")
      .in("user_id", memberUserIds)
      .not("clock_out", "is", null)
      .limit(500);
    for (const t of sheets ?? []) {
      if (t.clock_in && t.clock_out) {
        totalHours += (parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000;
      }
    }
  }

  return {
    memberCount: members.count ?? 0,
    eventCount: events.count ?? 0,
    assetCount: assets.count ?? 0,
    formCount: forms.count ?? 0,
    totalHoursLogged: Math.round(totalHours * 10) / 10,
  };
}

// ─── Dashboard Metrics ───────────────────────────────

export async function getDashboardMetrics(companyId: string) {
  const supabase = createClient();
  const now = new Date().toISOString();
  const todayStart = new Date(); todayStart.setHours(0,0,0,0);
  const todayISO = todayStart.toISOString();

  const [
    { count: activePersonnel },
    { count: openIncidents },
    { count: todayPatrols },
    { count: pendingReports },
    { count: totalStaff },
    { count: upcomingShifts },
  ] = await Promise.all([
    supabase.from("timesheets").select("id", { count: "exact", head: true })
      .is("clock_out", null),
    supabase.from("incidents").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).in("status", ["open", "investigating"]),
    supabase.from("patrol_logs").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).gte("scanned_at", todayISO),
    supabase.from("form_submissions").select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase.from("company_memberships").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "active"),
    supabase.from("shifts").select("id", { count: "exact", head: true })
      .gte("start_time", now).eq("status", "open"),
  ]);

  return {
    activePersonnel: activePersonnel ?? 0,
    openIncidents: openIncidents ?? 0,
    todayPatrols: todayPatrols ?? 0,
    pendingReports: pendingReports ?? 0,
    totalStaff: totalStaff ?? 0,
    upcomingShifts: upcomingShifts ?? 0,
  };
}

// ─── Intel Data (real analytics, no fakes) ──────────

export async function getIntelData(companyId: string) {
  const supabase = createClient();

  // Get member user IDs for this company
  const { data: memberRows } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");
  const memberUserIds = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);

  // --- Weekly hours by day (last 7 days) ---
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weeklyHours = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun mapped to last 7 days
  if (memberUserIds.length > 0) {
    const { data: sheets } = await supabase
      .from("timesheets")
      .select("clock_in, clock_out")
      .in("user_id", memberUserIds)
      .not("clock_out", "is", null)
      .gte("clock_in", weekStart.toISOString())
      .limit(500);
    for (const t of sheets ?? []) {
      if (t.clock_in && t.clock_out) {
        const dayIdx = Math.min(6, Math.floor(
          (parseUTC(t.clock_in).getTime() - weekStart.getTime()) / 86400000
        ));
        if (dayIdx >= 0) {
          weeklyHours[dayIdx] += (parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000;
        }
      }
    }
  }
  const roundedWeeklyHours = weeklyHours.map((h) => Math.round(h * 10) / 10);

  // --- Weekly incidents by day (last 7 days) ---
  const weeklyIncidents = [0, 0, 0, 0, 0, 0, 0];
  const { data: incRows } = await supabase
    .from("incidents")
    .select("created_at")
    .eq("company_id", companyId)
    .gte("created_at", weekStart.toISOString())
    .limit(500);
  for (const inc of incRows ?? []) {
    if (inc.created_at) {
      const dayIdx = Math.min(6, Math.floor(
        (parseUTC(inc.created_at).getTime() - weekStart.getTime()) / 86400000
      ));
      if (dayIdx >= 0) weeklyIncidents[dayIdx]++;
    }
  }

  // --- Personnel status (real) ---
  let onDuty = 0;
  if (memberUserIds.length > 0) {
    const { count } = await supabase
      .from("timesheets")
      .select("id", { count: "exact", head: true })
      .in("user_id", memberUserIds)
      .is("clock_out", null);
    onDuty = count ?? 0;
  }
  const { count: onLeaveCount } = await supabase
    .from("time_off_requests")
    .select("id", { count: "exact", head: true })
    .eq("status", "approved")
    .lte("start_date", new Date().toISOString().split("T")[0])
    .gte("end_date", new Date().toISOString().split("T")[0]);
  const onLeave = onLeaveCount ?? 0;
  const totalMembers = memberUserIds.length;
  const offDuty = Math.max(0, totalMembers - onDuty - onLeave);

  // --- Activity summary (real counts) ---
  const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
  const todayISO = todayStart.toISOString();
  const [
    { count: patrolCount },
    { count: trainingCount },
    { count: shiftCount },
  ] = await Promise.all([
    supabase.from("patrol_logs").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).gte("scanned_at", todayISO),
    supabase.from("student_module_progress").select("id", { count: "exact", head: true })
      .eq("status", "completed"),
    supabase.from("shifts").select("id", { count: "exact", head: true })
      .gte("start_time", weekStart.toISOString()),
  ]);

  // Day labels for the 7-day window
  const dayLabels = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d.getDay()];
  });

  return {
    weeklyHours: roundedWeeklyHours,
    weeklyIncidents,
    dayLabels,
    personnel: { onDuty, offDuty, onLeave, total: totalMembers },
    activity: {
      patrols: patrolCount ?? 0,
      training: trainingCount ?? 0,
      shifts: shiftCount ?? 0,
    },
  };
}
