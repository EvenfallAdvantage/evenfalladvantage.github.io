"use client";

import { Calendar, Check, X, AlertTriangle } from "lucide-react";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { type Shift, type Member, fmtDateLong } from "../shared";
import { ShiftRow } from "./shift-row";

interface ShiftCalendarViewProps {
  shifts: Shift[];
  shiftsByDay: Map<string, Shift[]>;
  opDays: string[];
  members: Member[];
  sortedMembers: Member[];
  availByUser: Map<string, string>;
  adminConflictIds: Set<string>;
  calendarDay: string | null;
  setCalendarDay: (d: string | null) => void;
  deletingShift: string | null;
  eventTimezone?: string;
  onDelete: (shiftId: string) => void;
  onAssign: (shiftId: string, userId: string) => void;
}

/* ── Calendar cell helpers ── */

export function ShiftCalendarView({
  shifts,
  shiftsByDay,
  opDays,
  members,
  sortedMembers,
  availByUser,
  adminConflictIds,
  calendarDay,
  setCalendarDay,
  deletingShift,
  eventTimezone,
  onDelete,
  onAssign,
}: ShiftCalendarViewProps) {
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
            {(shiftsByDay.get(calendarDay) ?? []).map((sh: Shift) => (
              <ShiftRow
                key={sh.id}
                sh={sh}
                adminConflictIds={adminConflictIds}
                deletingShift={deletingShift}
                sortedMembers={sortedMembers}
                availByUser={availByUser}
                eventTimezone={eventTimezone}
                onDelete={onDelete}
                onAssign={onAssign}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
