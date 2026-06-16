"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  getEventShifts, createShift, getConflictingShifts,
} from "@/lib/supabase/db";
import type { ConflictWarningData } from "../conflict-warning-modal";
import { type Shift, type Member, fmtTime } from "../shared";
import { localToUTC, tzAbbrev } from "@/lib/timezone";
import { MemberSearchSelect } from "./member-search-select";

interface CustomShiftFormProps {
  eventId: string;
  sortedMembers: Member[];
  availByUser: Map<string, string>;
  eventTimezone?: string;
  onShiftsChange: (shifts: Shift[]) => void;
  onConflictWarning: (data: ConflictWarningData) => void;
  onClose: () => void;
}

export function CustomShiftForm({
  eventId,
  sortedMembers,
  availByUser,
  eventTimezone,
  onShiftsChange,
  onConflictWarning,
  onClose,
}: CustomShiftFormProps) {
  /* ── Custom shift state ── */
  const [cRole, setCRole] = useState("");
  const [cStart, setCStart] = useState("");
  const [cEnd, setCEnd] = useState("");
  const [cAssign, setCAssign] = useState("");
  const [cPostOrders, setCPostOrders] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);

  async function handleAddCustom() {
    if (!cStart || !cEnd) return;
    // Convert datetime-local inputs from event timezone to UTC
    const utcStart = eventTimezone ? localToUTC(cStart, eventTimezone) : new Date(cStart).toISOString();
    const utcEnd = eventTimezone ? localToUTC(cEnd, eventTimezone) : new Date(cEnd).toISOString();
    const shiftPostOrders = cPostOrders.trim() || undefined;
    if (cAssign) {
      try {
        const conflicts = await getConflictingShifts(cAssign, utcStart, utcEnd);
        if (conflicts.length > 0) {
          onConflictWarning({
            shiftId: "new", userId: cAssign,
            conflicts: conflicts.map((c: Shift) => ({
              role: c.role ?? "Shift",
              eventName: c.events?.name ?? "Unknown Op",
              time: `${fmtTime(c.start_time, eventTimezone)} — ${fmtTime(c.end_time, eventTimezone)}`,
            })),
            pendingAction: async () => {
              setAddingCustom(true);
              try {
                await createShift({ eventId, role: cRole || undefined, startTime: utcStart, endTime: utcEnd, assignedUserId: cAssign || undefined, postOrders: shiftPostOrders });
                setCRole(""); setCStart(""); setCEnd(""); setCAssign(""); setCPostOrders(""); onClose();
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
      await createShift({ eventId, role: cRole || undefined, startTime: utcStart, endTime: utcEnd, assignedUserId: cAssign || undefined, postOrders: shiftPostOrders });
      setCRole(""); setCStart(""); setCEnd(""); setCAssign(""); setCPostOrders(""); onClose();
      onShiftsChange(await getEventShifts(eventId));
    } catch (err) { console.error(err); } finally { setAddingCustom(false); }
  }

  return (
    <div className="px-3 sm:px-4 py-3 space-y-2 border-b border-border/20 bg-primary/[0.02]">
      <Input placeholder="Role / Position (e.g. Supervisor)" value={cRole} onChange={(e) => setCRole(e.target.value)} className="h-8 text-sm" />
      {eventTimezone && (
        <p className="text-[10px] text-muted-foreground">Times are in <span className="font-semibold">{tzAbbrev(eventTimezone)}</span> ({eventTimezone})</p>
      )}
      <div className="flex gap-2">
        <div className="flex-1"><label className="text-[10px] text-muted-foreground">Start</label><Input type="datetime-local" value={cStart} onChange={(e) => setCStart(e.target.value)} className="h-8 text-sm" /></div>
        <div className="flex-1"><label className="text-[10px] text-muted-foreground">End</label><Input type="datetime-local" value={cEnd} onChange={(e) => setCEnd(e.target.value)} className="h-8 text-sm" /></div>
      </div>
      <MemberSearchSelect
        value={cAssign}
        onChange={setCAssign}
        sortedMembers={sortedMembers}
        availByUser={availByUser}
        placeholder="Unassigned"
      />
      <div>
        <label className="text-[10px] text-muted-foreground">Post Orders (optional, overrides event-level)</label>
        <textarea
          value={cPostOrders}
          onChange={(e) => setCPostOrders(e.target.value)}
          placeholder="Shift-specific post orders..."
          rows={2}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-y"
        />
      </div>
      <div className="flex gap-2">
        <Button size="sm" className="h-7 text-xs" onClick={handleAddCustom} disabled={!cStart || !cEnd || addingCustom}>{addingCustom ? <Loader2 className="h-3 w-3 animate-spin" /> : "Add Shift"}</Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onClose}>Cancel</Button>
      </div>
    </div>
  );
}
