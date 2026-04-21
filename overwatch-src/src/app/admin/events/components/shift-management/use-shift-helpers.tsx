"use client";

import type { OperationAvailability } from "@/lib/supabase/db-availability";
import {
  type Shift, type Member,
  getDaysInRange, groupByDay,
} from "../shared";

/**
 * Custom hook that derives computed data from shift/member/availability inputs.
 * Extracted from the original shift-management.tsx derived block.
 */
export function useShiftDerivedData(
  startDate: string,
  endDate: string,
  shifts: Shift[],
  members: Member[],
  availability: OperationAvailability[],
) {
  /* ── Derived ── */
  const opDays = getDaysInRange(startDate, endDate);
  const shiftsByDay = groupByDay(shifts);

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

  return { opDays, shiftsByDay, availByUser, sortedMembers, adminConflictIds };
}

/**
 * Utility: render member options for select elements, showing availability status.
 */
export function renderMemberOptions(
  sortedMembers: Member[],
  availByUser: Map<string, string>,
) {
  return sortedMembers.map((m: Member) => {
    const s = availByUser.get(m.users?.id);
    const tag = s === "available" ? " \u2713" : s === "tentative" ? " ?" : s === "unavailable" ? " \u2717" : "";
    return <option key={m.id} value={m.users?.id}>{m.users?.first_name} {m.users?.last_name}{tag}</option>;
  });
}
