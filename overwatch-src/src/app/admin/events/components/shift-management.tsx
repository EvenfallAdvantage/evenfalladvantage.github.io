"use client";

import { useState, useEffect } from "react";
import {
  Plus, Zap, List, LayoutGrid, Upload, Wand2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  getEventShifts, deleteShift, assignShift, getConflictingShifts,
  smartFillShifts, getEventUserCertifications,
} from "@/lib/supabase/db";
import { toast } from "sonner";
import { type Shift, fmtTime } from "./shared";
import type { ShiftManagementProps } from "./shift-management/types";
import { useShiftDerivedData } from "./shift-management/use-shift-helpers";
import { QuickFillPanel } from "./shift-management/quick-fill-panel";
import { CustomShiftForm } from "./shift-management/custom-shift-form";
import { CsvImportPanel } from "./shift-management/csv-import-panel";
import { ShiftCalendarView } from "./shift-management/shift-calendar-view";
import { ShiftListView } from "./shift-management/shift-list-view";

/* ── Component ── */

export function ShiftManagement({
  eventId,
  companyId,
  startDate,
  endDate,
  shifts,
  members,
  availability,
  onShiftsChange,
  onConflictWarning,
  eventTimezone,
}: ShiftManagementProps) {
  /* ── Panel visibility state ── */
  const [showBuilder, setShowBuilder] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [showImport, setShowImport] = useState(false);

  /* ── View state ── */
  const [shiftView, setShiftView] = useState<"list" | "calendar">("calendar");
  const [calendarDay, setCalendarDay] = useState<string | null>(null);
  const [deletingShift, setDeletingShift] = useState<string | null>(null);
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [userCertifications, setUserCertifications] = useState<Record<string, { hasAbcCert: boolean; abcState: string | null }>>({});

  /* ── Derived ── */
  const {
    opDays, shiftsByDay, availByUser, sortedMembers, adminConflictIds,
  } = useShiftDerivedData(startDate, endDate, shifts, members, availability);

  /* ── Fetch user certifications on mount ── */
  useEffect(() => {
    const fetchCertifications = async () => {
      try {
        const certs = await getEventUserCertifications(eventId);
        setUserCertifications(certs);
      } catch (err) {
        console.error("[ShiftManagement] Failed to fetch user certifications:", err);
      }
    };
    fetchCertifications();
  }, [eventId]);

  /* ── Handlers ── */

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
              time: `${fmtTime(c.start_time, eventTimezone)} — ${fmtTime(c.end_time, eventTimezone)}`,
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

  /**
   * Auto-assign open shifts to the best-fit staff. Considers availability,
   * weekly hours / OT, min rest between shifts, and role preference.
   * Surfaces a summary toast. The detailed per-shift reasoning is logged
   * to the console for debugging; future enhancement: surface in a modal.
   */
  async function handleAutoAssign() {
    const openCount = shifts.filter((s: Shift) => !s.assigned_user_id).length;
    if (openCount === 0) {
      toast.info("No open shifts to assign.");
      return;
    }
    setAutoAssigning(true);
    try {
      const results = await smartFillShifts(eventId, companyId, { dryRun: false });
      const assigned = results.filter((r) => r.assigned).length;
      const unassigned = results.length - assigned;
      if (assigned > 0) {
        toast.success(
          unassigned > 0
            ? `Assigned ${assigned}/${results.length}. ${unassigned} unfilled (no eligible staff).`
            : `Assigned all ${assigned} open shift${assigned === 1 ? "" : "s"}.`,
        );
        onShiftsChange(await getEventShifts(eventId));
      } else {
        toast.error("No shifts could be auto-assigned (no eligible staff).");
      }
      // Console-log the detailed reasoning for debugging — most users
      // won't open devtools, but it's there if someone wants to audit
      // why a particular shift went to a particular person.
      console.log("[Auto-Assign] Detailed results:", results);
    } catch (err) {
      console.error("[Auto-Assign] Failed:", err);
      toast.error("Auto-assign failed");
    } finally {
      setAutoAssigning(false);
    }
  }

  return (
    <>
      {/* Action Buttons */}
      <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center gap-2 border-b border-border/20">
        <Button size="sm" variant={showBuilder ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
          onClick={() => { setShowBuilder(!showBuilder); setShowCustom(false); setShowImport(false); }}>
          <Zap className="h-3.5 w-3.5" /> Quick Fill
        </Button>
        <Button size="sm" variant={showCustom ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
          onClick={() => { setShowCustom(!showCustom); setShowBuilder(false); setShowImport(false); }}>
          <Plus className="h-3.5 w-3.5" /> Custom Shift
        </Button>
        <Button size="sm" variant={showImport ? "default" : "outline"} className="h-7 gap-1.5 text-xs"
          onClick={() => { setShowImport(!showImport); setShowBuilder(false); setShowCustom(false); }}>
          <Upload className="h-3.5 w-3.5" /> Import Shifts
        </Button>
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1.5 text-xs"
          onClick={handleAutoAssign}
          disabled={autoAssigning}
          title="Assign open shifts to best-fit staff (availability + OT + rest + role)"
        >
          {autoAssigning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
          Auto-Assign
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
        <QuickFillPanel
          eventId={eventId}
          opDays={opDays}
          eventTimezone={eventTimezone}
          onShiftsChange={onShiftsChange}
          onClose={() => setShowBuilder(false)}
        />
      )}

      {/* Custom Shift Form */}
      {showCustom && (
        <CustomShiftForm
          eventId={eventId}
          sortedMembers={sortedMembers}
          availByUser={availByUser}
          eventTimezone={eventTimezone}
          onShiftsChange={onShiftsChange}
          onConflictWarning={onConflictWarning}
          onClose={() => setShowCustom(false)}
        />
      )}

      {/* CSV Import Panel */}
      {showImport && (
        <CsvImportPanel
          eventId={eventId}
          companyId={companyId}
          members={members}
          eventTimezone={eventTimezone}
          onShiftsChange={onShiftsChange}
          onClose={() => setShowImport(false)}
        />
      )}

      {/* List View */}
      {shiftView === "list" && (
        <ShiftListView
          shifts={shifts}
          shiftsByDay={shiftsByDay}
          sortedMembers={sortedMembers}
          availByUser={availByUser}
          adminConflictIds={adminConflictIds}
          deletingShift={deletingShift}
          eventTimezone={eventTimezone}
          onDelete={handleDeleteShift}
          onAssign={handleAssign}
          userCertifications={userCertifications}
        />
      )}

      {/* Calendar View */}
      {shiftView === "calendar" && (
        <div className="px-3 sm:px-4 py-3">
          <ShiftCalendarView
            shifts={shifts}
            shiftsByDay={shiftsByDay}
            opDays={opDays}
            members={members}
            sortedMembers={sortedMembers}
            availByUser={availByUser}
            adminConflictIds={adminConflictIds}
            calendarDay={calendarDay}
            setCalendarDay={setCalendarDay}
            deletingShift={deletingShift}
            eventTimezone={eventTimezone}
            onDelete={handleDeleteShift}
            onAssign={handleAssign}
            userCertifications={userCertifications}
          />
        </div>
      )}
    </>
  );
}
