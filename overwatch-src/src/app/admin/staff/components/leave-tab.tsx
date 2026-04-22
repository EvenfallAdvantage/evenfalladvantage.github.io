"use client";

import { useState } from "react";
import {
  CalendarOff, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import {
  getAllTimeOffRequests, reviewTimeOffRequest, removeConflictingShifts,
} from "@/lib/supabase/db";
import { useCompanyQuery } from "@/hooks/use-company-query";

type LeaveReq = Record<string, unknown> & {
  id: string;
  status: string;
  user_id?: string | null;
  users?: {
    id?: string | null;
    first_name?: string | null;
    last_name?: string | null;
  } | null;
  time_off_policies?: { name?: string | null } | null;
  start_date: string;
  end_date: string;
  leave_type?: string | null;
  note?: string | null;
};
type Member = Record<string, unknown> & {
  role: string;
  users?: { id?: string | null } | null;
};

interface LeaveTabProps {
  activeCompanyId: string;
  canManage: boolean;
  members: Member[];
}

export function LeaveTab({ activeCompanyId, canManage, members }: LeaveTabProps) {
  const { data: leaveRequests = [], isLoading: loading, refetch } = useCompanyQuery<LeaveReq[]>(
    "time-off-requests",
    (cid) => getAllTimeOffRequests(cid),
  );
  const [reviewingLeave, setReviewingLeave] = useState<string | null>(null);
  const [leaveFilter, setLeaveFilter] = useState<"pending" | "all">("pending");

  const pendingLeave = leaveRequests.filter((r: LeaveReq) => r.status === "pending");
  const filteredLeave = leaveFilter === "pending" ? pendingLeave : leaveRequests;

  const leaveStatusColor = (s: string) => {
    if (s === "approved") return "bg-green-500/15 text-green-600";
    if (s === "denied") return "bg-red-500/15 text-red-500";
    return "bg-amber-500/15 text-amber-600";
  };

  async function handleLeaveReview(id: string, status: "approved" | "denied") {
    setReviewingLeave(id);
    try {
      await reviewTimeOffRequest(id, status);
      const req = leaveRequests.find((r: LeaveReq) => r.id === id);

      if (req?.user_id && activeCompanyId) {
        const { dispatch } = await import("@/lib/services/notification-dispatcher");

        // Notify the requesting employee
        dispatch({
          userId: req.user_id,
          companyId: activeCompanyId!,
          title: `Leave Request ${status === "approved" ? "Approved" : "Denied"}`,
          body: `Your ${req.leave_type ?? "time off"} request has been ${status}.`,
          type: "leave_review",
          actionUrl: "/time-off",
        }).catch(() => {});

        // If approved, remove conflicting shifts and notify managers
        if (status === "approved" && req.start_date && req.end_date) {
          try {
            const removed = await removeConflictingShifts(req.user_id, req.start_date, req.end_date);
            if (removed.length > 0) {
              const u = req.users ?? req;
              const empName = `${u.first_name ?? ""} ${u.last_name ?? ""}`.trim() || "An employee";
              const shiftList = removed.map((s: { start_time: string; role?: string; events?: { name?: string } }) =>
                `${new Date(s.start_time).toLocaleDateString()} ${s.events?.name ?? ""}${s.role ? ` (${s.role})` : ""}`
              ).join(", ");

              // Notify all managers, admins, and owners about open shifts
              const mgrs = members.filter((m: Member) =>
                hasMinRole(m.role as CompanyRole, "manager") && m.users?.id !== req.user_id
              );
              for (const mgr of mgrs) {
                if (!mgr.users?.id) continue;
                dispatch({
                  userId: mgr.users.id,
                  companyId: activeCompanyId!,
                  title: "Shifts Need Coverage",
                  body: `${empName}'s leave was approved. ${removed.length} shift${removed.length > 1 ? "s" : ""} now open: ${shiftList}`,
                  type: "shift_coverage",
                  actionUrl: "/admin/events",
                }).catch(() => {});
              }
            }
          } catch (err) { console.error("Failed to remove conflicting shifts:", err); }
        }
      }
      // Reload
      await refetch();
    } catch (err) { console.error(err); }
    finally { setReviewingLeave(null); }
  }

  return (
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
                <div className="flex items-center gap-4 flex-wrap">
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
  );
}
