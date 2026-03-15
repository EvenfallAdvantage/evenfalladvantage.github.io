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
  MapPin,
  Shield,
  BookOpen,
  MessageCircle,
  Video,
  Scale,
  Award,
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

export default function FeedPage() {
  const { user, activeCompanyId } = useAuthStore();
  const [active, setActive] = useState<Timesheet | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recentShifts, setRecentShifts] = useState<Timesheet[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
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
        const [p, m] = await Promise.all([
          getPosts(activeCompanyId, 5),
          getDashboardMetrics(activeCompanyId),
        ]);
        setPosts(p);
        setMetrics(m);
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
          <h1 className="text-2xl font-bold tracking-tight font-mono">{greeting}</h1>
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
