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

// ─── Owner Intel (enhanced dashboard data) ────────────

export async function getOwnerIntel(companyId: string) {
  const supabase = createClient();

  // --- Hiring Pipeline ---
  const { data: applicants } = await supabase
    .from("applicants")
    .select("id, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);
  const appList = applicants ?? [];
  const pipeline = {
    new: appList.filter(a => a.status === "new" || a.status === "pending").length,
    interview: appList.filter(a => a.status === "interview").length,
    hired: appList.filter(a => a.status === "hired").length,
    rejected: appList.filter(a => a.status === "rejected").length,
    total: appList.length,
    recentApplicants: appList.slice(0, 5).map(a => ({
      id: a.id,
      status: a.status,
      createdAt: a.created_at,
    })),
  };

  // --- Pending Approvals ---
  const [
    { count: pendingTimeCorrections },
    { count: pendingLeave },
    { count: pendingForms },
    { count: unapprovedTimesheets },
  ] = await Promise.all([
    supabase.from("time_change_requests").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "pending"),
    supabase.from("time_off_requests").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "pending"),
    supabase.from("form_submissions").select("id", { count: "exact", head: true })
      .eq("status", "submitted"),
    supabase.from("timesheets").select("id", { count: "exact", head: true })
      .eq("approved", false).not("clock_out", "is", null),
  ]);
  const approvals = {
    timeCorrections: pendingTimeCorrections ?? 0,
    leaveRequests: pendingLeave ?? 0,
    formReviews: pendingForms ?? 0,
    timesheets: unapprovedTimesheets ?? 0,
    total: (pendingTimeCorrections ?? 0) + (pendingLeave ?? 0) + (pendingForms ?? 0) + (unapprovedTimesheets ?? 0),
  };

  // --- Integration Health ---
  const { data: integrations } = await supabase
    .from("integrations_config")
    .select("provider, is_active")
    .eq("company_id", companyId);
  const intList = integrations ?? [];
  const integrationHealth = {
    active: intList.filter(i => i.is_active).length,
    configured: intList.length,
    providers: intList.map(i => ({ provider: i.provider as string, active: i.is_active as boolean })),
  };

  // --- Onboarding Status ---
  const { data: onboarding } = await supabase
    .from("company_memberships")
    .select("id, user_id, onboarding_complete, hire_date, users:user_id(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("status", "onboarding")
    .order("hire_date", { ascending: false })
    .limit(10);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const onboardingList = (onboarding ?? []).map((m: any) => {
    const u = Array.isArray(m.users) ? m.users[0] : m.users;
    return {
      id: m.id as string,
      name: u ? `${u.first_name} ${u.last_name}` : "Unknown",
      complete: m.onboarding_complete as boolean,
      hireDate: m.hire_date as string,
    };
  });

  // --- Payroll Readiness ---
  const memberRows2 = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");
  const uids = (memberRows2.data ?? []).map((m: { user_id: string }) => m.user_id);
  let approvedHours = 0;
  let totalSheetHours = 0;
  if (uids.length > 0) {
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - 13); // last 2 weeks
    weekStart.setHours(0, 0, 0, 0);
    const { data: sheets } = await supabase
      .from("timesheets")
      .select("clock_in, clock_out, approved")
      .in("user_id", uids)
      .not("clock_out", "is", null)
      .gte("clock_in", weekStart.toISOString())
      .limit(500);
    for (const t of sheets ?? []) {
      if (t.clock_in && t.clock_out) {
        const hrs = (parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000;
        totalSheetHours += hrs;
        if (t.approved) approvedHours += hrs;
      }
    }
  }
  const payroll = {
    approvedHours: Math.round(approvedHours * 10) / 10,
    totalHours: Math.round(totalSheetHours * 10) / 10,
    unapprovedHours: Math.round((totalSheetHours - approvedHours) * 10) / 10,
    readyPct: totalSheetHours > 0 ? Math.round((approvedHours / totalSheetHours) * 100) : 100,
  };

  // --- Notifications (last 7 days) ---
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const { count: notifCount } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("company_id", companyId)
    .gte("created_at", weekAgo.toISOString());

  return {
    pipeline,
    approvals,
    integrationHealth,
    onboarding: onboardingList,
    payroll,
    notificationsSent: notifCount ?? 0,
  };
}
