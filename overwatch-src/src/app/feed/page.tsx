"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { timeAgo } from "@/lib/utils";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
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
  MapPin,
  Shield,
  MessageCircle,
  Scale,
  Award,
  Activity,
  BarChart3,
  CheckCircle2,
  Calendar,
  Inbox,
  ArrowRight,
  UserPlus,
  Plug,
  DollarSign,
  UserCheck,
  CircleDot,
  Bell,
  ThumbsUp,
  Send,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
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
  getIntelData,
  getOwnerIntel,
  getPostReactions,
  togglePostReaction,
  getPostComments,
  addPostComment,
} from "@/lib/supabase/db";
import { getUserShifts } from "@/lib/supabase/db-operations";
import { createCompanyWithOwner } from "@/lib/supabase/db-users";
import { createClient } from "@/lib/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { parseUTC } from "@/lib/parse-utc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Timesheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Post = any;

function formatDuration(ms: number) {
  const abs = Math.max(0, ms);
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


const QUICK_ACTIONS = [
  { title: "Comms", href: "/chat", icon: Radio, color: "text-blue-500", bg: "bg-blue-500/10" },
  { title: "Incidents", href: "/incidents", icon: AlertTriangle, color: "text-red-500", bg: "bg-red-500/10" },
  { title: "Patrols", href: "/patrols", icon: Footprints, color: "text-emerald-500", bg: "bg-emerald-500/10" },
  { title: "Deployments", href: "/schedule", icon: CalendarDays, color: "text-amber-500", bg: "bg-amber-500/10" },
  { title: "Reports", href: "/forms", icon: ClipboardList, color: "text-rose-500", bg: "bg-rose-500/10" },
  { title: "Training", href: "/academy", icon: GraduationCap, color: "text-violet-500", bg: "bg-violet-500/10" },
];

const TOOLS_GRID = [
  { title: "Geo-Risk", href: "/geo-risk", icon: MapPin, color: "text-cyan-500", bg: "bg-cyan-500/10", desc: "Location risk intel" },
  { title: "Site Assessment", href: "/site-assessment", icon: Shield, color: "text-teal-500", bg: "bg-teal-500/10", desc: "Security evaluations" },
  { title: "Academy", href: "/academy", icon: GraduationCap, color: "text-indigo-500", bg: "bg-indigo-500/10", desc: "Courses & certs" },
  { title: "Scenarios", href: "/training/scenarios", icon: MessageCircle, color: "text-orange-500", bg: "bg-orange-500/10", desc: "De-escalation sims" },
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

type OwnerIntel = {
  pipeline: { new: number; interview: number; hired: number; rejected: number; total: number };
  approvals: { timeCorrections: number; leaveRequests: number; formReviews: number; timesheets: number; total: number };
  integrationHealth: { active: number; configured: number; providers: { provider: string; active: boolean }[] };
  onboarding: { id: string; name: string; complete: boolean; hireDate: string }[];
  payroll: { approvedHours: number; totalHours: number; unapprovedHours: number; readyPct: number };
  notificationsSent: number;
};

const PROVIDER_LABELS: Record<string, string> = {
  email: "Email", whatsapp: "WhatsApp", twilio: "SMS/Twilio", onesignal: "Push",
  checkr: "Checkr", docusign: "DocuSign", gusto: "Gusto", airtable: "Airtable",
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full bg-border/20 overflow-hidden">
        <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
      </div>
      <span className="text-[10px] font-mono font-medium text-muted-foreground w-8 text-right">{pct}%</span>
    </div>
  );
}

function hireDaysAgo(iso: string) {
  const days = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days}d ago`;
}

type CompanyStats = {
  memberCount: number;
  eventCount: number;
  assetCount: number;
  formCount: number;
  totalHoursLogged: number;
};

type IntelData = {
  weeklyHours: number[];
  weeklyIncidents: number[];
  dayLabels: string[];
  personnel: { onDuty: number; offDuty: number; onLeave: number; total: number };
  activity: { patrols: number; training: number; shifts: number };
};

export default function FeedPage() {
  const { user, activeCompanyId, getActiveCompany } = useAuthStore();
  const activeCompany = getActiveCompany();
  const role = activeCompany?.role ?? "staff";
  const hiddenTabs = new Set(activeCompany?.settings?.hiddenTabs ?? []);
  const isLeadership = hasMinRole((role ?? "staff") as CompanyRole, "manager");
  const [active, setActive] = useState<Timesheet | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recentShifts, setRecentShifts] = useState<Timesheet[]>([]);
  const [posts, setPosts] = useState<Post[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);
  const [intel, setIntel] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nextShift, setNextShift] = useState<any>(null);
  const [ownerIntel, setOwnerIntel] = useState<OwnerIntel | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [postReactions, setPostReactions] = useState<Record<string, any[]>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [postComments, setPostComments] = useState<Record<string, any[]>>({});
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [commentText, setCommentText] = useState("");
  const [sendingComment, setSendingComment] = useState(false);
  const [togglingReaction, setTogglingReaction] = useState<string | null>(null);
  // Create Company modal
  const [showCreateCo, setShowCreateCo] = useState(false);
  const [newCoName, setNewCoName] = useState("");
  const [creatingCo, setCreatingCo] = useState(false);
  const createCoRef = useRef<HTMLInputElement>(null);

  async function handleCreateCompany() {
    if (!newCoName.trim() || !user?.id) return;
    setCreatingCo(true);
    try {
      const supabase = createClient();
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error("Not authenticated");

      await createCompanyWithOwner({
        companyName: newCoName.trim(),
        supabaseId: authUser.id,
        email: authUser.email ?? null,
        phone: authUser.phone ?? user.phone ?? null,
        firstName: user.firstName,
        lastName: user.lastName,
      });
      setShowCreateCo(false);
      setNewCoName("");
      window.location.reload();
    } catch (err) {
      console.error("Failed to create company:", err);
      alert(err instanceof Error ? err.message : "Failed to create company. Please try again.");
    } finally {
      setCreatingCo(false);
    }
  }

  async function handleReaction(postId: string) {
    setTogglingReaction(postId);
    try {
      await togglePostReaction(postId, "like");
      const r = await getPostReactions(postId);
      setPostReactions((prev) => ({ ...prev, [postId]: r }));
    } catch (err) { console.error(err); }
    finally { setTogglingReaction(null); }
  }

  async function toggleCommentSection(postId: string) {
    if (expandedPostId === postId) { setExpandedPostId(null); return; }
    setExpandedPostId(postId);
    setCommentText("");
    try {
      const [c, r] = await Promise.all([getPostComments(postId), getPostReactions(postId)]);
      setPostComments((prev) => ({ ...prev, [postId]: c }));
      setPostReactions((prev) => ({ ...prev, [postId]: r }));
    } catch {}
  }

  async function handleSendComment(postId: string) {
    if (!commentText.trim()) return;
    setSendingComment(true);
    try {
      await addPostComment(postId, commentText.trim());
      const c = await getPostComments(postId);
      setPostComments((prev) => ({ ...prev, [postId]: c }));
      setCommentText("");
    } catch (err) { console.error(err); }
    finally { setSendingComment(false); }
  }

  const load = useCallback(async () => {
    try {
      const [ts, history] = await Promise.all([
        getActiveTimesheet(),
        getRecentTimesheets(3),
      ]);
      setActive(ts);
      setRecentShifts(history.filter((t: Timesheet) => t.clock_out));

      if (activeCompanyId && activeCompanyId !== "pending") {
        const [p, m, cs, id] = await Promise.all([
          getPosts(activeCompanyId, 5),
          getDashboardMetrics(activeCompanyId),
          getCompanyStats(activeCompanyId),
          getIntelData(activeCompanyId),
        ]);
        setPosts(p);
        setMetrics(m);
        setCompanyStats(cs);
        setIntel(id);
        try {
          const oi = await getOwnerIntel(activeCompanyId);
          setOwnerIntel(oi);
        } catch {}
        try {
          const allShifts = await getUserShifts(activeCompanyId);
          const now = new Date();
          const upcoming = allShifts.filter((s: { start_time: string }) => parseUTC(s.start_time) > now);
          setNextShift(upcoming[0] ?? null);
        } catch {}
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
    const tick = () => setElapsed(Date.now() - parseUTC(active.clock_in).getTime());
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
      const d = parseUTC(t.clock_in);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    })
    .reduce((sum: number, t: Timesheet) => {
      return sum + (parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime());
    }, 0);

  if (loading) {
    return (
      <>
        <DashboardSkeleton />
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono">{greeting}</h1>
          <p className="text-sm text-muted-foreground">
            {new Date().toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
          </p>
        </div>

        {/* No-company onboarding banner */}
        {user && (!user.companies || user.companies.length === 0 || (user.companies.length === 1 && user.companies[0].companyId === "pending")) && (
          <Card className="border-[#dd8c33]/40 bg-gradient-to-r from-[#dd8c33]/10 via-[#dd8c33]/5 to-transparent">
            <CardContent className="py-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#dd8c33]/15 border border-[#dd8c33]/25">
                  <UserPlus className="h-6 w-6 text-[#dd8c33]" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-semibold">You&apos;re not part of a company yet</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Join an existing company with a code from your manager, or create your own.
                  </p>
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                  <Link href="/join" className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-lg text-sm font-medium bg-[#dd8c33] hover:bg-[#c47a2a] text-white transition-colors">
                    <UserPlus className="h-3.5 w-3.5" /> Join Company
                  </Link>
                  <button onClick={() => { setShowCreateCo(true); setTimeout(() => createCoRef.current?.focus(), 100); }} className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 h-7 px-3 rounded-lg text-sm font-medium border border-border bg-background hover:bg-muted transition-colors">
                    <ArrowRight className="h-3.5 w-3.5" /> Create Company
                  </button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Create Company Modal */}
        {showCreateCo && (
          <>
            <div className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm" onClick={() => setShowCreateCo(false)} />
            <div className="fixed inset-0 z-[101] flex items-center justify-center px-4">
              <Card className="w-full max-w-sm shadow-2xl">
                <CardContent className="pt-6 pb-4 space-y-4">
                  <div className="text-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src="/overwatch/images/overwatch_logo.png" alt="Overwatch" className="h-12 w-12 mx-auto mb-3" />
                    <h2 className="text-lg font-bold">Create Your Company</h2>
                    <p className="text-xs text-muted-foreground mt-1">Set up your security operation in seconds.</p>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium">Company Name</label>
                    <Input
                      ref={createCoRef}
                      placeholder="e.g. Apex Security Group"
                      value={newCoName}
                      onChange={(e) => setNewCoName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleCreateCompany()}
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1" onClick={() => setShowCreateCo(false)}>Cancel</Button>
                    <Button className="flex-1 gap-1.5" onClick={handleCreateCompany} disabled={creatingCo || !newCoName.trim()}>
                      {creatingCo ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowRight className="h-3.5 w-3.5" />}
                      Create
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Upcoming Shift */}
        {nextShift && (
          <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-transparent">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
                  <CalendarDays className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Upcoming Shift</h3>
                    <Badge className="text-[9px] bg-blue-500/15 text-blue-400 border-0">{
                      (() => {
                        const ms = parseUTC(nextShift.start_time).getTime() - Date.now();
                        const hrs = Math.floor(ms / 3600000);
                        if (hrs < 1) return "Starting soon";
                        if (hrs < 24) return `In ${hrs}h`;
                        const days = Math.floor(hrs / 24);
                        return `In ${days}d`;
                      })()
                    }</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {parseUTC(nextShift.start_time).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })} &bull; {parseUTC(nextShift.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {parseUTC(nextShift.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                  {nextShift.events && (
                    <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {nextShift.events.name}{nextShift.events.location ? ` @ ${nextShift.events.location}` : ""}
                    </p>
                  )}
                  {nextShift.role && (
                    <Badge variant="outline" className="text-[9px] mt-1">{nextShift.role}</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

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

        {/* Pinned Briefing — always visible */}
        {posts.filter((p: Post) => p.is_pinned).length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
                Pinned Briefing
              </h2>
              <Link href="/updates" className="flex items-center gap-1 text-xs text-primary hover:underline">
                View all <ChevronRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {posts.filter((p: Post) => p.is_pinned).map((post: Post) => {
                const author = post.users;
                const rxns = postReactions[post.id] ?? [];
                const cmts = postComments[post.id] ?? [];
                const userLiked = rxns.some((r: { users?: { id?: string } }) => r.users?.id === user?.id);
                return (
                  <div key={post.id} className="rounded-lg border border-amber-500/30 bg-amber-500/5 overflow-hidden">
                    <div className="flex items-start gap-3 p-3">
                      <Avatar className="h-8 w-8 shrink-0">
                        <AvatarImage src={author?.avatar_url ?? undefined} />
                        <AvatarFallback className="bg-amber-500/15 text-[10px] font-bold text-amber-600">
                          {(author?.first_name?.[0] ?? "")}{(author?.last_name?.[0] ?? "")}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{author?.first_name} {author?.last_name}</span>
                          <span className="text-[10px] text-muted-foreground">{timeAgo(post.created_at)}</span>
                          <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[9px] font-semibold text-amber-600">PINNED</span>
                        </div>
                        {post.title && <p className="mt-0.5 text-sm font-semibold">{post.title}</p>}
                        <p className="mt-0.5 text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 border-t border-amber-500/20 px-3 py-1.5">
                      <button onClick={() => handleReaction(post.id)} disabled={togglingReaction === post.id}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-accent ${userLiked ? "text-primary" : "text-muted-foreground"}`}>
                        <ThumbsUp className="h-3.5 w-3.5" />
                        {rxns.length > 0 && <span>{rxns.length}</span>}
                      </button>
                      <button onClick={() => toggleCommentSection(post.id)}
                        className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition-colors hover:bg-accent ${expandedPostId === post.id ? "text-primary" : "text-muted-foreground"}`}>
                        <MessageCircle className="h-3.5 w-3.5" /> Comment
                        {cmts.length > 0 && <span className="ml-0.5">({cmts.length})</span>}
                      </button>
                    </div>
                    {expandedPostId === post.id && (
                      <div className="border-t border-amber-500/20 px-3 py-2 space-y-2">
                        {cmts.map((cm: { id: string; content: string; created_at: string; users?: { first_name?: string; last_name?: string } }) => (
                          <div key={cm.id} className="flex items-start gap-2 text-xs">
                            <div className="h-5 w-5 shrink-0 rounded-full bg-primary/10 flex items-center justify-center text-[8px] font-bold text-primary">
                              {(cm.users?.first_name?.[0] ?? "")}{(cm.users?.last_name?.[0] ?? "")}
                            </div>
                            <div>
                              <span className="font-medium">{cm.users?.first_name} {cm.users?.last_name}</span>
                              <span className="ml-1.5 text-muted-foreground">{cm.content}</span>
                            </div>
                          </div>
                        ))}
                        <div className="flex items-center gap-2">
                          <input value={commentText} onChange={(e) => setCommentText(e.target.value)} placeholder="Write a comment..."
                            onKeyDown={(e) => e.key === "Enter" && handleSendComment(post.id)}
                            className="flex-1 rounded-md border border-border/40 bg-background px-2 py-1 text-xs outline-none focus:border-primary/50" />
                          <button onClick={() => handleSendComment(post.id)} disabled={sendingComment || !commentText.trim()}
                            className="rounded-md p-1 text-primary hover:bg-primary/10 disabled:opacity-40">
                            <Send className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Required — leadership only */}
        {isLeadership && ownerIntel?.approvals && ownerIntel.approvals.total > 0 && (
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/15">
                  <Inbox className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold">Action Required — {ownerIntel.approvals.total} pending approval{ownerIntel.approvals.total !== 1 ? "s" : ""}</p>
                  <div className="flex flex-wrap gap-3 mt-1">
                    {ownerIntel.approvals.timesheets > 0 && <span className="text-xs text-muted-foreground">{ownerIntel.approvals.timesheets} timesheet{ownerIntel.approvals.timesheets !== 1 ? "s" : ""}</span>}
                    {ownerIntel.approvals.timeCorrections > 0 && <span className="text-xs text-muted-foreground">{ownerIntel.approvals.timeCorrections} time correction{ownerIntel.approvals.timeCorrections !== 1 ? "s" : ""}</span>}
                    {ownerIntel.approvals.leaveRequests > 0 && <span className="text-xs text-muted-foreground">{ownerIntel.approvals.leaveRequests} leave request{ownerIntel.approvals.leaveRequests !== 1 ? "s" : ""}</span>}
                    {ownerIntel.approvals.formReviews > 0 && <span className="text-xs text-muted-foreground">{ownerIntel.approvals.formReviews} form{ownerIntel.approvals.formReviews !== 1 ? "s" : ""}</span>}
                  </div>
                </div>
                <Link href="/admin/staff">
                  <Button size="sm" variant="outline" className="gap-1 text-xs border-amber-500/30 text-amber-600 hover:bg-amber-500/10">
                    Review <ArrowRight className="h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}

        {/* KPI Cards — leadership only */}
        {isLeadership && metrics && (
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
                { label: "Total Staff", value: metrics.totalStaff, icon: Users, color: "text-primary", bg: "bg-primary/10", href: "/directory" },
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

        {/* Intel Center — leadership only */}
        {isLeadership && companyStats && intel && (() => {
          const mc = companyStats.memberCount;
          const ec = companyStats.eventCount;
          const ac = companyStats.assetCount;
          const fc = companyStats.formCount;
          const hrs = companyStats.totalHoursLogged;
          const intelKpis = [
            { label: "Personnel", value: mc, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
            { label: "Operations", value: ec, icon: MapPin, color: "text-violet-500", bg: "bg-violet-500/10" },
            { label: "Assets", value: ac, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
            { label: "Forms", value: fc, icon: ClipboardList, color: "text-rose-500", bg: "bg-rose-500/10" },
            { label: "Hours", value: hrs, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
            { label: "On Duty", value: intel.personnel.onDuty, icon: CheckCircle2, color: intel.personnel.onDuty > 0 ? "text-green-500" : "text-muted-foreground", bg: intel.personnel.onDuty > 0 ? "bg-green-500/10" : "bg-muted" },
          ];
          const compositionSegs = [
            { value: mc, color: "#3b82f6", label: "Personnel" },
            { value: ac, color: "#10b981", label: "Assets" },
            { value: fc, color: "#f43f5e", label: "Forms" },
            { value: ec, color: "#8b5cf6", label: "Operations" },
          ];
          const pers = intel.personnel;
          const statusBkdn = [
            { label: "On Duty", count: pers.onDuty, color: "bg-green-500", pct: pers.total > 0 ? Math.round((pers.onDuty / pers.total) * 100) : 0 },
            { label: "Off Duty", count: pers.offDuty, color: "bg-slate-400", pct: pers.total > 0 ? Math.round((pers.offDuty / pers.total) * 100) : 0 },
            { label: "On Leave", count: pers.onLeave, color: "bg-amber-500", pct: pers.total > 0 ? Math.round((pers.onLeave / pers.total) * 100) : 0 },
          ];
          const pipeline = ownerIntel?.pipeline;
          const intHealth = ownerIntel?.integrationHealth;
          const payroll = ownerIntel?.payroll;
          return (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" /> Intel Center
                </h2>
                <Badge className="bg-primary/10 text-primary text-[10px]">
                  {new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                </Badge>
              </div>

              {/* KPI Row */}
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {intelKpis.map((kpi) => (
                  <Card key={kpi.label} className="border-border/40">
                    <CardContent className="p-2.5">
                      <div className="flex items-center justify-between mb-1">
                        <div className={`flex h-6 w-6 items-center justify-center rounded-md ${kpi.bg}`}>
                          <kpi.icon className={`h-3 w-3 ${kpi.color}`} />
                        </div>
                      </div>
                      <p className={`text-lg font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                      <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Owner Row: Pipeline + Integrations + Payroll */}
              <div className="grid gap-3 lg:grid-cols-3">
                {/* Hiring Pipeline */}
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5 text-cyan-500" /> Hiring Pipeline</h3>
                      <Link href="/admin/staff"><Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-accent">View All</Badge></Link>
                    </div>
                    {pipeline && pipeline.total > 0 ? (
                      <div className="space-y-2">
                        {[
                          { label: "New / Pending", count: pipeline.new, color: "bg-cyan-500", pct: Math.round((pipeline.new / pipeline.total) * 100) },
                          { label: "Interview", count: pipeline.interview, color: "bg-blue-500", pct: Math.round((pipeline.interview / pipeline.total) * 100) },
                          { label: "Hired", count: pipeline.hired, color: "bg-green-500", pct: Math.round((pipeline.hired / pipeline.total) * 100) },
                          { label: "Rejected", count: pipeline.rejected, color: "bg-red-500/60", pct: Math.round((pipeline.rejected / pipeline.total) * 100) },
                        ].map(stage => (
                          <div key={stage.label}>
                            <div className="flex items-center justify-between text-[10px] mb-0.5">
                              <span className="text-muted-foreground">{stage.label}</span>
                              <span className="font-mono font-medium">{stage.count}</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-border/20 overflow-hidden">
                              <div className={`h-full rounded-full ${stage.color}`} style={{ width: `${Math.max(stage.pct, stage.count > 0 ? 4 : 0)}%` }} />
                            </div>
                          </div>
                        ))}
                        <p className="text-[9px] text-muted-foreground text-center pt-1">{pipeline.total} total applicants</p>
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <UserPlus className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                        <p className="text-[10px] text-muted-foreground">No applicants yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Integration Health */}
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold flex items-center gap-1.5"><Plug className="h-3.5 w-3.5 text-green-500" /> Integrations</h3>
                      <Link href="/admin/settings"><Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-accent">Settings</Badge></Link>
                    </div>
                    {intHealth && intHealth.configured > 0 ? (
                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-4 py-1">
                          <div className="text-center">
                            <p className="text-xl font-bold font-mono text-green-500">{intHealth.active}</p>
                            <p className="text-[8px] text-muted-foreground uppercase">Active</p>
                          </div>
                          <div className="h-6 w-px bg-border/40" />
                          <div className="text-center">
                            <p className="text-xl font-bold font-mono text-muted-foreground">{intHealth.configured}</p>
                            <p className="text-[8px] text-muted-foreground uppercase">Configured</p>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1 justify-center pt-1">
                          {intHealth.providers.map(p => (
                            <Badge key={p.provider} variant={p.active ? "default" : "outline"}
                              className={`text-[8px] ${p.active ? "bg-green-500/15 text-green-500 border-green-500/30" : "text-muted-foreground"}`}>
                              <CircleDot className={`h-2 w-2 mr-0.5 ${p.active ? "text-green-500" : "text-muted-foreground/40"}`} />
                              {PROVIDER_LABELS[p.provider] ?? p.provider}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <Plug className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                        <p className="text-[10px] text-muted-foreground">No integrations configured</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Payroll Readiness */}
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Payroll Readiness</h3>
                      <Badge variant="outline" className={`text-[9px] ${payroll && payroll.readyPct >= 100 ? "text-green-500 border-green-500/30" : "text-amber-500 border-amber-500/30"}`}>
                        {payroll?.readyPct ?? 100}% ready
                      </Badge>
                    </div>
                    {payroll && payroll.totalHours > 0 ? (
                      <div className="space-y-2">
                        <ProgressBar value={payroll.approvedHours} max={payroll.totalHours} color="bg-emerald-500" />
                        <div className="grid grid-cols-2 gap-2">
                          <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
                            <p className="text-base font-bold font-mono text-emerald-500">{payroll.approvedHours}h</p>
                            <p className="text-[7px] text-muted-foreground uppercase">Approved</p>
                          </div>
                          <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                            <p className="text-base font-bold font-mono text-amber-500">{payroll.unapprovedHours}h</p>
                            <p className="text-[7px] text-muted-foreground uppercase">Pending</p>
                          </div>
                        </div>
                        <p className="text-[9px] text-muted-foreground text-center">{payroll.totalHours}h total (last 14 days)</p>
                      </div>
                    ) : (
                      <div className="text-center py-3">
                        <DollarSign className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                        <p className="text-[10px] text-muted-foreground">No timesheet data yet</p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>

              {/* Charts Row */}
              <div className="grid gap-3 lg:grid-cols-3">
                <Card className="border-border/40 lg:col-span-2">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500" /> Weekly Hours</h3>
                      <span className="text-[10px] text-muted-foreground">{hrs}h total</span>
                    </div>
                    <MiniBarChart data={intel.weeklyHours} color="#f59e0b" />
                    <div className="flex justify-between mt-1">
                      {intel.dayLabels.map((d) => <span key={d} className="text-[8px] text-muted-foreground">{d}</span>)}
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

              {/* Bottom Row: Incidents + Personnel + Onboarding + Activity */}
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-xs font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Incidents</h3>
                      <span className="text-[10px] text-muted-foreground">{(intel.weeklyIncidents).reduce((a: number, b: number) => a + b, 0)} this week</span>
                    </div>
                    <MiniBarChart data={intel.weeklyIncidents} color="#ef4444" />
                    <div className="flex justify-between mt-1">
                      {intel.dayLabels.map((d) => <span key={d} className="text-[8px] text-muted-foreground">{d}</span>)}
                    </div>
                  </CardContent>
                </Card>
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-blue-500" /> Personnel Status</h3>
                    {pers.total > 0 ? (
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
                      <p className="text-[10px] text-muted-foreground text-center py-3">No personnel data</p>
                    )}
                  </CardContent>
                </Card>

                {/* Onboarding */}
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5 text-cyan-500" /> Onboarding</h3>
                    {ownerIntel?.onboarding && ownerIntel.onboarding.length > 0 ? (
                      <div className="space-y-2">
                        {ownerIntel.onboarding.slice(0, 4).map(ob => (
                          <div key={ob.id} className="flex items-center gap-2 text-[10px]">
                            <div className={`h-2 w-2 rounded-full ${ob.complete ? "bg-green-500" : "bg-amber-500 animate-pulse"}`} />
                            <span className="flex-1 truncate font-medium">{ob.name}</span>
                            <span className="text-muted-foreground">{ob.hireDate ? hireDaysAgo(ob.hireDate) : ""}</span>
                          </div>
                        ))}
                        {ownerIntel.onboarding.length > 4 && (
                          <p className="text-[9px] text-muted-foreground text-center">+{ownerIntel.onboarding.length - 4} more</p>
                        )}
                      </div>
                    ) : (
                      <div className="text-center py-2">
                        <CheckCircle2 className="h-5 w-5 text-green-500/40 mx-auto mb-1" />
                        <p className="text-[10px] text-muted-foreground">All onboarded</p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Activity */}
                <Card className="border-border/40">
                  <CardContent className="p-3">
                    <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-rose-500" /> Activity</h3>
                    <div className="space-y-2">
                      {[
                        { label: "Patrols Today", value: intel.activity.patrols, icon: Footprints, color: "text-emerald-500" },
                        { label: "Training Done", value: intel.activity.training, icon: GraduationCap, color: "text-violet-500" },
                        { label: "Shifts (7d)", value: intel.activity.shifts, icon: Calendar, color: "text-blue-500" },
                        { label: "Forms Filed", value: fc, icon: ClipboardList, color: "text-rose-500" },
                        { label: "Notifications (7d)", value: ownerIntel?.notificationsSent ?? 0, icon: Bell, color: "text-amber-500" },
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

              <p className="text-[9px] text-center text-muted-foreground/50">
                All data is queried live from your organization&apos;s database. Last refreshed {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
              </p>
            </div>
          );
        })()}

        {/* Professional Tools */}
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
            Professional Tools
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {TOOLS_GRID.filter((tool) => !hiddenTabs.has(tool.href)).map((tool) => (
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

        {/* Recent Activity — all non-pinned briefs, visible to everyone */}
        {posts.filter((p: Post) => !p.is_pinned).length > 0 && (
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
              {posts.filter((p: Post) => !p.is_pinned).map((post: Post) => {
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
    </>
  );
}
