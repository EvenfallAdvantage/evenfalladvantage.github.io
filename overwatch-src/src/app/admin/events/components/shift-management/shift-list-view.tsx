"use client";

import { Calendar } from "lucide-react";
import { type Shift, type Member, fmtDateLong } from "../shared";
import { ShiftRow } from "./shift-row";

interface ShiftListViewProps {
  shifts: Shift[];
  shiftsByDay: Map<string, Shift[]>;
  sortedMembers: Member[];
  availByUser: Map<string, string>;
  adminConflictIds: Set<string>;
  deletingShift: string | null;
  eventTimezone?: string;
  onDelete: (shiftId: string) => void;
  onAssign: (shiftId: string, userId: string) => void;
}

export function ShiftListView({
  shifts,
  shiftsByDay,
  sortedMembers,
  availByUser,
  adminConflictIds,
  deletingShift,
  eventTimezone,
  onDelete,
  onAssign,
}: ShiftListViewProps) {
  return (
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
              {dayShifts.map((sh: Shift) => (
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
        ))
      )}
    </div>
  );
}
