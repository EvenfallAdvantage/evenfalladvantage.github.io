"use client";

import { useState, useEffect, useCallback } from "react";
import { Coffee, UtensilsCrossed, Play, Square, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  startBreak,
  endBreak,
  getTimesheetBreaks,
  getActiveBreak,
  getBreakPolicy,
  resolveBreakPolicy,
  type TimesheetBreak,
  type BreakType,
  type BreakPolicyConfig,
} from "@/lib/supabase/db-breaks";
import { useAuthStore, useActiveCompany } from "@/stores/auth-store";
import { toast } from "sonner";

interface BreakTrackerProps {
  timesheetId: string;
  compact?: boolean;
  policy?: Partial<BreakPolicyConfig> | null;
  onChange?: () => void;
}

export function BreakTracker({ timesheetId, compact = false, policy: policyProp, onChange }: BreakTrackerProps) {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useActiveCompany();
  const [policy, setPolicy] = useState<BreakPolicyConfig>(() =>
    resolveBreakPolicy(policyProp ?? activeCompany?.settings)
  );
  const [breaks, setBreaks] = useState<TimesheetBreak[]>([]);
  const [activeBreak, setActiveBreak] = useState<TimesheetBreak | null>(null);
  const [busy, setBusy] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (policyProp) {
      setPolicy(resolveBreakPolicy(policyProp));
      return;
    }
    if (activeCompany?.settings?.break_policy) {
      setPolicy(resolveBreakPolicy(activeCompany.settings));
      return;
    }
    if (!activeCompanyId || activeCompanyId === "pending") return;
    let cancelled = false;
    getBreakPolicy(activeCompanyId)
      .then((bp) => {
        if (!cancelled) setPolicy(bp);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [policyProp, activeCompany?.settings, activeCompanyId]);

  const load = useCallback(async () => {
    const [allBreaks, active] = await Promise.all([
      getTimesheetBreaks(timesheetId),
      getActiveBreak(timesheetId),
    ]);
    setBreaks(allBreaks);
    setActiveBreak(active);
  }, [timesheetId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live timer for active break
  useEffect(() => {
    if (!activeBreak) {
      setElapsed(0);
      return;
    }
    const startMs = new Date(activeBreak.startTime).getTime();
    const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - startMs) / 1000)));
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [activeBreak]);

  const completedBreaks = breaks.filter((b) => b.endTime !== null);
  const mealBreaksTaken = completedBreaks.filter((b) => b.breakType === "meal").length;
  const restBreaksTaken = completedBreaks.filter((b) => b.breakType === "rest").length;
  const totalMealMins = completedBreaks
    .filter((b) => b.breakType === "meal")
    .reduce((sum, b) => sum + (b.durationMinutes ?? 0), 0);
  const totalRestMins = completedBreaks
    .filter((b) => b.breakType === "rest")
    .reduce((sum, b) => sum + (b.durationMinutes ?? 0), 0);

  const restLimitReached =
    policy.maxRestBreaksPerShift > 0 && restBreaksTaken >= policy.maxRestBreaksPerShift;

  const handleStart = async (type: BreakType) => {
    if (type === "rest" && restLimitReached) {
      toast.error(`Maximum of ${policy.maxRestBreaksPerShift} rest breaks reached for this shift`);
      return;
    }
    setBusy(true);
    try {
      const id = await startBreak(timesheetId, type);
      if (!id) {
        toast.error("Failed to start break");
        return;
      }
      await load();
      onChange?.();
      if (type === "meal") {
        toast.success(
          `Lunch break started (${policy.mealBreakMinutes}m ${policy.mealBreakPaid ? "paid" : "unpaid"})`
        );
      } else {
        toast.success(
          `Rest break started (${policy.restBreakMinutes}m ${policy.restBreakPaid ? "paid" : "unpaid"})`
        );
      }
    } catch {
      toast.error("Failed to start break");
    } finally {
      setBusy(false);
    }
  };

  const handleEnd = async () => {
    if (!activeBreak) return;
    setBusy(true);
    try {
      const endedType = activeBreak.breakType;
      const ok = await endBreak(activeBreak.id);
      if (!ok) {
        toast.error("Failed to end break");
        return;
      }
      await load();
      onChange?.();
      toast.success(endedType === "meal" ? "Lunch break ended — back on duty" : "Rest break ended — back on duty");
    } catch {
      toast.error("Failed to end break");
    } finally {
      setBusy(false);
    }
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  if (!policy.breaksEnabled && !activeBreak && completedBreaks.length === 0) {
    return null;
  }

  const activeTargetMinutes =
    activeBreak?.breakType === "meal" ? policy.mealBreakMinutes : policy.restBreakMinutes;
  const activeIsPaid =
    activeBreak?.breakType === "meal" ? policy.mealBreakPaid : policy.restBreakPaid;
  const isOverTarget = activeBreak ? elapsed > activeTargetMinutes * 60 : false;

  return (
    <div className={compact ? "space-y-2" : "space-y-2.5"}>
      {/* Active break banner */}
      {activeBreak ? (
        <div
          className={`flex items-center justify-between gap-2 rounded-xl border px-3 py-2.5 animate-pulse ${
            activeBreak.breakType === "meal"
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-sky-500/40 bg-sky-500/10"
          }`}
        >
          <div className="flex items-center gap-2 min-w-0">
            {activeBreak.breakType === "meal" ? (
              <UtensilsCrossed className="h-4 w-4 text-amber-500 shrink-0" />
            ) : (
              <Coffee className="h-4 w-4 text-sky-500 shrink-0" />
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <p
                  className={`text-xs font-semibold ${
                    activeBreak.breakType === "meal"
                      ? "text-amber-600 dark:text-amber-400"
                      : "text-sky-600 dark:text-sky-400"
                  }`}
                >
                  {activeBreak.breakType === "meal" ? "On Lunch Break" : `On Take ${policy.restBreakMinutes} (Rest)`}
                </p>
                <Badge
                  variant="outline"
                  className={`text-[9px] px-1.5 py-0 ${
                    activeIsPaid
                      ? "border-emerald-500/30 text-emerald-500 bg-emerald-500/10"
                      : "border-amber-500/30 text-amber-500 bg-amber-500/10"
                  }`}
                >
                  {activeIsPaid ? "Paid" : "Unpaid"}
                </Badge>
              </div>
              <p className="text-sm font-mono font-bold">
                {formatTimer(elapsed)}{" "}
                <span className="text-[10px] font-normal text-muted-foreground">
                  / {activeTargetMinutes}:00 target
                </span>
                {isOverTarget && (
                  <span className="ml-1.5 text-[10px] font-semibold text-red-500">Over target</span>
                )}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="outline"
            className={`h-8 gap-1.5 shrink-0 ${
              activeBreak.breakType === "meal"
                ? "border-amber-500/40 text-amber-600 hover:bg-amber-500/20"
                : "border-sky-500/40 text-sky-600 hover:bg-sky-500/20"
            }`}
            onClick={handleEnd}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Square className="h-3.5 w-3.5" />}
            {activeBreak.breakType === "meal" ? "End Lunch" : "End Break"}
          </Button>
        </div>
      ) : policy.breaksEnabled ? (
        /* Start break buttons */
        <div className="grid grid-cols-2 gap-2">
          <Button
            size="sm"
            variant="outline"
            className={`${compact ? "h-9" : "h-10"} flex items-center justify-center gap-1.5 text-xs border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/15 text-amber-600 dark:text-amber-400`}
            onClick={() => handleStart("meal")}
            disabled={busy}
          >
            <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-semibold">Take Lunch ({policy.mealBreakMinutes}m)</span>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-[9px] px-1 py-0 border-amber-500/30 text-amber-500"
            >
              {policy.mealBreakPaid ? "Paid" : "Unpaid"}
            </Badge>
            {!compact && <Play className="h-2.5 w-2.5 ml-auto opacity-50 shrink-0" />}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className={`${compact ? "h-9" : "h-10"} flex items-center justify-center gap-1.5 text-xs border-sky-500/30 bg-sky-500/5 hover:bg-sky-500/15 text-sky-600 dark:text-sky-400`}
            onClick={() => handleStart("rest")}
            disabled={busy || restLimitReached}
            title={
              restLimitReached
                ? `All ${policy.maxRestBreaksPerShift} rest breaks used for this shift`
                : `Start a ${policy.restBreakMinutes}-minute ${policy.restBreakPaid ? "paid" : "unpaid"} rest break`
            }
          >
            <Coffee className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate font-semibold">Take {policy.restBreakMinutes} (Rest)</span>
            <Badge
              variant="outline"
              className="hidden sm:inline-flex text-[9px] px-1 py-0 border-sky-500/30 text-sky-500"
            >
              {policy.restBreakPaid ? "Paid" : "Unpaid"}
              {policy.maxRestBreaksPerShift > 0 ? ` · ${restBreaksTaken}/${policy.maxRestBreaksPerShift}` : ""}
            </Badge>
            {!compact && <Play className="h-2.5 w-2.5 ml-auto opacity-50 shrink-0" />}
          </Button>
        </div>
      ) : null}

      {/* Completed breaks summary */}
      {completedBreaks.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          {totalMealMins > 0 && (
            <Badge
              variant="outline"
              className="text-[9px] gap-1 py-0 border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
            >
              <CheckCircle2 className="h-2.5 w-2.5 text-amber-500" />
              Lunch: {totalMealMins}m ({policy.mealBreakPaid ? "paid" : "unpaid"})
              {mealBreaksTaken > 1 ? ` ×${mealBreaksTaken}` : ""}
            </Badge>
          )}
          {totalRestMins > 0 && (
            <Badge
              variant="outline"
              className="text-[9px] gap-1 py-0 border-sky-500/30 bg-sky-500/5 text-sky-600 dark:text-sky-400"
            >
              <CheckCircle2 className="h-2.5 w-2.5 text-sky-500" />
              Rest: {totalRestMins}m ({policy.restBreakPaid ? "paid" : "unpaid"}
              {policy.maxRestBreaksPerShift > 0 ? ` · ${restBreaksTaken}/${policy.maxRestBreaksPerShift}` : ""})
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
