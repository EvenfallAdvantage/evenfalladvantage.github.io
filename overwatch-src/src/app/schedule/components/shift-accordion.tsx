"use client";

import { useState } from "react";
import {
  CalendarDays, Clock, List, ChevronDown, AlertTriangle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { parseUTC } from "@/lib/parse-utc";
import { fmtDate, fmtTime, statusColor, type Shift } from "./schedule-helpers";

export function ShiftAccordion({ shifts, highlight, conflictIds }: {
  shifts: Shift[];
  highlight: boolean;
  conflictIds: Set<string>;
}) {
  const [open, setOpen] = useState(highlight);
  const [view, setView] = useState<"list" | "calendar">("calendar");
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // Group shifts by day for calendar
  const shiftsByDay = new Map<string, Shift[]>();
  for (const sh of shifts) {
    const day = parseUTC(sh.start_time).toISOString().slice(0, 10);
    if (!shiftsByDay.has(day)) shiftsByDay.set(day, []);
    shiftsByDay.get(day)!.push(sh);
  }

  // Calendar grid: span from first to last shift day, padded to full weeks
  const sortedDays = Array.from(shiftsByDay.keys()).sort();
  const firstDay = sortedDays.length > 0 ? new Date(sortedDays[0] + "T12:00:00") : new Date();
  const lastDay = sortedDays.length > 0 ? new Date(sortedDays[sortedDays.length - 1] + "T12:00:00") : new Date();
  const startOfWeek = new Date(firstDay); startOfWeek.setDate(firstDay.getDate() - firstDay.getDay());
  const endOfWeek = new Date(lastDay); endOfWeek.setDate(lastDay.getDate() + (6 - lastDay.getDay()));
  const calDays: string[] = [];
  const cur = new Date(startOfWeek);
  while (cur <= endOfWeek) { calDays.push(cur.toISOString().slice(0, 10)); cur.setDate(cur.getDate() + 1); }
  const opDaySet = new Set(sortedDays);
  const todayStr = new Date().toISOString().slice(0, 10);

  return (
    <div className="mt-2 ml-14 border-t border-primary/10 pt-2">
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => setOpen(!open)}
          className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ChevronDown className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`} />
          {shifts.length} shift{shifts.length !== 1 ? "s" : ""} assigned
        </button>
        {open && shifts.length > 1 && (
          <div className="flex gap-0.5 rounded bg-muted/50 p-0.5 ml-auto">
            <button onClick={() => setView("list")}
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${view === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <List className="h-2.5 w-2.5 inline mr-0.5" />List
            </button>
            <button onClick={() => setView("calendar")}
              className={`rounded px-1.5 py-0.5 text-[9px] font-medium transition-colors ${view === "calendar" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              <CalendarDays className="h-2.5 w-2.5 inline mr-0.5" />Cal
            </button>
          </div>
        )}
      </div>
      {open && (
        <>
          {/* ── List View ── */}
          {view === "list" && (
            <div className="mt-1.5 space-y-1">
              {shifts.map((sh: Shift) => (
                <div key={sh.id} className={`text-xs ${conflictIds.has(sh.id) ? "rounded-md bg-amber-500/10 px-2 py-1.5 -mx-2" : ""}`}>
                  <div className="flex items-center gap-2">
                    {conflictIds.has(sh.id) ? <AlertTriangle className="h-3 w-3 text-amber-500" /> : <Clock className="h-3 w-3 text-primary/60" />}
                    <span className="text-muted-foreground">
                      {!highlight && `${fmtDate(sh.start_time)} · `}{fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}
                    </span>
                    <div className="flex items-center gap-1 ml-auto">
                      {conflictIds.has(sh.id) && <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Conflict</Badge>}
                      <Badge className={`text-[9px] ${highlight ? "bg-green-500/15 text-green-600" : statusColor(sh.assigned_user_id ? "confirmed" : "open")}`}>
                        {highlight ? "Today" : sh.assigned_user_id ? "Confirmed" : "Open"}
                      </Badge>
                    </div>
                  </div>
                  {sh.role && <div className="text-muted-foreground/60 text-[10px] ml-5 mt-0.5">Role: {sh.role}</div>}
                </div>
              ))}
            </div>
          )}

          {/* ── Calendar View ── */}
          {view === "calendar" && (
            <div className="mt-2">
              <div className="grid grid-cols-7 gap-px mb-0.5">
                {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
                  <div key={`${d}-${i}`} className="text-center text-[8px] font-semibold uppercase tracking-wider text-muted-foreground/40 py-0.5">{d}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-0.5">
                {calDays.map(day => {
                  const dayShifts = shiftsByDay.get(day) ?? [];
                  const dayNum = new Date(day + "T12:00:00").getDate();
                  const isOpDay = opDaySet.has(day);
                  const isToday = day === todayStr;
                  const isSelected = selectedDay === day;
                  const hasConflict = dayShifts.some((s: Shift) => conflictIds.has(s.id));
                  const totalHrs = dayShifts.reduce((sum: number, s: Shift) => {
                    const ms = parseUTC(s.end_time).getTime() - parseUTC(s.start_time).getTime();
                    return sum + (ms > 0 ? ms / 3600000 : ms / 3600000 + 24);
                  }, 0);

                  return (
                    <button key={day} onClick={() => isOpDay ? setSelectedDay(isSelected ? null : day) : undefined}
                      className={`relative rounded p-1 min-h-[44px] text-left transition-all border ${
                        isSelected ? "border-primary bg-primary/10 ring-1 ring-primary/30" :
                        !isOpDay ? "border-transparent opacity-25" :
                        hasConflict ? "border-amber-500/30 bg-amber-500/[0.04]" :
                        dayShifts.length > 0 ? "border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.07]" :
                        "border-transparent hover:bg-muted/20"
                      }`}>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-mono font-semibold ${isToday ? "text-primary" : isOpDay ? "" : "text-muted-foreground/30"}`}>{dayNum}</span>
                        {dayShifts.length > 0 && <span className="text-[7px] font-mono text-muted-foreground/50">{totalHrs.toFixed(0)}h</span>}
                      </div>
                      {dayShifts.length > 0 && (
                        <span className={`inline-flex items-center rounded px-0.5 py-0 text-[7px] font-bold ${hasConflict ? "bg-amber-500/15 text-amber-600" : "bg-primary/15 text-primary"}`}>
                          {dayShifts.length}
                        </span>
                      )}
                      {isToday && <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 h-0.5 w-0.5 rounded-full bg-primary" />}
                    </button>
                  );
                })}
              </div>

              {/* Expanded day detail */}
              {selectedDay && shiftsByDay.has(selectedDay) && (
                <div className="mt-2 rounded-lg border border-primary/20 bg-primary/[0.02] p-2 space-y-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[10px] font-semibold flex items-center gap-1">
                      <CalendarDays className="h-3 w-3 text-primary" />
                      {new Date(selectedDay + "T12:00:00").toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                    </h4>
                    <button onClick={() => setSelectedDay(null)} className="text-muted-foreground hover:text-foreground text-[10px]">✕</button>
                  </div>
                  {(shiftsByDay.get(selectedDay) ?? []).map((sh: Shift) => {
                    const hasConflict = conflictIds.has(sh.id);
                    return (
                      <div key={sh.id} className={`rounded border px-2 py-1.5 ${hasConflict ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-primary/15 bg-primary/[0.02]"}`}>
                        <div className="flex items-center gap-2 text-xs">
                          {hasConflict ? <AlertTriangle className="h-2.5 w-2.5 text-amber-500 shrink-0" /> : <Clock className="h-2.5 w-2.5 text-primary/60 shrink-0" />}
                          <span className="text-muted-foreground font-mono">{fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}</span>
                          <Badge className={`text-[8px] ml-auto ${highlight ? "bg-green-500/15 text-green-600" : statusColor(sh.assigned_user_id ? "confirmed" : "open")}`}>
                            {highlight ? "Today" : sh.assigned_user_id ? "Confirmed" : "Open"}
                          </Badge>
                        </div>
                        {sh.role && <div className="text-muted-foreground/60 text-[10px] ml-4 mt-0.5">Role: {sh.role}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
