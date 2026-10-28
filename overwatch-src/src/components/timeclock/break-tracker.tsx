"use client";

import { useState, useEffect, useCallback } from "react";
import { Coffee, UtensilsCrossed, Square, Loader2, CheckCircle2 } from "lucide-react";
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
    <div data-testid="break-tracker" className={`flex flex-col items-center ${compact ? "gap-1.5" : "gap-2"} w-full`}>
      {/* Active break compact pill */}
      {activeBreak ? (
        <div
          data-testid="active-break-pill"
          className={`inline-flex flex-wrap items-center justify-center gap-2 rounded-full border px-3 py-1.5 max-w-full ${
            activeBreak.breakType === "meal"
              ? "border-amber-500/40 bg-amber-500/10"
              : "border-sky-500/40 bg-sky-500/10"
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {activeBreak.breakType === "meal" ? (
              <UtensilsCrossed className="h-3.5 w-3.5 text-amber-500 shrink-0" />
            ) : (
              <Coffee className="h-3.5 w-3.5 text-sky-500 shrink-0" />
            )}
            <span
              className={`text-xs font-semibold whitespace-nowrap ${
                activeBreak.breakType === "meal"
                  ? "text-amber-600 dark:text-amber-400"
                  : "text-sky-600 dark:text-sky-400"
              }`}
            >
              {activeBreak.breakType === "meal" ? "On Lunch" : `On Take ${policy.restBreakMinutes}`}
            </span>
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
            <span className="text-xs font-mono font-bold whitespace-nowrap">
              {formatTimer(elapsed)}
              <span className="text-[10px] font-normal text-muted-foreground">/{activeTargetMinutes}:00</span>
            </span>
            {isOverTarget && (
              <span className="text-[10px] font-semibold text-red-500 whitespace-nowrap">Over</span>
            )}
          </div>
          <Button
            size="sm"
            variant="outline"
            data-testid="end-break-button"
            className={`h-6 rounded-full px-2.5 text-[11px] font-semibold gap-1 shrink-0 ${
              activeBreak.breakType === "meal"
                ? "border-amber-500/40 text-amber-600 hover:bg-amber-500/20"
                : "border-sky-500/40 text-sky-600 hover:bg-sky-500/20"
            }`}
            onClick={handleEnd}
            disabled={busy}
          >
            {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
            {activeBreak.breakType === "meal" ? "End Lunch" : "End Break"}
          </Button>
        </div>
      ) : policy.breaksEnabled ? (
        /* Start break compact inline pill cluster */
        <div data-testid="break-controls-cluster" className="flex flex-wrap items-center justify-center gap-2">
          <Button
            size="sm"
            variant="outline"
            data-testid="start-meal-break-button"
            className={`${compact ? "h-7 px-3" : "h-8 px-3.5"} rounded-full inline-flex items-center justify-center gap-1.5 text-xs border-amber-500/30 bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400`}
            onClick={() => handleStart("meal")}
            disabled={busy}
          >
            <UtensilsCrossed className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold whitespace-nowrap">Take Lunch ({policy.mealBreakMinutes}m)</span>
            <span className="text-[10px] opacity-80 whitespace-nowrap">· {policy.mealBreakPaid ? "Paid" : "Unpaid"}</span>
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="start-rest-break-button"
            className={`${compact ? "h-7 px-3" : "h-8 px-3.5"} rounded-full inline-flex items-center justify-center gap-1.5 text-xs border-sky-500/30 bg-sky-500/10 hover:bg-sky-500/20 text-sky-600 dark:text-sky-400`}
            onClick={() => handleStart("rest")}
            disabled={busy || restLimitReached}
            title={
              restLimitReached
                ? `All ${policy.maxRestBreaksPerShift} rest breaks used for this shift`
                : `Start a ${policy.restBreakMinutes}-minute ${policy.restBreakPaid ? "paid" : "unpaid"} rest break`
            }
          >
            <Coffee className="h-3.5 w-3.5 shrink-0" />
            <span className="font-semibold whitespace-nowrap">Take {policy.restBreakMinutes} (Rest)</span>
            <span className="text-[10px] opacity-80 whitespace-nowrap">
              · {policy.restBreakPaid ? "Paid" : "Unpaid"}
              {policy.maxRestBreaksPerShift > 0 ? ` (${restBreaksTaken}/${policy.maxRestBreaksPerShift})` : ""}
            </span>
          </Button>
        </div>
      ) : null}

      {/* Completed breaks summary */}
      {completedBreaks.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-1.5">
          {mealBreaksTaken > 0 && (
            <Badge
              variant="outline"
              className="text-[9px] gap-1 py-0 border-amber-500/30 bg-amber-500/5 text-amber-600 dark:text-amber-400"
            >
              <CheckCircle2 className="h-2.5 w-2.5 text-amber-500" />
              Lunch: {totalMealMins}m ({policy.mealBreakPaid ? "paid" : "unpaid"})
              {mealBreaksTaken > 1 ? ` ×${mealBreaksTaken}` : ""}
            </Badge>
          )}
          {restBreaksTaken > 0 && (
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
