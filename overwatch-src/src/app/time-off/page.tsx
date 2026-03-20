"use client";

import { useEffect, useState, useCallback } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { CalendarOff, Plus, Loader2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getTimeOffRequests, getTimeOffPolicies, createTimeOffRequest, getAllTimeOffRequests, reviewTimeOffRequest, deleteTimeOffRequest, removeConflictingShifts, getCompanyMembers } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Policy = any;

export default function TimeOffPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");
  const [requests, setRequests] = useState<Request[]>([]);
  const [allRequests, setAllRequests] = useState<Request[]>([]);
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState("");
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [deletingReq, setDeletingReq] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const reqs = await getTimeOffRequests();
      setRequests(reqs);
      if (activeCompanyId && activeCompanyId !== "pending") {
        setPolicies(await getTimeOffPolicies(activeCompanyId));
        if (isAdmin) {
          setAllRequests(await getAllTimeOffRequests(activeCompanyId));
        }
      }
    } catch {} finally { setLoading(false); }
  }, [activeCompanyId, isAdmin]);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!startDate || !endDate || !selectedPolicy || !activeCompanyId) return;
    setCreating(true);
    try {
      await createTimeOffRequest({ policyId: selectedPolicy, startDate, endDate, note: note || undefined });
      // Notify managers about the new leave request
      const policyName = policies.find((p: Policy) => p.id === selectedPolicy)?.name ?? "Leave";
      import("@/lib/supabase/db").then((mod) => {
        mod.getCompanyMembers(activeCompanyId).then((mbrs: { role: string; users: { id: string } | { id: string }[] }[]) => {
          const mgrs = mbrs.filter((m) => hasMinRole(m.role as CompanyRole, "manager") && m.users);
          import("@/lib/services/notification-dispatcher").then(({ dispatch }) => {
            for (const mgr of mgrs) {
              const u = Array.isArray(mgr.users) ? mgr.users[0] : mgr.users;
              if (!u?.id) continue;
              dispatch({
                userId: u.id,
                companyId: activeCompanyId,
                title: "New Leave Request",
                body: `${policyName}: ${startDate} — ${endDate}${note ? ` ("${note}")` : ""}`,
                type: "leave_request",
                actionUrl: "/admin/staff",
              }).catch(() => {});
            }
          }).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
      setStartDate(""); setEndDate(""); setNote(""); setSelectedPolicy(""); setShowCreate(false);
      await load();
    } catch (err) { console.error("Leave request failed:", err); }
    finally { setCreating(false); }
  }

  async function handleCancelRequest(id: string) {
    if (!confirm("Cancel this leave request?")) return;
    setDeletingReq(id);
    try { await deleteTimeOffRequest(id); await load(); }
    catch (err) { console.error(err); }
    finally { setDeletingReq(null); }
  }

  async function handleReview(id: string, status: "approved" | "denied") {
    setReviewing(id);
    try {
      await reviewTimeOffRequest(id, status);
      // If approved, remove conflicting shifts and notify managers
      if (status === "approved" && activeCompanyId) {
        const req = allRequests.find((r: Request) => r.id === id);
        if (req?.user_id && req.start_date && req.end_date) {
          try {
            const removed = await removeConflictingShifts(req.user_id, req.start_date, req.end_date);
            if (removed.length > 0) {
              const u = req.users ?? req;
              const empName = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "An employee";
              const shiftList = removed.map((s: { start_time: string; role?: string; events?: { name?: string } }) =>
                `${new Date(s.start_time).toLocaleDateString()} ${s.events?.name ?? ""}${s.role ? ` (${s.role})` : ""}`
              ).join(", ");
              const mbrs = await getCompanyMembers(activeCompanyId);
              const { dispatch } = await import("@/lib/services/notification-dispatcher");
              const mgrs = mbrs.filter((m: { role: string; users: { id: string } | { id: string }[] }) =>
                hasMinRole(m.role as CompanyRole, "manager")
              );
              for (const mgr of mgrs) {
                const mu = Array.isArray(mgr.users) ? mgr.users[0] : mgr.users;
                if (!mu?.id || mu.id === req.user_id) continue;
                dispatch({
                  userId: mu.id, companyId: activeCompanyId,
                  title: "Shifts Need Coverage",
                  body: `${empName}'s leave was approved. ${removed.length} shift${removed.length > 1 ? "s" : ""} now open: ${shiftList}`,
                  type: "shift_coverage", actionUrl: "/admin/events",
                }).catch(() => {});
              }
            }
          } catch (err) { console.error("Failed to remove conflicting shifts:", err); }
        }
      }
      await load();
    } catch (err) { console.error(err); }
    finally { setReviewing(null); }
  }

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-green-500/15 text-green-600";
    if (s === "denied") return "bg-red-500/15 text-red-600";
    return "bg-amber-500/15 text-amber-600";
  };

  const displayRequests = tab === "team" ? allRequests : requests;
  const pendingCount = allRequests.filter((r: Request) => r.status === "pending").length;

  return (
    <>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><CalendarOff className="h-5 w-5 sm:h-6 sm:w-6" /> LEAVE</h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Request and track leave days</p>
          </div>
          <Button size="sm" className="gap-1.5 w-full sm:w-auto" onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Request Leave
          </Button>
        </div>

        {/* Admin tabs */}
        {isAdmin && (
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
            <button onClick={() => setTab("mine")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "mine" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              My Requests
            </button>
            <button onClick={() => setTab("team")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "team" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              Team Requests {pendingCount > 0 && <Badge className="ml-1 h-4 min-w-4 px-1 text-[9px] bg-amber-500/20 text-amber-600">{pendingCount}</Badge>}
            </button>
          </div>
        )}

        {showCreate && (
          <div className="space-y-3 rounded-xl border border-primary/30 bg-card p-4">
            {policies.length > 0 ? (
              <div>
                <label className="text-xs text-muted-foreground">Leave Type</label>
                <select value={selectedPolicy} onChange={(e) => setSelectedPolicy(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm">
                  <option value="">Select type...</option>
                  {policies.map((p: Policy) => (
                    <option key={p.id} value={p.id}>{p.name} ({p.type})</option>
                  ))}
                </select>
              </div>
            ) : (
              <p className="text-xs text-amber-600 bg-amber-500/10 rounded-lg px-3 py-2">
                No leave policies configured yet. Ask your admin to set them up in HQ Config.
              </p>
            )}
            <div className="flex gap-2">
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="mt-1" />
              </div>
              <div className="flex-1">
                <label className="text-xs text-muted-foreground">End Date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="mt-1" />
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Note (optional)</label>
              <Input placeholder="Reason for leave..." value={note} onChange={(e) => setNote(e.target.value)} className="mt-1" />
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleCreate} disabled={!startDate || !endDate || !selectedPolicy || creating}>
                {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Submit Request"}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : displayRequests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <CalendarOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">{tab === "team" ? "No team requests" : "No leave requests"}</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              {tab === "team" ? "No leave requests from your team yet." : "Click \"Request Leave\" to submit your first request."}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {displayRequests.map((r: Request) => (
              <div key={r.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                  <CalendarOff className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">
                    {r.time_off_policies?.name ?? "Leave Request"}
                    {tab === "team" && r.users && (
                      <span className="text-muted-foreground font-normal"> — {r.users.first_name} {r.users.last_name}</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.start_date).toLocaleDateString()} — {new Date(r.end_date).toLocaleDateString()}
                  </p>
                  {r.note && <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>}
                </div>
                {tab === "team" && r.status === "pending" ? (
                  <div className="flex gap-1.5">
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10"
                      onClick={() => handleReview(r.id, "approved")} disabled={reviewing === r.id}>
                      {reviewing === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                    </Button>
                    <Button size="sm" variant="outline" className="h-7 px-2 text-xs text-red-600 border-red-500/30 hover:bg-red-500/10"
                      onClick={() => handleReview(r.id, "denied")} disabled={reviewing === r.id}>
                      Deny
                    </Button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Badge className={`text-[10px] ${statusColor(r.status)}`}>{r.status}</Badge>
                    {tab === "mine" && (
                      <button onClick={() => handleCancelRequest(r.id)} disabled={deletingReq === r.id}
                        className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete request">
                        {deletingReq === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
