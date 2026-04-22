"use client";

import { useEffect, useState, useCallback } from "react";
import { ArrowLeftRight, Check, X, Loader2, HandHelping } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth-store";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import {
  getOpenSwapRequests, getMySwapRequests, getPendingSwapApprovals,
  claimSwapRequest, approveSwapRequest, rejectSwapRequest, cancelSwapRequest,
  type ShiftSwapRequest,
} from "@/lib/supabase/db";
import { logger } from "@/lib/logger";

export function ShiftSwapTab() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const role = activeCompany?.role ?? "staff";
  const isManager = hasMinRole(role as CompanyRole, "manager");

  const [openSwaps, setOpenSwaps] = useState<ShiftSwapRequest[]>([]);
  const [mySwaps, setMySwaps] = useState<ShiftSwapRequest[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<ShiftSwapRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    try {
      const [open, mine, pending] = await Promise.all([
        getOpenSwapRequests(activeCompanyId),
        getMySwapRequests(),
        isManager ? getPendingSwapApprovals(activeCompanyId) : Promise.resolve([]),
      ]);
      setOpenSwaps(open);
      setMySwaps(mine);
      setPendingApprovals(pending);
    } catch (e) { logger.swallow("shift-swap:load", e, "warn"); }
    finally { setLoading(false); }
  }, [activeCompanyId, isManager]);

  useEffect(() => { load(); }, [load]);

  async function handleClaim(swapId: string) {
    setActing(swapId);
    try {
      const ok = await claimSwapRequest(swapId);
      if (ok) { toast.success("Shift claimed! Awaiting manager approval."); await load(); }
      else toast.error("Unable to claim this shift.");
    } catch { toast.error("Failed to claim shift."); }
    finally { setActing(null); }
  }

  async function handleApprove(swapId: string) {
    setActing(swapId);
    try {
      const ok = await approveSwapRequest(swapId);
      if (ok) { toast.success("Swap approved and shift reassigned."); await load(); }
      else toast.error("Unable to approve swap.");
    } catch { toast.error("Failed to approve swap."); }
    finally { setActing(null); }
  }

  async function handleReject(swapId: string) {
    setActing(swapId);
    try {
      await rejectSwapRequest(swapId);
      toast.success("Swap request rejected.");
      await load();
    } catch { toast.error("Failed to reject swap."); }
    finally { setActing(null); }
  }

  async function handleCancel(swapId: string) {
    setActing(swapId);
    try {
      await cancelSwapRequest(swapId);
      toast.success("Swap request cancelled.");
      await load();
    } catch { toast.error("Failed to cancel."); }
    finally { setActing(null); }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const noData = openSwaps.length === 0 && mySwaps.length === 0 && pendingApprovals.length === 0;

  return (
    <div className="space-y-6">
      {noData && (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
          <ArrowLeftRight className="mb-3 h-10 w-10 text-muted-foreground/40" />
          <p className="text-sm font-medium">No shift swaps</p>
          <p className="mt-1 max-w-xs text-xs text-muted-foreground">When someone offers a shift for swap, it will appear here. You can also offer your own shifts from the schedule tab.</p>
        </div>
      )}

      {/* Manager: Pending Approvals */}
      {isManager && pendingApprovals.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Pending Approval ({pendingApprovals.length})</h3>
          {pendingApprovals.map((s) => (
            <SwapCard key={s.id} swap={s} type="approval" acting={acting} onApprove={handleApprove} onReject={handleReject} />
          ))}
        </div>
      )}

      {/* Available swaps to claim */}
      {openSwaps.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Available Shifts ({openSwaps.length})</h3>
          {openSwaps.map((s) => (
            <SwapCard key={s.id} swap={s} type="claim" acting={acting} onClaim={handleClaim} />
          ))}
        </div>
      )}

      {/* My swap requests */}
      {mySwaps.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">My Swap Requests ({mySwaps.length})</h3>
          {mySwaps.map((s) => (
            <SwapCard key={s.id} swap={s} type="mine" acting={acting} onCancel={handleCancel} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Sub-component ────────────────────────────────────────

function SwapCard({
  swap, type, acting, onClaim, onApprove, onReject, onCancel,
}: {
  swap: ShiftSwapRequest;
  type: "claim" | "approval" | "mine";
  acting: string | null;
  onClaim?: (id: string) => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  onCancel?: (id: string) => void;
}) {
  const isActing = acting === swap.id;
  const statusColors: Record<string, string> = {
    open: "bg-blue-500/15 text-blue-500",
    claimed: "bg-amber-500/15 text-amber-500",
    approved: "bg-green-500/15 text-green-500",
    rejected: "bg-red-500/15 text-red-500",
    cancelled: "bg-muted text-muted-foreground",
  };

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card/50 px-4 py-3 flex-wrap">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 shrink-0">
        <ArrowLeftRight className="h-4 w-4 text-primary" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{swap.eventName}</p>
        <p className="text-[11px] text-muted-foreground">
          {swap.shiftDate} · {swap.shiftStart?.slice(0, 5)} — {swap.shiftEnd?.slice(0, 5)} · {swap.shiftRole || "General"}
        </p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          {type === "mine" ? "Your request" : `Offered by ${swap.requesterName}`}
          {swap.reason && ` · "${swap.reason}"`}
        </p>
        {type === "approval" && swap.replacementName && (
          <p className="text-[10px] text-green-600 mt-0.5 flex items-center gap-1">
            <HandHelping className="h-2.5 w-2.5" /> Claimed by {swap.replacementName}
          </p>
        )}
      </div>
      <Badge className={`text-[9px] ${statusColors[swap.status] ?? ""}`}>{swap.status}</Badge>
      <div className="flex items-center gap-1">
        {type === "claim" && swap.status === "open" && (
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => onClaim?.(swap.id)} disabled={isActing}>
            {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <HandHelping className="h-3 w-3" />}
            Claim
          </Button>
        )}
        {type === "approval" && (
          <>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-green-600 border-green-500/30" onClick={() => onApprove?.(swap.id)} disabled={isActing}>
              {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              Approve
            </Button>
            <Button size="sm" variant="outline" className="h-7 gap-1 text-xs text-red-500 border-red-500/30" onClick={() => onReject?.(swap.id)} disabled={isActing}>
              <X className="h-3 w-3" /> Reject
            </Button>
          </>
        )}
        {type === "mine" && (swap.status === "open" || swap.status === "claimed") && (
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-muted-foreground" onClick={() => onCancel?.(swap.id)} disabled={isActing}>
            {isActing ? <Loader2 className="h-3 w-3 animate-spin" /> : <X className="h-3 w-3" />}
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
