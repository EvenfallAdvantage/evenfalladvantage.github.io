"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Clock, LogIn, LogOut, Loader2, Zap, X, MapPin,
  CalendarDays, Briefcase, Flag,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getActiveTimesheet, clockIn, clockOut, getRecentTimesheets,
} from "@/lib/supabase/db";
import { getActiveShiftsForClockIn } from "@/lib/supabase/db-timesheets";
import { parseUTC } from "@/lib/parse-utc";
import { formatDuration, type Timesheet } from "./shared";

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [detectedShifts, setDetectedShifts] = useState<any[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  const load = useCallback(async () => {
    try {
      const [ts, history] = await Promise.all([
        getActiveTimesheet(activeCompanyId ?? undefined),
        getRecentTimesheets(3, activeCompanyId ?? undefined),
      ]);
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

  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - parseUTC(active.clock_in).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

  const isClockedIn = !!active;

  const todayHours = recentShifts
    .filter((t: Timesheet) => {
      const d = parseUTC(t.clock_in);
      const now = new Date();
      return d.toDateString() === now.toDateString();
    })
    .reduce((sum: number, t: Timesheet) => {
      return sum + (parseUTC(t.clock_out).getTime() - parseUTC(t.clock_in).getTime());
    }, 0);

  async function handleClock() {
    if (active) {
      setActing(true);
      try {
        await clockOut(active.id);
        await load();
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
        const shifts = await getActiveShiftsForClockIn(activeCompanyId!);
        setDetectedShifts(shifts);
      } catch {
        setDetectedShifts([]);
      } finally {
        setLoadingShifts(false);
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async function handleShiftClockIn(shift: any) {
    setActing(true);
    setShowClockInModal(false);
    try {
      await clockIn({
        shiftId: shift.id,
        eventId: shift.events?.id ?? shift.event_id,
        companyId: activeCompanyId ?? undefined,
        clockInType: "shift",
      });
      await load();
      onReload?.();
    } catch (err) {
      console.error("Clock in failed:", err);
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
      await clockIn({ clockInType: "admin", notes: adminNotes.trim(), companyId: activeCompanyId ?? undefined });
      await load();
      onReload?.();
    } catch (err) {
      console.error("Clock in failed:", err);
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
      await clockIn({ companyId: activeCompanyId ?? undefined });
      await load();
      onReload?.();
    } catch (err) {
      console.error("Clock in failed:", err);
    } finally {
      setActing(false);
    }
  }

  function formatShiftTime(iso: string) {
    return parseUTC(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
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
              <div className="flex items-center gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${isClockedIn ? "bg-green-500/20 text-green-600" : "bg-muted text-muted-foreground"}`}>
                  <Zap className="h-3 w-3" />
                  {isClockedIn ? "ON DUTY" : "OFF DUTY"}
                </span>
              </div>
              {isClockedIn ? (
                <p className="mt-1 font-mono text-xl sm:text-2xl font-bold tracking-wider text-green-600">
                  {formatDuration(elapsed)}
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
        </CardContent>
      </Card>

      {/* Clock-In Modal */}
      {showClockInModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowClockInModal(false); setAdminNotes(""); }}>
          <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowClockInModal(false); setAdminNotes(""); }}
              className="absolute top-3 right-3 text-muted-foreground/50 hover:text-foreground" aria-label="Close"><X className="h-5 w-5" /></button>

            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-lg font-bold font-mono">Clock In</h3>
                <p className="text-xs text-muted-foreground">Select what you&apos;re clocking in for</p>
              </div>

              {loadingShifts ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-3">
                  {detectedShifts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active / Upcoming Shifts</p>
                      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                      {detectedShifts.map((sh: any) => (
                        <button key={sh.id} onClick={() => handleShiftClockIn(sh)} disabled={acting}
                          className="w-full rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-left hover:bg-green-500/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15">
                              <Flag className="h-5 w-5 text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold">{sh.events?.name ?? "Shift"}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatShiftTime(sh.start_time)} — {formatShiftTime(sh.end_time)}
                              </p>
                              {sh.events?.location && (
                                <p className="text-[10px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                                  <MapPin className="h-2.5 w-2.5" /> {sh.events.location}
                                </p>
                              )}
                            </div>
                            {sh.role && <Badge variant="outline" className="text-[9px] shrink-0">{sh.role}</Badge>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {detectedShifts.length === 0 && (
                    <div className="rounded-xl border border-border/40 bg-muted/20 p-4 text-center">
                      <CalendarDays className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-sm font-medium text-muted-foreground">No active shifts found</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-1">You don&apos;t have a shift starting within 30 minutes</p>
                    </div>
                  )}

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
                    <div className="relative flex justify-center"><span className="bg-card px-3 text-[10px] text-muted-foreground uppercase tracking-wider">or</span></div>
                  </div>

                  <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 space-y-3">
                    <div className="flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-amber-500" />
                      <p className="text-sm font-semibold">Admin / Off-Shift Work</p>
                    </div>
                    <p className="text-[10px] text-muted-foreground">Clock in for administrative tasks or work outside of a scheduled operation.</p>
                    <textarea
                      value={adminNotes}
                      onChange={(e) => setAdminNotes(e.target.value)}
                      placeholder="What are you working on? (required)"
                      className="w-full rounded-lg border border-amber-500/20 bg-background px-3 py-2 text-xs min-h-[60px] resize-none outline-none focus:border-amber-500/50 placeholder:text-muted-foreground/50"
                    />
                    <Button size="sm" className="w-full gap-1.5 bg-amber-600 hover:bg-amber-700"
                      onClick={handleAdminClockIn} disabled={!adminNotes.trim() || acting}>
                      {acting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogIn className="h-3.5 w-3.5" />}
                      Clock In (Admin)
                    </Button>
                  </div>

                  <button onClick={handleQuickClockIn} disabled={acting}
                    className="w-full text-center text-[10px] text-muted-foreground/60 hover:text-muted-foreground transition-colors py-1">
                    or clock in without linking to an operation →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
