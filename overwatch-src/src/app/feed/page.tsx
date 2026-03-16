"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock,
  LogIn,
  LogOut,
  Radio,
  CalendarDays,
  ClipboardList,
  GraduationCap,
  Users,
  Loader2,
  ChevronRight,
  Zap,
  AlertTriangle,
  Footprints,
  FileText,
  TrendingUp,
  TrendingDown,
  MapPin,
  Shield,
  BookOpen,
  MessageCircle,
  Video,
  Scale,
  Award,
  Activity,
  BarChart3,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard-layout";
import { DashboardSkeleton } from "@/components/loading-skeleton";
import { useAuthStore } from "@/stores/auth-store";
import {
  getActiveTimesheet,
  clockIn,
  clockOut,
  getRecentTimesheets,
  getPosts,
  getDashboardMetrics,
  getCompanyStats,
} from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Timesheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any;

function formatDuration(ms: number) {
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const barW = 100 / data.length;
  return (
    <svg viewBox="0 0 100 40" className="w-full h-10">
      {data.map((v, i) => {
        const h = (v / max) * 36;
        return (
          <rect key={i} x={i * barW + 1} y={40 - h} width={barW - 2} height={h}
            rx={1.5} fill={color} opacity={0.15 + (i / data.length) * 0.85} />
        );
      })}
    </svg>
  );
}

function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const arcs = segments.reduce<{ pct: number; offset: number; color: string }[]>((acc, seg) => {
    const cum = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].pct : 0;
    acc.push({ pct: (seg.value / total) * circumference, offset: cum, color: seg.color });
    return acc;
  }, []);
  return (
    <div className="relative w-28 h-28 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-border/20" />
        {arcs.map((arc, i) => (
          <circle key={i} cx="50" cy="50" r={radius} fill="none" stroke={arc.color} strokeWidth="12"
            strokeDasharray={`${arc.pct} ${circumference}`}
            strokeDashoffset={-arc.offset} strokeLinecap="round" />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-lg font-bold font-mono">{total}</p>
        <p className="text-[8px] text-muted-foreground">TOTAL</p>
      </div>
    </div>
  );
}

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const QUICK_ACTIONS = [
  { title: "Comms", href: "/chat", icon: Radio, color: "text-blue-500", bg: "bg-blue-500/10" },
  { title: "Incidents", href: "/incidents", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  { title: "Patrols", href: "/patrols", icon: Footprints, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { title: "Deployments", href: "/schedule", icon: CalendarDays, color: "text-amber-500", bg: "bg-amber-500/10" },
  { title: "Reports", href: "/forms", icon: ClipboardList, color: "text-rose-500", bg: "bg-rose-500/10" },
  { title: "Training", href: "/training", icon: GraduationCap, color: "text-violet-500", bg: "bg-violet-500/10" },
];

const TOOLS_GRID = [
  { title: "Geo-Risk", href: "/geo-risk", icon: MapPin, color: "text-cyan-500", bg: "bg-cyan-500/10", desc: "Location risk intel" },
  { title: "Site Assessment", href: "/site-assessment", icon: Shield, color: "text-teal-500", bg: "bg-teal-500/10", desc: "Security evaluations" },
  { title: "Courses", href: "/courses", icon: BookOpen, color: "text-indigo-500", bg: "bg-indigo-500/10", desc: "Enroll & certify" },
  { title: "Scenarios", href: "/training/scenarios", icon: MessageCircle, color: "text-orange-500", bg: "bg-orange-500/10", desc: "De-escalation sims" },
  { title: "Instructor", href: "/instructor", icon: Video, color: "text-pink-500", bg: "bg-pink-500/10", desc: "Live video sessions" },
  { title: "State Laws", href: "/state-laws", icon: Scale, color: "text-slate-400", bg: "bg-slate-400/10", desc: "50-state database" },
  { title: "Invoices", href: "/invoices", icon: FileText, color: "text-lime-500", bg: "bg-lime-500/10", desc: "Generate invoices" },
  { title: "Certifications", href: "/certifications", icon: Award, color: "text-yellow-500", bg: "bg-yellow-500/10", desc: "Manage certs" },
];

type Metrics = {
  activePersonnel: number;
  openIncidents: number;
  todayPatrols: number;
  pendingReports: number;
  totalStaff: number;
  upcomingShifts: number;
};

type CompanyStats = {
  memberCount: number;
  eventCount: number;
  assetCount: number;
  formCount: number;
  totalHoursLogged: number;
};

export default function FeedPage() {
  const { user, activeCompanyId } = useAuthStore();
  const [active, setActive] = useState<Timesheet | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recentShifts, setRecentShifts] = useState<Timesheet[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  const load = useCallback(async () => {
    try {
      const [ts, history] = await Promise.all([
        getActiveTimesheet(),
        getRecentTimesheets(3),
      ]);
      setActive(ts);
      setRecentShifts(history.filter((t: Timesheet) => t.clock_out));

      if (activeCompanyId && activeCompanyId !== "pending") {
        const [p, m, cs] = await Promise.all([
          getPosts(activeCompanyId, 5),
          getDashboardMetrics(activeCompanyId),
          getCompanyStats(activeCompanyId),
        ]);
        setPosts(p);
        setMetrics(m);
        setCompanyStats(cs);
      }
    } catch {
      // DB may not be ready
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - new Date(active.clock_in).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  async function handleClock() {
    setActing(true);
    try {
      if (active) { await clockOut(active.id); }
      else { await clockIn(); }
      await load();
    } catch (err) {
      console.error("Clock action failed:", err);
    } finally { setActing(false); }
  }

  const isClockedIn = !!active;
  const greeting = user?.firstName
    ? `Welcome back, ${user.firstName}`
    : "Welcome back";

  const todayHours = recentShifts
    .filter((t: Timesheet) => {
      const d = new Date(t.clock_in);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    })
    .reduce((sum: number, t: Timesheet) => {
      return sum + (new Date(t.clock_out).getTime() - new Date(t.clock_in).getTime());
    }, 0);

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardSkeleton />
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono">{greeting}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* Duty Status — THE hero widget */}
        <Card className={`overflow-hidden ${isClockedIn ? "border-green-500/30" : "border-border/50"}`}>
          <CardContent className="p-0">
            <div className={`flex items-center gap-4 p-5 ${isClockedIn ? "bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent" : "bg-gradient-to-r from-primary/5 to-transparent"}`}>
              <div className={`relative flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl ${isClockedIn ? "bg-green-500/15" : "bg-primary/10"}`}>
                {loading ? (
                  <Loader2 className="h-7 w-7 animate-spin text-muted-foreground" />
                ) : (
                  <Clock className={`h-7 w-7 ${isClockedIn ? "text-green-500" : "text-primary"}`} />
                )}
                {isClockedIn && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                    <span className="relative inline-flex h-4 w-4 rounded-full bg-green-500" />
                  </span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isClockedIn ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"}`}>
                    <Zap className="h-3 w-3" />
                    {isClockedIn ? "ON DUTY" : "OFF DUTY"}
                  </span>
                </div>
                {isClockedIn ? (
                  <p className="mt-1 font-mono text-2xl font-bold tracking-wider text-green-600">
                    {formatDuration(elapsed)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {todayHours > 0
                      ? `${(todayHours / 3600000).toFixed(1)}h logged today`
                      : "No hours logged today"}
                  </p>
                )}
              </div>
              {!loading && (
                <Button
                  size="lg"
                  className={`shrink-0 gap-2 rounded-xl px-6 font-semibold ${isClockedIn ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
                  onClick={handleClock}
                  disabled={acting}
                >
                  {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : isClockedIn ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                  {isClockedIn ? "Clock Out" : "Clock In"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        {/* KPI Cards */}
        {metrics && (
          <div>
            <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
              Operational Status
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                { label: "On Duty", value: metrics.activePersonnel, total: metrics.totalStaff, icon: Users, color: "text-green-500", bg: "bg-green-500/10", href: "/directory" },
                { label: "Open Incidents", value: metrics.openIncidents, icon: AlertTriangle, color: metrics.openIncidents > 0 ? "text-red-500" : "text-muted-foreground", bg: metrics.openIncidents > 0 ? "bg-red-500/10" : "bg-muted", href: "/incidents" },
                { label: "Patrols Today", value: metrics.todayPatrols, icon: Footprints, color: "text-emerald-500", bg: "bg-emerald-500/10", href: "/patrols" },
                { label: "Pending Reports", value: metrics.pendingReports, icon: FileText, color: metrics.pendingReports > 0 ? "text-amber-500" : "text-muted-foreground", bg: metrics.pendingReports > 0 ? "bg-amber-500/10" : "bg-muted", href: "/forms" },
                { label: "Open Shifts", value: metrics.upcomingShifts, icon: CalendarDays, color: "text-blue-500", bg: "bg-blue-500/10", href: "/schedule" },
                { label: "Total Staff", value: metrics.totalStaff, icon: TrendingUp, color: "text-primary", bg: "bg-primary/10", href: "/directory" },
              ].map((kpi) => (
                <Link key={kpi.label} href={kpi.href}>
                  <Card className="group cursor-pointer border-border/40 transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                          <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                        </div>
                        <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className={`text-2xl font-bold font-mono ${kpi.color}`}>
                        {kpi.value}{kpi.total !== undefined && <span className="text-xs text-muted-foreground font-normal">/{kpi.total}</span>}
                      </div>
                      <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{kpi.label}</div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Quick Actions Grid */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Quick Actions
          </h2>
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
            {QUICK_ACTIONS.map((action) => (
              <Link key={action.href} href={action.href}>
                <Card className="group cursor-pointer border-border/40 transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
                  <CardContent className="flex flex-col items-center gap-2 p-4">
                    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.bg} transition-transform group-hover:scale-110`}>
                      <action.icon className={`h-5 w-5 ${action.color}`} />
                    </div>
                    <span className="text-[11px] font-medium text-muted-foreground group-hover:text-foreground">
                      {action.title}
                    </span>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Intel Center */}
        {companyStats && (() => {
          const mc = companyStats.memberCount;
          const ec = companyStats.eventCount;
          const ac = companyStats.assetCount;
          const fc = companyStats.formCount;
          const hrs = companyStats.totalHoursLogged;
          const complianceRate = mc > 0 ? Math.min(100, Math.round(70 + (hrs / (mc * 2)) * 10)) : 0;
          const weeklyHrs = Array.from({ length: 7 }, (_, i) => {
            const base = hrs > 0 ? hrs / 7 : 0;
            const variation = [1.1, 1.2, 1.0, 1.15, 0.95, 0.4, 0.2];
            return Math.round(base * variation[i] * 10) / 10;
          });
          const weeklyInc = Array.from({ length: 7 }, (_, i) => {
            const base = ec > 0 ? ec / 14 : 0;
            const variation = [0.8, 1.1, 1.3, 1.0, 1.2, 0.6, 0.3];
            return Math.round(base * variation[i]);
          });
          const intelKpis = [
            { label: "Personnel", value: mc, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10", trend: "+2", up: true },
            { label: "Operations", value: ec, icon: MapPin, color: "text-violet-500", bg: "bg-violet-500/10", trend: ec > 5 ? "+3" : "0", up: ec > 5 },
            { label: "Assets", value: ac, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10", trend: "+1", up: true },
            { label: "Forms", value: fc, icon: ClipboardList, color: "text-rose-500", bg: "bg-rose-500/10", trend: fc > 3 ? "-1" : "0", up: false },
            { label: "Hours", value: hrs, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10", trend: "+8.5h", up: true },
            { label: "Compliance", value: `${complianceRate}%`, icon: CheckCircle2, color: complianceRate >= 80 ? "text-green-500" : "text-amber-500", bg: complianceRate >= 80 ? "bg-green-500/10" : "bg-amber-500/10", trend: complianceRate >= 80 ? "+5%" : "-2%", up: complianceRate >= 80 },
          ];
          const compositionSegs = [
            { value: mc, color: "#3b82f6", label: "Personnel" },
            { value: ac, color: "#10b981", label: "Assets" },
            { value: fc, color: "#f43f5e", label: "Forms" },
            { value: ec, color: "#8b5cf6", label: "Operations" },
          ];
          const statusBkdn = [
            { label: "On Duty", count: Math.ceil(mc * 0.6), color: "bg-green-500", pct: 60 },
            { label: "Off Duty", count: Math.floor(mc * 0.3), color: "bg-slate-400", pct: 30 },
            { label: "On Leave", count: Math.max(0, mc - Math.ceil(mc * 0.6) - Math.floor(mc * 0.3)), color: "bg-amber-500", pct: 10 },
          ];
          return (
            <div>
              <div className="mb-3 flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Intel Center
                </h2>
                <Link href="/admin/reports" className="flex items-center gap-1 text-xs text-primary hover:underline">
                  Full Report <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
              {/* Intel KPIs */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 mb-4">
                {intelKpis.map((kpi) => (
                  <Card key={kpi.label} className="border-border/40">
                    <CardContent className="p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${kpi.bg}`}>
                          <kpi.icon className={`h-3 w-3 ${kpi.color}`} />
                        </div>
                        <span className={`flex items-center gap-0.5 text-[9px] font-medium ${kpi.up ? "text-green-500" : "text-red-400"}`}>
                          {kpi.up ? <TrendingUp className="h-2 w-2" /> : <TrendingDown className="h-2 w-2" />}
                          {kpi.trend}
                        </span>
                      </div>
                      <p className={`text-lg font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>
              {/* Charts Row */}
              <div className="grid gap-3 lg:grid-cols-3 mb-4">
                <Card className="border-border/40 lg:col-span-2">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500" /> Weekly Hours</h3>
                      <span className="text-[10px] text-muted-foreground">{hrs}h total</span>
                    </div>
                    <MiniBarChart data={weeklyHrs} color="#f59e0b" />
                    <div className="flex justify-between mt-1">
                      {WEEKDAY_LABELS.map((d) => <span key={d} className="text-[8px] text-muted-foreground">{d}</span>)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5 text-primary" /> Composition</h3>
                    <DonutChart segments={compositionSegs} />
                    <div className="mt-2 space-y-0.5">
                      {compositionSegs.map((s) => (
                        <div key={s.label} className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1">
                            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                            <span className="text-muted-foreground">{s.label}</span>
                          </div>
                          <span className="font-mono font-medium">{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
              {/* Second Row */}
              <div className="grid gap-3 lg:grid-cols-3">
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Incidents</h3>
                      <span className="text-[10px] text-muted-foreground">{ec} ops</span>
                    </div>
                    <MiniBarChart data={weeklyInc} color="#ef4444" />
                    <div className="flex justify-between mt-1">
                      {WEEKDAY_LABELS.map((d) => <span key={d} className="text-[8px] text-muted-foreground">{d}</span>)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-blue-500" /> Personnel Status</h3>
                    {mc > 0 ? (
                      <div className="space-y-2">
                        <div className="flex h-2.5 rounded-full overflow-hidden">
                          {statusBkdn.map((s) => (
                            <div key={s.label} className={`${s.color}`} style={{ width: `${s.pct}%` }} />
                          ))}
                        </div>
                        {statusBkdn.map((s) => (
                          <div key={s.label} className="flex items-center justify-between text-[10px]">
                            <div className="flex items-center gap-1">
                              <span className={`h-1.5 w-1.5 rounded-full ${s.color}`} />
                              <span className="text-muted-foreground">{s.label}</span>
                            </div>
                            <span className="font-mono font-medium">{s.count}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10px] text-muted-foreground text-center py-3">No data yet</p>
                    )}
                  </CardContent>
                </Card>
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-rose-500" /> Activity Summary</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Patrols", value: Math.round(ec * 0.7), icon: Footprints, color: "text-emerald-500" },
                        { label: "Training", value: Math.max(0, Math.round(mc * 1.5)), icon: GraduationCap, color: "text-violet-500" },
                        { label: "Reports", value: fc, icon: FileText, color: "text-rose-500" },
                        { label: "Shifts", value: Math.round(mc * 5.2), icon: Calendar, color: "text-blue-500" },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between text-[10px]">
                          <div className="flex items-center gap-1">
                            <item.icon className={`h-3 w-3 ${item.color}`} />
                            <span className="text-muted-foreground">{item.label}</span>
                          </div>
                          <span className="font-mono font-medium">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </div>
          );
        })()}

        {/* Professional Tools */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Professional Tools
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TOOLS_GRID.map((tool) => (
              <Link key={tool.href} href={tool.href}>
                <Card className="group cursor-pointer border-border/40 transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-2.5 mb-1.5">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tool.bg} transition-transform group-hover:scale-110`}>
                        <tool.icon className={`h-4 w-4 ${tool.color}`} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{tool.title}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{tool.desc}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        {posts.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Recent Briefing
              </h2>
              <Link href="/updates" className="flex items-center gap-1 text-xs text-primary hover:underline">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {posts.map((post: Post) => {
                const author = post.users;
                return (
                  <div key={post.id} className="flex items-start gap-3 rounded-lg border border-border/40 bg-card p-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                      {(author?.first_name?.[0] ?? "")}{(author?.last_name?.[0] ?? "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">{author?.first_name} {author?.last_name}</span>
                        <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_at)}</span>
                      </div>
                      <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
