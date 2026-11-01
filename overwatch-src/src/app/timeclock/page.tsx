"use client";

import { SubTab, SubTabList } from "@/components/ui/sub-tabs";
import { useEffect, useState, useCallback, useRef } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { useSearchParams, useRouter } from "next/navigation";
import { resolveClockTab, type ClockTab } from "@/lib/timeclock/clock-tabs";
import { Suspense } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { Clock, Loader2, ScanLine } from "lucide-react";
import { cachedRead, isOffline, writeCache } from "@/lib/offline/cached-read";
import { clockInOffline, clockOutOffline, isPendingSync } from "@/lib/offline/with-offline";
import {
  getActiveTimesheet,
  getRecentTimesheets,
  getTimesheetsForDateRange,
  getActiveShiftsForClockIn,
} from "@/lib/supabase/db";
import { getUserShifts } from "@/lib/supabase/db-operations";
import { parseUTC } from "@/lib/parse-utc";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import { startLocationWatcher, isLocationSharingEnabled } from "@/lib/supabase/db-location";
import { usePageHeader } from "@/stores/page-header-store";
import dynamic from "next/dynamic";

import { getWeekDates, calcPayableHoursNum, type Timesheet, type Shift } from "@/components/timeclock/timeclock-utils";
import { UpcomingShiftCard } from "@/components/timeclock/upcoming-shift-card";
import { ClockWidget } from "@/components/timeclock/clock-widget";
import { WeeklyHoursCalendar } from "@/components/timeclock/weekly-hours-calendar";
import { RecentWatchLog } from "@/components/timeclock/recent-watch-log";
import { ShiftDetailModal } from "@/components/timeclock/shift-detail-modal";
import { ClockInModal } from "@/components/timeclock/clock-in-modal";
import { DarSignoffModal } from "@/components/dar-signoff-modal";
import { logger } from "@/lib/logger";

const ScanPage = dynamic(() => import("@/app/scan/page"), { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> });

function TimeClockInner() {
  const searchParams = useSearchParams();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const authUser = useAuthStore((s) => s.user);
  const companyId = activeCompany?.companyId ?? "";

  const router = useRouter();
  const isManager = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");
  const resolved = resolveClockTab(searchParams.get("tab"), isManager);
  const [watchTab, setWatchTab] = useState<ClockTab>(resolved.tab);

  // Old ?tab=tasks / ?tab=patrols links now go to their own screens.
  useEffect(() => {
    if (resolved.redirect) router.replace(resolved.redirect);
  }, [resolved.redirect, router]);

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    const icons: Record<string, React.ReactNode> = {
      "clock": <Clock className="h-5 w-5" />,
      "mass-clock": <ScanLine className="h-5 w-5" />,
    };
    const heads: Record<string, [string, string]> = {
      "clock": ["CLOCK", "Clock in/out and track your duty hours"],
      "mass-clock": ["MASS CLOCK", "Clock a whole crew in or out at once"],
    };
    const [title, subtitle] = heads[watchTab] ?? heads.clock;
    setHeader(title, subtitle, icons[watchTab] ?? <Clock className="h-5 w-5" />);
    return () => clearHeader();
  }, [setHeader, clearHeader, watchTab]);

  const [active, setActive] = useState<Timesheet | null>(null);
  const [recent, setRecent] = useState<Timesheet[]>([]);
  const [weekTimesheets, setWeekTimesheets] = useState<Timesheet[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [nextShift, setNextShift] = useState<Shift | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Timesheet | null>(null);
  // Smart clock-in state
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [darTimesheetId, setDarTimesheetId] = useState<string | null>(null);
  const [detectedShifts, setDetectedShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const locationStopRef = useRef<(() => void) | null>(null);

  const weekDates = getWeekDates(weekOffset);

  const load = useCallback(async () => {
    try {
      const [ts, history] = await cachedRead(`timeclock:${activeCompanyId ?? "none"}`, () => Promise.all([
        getActiveTimesheet(activeCompanyId ?? undefined),
        getRecentTimesheets(20, activeCompanyId ?? undefined),
      ]));
      setActive(ts);
      setRecent(history.filter((t: Timesheet) => t.clock_out));
    } catch {
      // DB may not be ready
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  // Load upcoming shift
  useEffect(() => {
    if (!companyId) return;
    getUserShifts(companyId).then((shifts) => {
      const now = new Date();
      const upcoming = shifts.filter((s: Shift) => parseUTC(s.start_time) > now);
      setNextShift(upcoming[0] ?? null);
    }).catch(() => {});
  }, [companyId]);

  // Load week timesheets
  useEffect(() => {
    const dates = getWeekDates(weekOffset);
    const start = dates[0].toISOString();
    const end = new Date(dates[6].getTime() + 86400000 - 1).toISOString();
    getTimesheetsForDateRange(start, end, activeCompanyId ?? undefined).then(setWeekTimesheets).catch(() => {});
  }, [weekOffset, recent, activeCompanyId]);

  useEffect(() => { load(); }, [load]);

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

  // Live elapsed timer
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - parseUTC(active.clock_in).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  // Auto-start location tracking based on profile preference
  async function startLocationIfEnabled() {
    if (!authUser?.id || !activeCompanyId) return;
    try {
      const enabled = await isLocationSharingEnabled(activeCompanyId);
      if (enabled) {
        locationStopRef.current = startLocationWatcher(authUser.id, activeCompanyId);
      }
    } catch (e) { logger.swallow("timeclock:location-start", e, "debug"); }
  }

  /**
   * Clock in live, or queue it with the real tap time when there's no signal.
   * Returns true when it was queued (caller shows the offline toast, skips reload).
   */
  async function doClockIn(params: Parameters<typeof clockInOffline>[0]): Promise<boolean> {
    const r = await clockInOffline(params);
    if (!isPendingSync(r)) return false;
    const optimistic = { id: r.__mutationId, clock_in: new Date().toISOString(), clock_out: null, event_id: params?.eventId ?? null, shift_id: params?.shiftId ?? null } as unknown as Timesheet;
    writeCache(`timeclock:${activeCompanyId ?? "none"}`, [optimistic, recent]);
    setActive(optimistic);
    setShowClockInModal(false);
    toast.success("Clocked in offline. It will sync with the time you tapped.");
    return true;
  }

  async function handleClockIn() {
    if (!companyId) return;
    setLoadingShifts(true);
    setShowClockInModal(true);
    try {
      const shifts = await cachedRead(`shifts-now:${companyId}`, () => getActiveShiftsForClockIn(companyId));
      setDetectedShifts(shifts);
    } catch {
      setDetectedShifts([]);
    } finally {
      setLoadingShifts(false);
    }
  }

  async function handleShiftClockIn(shift: Shift, notes?: string) {
    setActing(true);
    setShowClockInModal(false);
    try {
      const queued = await doClockIn({
        shiftId: shift.id,
        eventId: shift.events?.id ?? shift.event_id,
        companyId: activeCompanyId ?? undefined,
        clockInType: "shift",
        ...(notes ? { notes } : {}),
      });
      if (!queued) { await startLocationIfEnabled(); await load(); toast.success("Clocked in"); }
    } catch (err) { console.error("Clock in failed:", err); toast.error(isOffline() ? "No connection and couldn't save offline." : "Clock in failed"); }
    finally { setActing(false); setDetectedShifts([]); }
  }

  async function handleAdminClockIn() {
    if (!adminNotes.trim()) return;
    setActing(true);
    setShowClockInModal(false);
    try {
      const queued = await doClockIn({ clockInType: "admin", notes: adminNotes.trim(), companyId: activeCompanyId ?? undefined });
      if (!queued) { await startLocationIfEnabled(); await load(); toast.success("Clocked in (admin)"); }
    } catch (err) { console.error("Clock in failed:", err); toast.error(isOffline() ? "No connection and couldn't save offline." : "Clock in failed"); }
    finally { setActing(false); setAdminNotes(""); setDetectedShifts([]); }
  }

  async function handleQuickClockIn() {
    setActing(true);
    try {
      const queued = await doClockIn({ companyId: activeCompanyId ?? undefined });
      if (!queued) { await startLocationIfEnabled(); await load(); toast.success("Clocked in"); }
    } catch (err) { console.error("Clock in failed:", err); toast.error(isOffline() ? "No connection and couldn't save offline." : "Clock in failed"); }
    finally { setActing(false); }
  }

  async function handleClockOut() {
    if (!active) return;
    setActing(true);
    try {
      if (locationStopRef.current) { locationStopRef.current(); locationStopRef.current = null; }
      const r = await clockOutOffline(active.id);
      if (isPendingSync(r)) {
        writeCache(`timeclock:${activeCompanyId ?? "none"}`, [null, recent]);
        setActive(null);
        toast.success("Clocked out offline. It will sync with the time you tapped.");
      } else { const sheetId = active.id; await load(); toast.success("Clocked out"); setDarTimesheetId(sheetId); }
    } catch (err) { console.error("Clock out failed:", err); toast.error("Clock out failed"); } finally { setActing(false); }
  }

  // Compute weekly hours per day
  const weekHours: number[] = weekDates.map(date => {
    const dayStart = new Date(date); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(date); dayEnd.setHours(23, 59, 59, 999);
    return weekTimesheets
      .filter((t: Timesheet) => {
        const ci = parseUTC(t.clock_in);
        return ci >= dayStart && ci <= dayEnd && t.clock_out;
      })
      .reduce((sum: number, t: Timesheet) => sum + calcPayableHoursNum(t.clock_in, t.clock_out, t, activeCompany?.settings), 0);
  });
  const weekTotal = weekHours.reduce((a, b) => a + b, 0);
  const isCurrentWeek = weekOffset === 0;

  return (
    <>
      <div className="space-y-4">
        {/* Tabs */}
        <SubTabList>
          <SubTab active={watchTab === "clock"} onClick={() => setWatchTab("clock")} icon={Clock}>
            Clock
          </SubTab>
          {isManager && (
            <SubTab active={watchTab === "mass-clock"} onClick={() => setWatchTab("mass-clock")} icon={ScanLine}>
              Mass Clock
            </SubTab>
          )}
        </SubTabList>

        {/* Clock Tab Content */}
        {watchTab === "clock" && <>
          {nextShift && <UpcomingShiftCard shift={nextShift} />}
          <ClockWidget active={active} loading={loading} acting={acting} elapsed={elapsed} onClockIn={handleClockIn} onClockOut={handleClockOut} onBreakChange={load} />
          <WeeklyHoursCalendar
            weekDates={weekDates} weekHours={weekHours} weekTotal={weekTotal}
            weekOffset={weekOffset} isCurrentWeek={isCurrentWeek}
            onPrevWeek={() => setWeekOffset(w => w - 1)}
            onNextWeek={() => setWeekOffset(w => w + 1)}
            onGoToToday={() => setWeekOffset(0)}
          />
          <RecentWatchLog recent={recent} onSelectEntry={setSelectedEntry} />
        </>}

        {/* Mass Clock Tab Content */}
        {watchTab === "mass-clock" && isManager && <ScanPage embedded />}

      </div>

      {selectedEntry && (
        <ShiftDetailModal entry={selectedEntry} companyId={companyId} onClose={() => setSelectedEntry(null)} />
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
      {showClockInModal && (
        <ClockInModal
          detectedShifts={detectedShifts} loadingShifts={loadingShifts} acting={acting}
          adminNotes={adminNotes} onAdminNotesChange={setAdminNotes}
          onShiftClockIn={handleShiftClockIn} onAdminClockIn={handleAdminClockIn} onQuickClockIn={handleQuickClockIn}
          onClose={() => { setShowClockInModal(false); setAdminNotes(""); }}
          companyId={companyId}
        />
      )}
    </>
  );
}

export default function TimeClockPage() {
  return <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}><TimeClockInner /></Suspense>;
}
