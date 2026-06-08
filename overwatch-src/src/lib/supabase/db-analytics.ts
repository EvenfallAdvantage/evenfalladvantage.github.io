import { createClient } from "./client";
import { parseUTC } from "@/lib/parse-utc";
import { logDbReadError } from "./db-error";

// ─── Company stats (for Intel page) ─────────────────

export async function getCompanyStats(companyId: string) {
  const supabase = createClient();

  // Get member user IDs for this company to scope timesheets
  const { data: memberRows, error: memberErr } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");
  if (memberErr) logDbReadError("company stats (members)", memberErr);
  const memberUserIds = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);

  const [members, events, assets, forms] = await Promise.all([
    supabase.from("company_memberships").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("status", "active"),
    supabase.from("events").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("assets").select("id", { count: "exact", head: true }).eq("company_id", companyId),
    supabase.from("forms").select("id", { count: "exact", head: true }).eq("company_id", companyId).eq("is_active", true),
  ]);

  let totalHours = 0;
  if (memberUserIds.length > 0) {
    // Fetch only clock_in/clock_out columns (not select *) and use company_id filter
    const { data: sheets, error: sheetsErr } = await supabase
      .from("timesheets")
      .select("clock_in, clock_out")
      .eq("company_id", companyId)
      .not("clock_out", "is", null)
      .limit(2000);
    if (sheetsErr) logDbReadError("company stats (timesheets)", sheetsErr);
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
    supabase.from("form_submissions").select("id, forms!inner(company_id)", { count: "exact", head: true })
      .eq("forms.company_id", companyId).eq("status", "submitted"),
    supabase.from("company_memberships").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "active"),
    supabase.from("shifts").select("id, events!inner(company_id)", { count: "exact", head: true })
      .eq("events.company_id", companyId).gte("start_time", now).is("assigned_user_id", null),
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

// ─── Dashboard Trends (7-day sparklines for KPI tiles) ─────

export interface DashboardTrends {
  /** Daily incident creation counts for the last 7 days (oldest first). */
  incidents: number[];
  /** Daily patrol log scans for the last 7 days. */
  patrols: number[];
  /** Daily form-submission counts for the last 7 days. */
  reports: number[];
  /** Daily incident creation counts indexed by ISO day for tooltips. */
  incidentsByDay: Record<string, number>;
}

/**
 * Returns lightweight 7-day daily counts to power the sparklines on
 * KpiCards. Designed to be cheap: each query reads created_at only and is
 * scoped to the company.
 */
export async function getDashboardTrends(companyId: string): Promise<DashboardTrends> {
  const supabase = createClient();
  const days: string[] = [];
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - 6);
  for (let i = 0; i < 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    days.push(d.toISOString().slice(0, 10));
  }
  const fromIso = `${days[0]}T00:00:00.000Z`;

  const [incidentsRes, patrolsRes, reportsRes] = await Promise.all([
    supabase
      .from("incidents")
      .select("created_at")
      .eq("company_id", companyId)
      .gte("created_at", fromIso)
      .limit(2000),
    supabase
      .from("patrol_logs")
      .select("scanned_at")
      .eq("company_id", companyId)
      .gte("scanned_at", fromIso)
      .limit(2000),
    supabase
      .from("form_submissions")
      .select("created_at, forms!inner(company_id)")
      .eq("forms.company_id", companyId)
      .gte("created_at", fromIso)
      .limit(2000),
  ]);

  if (incidentsRes.error) logDbReadError("dashboard trends (incidents)", incidentsRes.error);
  if (patrolsRes.error) logDbReadError("dashboard trends (patrols)", patrolsRes.error);
  if (reportsRes.error) logDbReadError("dashboard trends (reports)", reportsRes.error);

  const bucket = (rows: Array<{ [k: string]: string | null }>, col: string): number[] => {
    const series = new Array(7).fill(0);
    for (const r of rows) {
      const v = r[col];
      if (!v) continue;
      const day = v.slice(0, 10);
      const idx = days.indexOf(day);
      if (idx >= 0) series[idx] += 1;
    }
    return series;
  };

  const incidents = bucket(
    (incidentsRes.data ?? []) as Array<{ created_at: string | null }>,
    "created_at",
  );
  const patrols = bucket(
    (patrolsRes.data ?? []) as Array<{ scanned_at: string | null }>,
    "scanned_at",
  );
  const reports = bucket(
    (reportsRes.data ?? []) as Array<{ created_at: string | null }>,
    "created_at",
  );

  const incidentsByDay: Record<string, number> = {};
  for (let i = 0; i < 7; i++) incidentsByDay[days[i]] = incidents[i];

  return { incidents, patrols, reports, incidentsByDay };
}

// ─── Intel Data (real analytics, no fakes) ──────────

export async function getIntelData(companyId: string) {
  const supabase = createClient();

  // Get member user IDs for this company
  const { data: memberRows, error: memberErr } = await supabase
    .from("company_memberships")
    .select("user_id")
    .eq("company_id", companyId)
    .eq("status", "active");
  if (memberErr) logDbReadError("analytics (members)", memberErr);
  const memberUserIds = (memberRows ?? []).map((m: { user_id: string }) => m.user_id);

  // --- Weekly hours by day (last 7 days) ---
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  weekStart.setHours(0, 0, 0, 0);
  const weeklyHours = [0, 0, 0, 0, 0, 0, 0]; // Mon..Sun mapped to last 7 days
  if (memberUserIds.length > 0) {
    const { data: sheets, error: sheetsErr } = await supabase
      .from("timesheets")
      .select("clock_in, clock_out")
      .in("user_id", memberUserIds)
      .not("clock_out", "is", null)
      .gte("clock_in", weekStart.toISOString())
      .limit(500);
    if (sheetsErr) logDbReadError("analytics (weekly hours)", sheetsErr);
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
  const { data: incRows, error: incErr } = await supabase
    .from("incidents")
    .select("created_at")
    .eq("company_id", companyId)
    .gte("created_at", weekStart.toISOString())
    .limit(500);
  if (incErr) logDbReadError("analytics (weekly incidents)", incErr);
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
  const { data: applicants, error: appErr } = await supabase
    .from("applicants")
    .select("id, status, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (appErr) logDbReadError("owner intel (hiring pipeline)", appErr);
  const appList = applicants ?? [];
  const pipeline = {
    new: appList.filter((a: { status: string }) => a.status === "new" || a.status === "pending").length,
    interview: appList.filter((a: { status: string }) => a.status === "interview").length,
    hired: appList.filter((a: { status: string }) => a.status === "hired").length,
    rejected: appList.filter((a: { status: string }) => a.status === "rejected").length,
    total: appList.length,
    recentApplicants: appList.slice(0, 5).map((a: { id: string; status: string; created_at: string }) => ({
      id: a.id,
      status: a.status,
      createdAt: a.created_at,
    })),
  };

  // --- Pending Approvals (graceful: tables may not exist yet) ---
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const safeCount = async (p: any): Promise<{ count: number | null }> => {
    try { return await p; } catch { return { count: 0 }; }
  };
  const [
    { count: pendingTimeCorrections },
    { count: pendingLeave },
    { count: pendingForms },
    { count: unapprovedTimesheets },
  ] = await Promise.all([
    safeCount(supabase.from("time_change_requests").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("status", "pending")),
    safeCount(supabase.from("time_off_requests").select("id, time_off_policies!inner(company_id)", { count: "exact", head: true })
      .eq("time_off_policies.company_id", companyId).eq("status", "pending")),
    safeCount(supabase.from("form_submissions").select("id, forms!inner(company_id)", { count: "exact", head: true })
      .eq("forms.company_id", companyId).eq("status", "submitted")),
    safeCount(supabase.from("timesheets").select("id", { count: "exact", head: true })
      .eq("company_id", companyId).eq("approved", false).not("clock_out", "is", null)),
  ]);
  const approvals = {
    timeCorrections: pendingTimeCorrections ?? 0,
    leaveRequests: pendingLeave ?? 0,
    formReviews: pendingForms ?? 0,
    timesheets: unapprovedTimesheets ?? 0,
    total: (pendingTimeCorrections ?? 0) + (pendingLeave ?? 0) + (pendingForms ?? 0) + (unapprovedTimesheets ?? 0),
  };

  // --- Integration Health ---
  const { data: integrations, error: intErr } = await supabase
    .from("integrations_config")
    .select("provider, is_active")
    .eq("company_id", companyId);
  if (intErr) logDbReadError("owner intel (integrations)", intErr);
  const intList = integrations ?? [];
  const integrationHealth = {
    active: intList.filter((i: { is_active: boolean }) => i.is_active).length,
    configured: intList.length,
    providers: intList.map((i: { provider: string; is_active: boolean }) => ({ provider: i.provider as string, active: i.is_active as boolean })),
  };

  // --- Onboarding Status ---
  const { data: onboarding, error: onbErr } = await supabase
    .from("company_memberships")
    .select("id, user_id, onboarding_complete, hire_date, users:user_id(first_name, last_name)")
    .eq("company_id", companyId)
    .eq("status", "onboarding")
    .order("hire_date", { ascending: false })
    .limit(10);
  if (onbErr) logDbReadError("owner intel (onboarding)", onbErr);
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
      .eq("company_id", companyId)
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

// ─── Team metrics (Phase 3 / HaloFusion) ────────────────

export interface TeamMetrics {
  teamId: string;
  incidentsOpen: number;
  incidentsTotal: number;
  incidentsOverdue: number;
  tasksOpen: number;
  tasksTotal: number;
  tasksOverdue: number;
  recentTransfersIn: number;
  recentTransfersOut: number;
}

/**
 * Aggregate operational KPIs for a single team (open work + recent transfers).
 * "Overdue" = due_at in the past AND status not terminal.
 * "Recent" = last 7 days.
 */
export async function getTeamMetrics(
  companyId: string,
  teamId: string
): Promise<TeamMetrics> {
  const supabase = createClient();
  const nowIso = new Date().toISOString();
  const weekAgoIso = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const [
    incidentsTotal,
    incidentsOpen,
    incidentsOverdue,
    tasksTotal,
    tasksOpen,
    tasksOverdue,
    transfersIn,
  ] = await Promise.all([
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("team_id", teamId),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("team_id", teamId)
      .not("status", "in", "(resolved,closed)"),
    supabase
      .from("incidents")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("team_id", teamId)
      .lt("due_at", nowIso)
      .not("status", "in", "(resolved,closed)"),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("team_id", teamId),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("team_id", teamId)
      .in("status", ["todo", "in_progress", "blocked"]),
    supabase
      .from("tasks")
      .select("id", { count: "exact", head: true })
      .eq("company_id", companyId)
      .eq("team_id", teamId)
      .lt("due_at", nowIso)
      .in("status", ["todo", "in_progress", "blocked"]),
    // Recent transfers INTO this team = incident_updates rows of type 'transfer'
    // whose underlying incident currently has team_id=teamId, in last 7 days.
    supabase
      .from("incident_updates")
      .select("id, incidents!inner(team_id, company_id)", { count: "exact", head: true })
      .eq("type", "transfer")
      .eq("incidents.team_id", teamId)
      .eq("incidents.company_id", companyId)
      .gte("created_at", weekAgoIso),
  ]);

  return {
    teamId,
    incidentsTotal: incidentsTotal.count ?? 0,
    incidentsOpen: incidentsOpen.count ?? 0,
    incidentsOverdue: incidentsOverdue.count ?? 0,
    tasksTotal: tasksTotal.count ?? 0,
    tasksOpen: tasksOpen.count ?? 0,
    tasksOverdue: tasksOverdue.count ?? 0,
    recentTransfersIn: transfersIn.count ?? 0,
    // Transfers out are harder to attribute post-move without scanning content;
    // we leave this as 0 unless/until we add a dedicated audit table.
    recentTransfersOut: 0,
  };
}

/**
 * Aggregate metrics for every team in a company. Useful for the multi-team
 * dashboard at /teams.
 */
export async function getAllTeamMetrics(companyId: string): Promise<TeamMetrics[]> {
  const supabase = createClient();
  const { data: teams, error } = await supabase
    .from("teams")
    .select("id")
    .eq("company_id", companyId)
    .eq("is_archived", false);
  if (error) {
    logDbReadError("team metrics teams list", error);
    return [];
  }
  const teamIds = (teams ?? []).map((t: { id: string }) => t.id);
  return Promise.all(teamIds.map((id: string) => getTeamMetrics(companyId, id)));
}

// ─── Time-series analytics (Phase 5 / HaloInsights) ────────

export type TimeBucket = "day" | "week" | "month";

export interface AnalyticsFilters {
  from?: string; // ISO date
  to?: string;
  teamId?: string;
  groupBy?: TimeBucket; // for time series
}

export interface IncidentAnalytics {
  totalCount: number;
  openCount: number;
  resolvedCount: number;
  byStatus: Array<{ key: string; count: number }>;
  bySeverity: Array<{ key: string; count: number }>;
  byType: Array<{ key: string; count: number }>;
  byTeam: Array<{ teamId: string | null; count: number }>;
  byBucket: Array<{ bucket: string; count: number }>;
  /** Per-day raw counts (ISO date -> count); useful for HeatCalendar. */
  byDay: Record<string, number>;
}

export interface TaskAnalytics {
  totalCount: number;
  openCount: number;
  doneCount: number;
  overdueCount: number;
  completionRatePct: number;
  byStatus: Array<{ key: string; count: number }>;
  byPriority: Array<{ key: string; count: number }>;
  byTeam: Array<{ teamId: string | null; count: number }>;
  byAssignee: Array<{ assigneeId: string | null; count: number }>;
  byDay: Record<string, number>;
}

export interface MultiLogReport {
  range: { from: string; to: string };
  incidentsCount: number;
  tasksCount: number;
  patrolsCount: number;
  timesheetsCount: number;
  byDay: Record<string, { incidents: number; tasks: number; patrols: number; timesheets: number }>;
}

interface IncidentRow {
  id: string;
  status: string | null;
  severity: string | null;
  type: string | null;
  team_id: string | null;
  created_at: string;
}

interface TaskRow {
  id: string;
  status: string | null;
  priority: string | null;
  team_id: string | null;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  created_at: string;
}

function isoDay(iso: string): string {
  return iso.slice(0, 10); // YYYY-MM-DD
}

function isoWeek(iso: string): string {
  const d = new Date(iso);
  // Move to Thursday in current week (ISO week date) - this is the week's anchor.
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

function isoMonth(iso: string): string {
  return iso.slice(0, 7); // YYYY-MM
}

function bucketLabel(iso: string, groupBy: TimeBucket): string {
  if (groupBy === "day") return isoDay(iso);
  if (groupBy === "week") return isoWeek(iso);
  return isoMonth(iso);
}

function countBy<T, K extends string | null>(items: T[], key: (item: T) => K): Array<{ key: K; count: number }> {
  const m = new Map<K, number>();
  for (const item of items) {
    const k = key(item);
    m.set(k, (m.get(k) ?? 0) + 1);
  }
  return Array.from(m.entries())
    .map(([k, count]) => ({ key: k, count }))
    .sort((a, b) => b.count - a.count);
}

const OPEN_INCIDENT_STATUSES = ["open", "investigating", "in_progress", "triaging"];

/**
 * Incident-shaped analytics with optional time bucketing.
 */
export async function getIncidentAnalytics(
  companyId: string,
  filters: AnalyticsFilters = {},
): Promise<IncidentAnalytics> {
  const supabase = createClient();
  const groupBy: TimeBucket = filters.groupBy ?? "day";

  let q = supabase
    .from("incidents")
    .select("id, status, severity, type, team_id, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.teamId) q = q.eq("team_id", filters.teamId);

  const { data, error } = await q;
  if (error) {
    logDbReadError("incident analytics", error);
    return emptyIncidentAnalytics();
  }
  const rows = (data ?? []) as IncidentRow[];

  const byBucketMap = new Map<string, number>();
  const byDay: Record<string, number> = {};
  for (const r of rows) {
    const day = isoDay(r.created_at);
    byDay[day] = (byDay[day] ?? 0) + 1;
    const bucket = bucketLabel(r.created_at, groupBy);
    byBucketMap.set(bucket, (byBucketMap.get(bucket) ?? 0) + 1);
  }

  const openCount = rows.filter((r) => r.status && OPEN_INCIDENT_STATUSES.includes(r.status)).length;
  const resolvedCount = rows.filter((r) => r.status === "resolved").length;

  return {
    totalCount: rows.length,
    openCount,
    resolvedCount,
    byStatus: countBy(rows, (r) => r.status ?? "unknown"),
    bySeverity: countBy(rows, (r) => r.severity ?? "unknown"),
    byType: countBy(rows, (r) => r.type ?? "unknown"),
    byTeam: countBy(rows, (r) => r.team_id).map((x) => ({ teamId: x.key, count: x.count })),
    byBucket: Array.from(byBucketMap.entries())
      .map(([bucket, count]) => ({ bucket, count }))
      .sort((a, b) => (a.bucket < b.bucket ? -1 : 1)),
    byDay,
  };
}

function emptyIncidentAnalytics(): IncidentAnalytics {
  return {
    totalCount: 0,
    openCount: 0,
    resolvedCount: 0,
    byStatus: [],
    bySeverity: [],
    byType: [],
    byTeam: [],
    byBucket: [],
    byDay: {},
  };
}

const OPEN_TASK_STATUSES = ["todo", "in_progress", "blocked"];

/**
 * Task analytics with completion-rate calc and overdue detection.
 */
export async function getTaskAnalytics(
  companyId: string,
  filters: AnalyticsFilters = {},
): Promise<TaskAnalytics> {
  const supabase = createClient();
  let q = supabase
    .from("tasks")
    .select("id, status, priority, team_id, assigned_to, due_at, completed_at, created_at")
    .eq("company_id", companyId)
    .order("created_at", { ascending: true });

  if (filters.from) q = q.gte("created_at", filters.from);
  if (filters.to) q = q.lte("created_at", filters.to);
  if (filters.teamId) q = q.eq("team_id", filters.teamId);

  const { data, error } = await q;
  if (error) {
    logDbReadError("task analytics", error);
    return emptyTaskAnalytics();
  }
  const rows = (data ?? []) as TaskRow[];

  const nowIso = new Date().toISOString();
  const openCount = rows.filter((r) => r.status && OPEN_TASK_STATUSES.includes(r.status)).length;
  const doneCount = rows.filter((r) => r.status === "done").length;
  const overdueCount = rows.filter(
    (r) =>
      r.due_at !== null && r.due_at < nowIso && r.status && OPEN_TASK_STATUSES.includes(r.status),
  ).length;
  const completionRatePct =
    rows.length > 0 ? Math.round((doneCount / rows.length) * 100) : 0;

  const byDay: Record<string, number> = {};
  for (const r of rows) {
    const day = isoDay(r.created_at);
    byDay[day] = (byDay[day] ?? 0) + 1;
  }

  return {
    totalCount: rows.length,
    openCount,
    doneCount,
    overdueCount,
    completionRatePct,
    byStatus: countBy(rows, (r) => r.status ?? "unknown"),
    byPriority: countBy(rows, (r) => r.priority ?? "unknown"),
    byTeam: countBy(rows, (r) => r.team_id).map((x) => ({ teamId: x.key, count: x.count })),
    byAssignee: countBy(rows, (r) => r.assigned_to).map((x) => ({ assigneeId: x.key, count: x.count })),
    byDay,
  };
}

function emptyTaskAnalytics(): TaskAnalytics {
  return {
    totalCount: 0,
    openCount: 0,
    doneCount: 0,
    overdueCount: 0,
    completionRatePct: 0,
    byStatus: [],
    byPriority: [],
    byTeam: [],
    byAssignee: [],
    byDay: {},
  };
}

/**
 * Combined incident + task + patrol + timesheet activity series.
 * Returned as a per-day breakdown over the requested range.
 */
export async function getMultiLogReport(
  companyId: string,
  params: { from: string; to: string; teamId?: string },
): Promise<MultiLogReport> {
  const supabase = createClient();

  const buildBaseQuery = (table: string, dateCol = "created_at") => {
    let q = supabase
      .from(table)
      .select(`id, ${dateCol}, team_id`)
      .eq("company_id", companyId)
      .gte(dateCol, params.from)
      .lte(dateCol, params.to);
    if (params.teamId) q = q.eq("team_id", params.teamId);
    return q;
  };

  // Patrols + timesheets may not have team_id. We compose graceful fallbacks.
  const [incQ, tskQ] = await Promise.all([
    buildBaseQuery("incidents"),
    buildBaseQuery("tasks"),
  ]);

  // Patrols: no team_id column. Skip team filter for patrols.
  const [patQ, tmsQ] = await Promise.all([
    supabase
      .from("patrol_logs")
      .select("id, scanned_at")
      .eq("company_id", companyId)
      .gte("scanned_at", params.from)
      .lte("scanned_at", params.to),
    supabase
      .from("timesheets")
      .select("id, clock_in")
      .eq("company_id", companyId)
      .gte("clock_in", params.from)
      .lte("clock_in", params.to),
  ]);

  if (incQ.error) logDbReadError("multi-log incidents", incQ.error);
  if (tskQ.error) logDbReadError("multi-log tasks", tskQ.error);
  if (patQ.error) logDbReadError("multi-log patrols", patQ.error);
  if (tmsQ.error) logDbReadError("multi-log timesheets", tmsQ.error);

  const byDay: MultiLogReport["byDay"] = {};
  const bump = (kind: "incidents" | "tasks" | "patrols" | "timesheets", iso: string) => {
    const day = isoDay(iso);
    const existing = byDay[day] ?? { incidents: 0, tasks: 0, patrols: 0, timesheets: 0 };
    existing[kind] += 1;
    byDay[day] = existing;
  };

  for (const r of (incQ.data ?? []) as Array<{ created_at: string }>) bump("incidents", r.created_at);
  for (const r of (tskQ.data ?? []) as Array<{ created_at: string }>) bump("tasks", r.created_at);
  for (const r of (patQ.data ?? []) as Array<{ scanned_at: string }>) bump("patrols", r.scanned_at);
  for (const r of (tmsQ.data ?? []) as Array<{ clock_in: string }>) bump("timesheets", r.clock_in);

  return {
    range: { from: params.from, to: params.to },
    incidentsCount: (incQ.data ?? []).length,
    tasksCount: (tskQ.data ?? []).length,
    patrolsCount: (patQ.data ?? []).length,
    timesheetsCount: (tmsQ.data ?? []).length,
    byDay,
  };
}

// ─── Drill-down helpers ────────────────────────────────────

/**
 * Returns the incident rows matching a clicked analytics segment.
 * Used by the analytics drill-down table.
 */
export async function getIncidentsForSegment(
  companyId: string,
  segment: {
    from?: string;
    to?: string;
    teamId?: string;
    status?: string;
    severity?: string;
    type?: string;
  },
) {
  const supabase = createClient();
  let q = supabase
    .from("incidents")
    .select(
      "id, title, status, severity, type, team_id, created_at, incident_number, reported_user:users!incidents_reported_by_fkey(first_name, last_name)",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (segment.from) q = q.gte("created_at", segment.from);
  if (segment.to) q = q.lte("created_at", segment.to);
  if (segment.teamId) q = q.eq("team_id", segment.teamId);
  if (segment.status) q = q.eq("status", segment.status);
  if (segment.severity) q = q.eq("severity", segment.severity);
  if (segment.type) q = q.eq("type", segment.type);
  const { data, error } = await q;
  if (error) {
    logDbReadError("incidents segment", error);
    return [];
  }
  return data ?? [];
}

export async function getTasksForSegment(
  companyId: string,
  segment: {
    from?: string;
    to?: string;
    teamId?: string;
    status?: string;
    priority?: string;
    assigneeId?: string;
  },
) {
  const supabase = createClient();
  let q = supabase
    .from("tasks")
    .select(
      "id, title, status, priority, team_id, assigned_to, due_at, completed_at, created_at",
    )
    .eq("company_id", companyId)
    .order("created_at", { ascending: false })
    .limit(200);
  if (segment.from) q = q.gte("created_at", segment.from);
  if (segment.to) q = q.lte("created_at", segment.to);
  if (segment.teamId) q = q.eq("team_id", segment.teamId);
  if (segment.status) q = q.eq("status", segment.status);
  if (segment.priority) q = q.eq("priority", segment.priority);
  if (segment.assigneeId) q = q.eq("assigned_to", segment.assigneeId);
  const { data, error } = await q;
  if (error) {
    logDbReadError("tasks segment", error);
    return [];
  }
  return data ?? [];
}




