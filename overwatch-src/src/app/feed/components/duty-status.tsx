"use client";

import { useEffect, useState, useCallback } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import {
  Clock, LogIn, LogOut, Loader2, Zap, UtensilsCrossed, Coffee,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  getActiveTimesheet, getRecentTimesheets,
} from "@/lib/supabase/db";
import { getActiveShiftsForClockIn } from "@/lib/supabase/db-timesheets";
import { ClockInModal } from "@/components/timeclock/clock-in-modal";
import { BreakTracker } from "@/components/timeclock/break-tracker";
import { calcBreakSummary, calcPayableHoursNum } from "@/components/timeclock/timeclock-utils";
import { cachedRead, isOffline, writeCache } from "@/lib/offline/cached-read";
import { clockInOffline, clockOutOffline, isPendingSync } from "@/lib/offline/with-offline";
import { toast } from "sonner";
import { parseUTC } from "@/lib/parse-utc";
import { DarSignoffModal } from "@/components/dar-signoff-modal";
import { useAuthStore, useActiveCompany } from "@/stores/auth-store";
import { formatDuration, type Timesheet } from "./shared";

/** Thrown after an offline clock-in so callers skip the live reload. */
class OfflineHandled extends Error {}

interface DutyStatusProps {
  activeCompanyId: string | null;
  onReload?: () => void;
}

export function DutyStatus({ activeCompanyId, onReload }: DutyStatusProps) {
  const [active, setActive] = useState<Timesheet | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recentShifts, setRecentShifts] = useState<Timesheet[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);

  // Clock-in modal state
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [darTimesheetId, setDarTimesheetId] = useState<string | null>(null);
  const authUser = useAuthStore((s) => s.user);
  const activeCompany = useActiveCompany();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detectedShifts, setDetectedShifts] = useState<any[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const key = `duty:${activeCompanyId ?? "none"}`;
      const [ts, history] = await cachedRead(key, () => Promise.all([
        getActiveTimesheet(activeCompanyId ?? undefined),
        getRecentTimesheets(3, activeCompanyId ?? undefined),
      ]));
      setActive(ts);
      setRecentShifts(history.filter((t: Timesheet) => t.clock_out));
    } catch {
      // DB may not be ready
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => {
    load();
  }, [load]);

  // Auto-refresh clock status every 15 seconds (picks up manager badge scans)
  useEffect(() => {
    // Paused while hidden; the visibilitychange effect below refreshes on return.
    return setVisibleInterval(() => { load(); }, 15000, { refreshOnVisible: false });
  }, [load]);

  // Immediately refresh when tab becomes visible again
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "visible") load();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [load]);

  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - parseUTC(active.clock_in).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  const isClockedIn = !!active;
  const breakSummary = active ? calcBreakSummary(active, activeCompany?.settings) : null;
  const activeBreak = breakSummary?.activeBreak ?? null;
  const netElapsedMs = breakSummary
    ? Math.max(0, elapsed - breakSummary.unpaidMinutes * 60000)
    : elapsed;

  const todayHours = recentShifts
    .filter((t: Timesheet) => {
      const d = parseUTC(t.clock_in);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    })
    .reduce((sum: number, t: Timesheet) => {
      return sum + calcPayableHoursNum(t.clock_in, t.clock_out, t, activeCompany?.settings) * 3600000;
    }, 0);

  /** Clock in live, or queue it (with the real tap time) when there's no signal. */
  async function doClockIn(params: Parameters<typeof clockInOffline>[0]) {
    const r = await clockInOffline(params);
    if (isPendingSync(r)) {
      const optimistic = { id: r.__mutationId, clock_in: new Date().toISOString(), clock_out: null, ...params } as unknown as Timesheet;
      writeCache(`duty:${activeCompanyId ?? "none"}`, [optimistic, recentShifts]);
      setActive(optimistic);
      toast.success("Clocked in offline. It will sync with the time you tapped.");
      throw new OfflineHandled();
    }
  }

  async function handleClock() {
    if (active) {
      setActing(true);
      try {
        const r = await clockOutOffline(active.id);
        if (isPendingSync(r)) {
          writeCache(`duty:${activeCompanyId ?? "none"}`, [null, recentShifts]);
          setActive(null);
          toast.success("Clocked out offline. It will sync with the time you tapped.");
        } else { const sheetId = active.id; await load(); setDarTimesheetId(sheetId); }
        onReload?.();
      } catch (err) {
        console.error("Clock out failed:", err);
      } finally {
        setActing(false);
      }
    } else {
      setLoadingShifts(true);
      setShowClockInModal(true);
      try {
        const shifts = await cachedRead(`shifts-now:${activeCompanyId}`, () => getActiveShiftsForClockIn(activeCompanyId!));
        setDetectedShifts(shifts);
      } catch {
        setDetectedShifts([]);
      } finally {
        setLoadingShifts(false);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleShiftClockIn(shift: any, notes?: string) {
    setActing(true);
    setShowClockInModal(false);
    try {
      await doClockIn({
        shiftId: shift.id,
        eventId: shift.events?.id ?? shift.event_id,
        companyId: activeCompanyId ?? undefined,
        clockInType: "shift",
        ...(notes ? { notes } : {}),
      });
      await load();
      onReload?.();
    } catch (err) {
      if (!(err instanceof OfflineHandled)) { console.error("Clock in failed:", err); toast.error(isOffline() ? "No connection and couldn't save offline." : "Clock in failed. Try again."); }
    } finally {
      setActing(false);
      setDetectedShifts([]);
    }
  }

  async function handleAdminClockIn() {
    if (!adminNotes.trim()) return;
    setActing(true);
    setShowClockInModal(false);
    try {
      await doClockIn({ clockInType: "admin", notes: adminNotes.trim(), companyId: activeCompanyId ?? undefined });
      await load();
      onReload?.();
    } catch (err) {
      if (!(err instanceof OfflineHandled)) { console.error("Clock in failed:", err); toast.error(isOffline() ? "No connection and couldn't save offline." : "Clock in failed. Try again."); }
    } finally {
      setActing(false);
      setAdminNotes("");
      setDetectedShifts([]);
    }
  }

  async function handleQuickClockIn() {
    setActing(true);
    setShowClockInModal(false);
    try {
      await doClockIn({ companyId: activeCompanyId ?? undefined });
      await load();
      onReload?.();
    } catch (err) {
      if (!(err instanceof OfflineHandled)) { console.error("Clock in failed:", err); toast.error(isOffline() ? "No connection and couldn't save offline." : "Clock in failed. Try again."); }
    } finally {
      setActing(false);
    }
  }

  return (
    <>
      {/* Duty Status Widget */}
      <Card className={`overflow-hidden ${isClockedIn ? "border-green-500/30" : "border-border/50"}`}>
        <CardContent className="p-0">
          <div className={`flex items-center gap-3 sm:gap-4 p-4 sm:p-5 ${isClockedIn ? "bg-gradient-to-r from-green-500/10 via-green-500/5 to-transparent" : "bg-gradient-to-r from-primary/5 to-transparent"}`}>
            <div className={`relative flex h-12 w-12 sm:h-16 sm:w-16 shrink-0 items-center justify-center rounded-2xl ${isClockedIn ? "bg-green-500/15" : "bg-primary/10"}`}>
              {loading ? (
                <Loader2 className="h-6 w-6 sm:h-7 sm:w-7 animate-spin text-muted-foreground" />
              ) : (
                <Clock className={`h-6 w-6 sm:h-7 sm:w-7 ${isClockedIn ? "text-green-500" : "text-primary"}`} />
              )}
              {isClockedIn && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex h-4 w-4 rounded-full bg-green-500" />
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isClockedIn ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"}`}>
                  <Zap className="h-3 w-3" />
                  {isClockedIn ? "ON DUTY" : "OFF DUTY"}
                </span>
                {isClockedIn && activeBreak && (
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                      activeBreak.breakType === "meal"
                        ? "bg-amber-500/20 text-amber-600 dark:text-amber-400"
                        : "bg-sky-500/20 text-sky-600 dark:text-sky-400"
                    }`}
                  >
                    {activeBreak.breakType === "meal" ? (
                      <UtensilsCrossed className="h-2.5 w-2.5" />
                    ) : (
                      <Coffee className="h-2.5 w-2.5" />
                    )}
                    {activeBreak.breakType === "meal" ? "ON LUNCH" : "ON BREAK"}
                  </span>
                )}
              </div>
              {isClockedIn ? (
                <p className="mt-1 font-mono text-xl sm:text-2xl font-bold tracking-wider text-green-600">
                  {formatDuration(netElapsedMs)}
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
                size="default"
                className={`shrink-0 gap-1.5 sm:gap-2 rounded-xl px-3 sm:px-6 text-xs sm:text-sm font-semibold ${isClockedIn ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
                onClick={handleClock}
                disabled={acting}
              >
                {acting ? <Loader2 className="h-4 w-4 animate-spin" /> : isClockedIn ? <LogOut className="h-4 w-4" /> : <LogIn className="h-4 w-4" />}
                {isClockedIn ? "Clock Out" : "Clock In"}
              </Button>
            )}
          </div>
          {isClockedIn && active?.id && !String(active.id).startsWith("offline-") && (
            <div className="border-t border-border/30 bg-muted/10 px-4 py-2.5 sm:px-5">
              <BreakTracker timesheetId={active.id} compact onChange={load} />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Clock-In Modal (shared with /timeclock) */}
      {showClockInModal && (
        <ClockInModal
          detectedShifts={detectedShifts} loadingShifts={loadingShifts} acting={acting}
          adminNotes={adminNotes} onAdminNotesChange={setAdminNotes}
          onShiftClockIn={handleShiftClockIn} onAdminClockIn={handleAdminClockIn} onQuickClockIn={handleQuickClockIn}
          onClose={() => { setShowClockInModal(false); setAdminNotes(""); }}
          companyId={activeCompanyId}
        />
      )}
      <DarSignoffModal
        key={darTimesheetId ?? "none"}
        open={!!darTimesheetId}
        onClose={() => setDarTimesheetId(null)}
        timesheetId={darTimesheetId}
        companyId={activeCompanyId}
        userId={authUser?.id ?? null}
        defaultName={`${authUser?.firstName ?? ""} ${authUser?.lastName ?? ""}`.trim()}
      />
    </>
  );
}
