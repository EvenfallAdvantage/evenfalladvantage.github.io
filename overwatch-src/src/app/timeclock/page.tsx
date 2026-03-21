"use client";

import { useEffect, useState, useCallback } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { Clock, LogIn, LogOut, History, Loader2, CalendarDays, MapPin, X, Send, ChevronLeft, ChevronRight, AlertCircle, Timer, Flag, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  getActiveTimesheet,
  clockIn,
  clockOut,
  getRecentTimesheets,
  getTimesheetsForDateRange,
  createTimeChangeRequest,
  getActiveShiftsForClockIn,
} from "@/lib/supabase/db";
import { getUserShifts } from "@/lib/supabase/db-operations";
import { parseUTC } from "@/lib/parse-utc";
import { useAuthStore } from "@/stores/auth-store";
import { dispatch } from "@/lib/services/notification-dispatcher";

function formatDuration(ms: number) {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

function formatTime(iso: string) {
  return parseUTC(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string) {
  return parseUTC(iso).toLocaleDateString([], { month: "short", day: "numeric" });
}

function formatFullDate(iso: string) {
  return parseUTC(iso).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

function calcHoursNum(clockInISO: string, clockOutISO: string) {
  return Math.max(0, (parseUTC(clockOutISO).getTime() - parseUTC(clockInISO).getTime()) / 3600000);
}

function calcHours(clockInISO: string, clockOutISO: string) {
  return calcHoursNum(clockInISO, clockOutISO).toFixed(2);
}

function getWeekDates(offset: number) {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day === 0 ? 7 : day) - 1) + offset * 7);
  monday.setHours(0, 0, 0, 0);
  const days: Date[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Timesheet = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shift = any;

export default function TimeClockPage() {
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const authUser = useAuthStore((s) => s.user);
  const companyId = activeCompany?.companyId ?? "";
  const [active, setActive] = useState<Timesheet | null>(null);
  const [recent, setRecent] = useState<Timesheet[]>([]);
  const [weekTimesheets, setWeekTimesheets] = useState<Timesheet[]>([]);
  const [weekOffset, setWeekOffset] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [nextShift, setNextShift] = useState<Shift | null>(null);
  const [selectedEntry, setSelectedEntry] = useState<Timesheet | null>(null);
  const [showChangeRequest, setShowChangeRequest] = useState(false);
  const [changeReason, setChangeReason] = useState("");
  const [changeClockIn, setChangeClockIn] = useState("");
  const [changeClockOut, setChangeClockOut] = useState("");
  const [submittingChange, setSubmittingChange] = useState(false);
  const [changeSuccess, setChangeSuccess] = useState(false);
  // Smart clock-in state
  const [showClockInModal, setShowClockInModal] = useState(false);
  const [detectedShifts, setDetectedShifts] = useState<Shift[]>([]);
  const [loadingShifts, setLoadingShifts] = useState(false);
  const [adminNotes, setAdminNotes] = useState("");

  const weekDates = getWeekDates(weekOffset);

  const load = useCallback(async () => {
    try {
      const [ts, history] = await Promise.all([
        getActiveTimesheet(),
        getRecentTimesheets(20),
      ]);
      setActive(ts);
      setRecent(history.filter((t: Timesheet) => t.clock_out));
    } catch {
      // DB may not be ready
    } finally {
      setLoading(false);
    }
  }, []);

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
    getTimesheetsForDateRange(start, end).then(setWeekTimesheets).catch(() => {});
  }, [weekOffset, recent]);

  useEffect(() => { load(); }, [load]);

  // Live elapsed timer
  useEffect(() => {
    if (!active) { setElapsed(0); return; }
    const tick = () => setElapsed(Date.now() - parseUTC(active.clock_in).getTime());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [active]);

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
        clockInType: "shift",
      });
      await load();
    } catch (err) { console.error("Clock in failed:", err); }
    finally { setActing(false); setDetectedShifts([]); }
  }

  async function handleAdminClockIn() {
    if (!adminNotes.trim()) return;
    setActing(true);
    setShowClockInModal(false);
    try {
      await clockIn({ clockInType: "admin", notes: adminNotes.trim() });
      await load();
    } catch (err) { console.error("Clock in failed:", err); }
    finally { setActing(false); setAdminNotes(""); setDetectedShifts([]); }
  }

  async function handleQuickClockIn() {
    setActing(true);
    try { await clockIn(); await load(); } catch (err) { console.error("Clock in failed:", err); } finally { setActing(false); }
  }

  async function handleClockOut() {
    if (!active) return;
    setActing(true);
    try { await clockOut(active.id); await load(); } catch (err) { console.error("Clock out failed:", err); } finally { setActing(false); }
  }

  async function handleSubmitChangeRequest() {
    if (!selectedEntry || !companyId || !changeReason.trim()) return;
    setSubmittingChange(true);
    try {
      await createTimeChangeRequest({
        timesheetId: selectedEntry.id,
        companyId,
        requestedClockIn: changeClockIn || undefined,
        requestedClockOut: changeClockOut || undefined,
        reason: changeReason,
      });
      // Notify managers/admins about the new time correction request
      const userName = authUser?.firstName ? `${authUser.firstName} ${authUser.lastName ?? ""}`.trim() : "An employee";
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      import("@/lib/supabase/db").then((mod: any) => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        mod.getCompanyMembers(companyId).then((members: any[]) => {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const managers = members.filter((m: any) =>
            hasMinRole(m.role as CompanyRole, "manager") && m.users
          );
          for (const mgr of managers) {
            const u = Array.isArray(mgr.users) ? mgr.users[0] : mgr.users;
            if (!u?.id) continue;
            dispatch({
              userId: u.id,
              companyId,
              title: "Time Correction Request",
              body: `${userName} requested a time correction: "${changeReason}"`,
              type: "time_change_request",
              actionUrl: "/admin/staff",
              emailFallback: true,
              email: u.email,
            }).catch(() => {});
          }
        }).catch(() => {});
      }).catch(() => {});
      setChangeSuccess(true);
      setTimeout(() => {
        setShowChangeRequest(false);
        setChangeSuccess(false);
        setChangeReason("");
        setChangeClockIn("");
        setChangeClockOut("");
      }, 1500);
    } catch (err) {
      console.error("Time change request failed:", err);
    } finally {
      setSubmittingChange(false);
    }
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isClockedIn = !!active;

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono uppercase flex items-center gap-2"><Clock className="h-5 w-5 sm:h-6 sm:w-6" /> Watch Log</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Clock in/out and track your duty hours</p>
        </div>

        {/* Upcoming Shift */}
        {nextShift && (
          <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-transparent">
            <CardContent className="py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
                  <CalendarDays className="h-5 w-5 text-blue-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold">Upcoming Shift</h3>
                    <Badge className="text-[9px] bg-blue-500/15 text-blue-400">{
                      (() => {
                        const ms = parseUTC(nextShift.start_time).getTime() - Date.now();
                        const hrs = Math.floor(ms / 3600000);
                        if (hrs < 1) return "Starting soon";
                        if (hrs < 24) return `In ${hrs}h`;
                        const days = Math.floor(hrs / 24);
                        return `In ${days}d`;
                      })()
                    }</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formatFullDate(nextShift.start_time)} &bull; {formatTime(nextShift.start_time)} — {formatTime(nextShift.end_time)}
                  </p>
                  {nextShift.events && (
                    <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                      <MapPin className="h-3 w-3" /> {nextShift.events.name}{nextShift.events.location ? ` @ ${nextShift.events.location}` : ""}
                    </p>
                  )}
                  {nextShift.role && (
                    <Badge variant="outline" className="text-[9px] mt-1">{nextShift.role}</Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Clock Widget */}
        <Card className={isClockedIn ? "border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent" : "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"}>
          <CardContent className="flex flex-col items-center py-8">
            <div className={`mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 ${isClockedIn ? "border-green-500/30 bg-green-500/10" : "border-primary/20 bg-primary/10"}`}>
              {loading ? <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /> : <Clock className={`h-10 w-10 ${isClockedIn ? "text-green-500" : "text-primary"}`} />}
            </div>
            <p className="mb-1 text-sm text-muted-foreground">{isClockedIn ? "On duty since" : "Status"}</p>
            {isClockedIn ? (
              <>
                <p className="text-sm font-medium text-green-600">{formatTime(active.clock_in)}</p>
                <p className="my-2 font-mono text-3xl font-bold tracking-wider text-green-600">{formatDuration(elapsed)}</p>
                {/* Operation context */}
                {active.events?.name ? (
                  <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                    <Flag className="h-3.5 w-3.5 text-green-500 shrink-0" />
                    <span className="text-xs font-medium text-green-600">{active.events.name}</span>
                    {active.shifts?.role && <Badge className="text-[9px] bg-green-500/15 text-green-600">{active.shifts.role}</Badge>}
                  </div>
                ) : active.clock_in_type === "admin" ? (
                  <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                    <Briefcase className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                    <span className="text-xs font-medium text-amber-600">Admin / Off-Shift</span>
                  </div>
                ) : null}
              </>
            ) : (
              <p className="mb-3 text-2xl font-bold text-muted-foreground">Off Duty</p>
            )}
            {!loading && (
              <Button size="lg" className={`mt-2 gap-2 px-10 ${isClockedIn ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
                onClick={isClockedIn ? handleClockOut : handleClockIn} disabled={acting}>
                {acting ? <Loader2 className="h-5 w-5 animate-spin" /> : isClockedIn ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
                {isClockedIn ? "Clock Out" : "Clock In"}
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Weekly Calendar */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <CalendarDays className="h-4 w-4" />
                Weekly Hours
              </h3>
              <div className="flex items-center gap-1">
                <button onClick={() => setWeekOffset(w => w - 1)} className="p-1 rounded hover:bg-muted/50 text-muted-foreground"><ChevronLeft className="h-4 w-4" /></button>
                {!isCurrentWeek && (
                  <button onClick={() => setWeekOffset(0)} className="text-[10px] text-primary px-2 py-0.5 rounded hover:bg-primary/10">Today</button>
                )}
                <button onClick={() => setWeekOffset(w => w + 1)} disabled={isCurrentWeek} className="p-1 rounded hover:bg-muted/50 text-muted-foreground disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
              </div>
            </div>
            <div className="text-[10px] text-muted-foreground mb-2">
              {weekDates[0].toLocaleDateString([], { month: "short", day: "numeric" })} — {weekDates[6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
            </div>
            <div className="grid grid-cols-7 gap-1.5">
              {weekDates.map((date, i) => {
                const isToday = date.getTime() === today.getTime();
                const hrs = weekHours[i];
                const hasHours = hrs > 0;
                return (
                  <div key={i} className={`flex flex-col items-center rounded-lg p-2 ${isToday ? "bg-primary/10 border border-primary/20" : "bg-muted/20"}`}>
                    <span className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{DAY_LABELS[i]}</span>
                    <span className={`text-[10px] ${isToday ? "text-primary" : "text-muted-foreground/60"}`}>{date.getDate()}</span>
                    <div className={`mt-1 text-xs font-mono font-bold ${hasHours ? "text-green-500" : "text-muted-foreground/30"}`}>
                      {hasHours ? `${hrs.toFixed(1)}` : "—"}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Week Total</span>
              <span className="font-mono font-bold text-primary">{weekTotal.toFixed(1)}h</span>
            </div>
          </CardContent>
        </Card>

        {/* Recent History */}
        <div>
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <History className="h-4 w-4" /> Recent Watch Log
          </h2>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed shifts yet. Clock in to start logging hours.</p>
          ) : (
            <div className="space-y-2">
              {recent.map((ts: Timesheet) => (
                <button key={ts.id} type="button" onClick={() => setSelectedEntry(ts)}
                  className="w-full flex items-center justify-between rounded-lg border border-border/50 bg-card px-4 py-3 hover:bg-muted/30 hover:border-primary/20 transition-colors text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3">
                      <div className="text-xs text-muted-foreground font-medium">{formatDate(ts.clock_in)}</div>
                      <div className="text-sm">{formatTime(ts.clock_in)} → {formatTime(ts.clock_out)}</div>
                    </div>
                    {ts.events?.name && (
                      <div className="flex items-center gap-1 mt-1">
                        <Flag className="h-3 w-3 text-primary/60" />
                        <span className="text-[10px] text-muted-foreground truncate">{ts.events.name}</span>
                      </div>
                    )}
                    {!ts.events?.name && ts.clock_in_type === "admin" && (
                      <div className="flex items-center gap-1 mt-1">
                        <Briefcase className="h-3 w-3 text-amber-500/60" />
                        <span className="text-[10px] text-amber-600/70">Admin</span>
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0 ml-2">
                    <span className="font-mono text-sm font-semibold">{calcHours(ts.clock_in, ts.clock_out)}h</span>
                    <Badge variant={ts.approved ? "default" : "secondary"} className="text-[10px]">
                      {ts.approved ? "Approved" : "Pending"}
                    </Badge>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setSelectedEntry(null); setShowChangeRequest(false); setChangeSuccess(false); }}>
          <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setSelectedEntry(null); setShowChangeRequest(false); setChangeSuccess(false); }}
              className="absolute top-3 right-3 text-muted-foreground/50 hover:text-foreground"><X className="h-5 w-5" /></button>

            <div className="p-6 space-y-5">
              {/* Header */}
              <div>
                <h3 className="text-lg font-bold font-mono">Shift Detail</h3>
                <p className="text-xs text-muted-foreground">{formatFullDate(selectedEntry.clock_in)}</p>
              </div>

              {/* Time details */}
              <div className="grid grid-cols-2 gap-4">
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Clock In</p>
                  <p className="text-lg font-mono font-bold">{formatTime(selectedEntry.clock_in)}</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-3">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Clock Out</p>
                  <p className="text-lg font-mono font-bold">{formatTime(selectedEntry.clock_out)}</p>
                </div>
              </div>

              {/* Summary row */}
              <div className="flex items-center justify-between rounded-lg border border-border/40 p-3">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4 text-primary" />
                  <span className="text-sm">Duration</span>
                </div>
                <span className="font-mono font-bold text-lg">{calcHours(selectedEntry.clock_in, selectedEntry.clock_out)}h</span>
              </div>

              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Status</span>
                <Badge variant={selectedEntry.approved ? "default" : "secondary"}>
                  {selectedEntry.approved ? "Approved" : "Pending Review"}
                </Badge>
              </div>

              {selectedEntry.events?.name && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Operation</span>
                  <div className="flex items-center gap-1.5">
                    <Flag className="h-3.5 w-3.5 text-primary" />
                    <span className="font-medium">{selectedEntry.events.name}</span>
                  </div>
                </div>
              )}

              {selectedEntry.clock_in_type === "admin" && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <div className="flex items-center gap-1.5">
                    <Briefcase className="h-3.5 w-3.5 text-amber-500" />
                    <span className="font-medium text-amber-600">Admin / Off-Shift</span>
                  </div>
                </div>
              )}

              {selectedEntry.notes && (
                <div className="text-sm">
                  <span className="text-muted-foreground block mb-1">Notes</span>
                  <p className="text-xs bg-muted/30 rounded-md px-3 py-2">{selectedEntry.notes}</p>
                </div>
              )}

              {selectedEntry.clock_method && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Clock Method</span>
                  <span className="capitalize">{selectedEntry.clock_method}</span>
                </div>
              )}

              {/* Time Change Request Section */}
              {!showChangeRequest ? (
                <Button variant="outline" className="w-full gap-2 text-xs" onClick={() => setShowChangeRequest(true)}>
                  <AlertCircle className="h-3.5 w-3.5" /> Request Time Correction
                </Button>
              ) : changeSuccess ? (
                <div className="rounded-lg border border-green-500/30 bg-green-500/5 p-4 text-center">
                  <p className="text-sm font-medium text-green-500">Request Submitted!</p>
                  <p className="text-[10px] text-muted-foreground mt-1">Your manager will review this correction request.</p>
                </div>
              ) : (
                <div className="rounded-lg border border-border/40 p-4 space-y-3">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <AlertCircle className="h-4 w-4 text-orange-400" /> Request Time Correction
                  </h4>
                  <p className="text-[10px] text-muted-foreground">Submit a correction request to your manager. Leave a field blank to keep the original time.</p>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Corrected Clock In</Label>
                      <Input type="time" value={changeClockIn} onChange={e => setChangeClockIn(e.target.value)}
                        className="h-8 text-xs mt-0.5" placeholder={formatTime(selectedEntry.clock_in)} />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground">Corrected Clock Out</Label>
                      <Input type="time" value={changeClockOut} onChange={e => setChangeClockOut(e.target.value)}
                        className="h-8 text-xs mt-0.5" placeholder={formatTime(selectedEntry.clock_out)} />
                    </div>
                  </div>

                  <div>
                    <Label className="text-[10px] text-muted-foreground">Reason for correction *</Label>
                    <textarea value={changeReason} onChange={e => setChangeReason(e.target.value)}
                      placeholder="e.g. Forgot to clock in at shift start, actual start was 6:00 AM"
                      className="mt-0.5 w-full rounded-md border border-border/40 bg-background px-3 py-2 text-xs min-h-[60px] resize-none outline-none focus:border-primary/50" />
                  </div>

                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => setShowChangeRequest(false)}>Cancel</Button>
                    <Button size="sm" className="flex-1 gap-1.5 text-xs" disabled={!changeReason.trim() || submittingChange}
                      onClick={handleSubmitChangeRequest}>
                      {submittingChange ? <Loader2 className="h-3 w-3 animate-spin" /> : <Send className="h-3 w-3" />}
                      Submit Request
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Smart Clock-In Modal */}
      {showClockInModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={() => { setShowClockInModal(false); setAdminNotes(""); }}>
          <div className="relative w-full max-w-md rounded-2xl border border-border/50 bg-card shadow-2xl max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => { setShowClockInModal(false); setAdminNotes(""); }}
              className="absolute top-3 right-3 text-muted-foreground/50 hover:text-foreground"><X className="h-5 w-5" /></button>

            <div className="p-6 space-y-5">
              <div>
                <h3 className="text-lg font-bold font-mono">Clock In</h3>
                <p className="text-xs text-muted-foreground">Select what you&apos;re clocking in for</p>
              </div>

              {loadingShifts ? (
                <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
              ) : (
                <div className="space-y-3">
                  {/* Detected shifts */}
                  {detectedShifts.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Active / Upcoming Shifts</p>
                      {detectedShifts.map((sh: Shift) => (
                        <button key={sh.id} onClick={() => handleShiftClockIn(sh)} disabled={acting}
                          className="w-full rounded-xl border border-green-500/30 bg-green-500/5 p-4 text-left hover:bg-green-500/10 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/15">
                              <Flag className="h-5 w-5 text-green-500" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-semibold">{sh.events?.name ?? "Shift"}</p>
                              <p className="text-xs text-muted-foreground">
                                {formatTime(sh.start_time)} — {formatTime(sh.end_time)}
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

                  {/* Divider */}
                  <div className="relative">
                    <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/40" /></div>
                    <div className="relative flex justify-center"><span className="bg-card px-3 text-[10px] text-muted-foreground uppercase tracking-wider">or</span></div>
                  </div>

                  {/* Admin / Off-Shift clock-in */}
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

                  {/* Quick clock-in fallback */}
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
