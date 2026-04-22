"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { Clock, Loader2, ScanLine } from "lucide-react";
import {
  getActiveTimesheet,
  clockIn,
  clockOut,
  getRecentTimesheets,
  getTimesheetsForDateRange,
  getActiveShiftsForClockIn,
} from "@/lib/supabase/db";
import { getUserShifts } from "@/lib/supabase/db-operations";
import { parseUTC } from "@/lib/parse-utc";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "sonner";
import Link from "next/link";
import { startLocationWatcher, isLocationSharingEnabled } from "@/lib/supabase/db-location";
import { usePageHeader } from "@/stores/page-header-store";
import dynamic from "next/dynamic";

import { getWeekDates, calcHoursNum, type Timesheet, type Shift } from "@/components/timeclock/timeclock-utils";
import { UpcomingShiftCard } from "@/components/timeclock/upcoming-shift-card";
import { ClockWidget } from "@/components/timeclock/clock-widget";
import { WeeklyHoursCalendar } from "@/components/timeclock/weekly-hours-calendar";
import { RecentWatchLog } from "@/components/timeclock/recent-watch-log";
import { ShiftDetailModal } from "@/components/timeclock/shift-detail-modal";
import { BreakTracker } from "@/components/timeclock/break-tracker";
import { ClockInModal } from "@/components/timeclock/clock-in-modal";
import { logger } from "@/lib/logger";

const ScanPage = dynamic(() => import("@/app/scan/page"), { ssr: false, loading: () => <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> });

function TimeClockInner() {
  const searchParams = useSearchParams();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const authUser = useAuthStore((s) => s.user);
  const companyId = activeCompany?.companyId ?? "";

  const initialTab = searchParams.get("tab") === "mass-clock" ? "mass-clock" : "clock";
  const [watchTab, setWatchTab] = useState<"clock" | "mass-clock">(initialTab as "clock" | "mass-clock");
  const isManager = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    const icons: Record<string, React.ReactNode> = {
      "clock": <Clock className="h-5 w-5" />,
      "mass-clock": <ScanLine className="h-5 w-5" />,
    };
    setHeader("WATCH LOG", "Clock in/out and track your duty hours", icons[watchTab] ?? <Clock className="h-5 w-5" />);
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
  const [detectedShifts, setDetectedShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");
  const locationStopRef = useRef<(() => void) | null>(null);

  const weekDates = getWeekDates(weekOffset);

  const load = useCallback(async () => {
    try {
      const [ts, history] = await Promise.all([
        getActiveTimesheet(activeCompanyId ?? undefined),
        getRecentTimesheets(20, activeCompanyId ?? undefined),
      ]);
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
    const id = setInterval(() => { load(); }, 15000);
    return () => clearInterval(id);
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

  async function handleClockIn() {
    if (!companyId) return;
    setLoadingShifts(true);
    setShowClockInModal(true);
    try {
      const shifts = await getActiveShiftsForClockIn(companyId);
      setDetectedShifts(shifts);
    } catch {
      setDetectedShifts([]);
    } finally {
      setLoadingShifts(false);
    }
  }

  async function handleShiftClockIn(shift: Shift) {
    setActing(true);
    setShowClockInModal(false);
    try {
      await clockIn({
        shiftId: shift.id,
        eventId: shift.events?.id ?? shift.event_id,
        companyId: activeCompanyId ?? undefined,
        clockInType: "shift",
      });
      await startLocationIfEnabled();
      await load();
      toast.success("Clocked in");
    } catch (err) { console.error("Clock in failed:", err); toast.error("Clock in failed"); }
    finally { setActing(false); setDetectedShifts([]); }
  }

  async function handleAdminClockIn() {
    if (!adminNotes.trim()) return;
    setActing(true);
    setShowClockInModal(false);
    try {
      await clockIn({ clockInType: "admin", notes: adminNotes.trim(), companyId: activeCompanyId ?? undefined });
      await startLocationIfEnabled();
      await load();
      toast.success("Clocked in (admin)");
    } catch (err) { console.error("Clock in failed:", err); toast.error("Clock in failed"); }
    finally { setActing(false); setAdminNotes(""); setDetectedShifts([]); }
  }

  async function handleQuickClockIn() {
    setActing(true);
    try {
      await clockIn({ companyId: activeCompanyId ?? undefined });
      await startLocationIfEnabled();
      await load();
      toast.success("Clocked in");
    } catch (err) { console.error("Clock in failed:", err); toast.error("Clock in failed"); }
    finally { setActing(false); }
  }

  async function handleClockOut() {
    if (!active) return;
    setActing(true);
    try {
      if (locationStopRef.current) { locationStopRef.current(); locationStopRef.current = null; }
      await clockOut(active.id);
      await load();
      toast.success("Clocked out");
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
      .reduce((sum: number, t: Timesheet) => sum + calcHoursNum(t.clock_in, t.clock_out), 0);
  });
  const weekTotal = weekHours.reduce((a, b) => a + b, 0);
  const isCurrentWeek = weekOffset === 0;

  return (
    <>
      <div className="space-y-4">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto max-w-full">
          <button onClick={() => setWatchTab("clock")}
            className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${watchTab === "clock" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
            {watchTab === "clock" && <Clock className="h-3.5 w-3.5 text-primary" />}
            Clock
          </button>
          {isManager && (
            <button onClick={() => setWatchTab("mass-clock")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${watchTab === "mass-clock" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              {watchTab === "mass-clock" && <ScanLine className="h-3.5 w-3.5 text-primary" />}
              Mass Clock
            </button>
          )}
          <Link href="/patrols"
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors">
            Patrols
          </Link>
        </div>

        {/* Clock Tab Content */}
        {watchTab === "clock" && <>
          {nextShift && <UpcomingShiftCard shift={nextShift} />}
          <ClockWidget active={active} loading={loading} acting={acting} elapsed={elapsed} onClockIn={handleClockIn} onClockOut={handleClockOut} />
          {/* Break tracker — visible when clocked in */}
          {active?.id && <BreakTracker timesheetId={active.id} />}
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
        {watchTab === "mass-clock" && isManager && <ScanPage />}
      </div>

      {selectedEntry && (
        <ShiftDetailModal entry={selectedEntry} companyId={companyId} onClose={() => setSelectedEntry(null)} />
      )}

      {showClockInModal && (
        <ClockInModal
          detectedShifts={detectedShifts} loadingShifts={loadingShifts} acting={acting}
          adminNotes={adminNotes} onAdminNotesChange={setAdminNotes}
          onShiftClockIn={handleShiftClockIn} onAdminClockIn={handleAdminClockIn} onQuickClockIn={handleQuickClockIn}
          onClose={() => { setShowClockInModal(false); setAdminNotes(""); }}
        />
      )}
    </>
  );
}

export default function TimeClockPage() {
  return <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}><TimeClockInner /></Suspense>;
}
