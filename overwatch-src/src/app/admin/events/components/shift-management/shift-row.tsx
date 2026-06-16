"use client";

import { Clock, Loader2, AlertTriangle, Trash2, ShieldAlert } from "lucide-react";
import { type Shift, type Member, fmtTime } from "../shared";
import { MemberSearchSelect } from "./member-search-select";

interface ShiftRowProps {
  sh: Shift;
  adminConflictIds: Set<string>;
  deletingShift: string | null;
  sortedMembers: Member[];
  availByUser: Map<string, string>;
  eventTimezone?: string;
  onDelete: (shiftId: string) => void;
  onAssign: (shiftId: string, userId: string) => void;
  userCertifications?: Record<string, { hasAbcCert: boolean; abcState: string | null }>;
}

/* ── Shift row renderer (shared between list and calendar detail) ── */

export function ShiftRow({
  sh,
  adminConflictIds,
  deletingShift,
  sortedMembers,
  availByUser,
  eventTimezone,
  onDelete,
  onAssign,
  userCertifications = {},
}: ShiftRowProps) {
  const filled = !!sh.assigned_user_id;
  const hasConflict = adminConflictIds.has(sh.id);
  const assignedUserId = sh.assigned_user_id;
  const userCert = assignedUserId ? userCertifications[assignedUserId] : undefined;
  const isAbcShift = sh.role?.toLowerCase().includes("abc checkpoint") || sh.role?.toLowerCase().includes("abc");
  const missingAbcCert = isAbcShift && userCert && !userCert.hasAbcCert;
  return (
    <div key={sh.id} className={`rounded-lg border px-2.5 sm:px-3 py-2 transition-colors ${hasConflict ? "border-red-500/40 bg-red-500/[0.06]" : filled ? "border-green-500/20 bg-green-500/[0.03]" : "border-amber-500/20 bg-amber-500/[0.03]"}`}>
      <div className="flex items-center gap-2 sm:gap-3">
        {hasConflict ? <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-red-500" /> : <Clock className={`h-3.5 w-3.5 shrink-0 ${filled ? "text-green-500" : "text-amber-500"}`} />}
        {missingAbcCert && <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-500" />}
        <div className="flex-1 min-w-0 text-xs truncate">
          <span className="font-medium">{sh.role ?? "Shift"}</span>
          <span className="text-muted-foreground ml-1.5 sm:ml-2 font-mono">{fmtTime(sh.start_time, eventTimezone)} — {fmtTime(sh.end_time, eventTimezone)}</span>
          {hasConflict && <span className="ml-1 sm:ml-2 text-red-500 font-semibold text-[10px]">CONFLICT</span>}
          {missingAbcCert && <span className="ml-1 sm:ml-2 text-amber-500 font-semibold text-[10px]">Missing ABC Cert</span>}
        </div>
        <button onClick={() => onDelete(sh.id)} disabled={deletingShift === sh.id}
          className="rounded p-0.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10 shrink-0" title="Delete">
          {deletingShift === sh.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
        </button>
      </div>
      <div className="mt-1.5 ml-5.5 sm:ml-[26px]">
        <MemberSearchSelect
          value={sh.assigned_user_id ?? ""}
          onChange={(userId) => onAssign(sh.id, userId)}
          sortedMembers={sortedMembers}
          availByUser={availByUser}
          hasConflict={hasConflict}
          filled={filled}
        />
      </div>
    </div>
  );
}
