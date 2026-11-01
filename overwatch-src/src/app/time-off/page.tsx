"use client";

import { approvalsHref } from "@/lib/personnel/staff-tabs";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import Link from "next/link";
import { CalendarOff, Plus, Loader2, Trash2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getTimeOffRequests, getTimeOffPolicies, createTimeOffRequest, getAllTimeOffRequests, deleteTimeOffRequest } from "@/lib/supabase/db";
import { useCompanyQuery } from "@/hooks/use-company-query";
import { toast } from "sonner";
import { PageShell } from "@/components/layout/page-shell";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Policy = any;

export default function TimeOffPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");

  const [showCreate, setShowCreate] = useState(false);
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState("");
  const [creating, setCreating] = useState(false);
  const [deletingReq, setDeletingReq] = useState<string | null>(null);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const { data: requests = [], isLoading: reqLoading, refetch: refetchRequests } = useQuery<Request[]>({
    queryKey: ["time-off-requests-mine", activeCompanyId ?? ""],
    queryFn: () => getTimeOffRequests(),
  });
  const { data: policies = [], isLoading: polLoading, refetch: refetchPolicies } = useCompanyQuery<Policy[]>(
    "time-off-policies", (cid) => getTimeOffPolicies(cid)
  );
  const { data: allRequests = [], isLoading: allLoading, refetch: refetchAll } = useCompanyQuery<Request[]>(
    "time-off-requests-all", (cid) => getAllTimeOffRequests(cid), { enabled: isAdmin }
  );
  const loading = reqLoading || polLoading || (isAdmin && allLoading);

  const load = async () => {
    await Promise.all([refetchRequests(), refetchPolicies(), isAdmin ? refetchAll() : Promise.resolve()]);
  };

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
                actionUrl: approvalsHref("leave"),
              }).catch(() => {});
            }
          }).catch(() => {});
        }).catch(() => {});
      }).catch(() => {});
      setStartDate(""); setEndDate(""); setNote(""); setSelectedPolicy(""); setShowCreate(false);
      await load();
      toast.success("Leave request submitted");
    } catch (err) { console.error("Leave request failed:", err); toast.error("Failed to submit request"); }
    finally { setCreating(false); }
  }

  async function handleCancelRequest(id: string) {
    const req = requests.find((r: Request) => r.id === id);
    const wasApproved = req?.status === "approved";
    const msg = wasApproved
      ? "Cancel this approved leave request? Note: shifts that were removed during approval will need to be manually re-created."
      : "Cancel this leave request?";
    if (!await confirm({ description: msg, variant: "destructive" })) return;
    setDeletingReq(id);
    try { await deleteTimeOffRequest(id); await load(); toast.success("Request cancelled"); }
    catch (err) { console.error(err); toast.error("Failed to cancel request"); }
    finally { setDeletingReq(null); }
  }

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-green-500/15 text-green-600";
    if (s === "denied") return "bg-red-500/15 text-red-600";
    return "bg-amber-500/15 text-amber-600";
  };

  const displayRequests = requests;
  const pendingCount = allRequests.filter((r: Request) => r.status === "pending").length;

  return (
    <PageShell
      title="LEAVE"
      subtitle="Request and track leave days"
      icon={<CalendarOff className="h-5 w-5" />}
      actions={
        <Button size="sm" className="gap-1.5 w-full sm:w-auto" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Request Leave
        </Button>
      }
    >
      <div className="space-y-4">
        {/* Team leave is reviewed in Personnel → Approvals (one approval queue). */}
        {isAdmin && (
          <Link href={approvalsHref("leave")} data-testid="team-leave-link"
            className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-border/50 bg-card px-4 py-3 text-sm hover:bg-accent/50">
            <span>
              Review team leave in <span className="font-medium">Personnel → Approvals</span>
              {pendingCount > 0 && <Badge className="ml-2 h-4 min-w-4 px-1 text-[10px] bg-amber-500/20 text-amber-600">{pendingCount} pending</Badge>}
            </span>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
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
            <p className="text-sm font-medium">No leave requests</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Click &quot;Request Leave&quot; to submit your first request.
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
                  <p className="font-medium text-sm">{r.time_off_policies?.name ?? "Leave Request"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.start_date).toLocaleDateString()} — {new Date(r.end_date).toLocaleDateString()}
                  </p>
                  {r.note && <p className="text-xs text-muted-foreground mt-0.5">{r.note}</p>}
                </div>
                <div className="flex items-center gap-1.5">
                  <Badge className={`text-[10px] ${statusColor(r.status)}`}>{r.status}</Badge>
                  <button onClick={() => handleCancelRequest(r.id)} disabled={deletingReq === r.id}
                    className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete request">
                    {deletingReq === r.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
      <ConfirmDialog />
    </PageShell>
  );
}
