"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Users, UserCog, Search, Copy, Check, Loader2, Clock, Trash2,
  ChevronDown, CalendarOff, ClipboardList, CheckCircle2, XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import {
  getCompanyMembers, getCompanyDetails, getCompanyTimesheets, approveTimesheet,
  updateMemberRole, removeMember, getAllTimeOffRequests, reviewTimeOffRequest,
  getAllFormSubmissions, reviewFormSubmission,
} from "@/lib/supabase/db";
import { parseUTC } from "@/lib/parse-utc";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Sheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type LeaveReq = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FormSub = any;

type Tab = "roster" | "timesheets" | "leave" | "forms";

export default function AdminStaffPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const user = useAuthStore((s) => s.user);
  const [members, setMembers] = useState<Member[]>([]);
  const [joinCode, setJoinCode] = useState("");
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
      setTimesheets(ts.filter((t: Sheet) => t.clock_out));
      setLeaveRequests(leave);
      setFormSubmissions(forms);
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
    try { await reviewTimeOffRequest(id, status); await load(); } catch (err) { console.error(err); }
    finally { setReviewingLeave(null); }
  }

  async function handleFormReview(id: string) {
    setReviewingForm(id);
    try { await reviewFormSubmission(id, reviewNote || "Reviewed"); setReviewNote(""); await load(); } catch (err) { console.error(err); }
    finally { setReviewingForm(null); }
  }

  const filtered = members.filter((m: Member) => {
    const name = `${m.users?.first_name ?? ""} ${m.users?.last_name ?? ""}`.toLowerCase();
    return name.includes(search.toLowerCase());
  });

  const pendingSheets = timesheets.filter((t: Sheet) => !t.approved);
  const pendingLeave = leaveRequests.filter((r: LeaveReq) => r.status === "pending");
  const filteredLeave = leaveFilter === "pending" ? pendingLeave : leaveRequests;
  const pendingForms = formSubmissions.filter((f: FormSub) => f.status !== "reviewed");

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

        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1">
          {([
            { key: "roster" as Tab, label: `Roster (${members.length})`, badge: 0 },
            { key: "timesheets" as Tab, label: "Timesheets", badge: pendingSheets.length },
            { key: "leave" as Tab, label: "Leave", badge: pendingLeave.length },
            { key: "forms" as Tab, label: "Forms", badge: pendingForms.length },
          ]).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${tab === t.key ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
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
      </div>
    </>
  );
}
