"use client";

import { useState } from "react";
import {
  Clock, CheckCircle2, XCircle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { getCompanyTimeChangeRequests, reviewTimeChangeRequest } from "@/lib/supabase/db";
import { parseUTC } from "@/lib/parse-utc";
import { useCompanyQuery } from "@/hooks/use-company-query";

type TCR = Record<string, unknown> & {
  id: string;
  status: string;
  user_id?: string | null;
  users?: { first_name?: string | null; last_name?: string | null } | null;
  timesheets?: {
    user_id?: string | null;
    clock_in?: string | null;
    clock_out?: string | null;
  } | null;
  requested_clock_in?: string | null;
  requested_clock_out?: string | null;
  reason?: string | null;
  created_at: string;
};

interface CorrectionsTabProps {
  activeCompanyId: string;
  canManage: boolean;
}

export function CorrectionsTab({ activeCompanyId, canManage }: CorrectionsTabProps) {
  const { data: timeChangeReqs = [], isLoading: loading, refetch } = useCompanyQuery<TCR[]>(
    "company-time-change-requests",
    (cid) => getCompanyTimeChangeRequests(cid),
  );
  const [reviewingTCR, setReviewingTCR] = useState<string | null>(null);

  async function handleTCRReview(id: string, status: "approved" | "denied") {
    setReviewingTCR(id);
    try {
      await reviewTimeChangeRequest(id, status);
      // Notify the employee their time correction was reviewed
      const req = timeChangeReqs.find((r: TCR) => r.id === id);
      const reqUserId = req?.user_id ?? (req?.timesheets?.user_id);
      if (reqUserId && activeCompanyId) {
        import("@/lib/services/notification-dispatcher").then(({ dispatch }) => {
          dispatch({
            userId: reqUserId,
            companyId: activeCompanyId!,
            title: `Time Correction ${status === "approved" ? "Approved" : "Denied"}`,
            body: `Your time correction request has been ${status}.`,
            type: "time_change_review",
            actionUrl: "/timeclock",
          }).catch(() => {});
        }).catch(() => {});
      }
      // Reload
      await refetch();
    } catch (err) { console.error(err); }
    finally { setReviewingTCR(null); }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (timeChangeReqs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
        <Clock className="mb-3 h-10 w-10 text-muted-foreground/40" />
        <p className="text-sm font-medium">No time correction requests</p>
        <p className="mt-1 max-w-xs text-xs text-muted-foreground">When employees request changes to their timesheet entries, they&apos;ll appear here for review.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {timeChangeReqs.map((r: TCR) => {
        const u = r.users;
        const ts = r.timesheets;
        const statusColor = r.status === "approved" ? "bg-green-500/15 text-green-600" : r.status === "denied" ? "bg-red-500/15 text-red-500" : "bg-amber-500/15 text-amber-600";
        return (
          <div key={r.id} className={`rounded-xl border bg-card px-4 py-3 space-y-2 ${
            r.status === "pending" ? "border-orange-500/30" : "border-border/50"
          }`}>
            {/* Row 1: Avatar + Name + Status badge */}
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orange-500/10 text-xs font-bold text-orange-500">
                {(u?.first_name?.[0] ?? "")}{(u?.last_name?.[0] ?? "")}
              </div>
              <p className="font-medium text-sm flex-1 min-w-0 truncate">{u?.first_name} {u?.last_name}</p>
              <Badge className={`text-[10px] capitalize shrink-0 ${statusColor}`}>{r.status}</Badge>
            </div>
            {/* Row 2: Time details */}
            <div className="ml-12 space-y-1">
              <p className="text-xs text-muted-foreground">
                Original: {ts?.clock_in ? parseUTC(ts.clock_in).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"} → {ts?.clock_out ? parseUTC(ts.clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—"}
              </p>
              <div className="flex flex-wrap gap-x-4 gap-y-0.5">
                {r.requested_clock_in && (
                  <span className="text-[10px]"><span className="text-muted-foreground">New In:</span> <span className="font-mono font-medium text-blue-400">{parseUTC(r.requested_clock_in).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></span>
                )}
                {r.requested_clock_out && (
                  <span className="text-[10px]"><span className="text-muted-foreground">New Out:</span> <span className="font-mono font-medium text-blue-400">{parseUTC(r.requested_clock_out).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span></span>
                )}
              </div>
              {r.reason && <p className="text-[10px] text-muted-foreground/70 italic line-clamp-2">&ldquo;{r.reason}&rdquo;</p>}
              <p className="text-[9px] text-muted-foreground/50">Submitted {new Date(r.created_at).toLocaleDateString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
            {/* Row 3: Action buttons */}
            {r.status === "pending" && canManage && (
              <div className="flex gap-2 ml-12">
                <Button size="sm" variant="outline"
                  className="h-7 flex-1 gap-1 text-xs text-green-600 border-green-500/30 hover:bg-green-500/10"
                  onClick={() => handleTCRReview(r.id, "approved")}
                  disabled={reviewingTCR === r.id}>
                  {reviewingTCR === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  Approve
                </Button>
                <Button size="sm" variant="outline"
                  className="h-7 flex-1 gap-1 text-xs text-red-500 border-red-500/30 hover:bg-red-500/10"
                  onClick={() => handleTCRReview(r.id, "denied")}
                  disabled={reviewingTCR === r.id}>
                  <XCircle className="h-3 w-3" /> Deny
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
