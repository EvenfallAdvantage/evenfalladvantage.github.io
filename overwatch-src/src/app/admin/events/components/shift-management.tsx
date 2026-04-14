"use client";

import { useState } from "react";
import {
  Plus, Loader2, Clock, Zap, Calendar, Check, X,
  AlertTriangle, List, LayoutGrid, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";
import {
  getEventShifts, createShift,
  deleteShift, assignShift, getConflictingShifts,
} from "@/lib/supabase/db";
import type { OperationAvailability } from "@/lib/supabase/db-availability";
import type { ConflictWarningData } from "./conflict-warning-modal";
import {
  type Shift, type Member,
  fmtTime, fmtDateLong, getDaysInRange, groupByDay, pad2,
  PATTERNS, toISO,
} from "./shared";

/* ── Types ── */

interface ShiftManagementProps {
  eventId: string;
  startDate: string;
  endDate: string;
  shifts: Shift[];
  members: Member[];
  availability: OperationAvailability[];
  onShiftsChange: (shifts: Shift[]) => void;
  onConflictWarning: (data: ConflictWarningData) => void;
}

/* ── Component ── */

export function ShiftManagement({
  eventId,
  startDate,
  endDate,
  shifts,
  members,
  availability,
  onShiftsChange,
  onConflictWarning,
}: ShiftManagementProps) {
  /* ── Quick Fill state ── */
  const [posts, setPosts] = useState<string[]>([]);
  const [newPost, setNewPost] = useState("");
  const [pattern, setPattern] = useState<"8" | "12">("8");
  const [selectedDays, setSelectedDays] = useState<Set<string>>(new Set());
  const [generating, setGenerating] = useState(false);
  const [showBuilder, setShowBuilder] = useState(false);

  /* ── Custom shift state ── */
  const [showCustom, setShowCustom] = useState(false);
  const [cRole, setCRole] = useState("");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");
  const [cAssign, setCAssign] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  /* ── View state ── */
  const [shiftView, setShiftView] = useState<"list" | "calendar">("calendar");
  const [calendarDay, setCalendarDay] = useState<string | null>(null);
  const [deletingShift, setDeletingShift] = useState<string | null>(null);

  /* ── Derived ── */
  const opDays = getDaysInRange(startDate, endDate);
  const shiftsByDay = groupByDay(shifts);
  const previewCount = posts.length * (pattern === "8" ? 3 : 2) * selectedDays.size;

  // Availability lookup
  const availByUser = new Map<string, string>();
  for (const a of availability) { availByUser.set(a.user_id, a.status); }

  // Sort members by availability
  const sortedMembers = [...members].sort((a: Member, b: Member) => {
    const as = availByUser.get(a.users?.id) ?? "pending";
    const bs = availByUser.get(b.users?.id) ?? "pending";
    const order: Record<string, number> = { available: 0, tentative: 1, pending: 2, unavailable: 3 };
    return (order[as] ?? 2) - (order[bs] ?? 2);
  });

  // Detect scheduling conflicts
  const adminConflictIds = new Set<string>();
  const assignedShifts = shifts.filter((s: Shift) => s.assigned_user_id);
  for (let i = 0; i < assignedShifts.length; i++) {
    for (let j = i + 1; j < assignedShifts.length; j++) {
      const a = assignedShifts[i], b = assignedShifts[j];
      if (a.assigned_user_id === b.assigned_user_id &&
          new Date(a.start_time) < new Date(b.end_time) &&
          new Date(a.end_time) > new Date(b.start_time)) {
        adminConflictIds.add(a.id); adminConflictIds.add(b.id);
      }
    }
  }

  /* ── Handlers ── */

  function renderMemberOptions() {
    return sortedMembers.map((m: Member) => {
      const s = availByUser.get(m.users?.id);
      const tag = s === "available" ? " \u2713" : s === "tentative" ? " ?" : s === "unavailable" ? " \u2717" : "";
      return <option key={m.id} value={m.users?.id}>{m.users?.first_name} {m.users?.last_name}{tag}</option>;
    });
  }

  async function handleDeleteShift(shiftId: string) {
    setDeletingShift(shiftId);
    try { await deleteShift(shiftId); onShiftsChange(await getEventShifts(eventId)); toast.success("Shift removed"); }
    catch (err) { console.error(err); toast.error("Failed to remove shift"); } finally { setDeletingShift(null); }
  }

  async function handleAssign(shiftId: string, userId: string) {
    if (!userId) {
      try { await assignShift(shiftId, null); onShiftsChange(await getEventShifts(eventId)); }
      catch (err) { console.error(err); }
      return;
    }
    const sh = shifts.find((s: Shift) => s.id === shiftId);
    if (sh) {
      try {
        const conflicts = await getConflictingShifts(userId, sh.start_time, sh.end_time, shiftId);
        if (conflicts.length > 0) {
          onConflictWarning({
            shiftId, userId,
            conflicts: conflicts.map((c: Shift) => ({
              role: c.role ?? "Shift",
              eventName: c.events?.name ?? "Unknown Op",
              time: `${fmtTime(c.start_time)} — ${fmtTime(c.end_time)}`,
            })),
            pendingAction: async () => {
              await assignShift(shiftId, userId);
              onShiftsChange(await getEventShifts(eventId));
            },
          });
          return;
        }
      } catch (err) { console.error("Conflict check failed:", err); }
    }
    try { await assignShift(shiftId, userId); onShiftsChange(await getEventShifts(eventId)); }
    catch (err) { console.error(err); }
  }

  async function handleGenerate() {
    if (posts.length === 0 || selectedDays.size === 0) return;
    setGenerating(true);
    try {
      const batch: { eventId: string; role: string; startTime: string; endTime: string }[] = [];
      const pat = PATTERNS[pattern];
      for (const day of Array.from(selectedDays).sort()) {
        for (const p of pat) {
          for (const post of posts) {
            batch.push({ eventId, role: `${post} — ${p.label}`, startTime: toISO(day, p.sH, p.sM, false), endTime: toISO(day, p.eH, p.eM, p.overnight) });
          }
        }
      }
      for (let i = 0; i < batch.length; i += 5) { await Promise.all(batch.slice(i, i + 5).map(s => createShift(s))); }
      onShiftsChange(await getEventShifts(eventId));
      setPosts([]); setSelectedDays(new Set()); setShowBuilder(false);
    } catch (err) { console.error(err); } finally { setGenerating(false); }
  }

  async function handleAddCustom() {
    if (!cStart || !cEnd) return;
    if (cAssign) {
      try {
        const conflicts = await getConflictingShifts(cAssign, cStart, cEnd);
        if (conflicts.length > 0) {
          onConflictWarning({
            shiftId: "new", userId: cAssign,
            conflicts: conflicts.map((c: Shift) => ({
              role: c.role ?? "Shift",
              eventName: c.events?.name ?? "Unknown Op",
              time: `${fmtTime(c.start_time)} — ${fmtTime(c.end_time)}`,
            })),
            pendingAction: async () => {
              setAddingCustom(true);
              try {
                await createShift({ eventId, role: cRole || undefined, startTime: cStart, endTime: cEnd, assignedUserId: cAssign || undefined });
                setCRole(""); setCStart(""); setCEnd(""); setCAssign(""); setShowCustom(false);
                onShiftsChange(await getEventShifts(eventId));
              } finally { setAddingCustom(false); }
            },
          });
          return;
        }
      } catch (err) { console.error("Conflict check failed:", err); }
    }
    setAddingCustom(true);
    try {
      await createShift({ eventId, role: cRole || undefined, startTime: cStart, endTime: cEnd, assignedUserId: cAssign || undefined });
      setCRole(""); setCStart(""); setCEnd(""); setCAssign(""); setShowCustom(false);
      onShiftsChange(await getEventShifts(eventId));
    } catch (err) { console.error(err); } finally { setAddingCustom(false); }
  }

  function addPost() { if (!newPost.trim() || posts.includes(newPost.trim())) return; setPosts([...posts, newPost.trim()]); setNewPost(""); }
  function toggleDay(d: string) { const n = new Set(selectedDays); if (n.has(d)) n.delete(d); else n.add(d); setSelectedDays(n); }

  /* ── Shift row renderer (shared between list and calendar detail) ── */

  function renderShiftRow(sh: Shift) {
    const filled = !!sh.assigned_user_id;
    const hasConflict = adminConflictIds.has(sh.id);
    return (
      <div key={sh.id} className={`rounded-lg border px-2.5 sm:px-3 py-2 transition-colors ${hasConflict ? "border-red-500/40 bg-red-500/[0.06]" : filled ? "border-green-500/20 bg-green-500/[0.03]" : "border-amber-500/20 bg-amber-500/[0.03]"}`}>
        <div className="flex items-center gap-2 sm:gap-3">
          {hasConflict ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" /> : <Clock className={`h-3.5 w-3.5 shrink-0 ${filled ? "text-green-500" : "text-amber-500"}`} />}
          <div className="flex-1 min-w-0 text-xs truncate">
            <span className="font-medium">{sh.role ?? "Shift"}</span>
            <span className="text-muted-foreground ml-1.5 sm:ml-2 font-mono">{fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}</span>
            {hasConflict && <span className="ml-1 sm:ml-2 text-red-500 font-semibold text-[10px]">CONFLICT</span>}
          </div>
          <button onClick={() => handleDeleteShift(sh.id)} disabled={deletingShift === sh.id}
            className="rounded p-0.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 shrink-0" title="Delete">
            {deletingShift === sh.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
          </button>
        </div>
        <div className="mt-1.5 ml-5.5 sm:ml-[26px]">
          <select value={sh.assigned_user_id ?? ""} onChange={(e) => handleAssign(sh.id, e.target.value)}
            className={`h-6 w-full sm:w-auto sm:max-w-[180px] truncate rounded border bg-background px-1.5 text-[10px] font-medium cursor-pointer ${hasConflict ? "border-red-500/40 text-red-500" : filled ? "border-green-500/30 text-green-600" : "border-amber-500/30 text-amber-600"}`}>
            <option value="">Open</option>
            {renderMemberOptions()}
          </select>
        </div>
      </div>
    );
  }

  /* ── Calendar cell helpers ── */

  function renderCalendarView() {
    if (shifts.length === 0) {
      return (
        <div className="text-center py-8">
          <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
          <p className="text-sm font-medium text-muted-foreground/60">No shifts yet</p>
        </div>
      );
    }
    const sortedDays = Array.from(shiftsByDay.entries()).sort(([a], [b]) => a.localeCompare(b));
    const firstDay = new Date(sortedDays[0][0] + "T12:00:00");
    const startOfWeek = new Date(firstDay);
    startOfWeek.setDate(firstDay.getDate() - firstDay.getDay());
    const lastDay = new Date(sortedDays[sortedDays.length - 1][0] + "T12:00:00");
    const endOfWeek = new Date(lastDay);
    endOfWeek.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
    const calDays: string[] = [];
    const cur = new Date(startOfWeek);
    while (cur <= endOfWeek) {
      calDays.push(cur.toISOString().slice(0, 10));
      cur.setDate(cur.getDate() + 1);
    }
    const opDaySet = new Set(opDays);

    const memberMap = new Map<string, { fn: string; ln: string; role: string; avatar: string }>();
    members.forEach((m: Member) => { if (m.users?.id) memberMap.set(m.users.id, { fn: m.users.first_name ?? "", ln: m.users.last_name ?? "", role: m.role ?? "member", avatar: m.users.avatar_url ?? "" }); });

    return (
      <div>
        <div className="grid grid-cols-7 gap-px mb-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40 py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {calDays.map(day => {
            const dayShifts = shiftsByDay.get(day) ?? [];
            const isOpDay = opDaySet.has(day);
            const filled = dayShifts.filter((s: Shift) => s.assigned_user_id).length;
            const open = dayShifts.length - filled;
            const hasConflicts = dayShifts.some((s: Shift) => adminConflictIds.has(s.id));
            const isSelected = calendarDay === day;
            const dayNum = new Date(day + "T12:00:00").getDate();
            const isToday = day === new Date().toISOString().slice(0, 10);
            const totalHrs = dayShifts.reduce((sum: number, s: Shift) => {
              const ms = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
              return sum + (ms > 0 ? ms / 3600000 : ms / 3600000 + 24);
            }, 0);
            const uniqueStaff = [...new Set(dayShifts.filter((s: Shift) => s.assigned_user_id).map((s: Shift) => s.assigned_user_id as string))];
            const staffData = uniqueStaff.slice(0, 3).map(uid => {
              const u = memberMap.get(uid);
              return { uid, ini: u ? `${u.fn[0] ?? ""}${u.ln[0] ?? ""}` : "?", fn: u?.fn ?? "", ln: u?.ln ?? "", role: u?.role ?? "member", avatar: u?.avatar ?? "" };
            });

            return (
              <button key={day} onClick={() => isOpDay ? setCalendarDay(isSelected ? null : day) : undefined}
                className={`relative rounded-lg p-1.5 min-h-[68px] text-left transition-all border ${
                  isSelected ? "border-primary bg-primary/10 ring-1 ring-primary/30" :
                  !isOpDay ? "border-transparent opacity-30" :
                  hasConflicts ? "border-red-500/30 bg-red-500/[0.04] hover:bg-red-500/[0.08]" :
                  dayShifts.length > 0 && open === 0 ? "border-green-500/20 bg-green-500/[0.04] hover:bg-green-500/[0.08]" :
                  dayShifts.length > 0 ? "border-amber-500/20 bg-amber-500/[0.04] hover:bg-amber-500/[0.08]" :
                  "border-border/20 hover:bg-muted/30"
                }`}>
                <div className="flex items-center justify-between">
                  <span className={`text-[11px] font-mono font-semibold ${isToday ? "text-primary" : isOpDay ? "" : "text-muted-foreground/30"}`}>{dayNum}</span>
                  {dayShifts.length > 0 && <span className="text-[8px] font-mono text-muted-foreground/60">{totalHrs.toFixed(0)}h</span>}
                </div>
                {dayShifts.length > 0 && (
                  <div className="mt-0.5 flex flex-wrap gap-0.5">
                    {filled > 0 && (
                      <span className="inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[8px] font-bold bg-green-500/15 text-green-600">
                        <Check className="h-2 w-2" />{filled}
                      </span>
                    )}
                    {open > 0 && (
                      <span className="inline-flex items-center rounded px-1 py-0.5 text-[8px] font-bold bg-amber-500/15 text-amber-600">
                        {open}
                      </span>
                    )}
                  </div>
                )}
                {staffData.length > 0 && (
                  <TooltipProvider>
                  <div className="mt-0.5 flex gap-0.5">
                    {staffData.map((s) => (
                      <Tooltip key={s.uid}>
                        <TooltipTrigger>
                          <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-primary/10 text-[7px] font-bold text-primary/70 cursor-default">{s.ini}</span>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="p-0 overflow-hidden rounded-lg">
                          <div className="flex items-center gap-2 px-3 py-2">
                            <Avatar className="h-7 w-7">
                              {s.avatar && <AvatarImage src={s.avatar} />}
                              <AvatarFallback className="text-[9px] font-bold bg-primary/20 text-primary">{s.ini}</AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="text-xs font-semibold leading-tight">{s.fn} {s.ln}</p>
                              <p className="text-[10px] capitalize opacity-70">{s.role}</p>
                            </div>
                          </div>
                        </TooltipContent>
                      </Tooltip>
                    ))}
                    {uniqueStaff.length > 3 && (() => {
                      const overflow = uniqueStaff.slice(3).map(uid => {
                        const u = memberMap.get(uid);
                        return { uid, ini: u ? `${u.fn[0] ?? ""}${u.ln[0] ?? ""}` : "?", fn: u?.fn ?? "", ln: u?.ln ?? "", role: u?.role ?? "member", avatar: u?.avatar ?? "" };
                      });
                      return (
                        <Tooltip>
                          <TooltipTrigger>
                            <span className="inline-flex h-4 items-center rounded-full bg-muted/40 px-1 text-[7px] font-bold text-muted-foreground/60 cursor-default">+{uniqueStaff.length - 3}</span>
                          </TooltipTrigger>
                          <TooltipContent side="top" className="p-0 overflow-hidden rounded-lg">
                            <div className="py-1">
                              {overflow.map(s => (
                                <div key={s.uid} className="flex items-center gap-2 px-3 py-1.5">
                                  <Avatar className="h-6 w-6">
                                    {s.avatar && <AvatarImage src={s.avatar} />}
                                    <AvatarFallback className="text-[8px] font-bold bg-primary/20 text-primary">{s.ini}</AvatarFallback>
                                  </Avatar>
                                  <div>
                                    <p className="text-[11px] font-semibold leading-tight">{s.fn} {s.ln}</p>
                                    <p className="text-[9px] capitalize opacity-70">{s.role}</p>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </TooltipContent>
                        </Tooltip>
                      );
                    })()}
                  </div>
                  </TooltipProvider>
                )}
                {hasConflicts && (
                  <AlertTriangle className="absolute top-1 right-1 h-2.5 w-2.5 text-red-500" />
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/10">
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-green-500/30" /> Fully Staffed</span>
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-amber-500/30" /> Open Slots</span>
          <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><AlertTriangle className="h-2 w-2 text-red-500" /> Conflict</span>
        </div>

        {/* Expanded Day Detail */}
        {calendarDay && shiftsByDay.has(calendarDay) && (
          <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.02] p-3 space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold flex items-center gap-1.5">
                <Calendar className="h-3.5 w-3.5 text-primary" />
                {fmtDateLong(calendarDay)}
              </h4>
              <button onClick={() => setCalendarDay(null)} className="text-muted-foreground hover:text-foreground"><X className="h-3.5 w-3.5" /></button>
            </div>
            <div className="space-y-1">
              {(shiftsByDay.get(calendarDay) ?? []).map((sh: Shift) => renderShiftRow(sh))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      {/* Action Buttons */}
      <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 border-b border-border/20">
        <Button size="sm" variant={showBuilder ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
          onClick={() => { setShowBuilder(!showBuilder); setShowCustom(false); }}>
          <Zap className="h-3.5 w-3.5" /> Quick Fill
        </Button>
        <Button size="sm" variant={showCustom ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
          onClick={() => { setShowCustom(!showCustom); setShowBuilder(false); }}>
          <Plus className="h-3.5 w-3.5" /> Custom Shift
        </Button>
        {/* View toggle */}
        <div className="flex rounded-lg border border-border/40 overflow-hidden ml-1">
          <button onClick={() => setShiftView("calendar")} className={`px-2 py-1 text-[10px] font-medium flex items-center gap-1 transition-colors ${shiftView === "calendar" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}>
            <LayoutGrid className="h-3 w-3" /> Calendar
          </button>
          <button onClick={() => setShiftView("list")} className={`px-2 py-1 text-[10px] font-medium flex items-center gap-1 transition-colors border-l border-border/40 ${shiftView === "list" ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-muted/50"}`}>
            <List className="h-3 w-3" /> List
          </button>
        </div>
      </div>

      {/* Quick Fill Panel */}
      {showBuilder && (
        <div className="px-3 sm:px-4 py-3 space-y-3 border-b border-border/20 bg-primary/[0.02]">
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Posts / Positions</label>
            <div className="flex flex-wrap items-center gap-1.5 mt-1">
              {posts.map(p => (
                <Badge key={p} variant="secondary" className="gap-1 text-xs pr-1">
                  {p}
                  <button onClick={() => setPosts(posts.filter(x => x !== p))} className="hover:text-red-400"><X className="h-2.5 w-2.5" /></button>
                </Badge>
              ))}
              <div className="flex gap-1">
                <Input value={newPost} onChange={(e) => setNewPost(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPost()} placeholder="e.g. Front Gate" className="h-6 w-32 text-xs" />
                <Button size="sm" variant="outline" className="h-6 w-6 p-0" onClick={addPost} disabled={!newPost.trim()}><Plus className="h-3 w-3" /></Button>
              </div>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Shift Pattern</label>
            <div className="flex gap-2 mt-1">
              {(["8", "12"] as const).map(p => (
                <button key={p} onClick={() => setPattern(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${pattern === p ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>
                  {p === "8" ? "8-Hour (Day / Swing / Night)" : "12-Hour (Day / Night)"}
                </button>
              ))}
            </div>
            <div className="flex gap-3 mt-1.5">{PATTERNS[pattern].map(p => <span key={p.label} className="text-[10px] text-muted-foreground font-mono">{p.label}: {pad2(p.sH)}{pad2(p.sM)}–{pad2(p.eH)}{pad2(p.eM)}</span>)}</div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Coverage Days</label>
              <button onClick={() => setSelectedDays(new Set(opDays))} className="text-[10px] text-primary hover:underline">Select All</button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              {opDays.map(day => {
                const d = new Date(day + "T12:00:00");
                const lbl = d.toLocaleDateString([], { weekday: "short", month: "numeric", day: "numeric" });
                const sel = selectedDays.has(day);
                return (<button key={day} onClick={() => toggleDay(day)} className={`px-2 py-1 rounded-md text-[10px] font-mono border transition-colors ${sel ? "border-primary bg-primary/10 text-primary" : "border-border/40 text-muted-foreground hover:border-border"}`}>{sel && <Check className="h-2.5 w-2.5 inline mr-0.5" />}{lbl}</button>);
              })}
            </div>
          </div>
          <div className="flex items-center gap-3 pt-1">
            <Button size="sm" className="gap-1.5" onClick={handleGenerate} disabled={posts.length === 0 || selectedDays.size === 0 || generating}>
              {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />} Generate {previewCount} Shift{previewCount !== 1 ? "s" : ""}
            </Button>
            {previewCount > 0 && <span className="text-[10px] text-muted-foreground font-mono">{posts.length} post{posts.length > 1 ? "s" : ""} × {pattern === "8" ? "3" : "2"} periods × {selectedDays.size} day{selectedDays.size > 1 ? "s" : ""}</span>}
          </div>
        </div>
      )}

      {/* Custom Shift Form */}
      {showCustom && (
        <div className="px-3 sm:px-4 py-3 space-y-2 border-b border-border/20 bg-primary/[0.02]">
          <Input placeholder="Role / Position (e.g. Supervisor)" value={cRole} onChange={(e) => setCRole(e.target.value)} className="h-8 text-sm" />
          <div className="flex gap-2">
            <div className="flex-1"><label className="text-[10px] text-muted-foreground">Start</label><Input type="datetime-local" value={cStart} onChange={(e) => setCStart(e.target.value)} className="h-8 text-sm" /></div>
            <div className="flex-1"><label className="text-[10px] text-muted-foreground">End</label><Input type="datetime-local" value={cEnd} onChange={(e) => setCEnd(e.target.value)} className="h-8 text-sm" /></div>
          </div>
          <select value={cAssign} onChange={(e) => setCAssign(e.target.value)} className="w-full rounded-lg border border-border bg-background px-3 py-1.5 text-sm">
            <option value="">Unassigned</option>
            {renderMemberOptions()}
          </select>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs" onClick={handleAddCustom} disabled={!cStart || !cEnd || addingCustom}>{addingCustom ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add Shift"}</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setShowCustom(false)}>Cancel</Button>
          </div>
        </div>
      )}

      {/* List View */}
      {shiftView === "list" && (
        <div className="px-3 sm:px-4 py-3 space-y-4">
          {shifts.length === 0 ? (
            <div className="text-center py-8">
              <Calendar className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground/60">No shifts yet</p>
              <p className="text-[10px] text-muted-foreground mt-1">Use Quick Fill to batch-generate shifts, or add a custom shift.</p>
            </div>
          ) : (
            Array.from(shiftsByDay.entries()).sort(([a], [b]) => a.localeCompare(b)).map(([day, dayShifts]) => (
              <div key={day}>
                <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-1.5 flex items-center gap-1.5">
                  <Calendar className="h-3 w-3" /> {fmtDateLong(day)}
                  <span className="text-muted-foreground/30 font-normal">· {dayShifts.length} shift{dayShifts.length > 1 ? "s" : ""} · {dayShifts.filter((s: Shift) => s.assigned_user_id).length} filled</span>
                </h4>
                <div className="space-y-1">
                  {dayShifts.map((sh: Shift) => renderShiftRow(sh))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Calendar View */}
      {shiftView === "calendar" && (
        <div className="px-3 sm:px-4 py-3">
          {renderCalendarView()}
        </div>
      )}
    </>
  );
}
