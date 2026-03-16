"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, UserCog, Search, Copy, Check, Loader2, Clock, Trash2,
  ChevronDown, CalendarOff, ClipboardList, CheckCircle2, XCircle,
  UserPlus, ListChecks, Plus, ArrowRight, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import {
  getCompanyMembers, getCompanyDetails, getCompanyTimesheets, approveTimesheet,
  updateMemberRole, removeMember, getAllTimeOffRequests, reviewTimeOffRequest,
  getAllFormSubmissions, reviewFormSubmission,
  getApplicants, createApplicant, updateApplicantStatus, deleteApplicant, convertApplicantToUser,
  getOnboardingTasks, createOnboardingTask, deleteOnboardingTask,
  getCompanyTimeChangeRequests, reviewTimeChangeRequest,
} from "@/lib/supabase/db";
import { parseUTC } from "@/lib/parse-utc";
import { onApplicantHired, type HireResult } from "@/lib/services/hiring-orchestrator";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeaveReq = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormSub = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Applicant = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OTask = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TCR = any;

type Tab = "roster" | "timesheets" | "leave" | "forms" | "applicants" | "onboarding" | "corrections";

export default function AdminStaffPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const user = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [tab, setTab] = useState<Tab>("roster");
  const [timesheets, setTimesheets] = useState<Sheet[]>([]);
  const [leaveRequests, setLeaveRequests] = useState<LeaveReq[]>([]);
  const [formSubmissions, setFormSubmissions] = useState<FormSub[]>([]);
  const [approving, setApproving] = useState<string | null>(null);
  const [changingRole, setChangingRole] = useState<string | null>(null);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [reviewingLeave, setReviewingLeave] = useState<string | null>(null);
  const [reviewingForm, setReviewingForm] = useState<string | null>(null);
  const [reviewNote, setReviewNote] = useState("");
  const [leaveFilter, setLeaveFilter] = useState<"pending" | "all">("pending");
  const [error, setError] = useState<string | null>(null);
  // Applicants
  const [applicants, setApplicants] = useState<Applicant[]>([]);
  const [appFilter, setAppFilter] = useState("all");
  const [showAddApp, setShowAddApp] = useState(false);
  const [appForm, setAppForm] = useState({ firstName: "", lastName: "", email: "", phone: "", guardCardNumber: "", experience: "", availability: "" });
  const [savingApp, setSavingApp] = useState(false);
  const [updatingApp, setUpdatingApp] = useState<string | null>(null);
  // Onboarding tasks
  const [oTasks, setOTasks] = useState<OTask[]>([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", category: "general", isRequired: true });
  const [savingTask, setSavingTask] = useState(false);
  // Time change requests
  const [timeChangeReqs, setTimeChangeReqs] = useState<TCR[]>([]);
  const [reviewingTCR, setReviewingTCR] = useState<string | null>(null);
  // Hire integration results
  const [hireResult, setHireResult] = useState<HireResult | null>(null);
  // Gusto sync
  const [syncingGusto, setSyncingGusto] = useState(false);
  const [gustoResult, setGustoResult] = useState<{ synced: number; errors: string[] } | null>(null);

  const myRole = user?.companies.find((c) => c.companyId === activeCompanyId)?.role ?? "staff";
  const canManageRoles = myRole === "owner" || myRole === "admin";
  const canManage = myRole === "owner" || myRole === "admin" || myRole === "manager";

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const [m, company, ts, leave, forms] = await Promise.all([
        getCompanyMembers(activeCompanyId),
        getCompanyDetails(activeCompanyId),
        getCompanyTimesheets(activeCompanyId),
        getAllTimeOffRequests(activeCompanyId),
        getAllFormSubmissions(activeCompanyId),
      ]);
      setMembers(m);
      setJoinCode(company?.join_code ?? "");
      setCompanyName(company?.name ?? "");
      setTimesheets(ts.filter((t: Sheet) => t.clock_out));
      setLeaveRequests(leave);
      setFormSubmissions(forms);
      // Load applicants, onboarding tasks, and time change requests (non-blocking)
      try { setApplicants(await getApplicants(activeCompanyId)); } catch {}
      try { setOTasks(await getOnboardingTasks(activeCompanyId)); } catch {}
      try { setTimeChangeReqs(await getCompanyTimeChangeRequests(activeCompanyId)); } catch {}
    } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  function copyCode() {
    navigator.clipboard.writeText(joinCode);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function handleRoleChange(membershipId: string, newRole: string) {
    setChangingRole(membershipId);
    setError(null);
    try { await updateMemberRole(membershipId, newRole); await load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to update role"); console.error(err); }
    finally { setChangingRole(null); }
  }

  async function handleRemoveMember(membershipId: string, name: string) {
    if (!confirm(`Remove ${name} from the organization?`)) return;
    setRemovingMember(membershipId);
    setError(null);
    try { await removeMember(membershipId); await load(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : "Failed to remove member"); console.error(err); }
    finally { setRemovingMember(null); }
  }

  async function handleApprove(id: string) {
    setApproving(id);
    try { await approveTimesheet(id); await load(); } catch (err) { console.error(err); }
    finally { setApproving(null); }
  }

  async function handleLeaveReview(id: string, status: "approved" | "denied") {
    setReviewingLeave(id);
    try {
      await reviewTimeOffRequest(id, status);
      // Notify the requesting employee
      const req = leaveRequests.find((r: LeaveReq) => r.id === id);
      if (req?.user_id && activeCompanyId) {
        import("@/lib/services/notification-dispatcher").then(({ dispatch }) => {
          dispatch({
            userId: req.user_id,
            companyId: activeCompanyId!,
            title: `Leave Request ${status === "approved" ? "Approved" : "Denied"}`,
            body: `Your ${req.leave_type ?? "time off"} request has been ${status}.`,
            type: "leave_review",
            actionUrl: "/time-off",
          }).catch(() => {});
        }).catch(() => {});
      }
      await load();
    } catch (err) { console.error(err); }
    finally { setReviewingLeave(null); }
  }

  async function handleFormReview(id: string) {
    setReviewingForm(id);
    try { await reviewFormSubmission(id, reviewNote || "Reviewed"); setReviewNote(""); await load(); } catch (err) { console.error(err); }
    finally { setReviewingForm(null); }
  }

  async function handleAddApplicant() {
    if (!appForm.firstName.trim() || !appForm.email.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setSavingApp(true);
    try {
      await createApplicant(activeCompanyId, appForm);
      setAppForm({ firstName: "", lastName: "", email: "", phone: "", guardCardNumber: "", experience: "", availability: "" });
      setShowAddApp(false);
      setApplicants(await getApplicants(activeCompanyId));
    } catch (err) { console.error(err); } finally { setSavingApp(false); }
  }

  async function handleAppStatus(id: string, status: string) {
    setUpdatingApp(id);
    try {
      await updateApplicantStatus(id, status);
      if (status === "hired" && activeCompanyId && activeCompanyId !== "pending") {
        try {
          await convertApplicantToUser(id, activeCompanyId);
          // Fire integration triggers (email, WhatsApp, Checkr, DocuSign)
          const applicant = applicants.find((a: Applicant) => a.id === id);
          if (applicant) {
            const appUrl = typeof window !== "undefined"
              ? `${window.location.origin}${window.location.pathname.replace(/\/admin\/staff.*/, "")}`
              : "";
            onApplicantHired({
              companyId: activeCompanyId,
              companyName: companyName || "Your Company",
              joinCode,
              appUrl,
              applicant: {
                firstName: applicant.first_name ?? "",
                lastName: applicant.last_name ?? "",
                email: applicant.email ?? "",
                phone: applicant.phone,
              },
            }).then(result => {
              setHireResult(result);
              setTimeout(() => setHireResult(null), 8000);
            }).catch(err => console.error("Integration triggers failed:", err));
          }
        } catch (err) { console.error("Convert failed:", err); }
      }
      if (activeCompanyId && activeCompanyId !== "pending") setApplicants(await getApplicants(activeCompanyId));
      await load();
    } catch (err) { console.error(err); } finally { setUpdatingApp(null); }
  }

  async function handleDeleteApp(id: string) {
    if (!confirm("Delete this applicant?")) return;
    try {
      await deleteApplicant(id);
      if (activeCompanyId && activeCompanyId !== "pending") setApplicants(await getApplicants(activeCompanyId));
    } catch (err) { console.error(err); }
  }

  async function handleAddTask() {
    if (!taskForm.title.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setSavingTask(true);
    try {
      await createOnboardingTask(activeCompanyId, taskForm);
      setTaskForm({ title: "", description: "", category: "general", isRequired: true });
      setShowAddTask(false);
      setOTasks(await getOnboardingTasks(activeCompanyId));
    } catch (err) { console.error(err); } finally { setSavingTask(false); }
  }

  async function handleTCRReview(id: string, status: "approved" | "denied") {
    setReviewingTCR(id);
    try { await reviewTimeChangeRequest(id, status); await load(); } catch (err) { console.error(err); }
    finally { setReviewingTCR(null); }
  }

  async function handleDeleteTask(id: string) {
    if (!confirm("Delete this onboarding task?")) return;
    try {
      await deleteOnboardingTask(id);
      if (activeCompanyId && activeCompanyId !== "pending") setOTasks(await getOnboardingTasks(activeCompanyId));
    } catch (err) { console.error(err); }
  }

  const STATUSES = ["applied", "reviewing", "interviewing", "offered", "hired", "rejected", "withdrawn"];
  const STATUS_COLORS: Record<string, string> = {
    applied: "bg-blue-500/15 text-blue-500", reviewing: "bg-amber-500/15 text-amber-600",
    interviewing: "bg-violet-500/15 text-violet-500", offered: "bg-cyan-500/15 text-cyan-500",
    hired: "bg-green-500/15 text-green-600", rejected: "bg-red-500/15 text-red-500",
    withdrawn: "bg-zinc-500/15 text-zinc-400",
  };
  const filteredApplicants = appFilter === "all" ? applicants : applicants.filter((a: Applicant) => a.status === appFilter);

  const filtered = members.filter((m: Member) => {
    const name = `${m.users?.first_name ?? ""} ${m.users?.last_name ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const pendingSheets = timesheets.filter((t: Sheet) => !t.approved);
  const pendingLeave = leaveRequests.filter((r: LeaveReq) => r.status === "pending");
  const filteredLeave = leaveFilter === "pending" ? pendingLeave : leaveRequests;
  const pendingForms = formSubmissions.filter((f: FormSub) => f.status !== "reviewed");
  const pendingTCR = timeChangeReqs.filter((r: TCR) => r.status === "pending");

  const leaveStatusColor = (s: string) => {
    if (s === "approved") return "bg-green-500/15 text-green-600";
    if (s === "denied") return "bg-red-500/15 text-red-500";
    return "bg-amber-500/15 text-amber-600";
  };

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><UserCog className="h-5 w-5 sm:h-6 sm:w-6" /> PERSONNEL</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Manage team members, timesheets, leave, and submissions</p>
          </div>
          {joinCode && (
            <Button size="sm" variant="outline" className="gap-1.5 font-mono" onClick={copyCode}>
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
              {joinCode}
            </Button>
          )}
        </div>

        {joinCode && (
          <div className="rounded-lg bg-primary/5 border border-primary/20 px-4 py-2 text-xs text-muted-foreground">
            Share the code <span className="font-mono font-bold text-foreground">{joinCode}</span> with team members so they can join your organization.
          </div>
        )}

        {error && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 px-4 py-2 text-xs text-red-500 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="ml-2 font-bold hover:text-red-400">&times;</button>
          </div>
        )}

        {hireResult && (
          <div className="rounded-lg border border-green-500/30 bg-green-500/5 px-4 py-3 space-y-1">
            <p className="text-xs font-semibold text-green-600 flex items-center gap-1.5"><CheckCircle2 className="h-3.5 w-3.5" /> Hire Integrations Triggered</p>
            <div className="flex flex-wrap gap-2">
              {([
                { key: "email" as const, label: "Email", ok: hireResult.email.sent },
                { key: "whatsapp" as const, label: "WhatsApp", ok: hireResult.whatsapp.sent },
                { key: "checkr" as const, label: "Checkr", ok: hireResult.checkr.triggered },
                { key: "docusign" as const, label: "DocuSign", ok: hireResult.docusign.sent },
              ]).map(i => (
                <span key={i.key} className={`text-[10px] px-2 py-0.5 rounded-full border ${i.ok ? "bg-green-500/10 border-green-500/20 text-green-600" : "bg-muted/30 border-border/40 text-muted-foreground"}`}>
                  {i.ok ? "✓" : "—"} {i.label}
                  {!i.ok && hireResult[i.key] && "error" in hireResult[i.key] && hireResult[i.key].error ? `: ${hireResult[i.key].error}` : ""}
                </span>
              ))}
            </div>
            <button onClick={() => setHireResult(null)} className="text-[10px] text-muted-foreground hover:text-foreground">Dismiss</button>
          </div>
        )}

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 overflow-x-auto">
          {([
            { key: "roster" as Tab, label: `Roster (${members.length})`, badge: 0 },
            { key: "applicants" as Tab, label: "Applicants", badge: applicants.filter((a: Applicant) => a.status === "applied").length },
            { key: "onboarding" as Tab, label: "Onboarding", badge: 0 },
            { key: "timesheets" as Tab, label: "Timesheets", badge: pendingSheets.length },
            { key: "corrections" as Tab, label: "Corrections", badge: pendingTCR.length },
            { key: "leave" as Tab, label: "Leave", badge: pendingLeave.length },
            { key: "forms" as Tab, label: "Forms", badge: pendingForms.length },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap ${tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t.label}
              {t.badge > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-amber-500/20 text-amber-600">{t.badge}</Badge>}
            </button>
          ))}
        </div>

        {/* ── Roster Tab ── */}
        {tab === "roster" && (
          <>
            <div className="relative max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search personnel..." className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <Users className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">{members.length === 0 ? "No personnel yet" : "No matches"}</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {members.length === 0 ? "Share your company code to recruit team members." : "Try a different search."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filtered.map((m: Member) => {
                  const u = m.users;
                  return (
                    <div key={m.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">
                        {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{u?.first_name} {u?.last_name}</p>
                        <p className="text-xs text-muted-foreground">{u?.email}</p>
                      </div>
                      <div className="relative">
                        {canManageRoles ? (
                          <>
                            <select value={m.role}
                              onChange={(e) => handleRoleChange(m.id, e.target.value)}
                              disabled={changingRole === m.id || (m.role === "owner" && myRole !== "owner")}
                              className="h-6 appearance-none rounded border border-border/40 bg-background px-2 pr-5 text-[10px] font-medium capitalize cursor-pointer disabled:opacity-50">
                              {(myRole === "owner" ? ["owner", "admin", "manager", "staff"] : ["manager", "staff"]).map((r) => (
                                <option key={r} value={r}>{r}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1 top-1/2 -translate-y-1/2 h-3 w-3 text-muted-foreground pointer-events-none" />
                          </>
                        ) : (
                          <Badge variant="outline" className="text-[10px] capitalize">{m.role}</Badge>
                        )}
                      </div>
                      <Badge variant={m.status === "active" ? "default" : "outline"} className="text-[10px] capitalize">{m.status}</Badge>
                      {canManageRoles && m.role !== "owner" && (
                        <button onClick={() => handleRemoveMember(m.id, `${u?.first_name} ${u?.last_name}`)} disabled={removingMember === m.id}
                          className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Remove member">
                          {removingMember === m.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Timesheets Tab ── */}
        {tab === "timesheets" && (
          <>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : timesheets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No timesheets yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">Timesheets will appear here as your team clocks in and out.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {timesheets.map((t: Sheet) => {
                  const hrs = ((parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000).toFixed(1);
                  const u = t.users;
                  return (
                    <div key={t.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/10 text-xs font-bold text-green-600">
                        {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{u?.first_name} {u?.last_name}</p>
                        <p className="text-xs text-muted-foreground">
                          {parseUTC(t.clock_in).toLocaleDateString()} · {parseUTC(t.clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {parseUTC(t.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className="font-mono text-sm font-semibold">{hrs}h</span>
                      {t.approved ? (
                        <Badge className="text-[10px] bg-green-500/15 text-green-600">Approved</Badge>
                      ) : (
                        <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10"
                          onClick={() => handleApprove(t.id)} disabled={approving === t.id}>
                          {approving === t.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
              {/* Gusto Sync Button */}
              {canManage && timesheets.filter((t: Sheet) => t.approved).length > 0 && (
                <div className="mt-4 flex items-center gap-3">
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs font-mono"
                    onClick={async () => {
                      if (!activeCompanyId) return;
                      setSyncingGusto(true); setGustoResult(null);
                      try {
                        const { syncTimesheetsToGusto } = await import("@/lib/services/gusto-service");
                        const approved = timesheets.filter((t: Sheet) => t.approved);
                        const mapped = approved.map((t: Sheet) => ({
                          employeeEmail: t.users?.email ?? "",
                          date: parseUTC(t.clock_in).toISOString().split("T")[0],
                          hours: parseFloat(((parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime()) / 3600000).toFixed(2)),
                        }));
                        const result = await syncTimesheetsToGusto(activeCompanyId, mapped);
                        setGustoResult(result);
                        setTimeout(() => setGustoResult(null), 8000);
                      } catch (err) {
                        setGustoResult({ synced: 0, errors: [String(err)] });
                      } finally { setSyncingGusto(false); }
                    }} disabled={syncingGusto}>
                    {syncingGusto ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                    Sync to Gusto
                  </Button>
                  {gustoResult && (
                    <span className={`text-xs ${gustoResult.synced > 0 ? "text-green-600" : "text-amber-600"}`}>
                      {gustoResult.synced > 0 ? `✓ ${gustoResult.synced} synced` : gustoResult.errors[0] ?? "No data synced"}
                    </span>
                  )}
                </div>
              )}
          </>
        )}

        {/* ── Time Corrections Tab ── */}
        {tab === "corrections" && (
          <>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : timeChangeReqs.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No time correction requests</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">When employees request changes to their timesheet entries, they&apos;ll appear here for review.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {timeChangeReqs.map((r: TCR) => {
                  const u = r.users;
                  const ts = r.timesheets;
                  const statusColor = r.status === "approved" ? "bg-green-500/15 text-green-600" : r.status === "denied" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-600";
                  return (
                    <div key={r.id} className={`rounded-xl border bg-card px-4 py-3 ${
                      r.status === "pending" ? "border-orange-500/30" : "border-border/50"
                    }`}>
                      <div className="flex items-start gap-4">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-xs font-bold text-orange-500">
                          {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{u?.first_name} {u?.last_name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Original: {ts?.clock_in ? parseUTC(ts.clock_in).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} → {ts?.clock_out ? parseUTC(ts.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
                          </p>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1">
                            {r.requested_clock_in && (
                              <span className="text-[10px]"><span className="text-muted-foreground">New In:</span> <span className="font-mono font-medium text-blue-400">{parseUTC(r.requested_clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></span>
                            )}
                            {r.requested_clock_out && (
                              <span className="text-[10px]"><span className="text-muted-foreground">New Out:</span> <span className="font-mono font-medium text-blue-400">{parseUTC(r.requested_clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></span>
                            )}
                          </div>
                          {r.reason && <p className="text-[10px] text-muted-foreground/70 mt-1 italic">&ldquo;{r.reason}&rdquo;</p>}
                          <p className="text-[9px] text-muted-foreground/50 mt-0.5">Submitted {new Date(r.created_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                        </div>
                        <Badge className={`text-[10px] capitalize shrink-0 ${statusColor}`}>{r.status}</Badge>
                        {r.status === "pending" && canManage && (
                          <div className="flex gap-1 shrink-0">
                            <Button size="sm" variant="outline"
                              className="h-7 gap-1 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10"
                              onClick={() => handleTCRReview(r.id, "approved")}
                              disabled={reviewingTCR === r.id}>
                              {reviewingTCR === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Approve
                            </Button>
                            <Button size="sm" variant="outline"
                              className="h-7 gap-1 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
                              onClick={() => handleTCRReview(r.id, "denied")}
                              disabled={reviewingTCR === r.id}>
                              <XCircle className="h-3 w-3" /> Deny
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Leave Requests Tab ── */}
        {tab === "leave" && (
          <>
            <div className="flex gap-2">
              <button onClick={() => setLeaveFilter("pending")}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${leaveFilter === "pending" ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}>
                Pending ({pendingLeave.length})
              </button>
              <button onClick={() => setLeaveFilter("all")}
                className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors ${leaveFilter === "all" ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}>
                All ({leaveRequests.length})
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : filteredLeave.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <CalendarOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">{leaveFilter === "pending" ? "No pending leave requests" : "No leave requests"}</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">Leave requests from your team will appear here for review.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredLeave.map((r: LeaveReq) => {
                  const u = r.users;
                  const policy = r.time_off_policies;
                  const start = new Date(r.start_date).toLocaleDateString([], { month: "short", day: "numeric" });
                  const end = new Date(r.end_date).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" });
                  const days = Math.max(1, Math.ceil((new Date(r.end_date).getTime() - new Date(r.start_date).getTime()) / 86400000) + 1);

                  return (
                    <div key={r.id} className={`rounded-xl border bg-card px-4 py-3 ${
                      r.status === "pending" ? "border-amber-500/30" : "border-border/50"
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-violet-500/10 text-xs font-bold text-violet-500">
                          {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{u?.first_name} {u?.last_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {policy?.name ?? "Leave"} · {start} — {end} · <span className="font-mono">{days} day{days > 1 ? "s" : ""}</span>
                          </p>
                          {r.note && <p className="text-xs text-muted-foreground/70 mt-0.5 italic">&ldquo;{r.note}&rdquo;</p>}
                        </div>
                        <Badge className={`text-[10px] capitalize ${leaveStatusColor(r.status)}`}>{r.status}</Badge>
                        {r.status === "pending" && canManage && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline"
                              className="h-7 gap-1 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10"
                              onClick={() => handleLeaveReview(r.id, "approved")}
                              disabled={reviewingLeave === r.id}>
                              {reviewingLeave === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Approve
                            </Button>
                            <Button size="sm" variant="outline"
                              className="h-7 gap-1 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
                              onClick={() => handleLeaveReview(r.id, "denied")}
                              disabled={reviewingLeave === r.id}>
                              <XCircle className="h-3 w-3" /> Deny
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Form Submissions Tab ── */}
        {tab === "forms" && (
          <>
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : formSubmissions.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <ClipboardList className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No form submissions</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">Submitted field reports and forms will appear here for review.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {formSubmissions.map((f: FormSub) => {
                  const u = f.users;
                  const isReviewed = f.status === "reviewed";
                  const dataEntries = f.data ? Object.entries(f.data as Record<string, unknown>).slice(0, 3) : [];

                  return (
                    <div key={f.id} className={`rounded-xl border bg-card px-4 py-3 ${
                      !isReviewed ? "border-amber-500/30" : "border-border/50"
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-rose-500/10 text-xs font-bold text-rose-500">
                          {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm">{u?.first_name} {u?.last_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {f.forms?.name ?? "Form"} · {new Date(f.created_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          {dataEntries.length > 0 && (
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                              {dataEntries.map(([key, val]) => (
                                <span key={key} className="text-[10px] text-muted-foreground/70">
                                  <span className="font-medium">{key}:</span> {String(val).slice(0, 40)}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {isReviewed ? (
                          <Badge className="text-[10px] bg-green-500/15 text-green-600">Reviewed</Badge>
                        ) : canManage ? (
                          <div className="flex items-center gap-2">
                            <Input placeholder="Note..." value={reviewingForm === f.id ? reviewNote : ""}
                              onChange={(e) => { setReviewingForm(f.id); setReviewNote(e.target.value); }}
                              className="h-7 w-28 text-xs" />
                            <Button size="sm" variant="outline"
                              className="h-7 gap-1 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10"
                              onClick={() => { setReviewingForm(f.id); handleFormReview(f.id); }}
                              disabled={reviewingForm === f.id && !reviewNote && reviewingForm !== null}>
                              {reviewingForm === f.id && reviewNote === "" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                              Review
                            </Button>
                          </div>
                        ) : (
                          <Badge className="text-[10px] bg-amber-500/15 text-amber-600">Pending</Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ── Applicants Tab ── */}
        {tab === "applicants" && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {["all", ...STATUSES].map(s => (
                <button key={s} onClick={() => setAppFilter(s)}
                  className={`px-3 py-1 rounded-lg text-xs font-medium border transition-colors capitalize ${appFilter === s ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground"}`}>
                  {s === "all" ? `All (${applicants.length})` : `${s} (${applicants.filter((a: Applicant) => a.status === s).length})`}
                </button>
              ))}
              {canManage && (
                <Button size="sm" className="ml-auto gap-1.5" onClick={() => setShowAddApp(!showAddApp)}>
                  {showAddApp ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                  {showAddApp ? "Cancel" : "Add Applicant"}
                </Button>
              )}
            </div>

            {showAddApp && (
              <div className="rounded-xl border border-primary/30 bg-card p-4 space-y-3">
                <p className="text-sm font-medium flex items-center gap-2"><UserPlus className="h-4 w-4" /> Add Applicant Manually</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input placeholder="First name *" value={appForm.firstName}
                    onChange={(e) => setAppForm(p => ({ ...p, firstName: e.target.value }))} />
                  <Input placeholder="Last name" value={appForm.lastName}
                    onChange={(e) => setAppForm(p => ({ ...p, lastName: e.target.value }))} />
                  <Input placeholder="Email *" type="email" value={appForm.email}
                    onChange={(e) => setAppForm(p => ({ ...p, email: e.target.value }))} />
                  <Input placeholder="Phone" value={appForm.phone}
                    onChange={(e) => setAppForm(p => ({ ...p, phone: e.target.value }))} />
                  <Input placeholder="Guard card #" value={appForm.guardCardNumber}
                    onChange={(e) => setAppForm(p => ({ ...p, guardCardNumber: e.target.value }))} />
                  <Input placeholder="Availability (e.g. Weekends, Nights)" value={appForm.availability}
                    onChange={(e) => setAppForm(p => ({ ...p, availability: e.target.value }))} />
                </div>
                <Input placeholder="Experience / background" value={appForm.experience}
                  onChange={(e) => setAppForm(p => ({ ...p, experience: e.target.value }))} />
                <Button size="sm" onClick={handleAddApplicant} disabled={!appForm.firstName.trim() || !appForm.email.trim() || savingApp}>
                  {savingApp ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Applicant"}
                </Button>
              </div>
            )}

            {filteredApplicants.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <UserPlus className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No applicants{appFilter !== "all" ? ` with status "${appFilter}"` : ""}</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  Applicants from your public form or manual entry will appear here.
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredApplicants.map((a: Applicant) => (
                  <div key={a.id} className={`rounded-xl border bg-card px-4 py-3 ${a.status === "applied" ? "border-blue-500/30" : "border-border/50"}`}>
                    <div className="flex items-center gap-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-xs font-bold text-blue-500">
                        {(a.first_name?.[0] ?? "")}{(a.last_name?.[0] ?? "")}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{a.first_name} {a.last_name}</p>
                        <p className="text-xs text-muted-foreground">{a.email}{a.phone ? ` · ${a.phone}` : ""}</p>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                          {a.guard_card_number && <span className="text-[10px] text-muted-foreground/70"><span className="font-medium">Guard Card:</span> {a.guard_card_number}</span>}
                          {a.availability && <span className="text-[10px] text-muted-foreground/70"><span className="font-medium">Availability:</span> {a.availability}</span>}
                          {a.experience && <span className="text-[10px] text-muted-foreground/70"><span className="font-medium">Experience:</span> {a.experience.slice(0, 60)}</span>}
                          {a.source && a.source !== "overwatch" && <span className="text-[10px] text-muted-foreground/70"><span className="font-medium">Source:</span> {a.source}</span>}
                        </div>
                        <p className="text-[9px] text-muted-foreground/50 mt-0.5">Applied {new Date(a.created_at).toLocaleDateString()}</p>
                      </div>
                      <Badge className={`text-[10px] capitalize ${STATUS_COLORS[a.status] ?? "bg-muted text-muted-foreground"}`}>{a.status}</Badge>
                      {canManage && a.status !== "hired" && a.status !== "rejected" && a.status !== "withdrawn" && (
                        <div className="flex items-center gap-1">
                          {a.status === "applied" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => handleAppStatus(a.id, "reviewing")} disabled={updatingApp === a.id}>
                              {updatingApp === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Review"}
                            </Button>
                          )}
                          {a.status === "reviewing" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => handleAppStatus(a.id, "interviewing")} disabled={updatingApp === a.id}>
                              {updatingApp === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Interview"}
                            </Button>
                          )}
                          {a.status === "interviewing" && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1"
                              onClick={() => handleAppStatus(a.id, "offered")} disabled={updatingApp === a.id}>
                              {updatingApp === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Offer"}
                            </Button>
                          )}
                          {(a.status === "offered" || a.status === "interviewing") && (
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-green-600 border-green-500/30 hover:bg-green-500/10"
                              onClick={() => handleAppStatus(a.id, "hired")} disabled={updatingApp === a.id}>
                              {updatingApp === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><ArrowRight className="h-3 w-3" /> Hire</>}
                            </Button>
                          )}
                          <Button size="sm" variant="outline" className="h-7 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
                            onClick={() => handleAppStatus(a.id, "rejected")} disabled={updatingApp === a.id}>
                            <XCircle className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {canManage && (a.status === "hired" || a.status === "rejected" || a.status === "withdrawn") && (
                        <button onClick={() => handleDeleteApp(a.id)}
                          className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── Onboarding Tasks Tab ── */}
        {tab === "onboarding" && (
          <>
            <div className="rounded-xl border border-border/50 bg-card p-4">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-sm flex items-center gap-2"><ListChecks className="h-4 w-4" /> Onboarding Checklist</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Configure tasks that new hires must complete. These are auto-assigned when an applicant is hired.</p>
                </div>
                {canManage && (
                  <Button size="sm" className="gap-1.5" onClick={() => setShowAddTask(!showAddTask)}>
                    {showAddTask ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
                    {showAddTask ? "Cancel" : "Add Task"}
                  </Button>
                )}
              </div>

              {showAddTask && (
                <div className="rounded-lg border border-primary/30 bg-muted/30 p-3 space-y-2 mb-3">
                  <Input placeholder="Task title (e.g. Complete guard card upload)" value={taskForm.title}
                    onChange={(e) => setTaskForm(p => ({ ...p, title: e.target.value }))} />
                  <Input placeholder="Description (optional)" value={taskForm.description}
                    onChange={(e) => setTaskForm(p => ({ ...p, description: e.target.value }))} />
                  <div className="flex gap-2 items-center">
                    <select value={taskForm.category}
                      onChange={(e) => setTaskForm(p => ({ ...p, category: e.target.value }))}
                      className="h-8 rounded border border-border/40 bg-background px-2 text-xs">
                      <option value="general">General</option>
                      <option value="documents">Documents</option>
                      <option value="training">Training</option>
                      <option value="equipment">Equipment</option>
                      <option value="accounts">Accounts</option>
                    </select>
                    <label className="flex items-center gap-1.5 text-xs">
                      <input type="checkbox" checked={taskForm.isRequired}
                        onChange={(e) => setTaskForm(p => ({ ...p, isRequired: e.target.checked }))}
                        className="rounded" />
                      Required
                    </label>
                    <Button size="sm" onClick={handleAddTask} disabled={!taskForm.title.trim() || savingTask} className="ml-auto">
                      {savingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                    </Button>
                  </div>
                </div>
              )}

              {oTasks.length === 0 ? (
                <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/50 p-8 text-center">
                  <ListChecks className="mb-2 h-8 w-8 text-muted-foreground/40" />
                  <p className="text-xs font-medium">No onboarding tasks configured</p>
                  <p className="mt-1 max-w-xs text-[10px] text-muted-foreground">Add tasks like &ldquo;Upload guard card&rdquo;, &ldquo;Complete safety training&rdquo;, &ldquo;Join WhatsApp community&rdquo;.</p>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {oTasks.map((t: OTask, i: number) => (
                    <div key={t.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{t.title}</p>
                        {t.description && <p className="text-[10px] text-muted-foreground">{t.description}</p>}
                      </div>
                      <Badge variant="outline" className="text-[9px] capitalize">{t.category}</Badge>
                      {t.is_required && <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Required</Badge>}
                      {canManage && (
                        <button onClick={() => handleDeleteTask(t.id)}
                          className="rounded p-1 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10">
                          <Trash2 className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Public application form link */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
              <p className="font-medium text-sm">Public Application Form</p>
              <p className="text-xs text-muted-foreground">
                Share this link with potential applicants. Submissions appear in the Applicants tab.
              </p>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-lg bg-muted/50 px-3 py-2 text-xs font-mono text-muted-foreground truncate">
                  {typeof window !== "undefined" ? `${window.location.origin}${window.location.pathname.replace(/\/admin\/staff.*/, "")}/apply?c=${activeCompanyId ?? ""}` : `/apply?c=${activeCompanyId ?? ""}`}
                </code>
                <Button size="sm" variant="outline" className="shrink-0 text-xs gap-1"
                  onClick={() => {
                    const url = `${window.location.origin}${window.location.pathname.replace(/\/admin\/staff.*/, "")}/apply?c=${activeCompanyId ?? ""}`;
                    navigator.clipboard.writeText(url);
                  }}>
                  <Copy className="h-3 w-3" /> Copy
                </Button>
              </div>
            </div>

            {/* Integrations config preview */}
            <div className="rounded-xl border border-border/50 bg-card p-4 space-y-2">
              <p className="font-medium text-sm">External Integrations</p>
              <p className="text-xs text-muted-foreground">
                Connect Fillout, Airtable, or other tools to auto-import applicants via webhooks.
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {[
                  { name: "Fillout", desc: "Receive form submissions via webhook", status: "planned" },
                  { name: "Airtable", desc: "Sync applicant records bidirectionally", status: "planned" },
                  { name: "Email (Postmark)", desc: "Auto-send onboarding emails on hire", status: "planned" },
                ].map(int => (
                  <div key={int.name} className="rounded-lg border border-border/40 p-3">
                    <p className="text-xs font-medium">{int.name}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{int.desc}</p>
                    <Badge variant="outline" className="text-[9px] mt-1.5">{int.status}</Badge>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
