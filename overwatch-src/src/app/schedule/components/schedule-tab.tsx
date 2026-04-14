"use client";

import Link from "next/link";
import {
  CalendarDays, MapPin, Clock, Loader2, Bell,
  FileText, CheckCircle2, AlertTriangle,
  ClipboardList, Flag,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { parseUTC } from "@/lib/parse-utc";
import type { OperationDocument } from "@/types/operations";
import type { AvailabilityStatus } from "@/lib/supabase/db-availability";
import { DocsPopup } from "@/components/ops/staff-doc-viewer";
import { ShiftAccordion } from "./shift-accordion";
import { fmtDate, fmtTime, statusColor, type Ev, type Shift } from "./schedule-helpers";
import type { OperationAvailability } from "@/lib/supabase/db-availability";

interface ScheduleTabProps {
  loading: boolean;
  events: Ev[];
  shifts: Shift[];
  isAdmin: boolean;
  eventDocs: Record<string, OperationDocument[]>;
  myAvail: Record<string, OperationAvailability | null>;
  settingAvail: string | null;
  docsPopupEvent: string | null;
  setDocsPopupEvent: (id: string | null) => void;
  onViewDoc: (doc: OperationDocument) => void;
  handleAvailability: (eventId: string, status: AvailabilityStatus) => void;
  sendingReminders: boolean;
  remindersSent: boolean;
  handleSendReminders: () => void;
}

export function ScheduleTab({
  loading, events, shifts, isAdmin,
  eventDocs, myAvail, settingAvail,
  docsPopupEvent, setDocsPopupEvent, onViewDoc,
  handleAvailability,
  sendingReminders, remindersSent, handleSendReminders,
}: ScheduleTabProps) {
  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const today = new Date(); today.setHours(0, 0, 0, 0);
  const isToday = (iso: string) => { const d = parseUTC(iso); d.setHours(0, 0, 0, 0); return d.getTime() === today.getTime(); };
  const isCurrent = (startIso: string, endIso: string) => {
    const s = parseUTC(startIso); s.setHours(0, 0, 0, 0);
    const e = parseUTC(endIso); e.setHours(0, 0, 0, 0);
    return s.getTime() <= today.getTime() && e.getTime() >= today.getTime();
  };
  const currentShifts = shifts.filter((sh: Shift) => isToday(sh.start_time));
  const upcomingShifts = shifts.filter((sh: Shift) => !isToday(sh.start_time));
  const currentEvents = events.filter((ev: Ev) => isCurrent(ev.start_date, ev.end_date));
  const upcomingEvents = events.filter((ev: Ev) => !isCurrent(ev.start_date, ev.end_date));

  // Detect conflicting shifts (same user, overlapping time ranges)
  const conflictIds = new Set<string>();
  for (let i = 0; i < shifts.length; i++) {
    for (let j = i + 1; j < shifts.length; j++) {
      const a = shifts[i], b = shifts[j];
      if (parseUTC(a.start_time) < parseUTC(b.end_time) && parseUTC(a.end_time) > parseUTC(b.start_time)) {
        conflictIds.add(a.id); conflictIds.add(b.id);
      }
    }
  }

  // Group ALL shifts by their event
  const allShiftsByEvent = new Map<string, Shift[]>();
  for (const sh of shifts) {
    const eid = sh.events?.id ?? sh.event_id;
    if (eid) {
      if (!allShiftsByEvent.has(eid)) allShiftsByEvent.set(eid, []);
      allShiftsByEvent.get(eid)!.push(sh);
    }
  }

  const currentEventIds = new Set(currentEvents.map((ev: Ev) => ev.id));
  const upcomingEventIds = new Set(upcomingEvents.map((ev: Ev) => ev.id));
  const allEventIds = new Set([...currentEventIds, ...upcomingEventIds]);
  const orphanShifts = currentShifts.filter((sh: Shift) => !allEventIds.has(sh.events?.id ?? sh.event_id));
  const orphanUpcomingShifts = upcomingShifts.filter((sh: Shift) => {
    const eid = sh.events?.id ?? sh.event_id;
    return !eid || !allEventIds.has(eid);
  });

  const renderOpCard = (ev: Ev, highlight?: boolean, myShifts?: Shift[]) => (
    <Card key={ev.id} className={`overflow-visible ${highlight ? "border-primary/40 bg-primary/5" : "border-border/40"}`}>
      <CardContent className="py-3 px-4">
        <div className="flex items-center gap-4">
          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${highlight ? "bg-primary/15" : "bg-violet-500/10"}`}>
            <MapPin className={`h-5 w-5 ${highlight ? "text-primary" : "text-violet-500"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{ev.name}</p>
            <p className="text-xs text-muted-foreground">
              {fmtDate(ev.start_date)} · {fmtTime(ev.start_date)} — {fmtTime(ev.end_date)}
            </p>
            {ev.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {ev.location}
              </p>
            )}
          </div>
          {(eventDocs[ev.id] ?? []).length > 0 && (
            <div className="relative">
              <button onClick={() => setDocsPopupEvent(docsPopupEvent === ev.id ? null : ev.id)}
                className={`flex items-center gap-1 rounded-lg border px-2 py-1 text-[10px] font-medium transition-colors ${docsPopupEvent === ev.id ? "border-primary bg-primary/10 text-primary" : "border-primary/30 bg-primary/5 text-primary hover:bg-primary/10"}`}>
                <FileText className="h-3 w-3" /> Docs
              </button>
              {docsPopupEvent === ev.id && (
                <DocsPopup
                  docs={eventDocs[ev.id] ?? []}
                  onViewDoc={(doc) => { setDocsPopupEvent(null); onViewDoc(doc); }}
                  onClose={() => setDocsPopupEvent(null)}
                />
              )}
            </div>
          )}
          <Badge className={`text-[10px] capitalize ${statusColor(ev.status)}`}>{ev.status}</Badge>
        </div>
        {/* Issued document badges */}
        {(eventDocs[ev.id] ?? []).length > 0 && (
          <div className="mt-2 ml-14 flex flex-wrap gap-1 border-t border-border/10 pt-2">
            {(eventDocs[ev.id] ?? []).map((d: OperationDocument) => (
              <span key={d.id} className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[9px] font-bold ${
                d.doc_type === "warno" ? "bg-primary/10 text-primary" :
                d.doc_type === "opord" ? "bg-green-500/10 text-green-600" :
                d.doc_type === "frago" ? "bg-amber-500/10 text-amber-600" :
                d.doc_type === "gotwa" ? "bg-violet-500/10 text-violet-500" :
                "bg-muted text-muted-foreground"
              }`}>
                <CheckCircle2 className="h-2.5 w-2.5" /> {d.doc_type.toUpperCase()}
              </span>
            ))}
          </div>
        )}
        {/* Availability RSVP */}
        {!highlight && (
          <div className="mt-2 ml-14 border-t border-border/10 pt-2">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground font-medium">Availability:</span>
              {(["available", "tentative", "unavailable"] as AvailabilityStatus[]).map(s => {
                const current = myAvail[ev.id]?.status;
                const isActive = current === s;
                const cls = s === "available" ? "border-green-500/40 bg-green-500/10 text-green-600" :
                            s === "tentative" ? "border-amber-500/40 bg-amber-500/10 text-amber-600" :
                            "border-red-500/40 bg-red-500/10 text-red-500";
                return (
                  <button key={s} type="button" disabled={settingAvail === ev.id}
                    onClick={() => handleAvailability(ev.id, s)}
                    className={`rounded-md border px-2 py-0.5 text-[10px] font-medium capitalize transition-colors ${isActive ? cls : "border-border/30 text-muted-foreground/60 hover:border-border"}`}>
                    {s}
                  </button>
                );
              })}
              {settingAvail === ev.id && <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />}
            </div>
          </div>
        )}
        {/* Collapsible shift details */}
        {myShifts && myShifts.length > 0 && (
          <ShiftAccordion shifts={myShifts} highlight={!!highlight} conflictIds={conflictIds} />
        )}
        {/* Quick-action buttons for current operations */}
        {highlight && (
          <div className="mt-2 ml-14 flex flex-wrap gap-1.5 border-t border-primary/10 pt-2">
            <Link href="/timeclock">
              <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2">
                <Clock className="h-3 w-3" /> Clock In
              </Button>
            </Link>
            <Link href="/forms">
              <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2">
                <ClipboardList className="h-3 w-3" /> File Report
              </Button>
            </Link>
            <Link href="/incidents">
              <Button size="sm" variant="outline" className="h-6 gap-1 text-[10px] px-2">
                <Flag className="h-3 w-3" /> Report Incident
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <>
      {/* ── Send Reminders (admin only) ── */}
      {isAdmin && shifts.length > 0 && (
        <div className="flex justify-end">
          <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
            onClick={handleSendReminders} disabled={sendingReminders}>
            {sendingReminders ? <Loader2 className="h-3 w-3 animate-spin" /> : remindersSent ? <Bell className="h-3 w-3 text-green-500" /> : <Bell className="h-3 w-3" />}
            {remindersSent ? "Sent!" : "Send Reminders"}
          </Button>
        </div>
      )}

      {/* ── Conflict Banner ── */}
      {conflictIds.size > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-600">Scheduling Conflict</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              You have {conflictIds.size} shift{conflictIds.size !== 1 ? "s" : ""} with overlapping times. Contact your supervisor to resolve.
            </p>
          </div>
        </div>
      )}

      {/* ── Current Operation ── */}
      {(currentShifts.length > 0 || currentEvents.length > 0) && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-primary/80 flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-green-500 animate-pulse" /> Current Operation
          </h2>
          <div className="space-y-2">
            {currentEvents.map((ev: Ev) => renderOpCard(ev, true, allShiftsByEvent.get(ev.id)))}
            {/* Orphan shifts without a matching event card */}
            {orphanShifts.map((sh: Shift) => (
              <Card key={sh.id} className={`${conflictIds.has(sh.id) ? "border-amber-500/40 bg-amber-500/5" : "border-primary/40 bg-primary/5"}`}>
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${conflictIds.has(sh.id) ? "bg-amber-500/15" : "bg-primary/15"}`}>
                    {conflictIds.has(sh.id) ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <Clock className="h-5 w-5 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{sh.events?.name ?? "Shift"}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(sh.start_time)} · {fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}
                    </p>
                    {sh.role && <p className="text-xs text-muted-foreground mt-0.5">Role: {sh.role}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {conflictIds.has(sh.id) && <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Conflict</Badge>}
                    <Badge className="text-[10px] capitalize bg-green-500/15 text-green-600">Today</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ── Upcoming Operations (with nested shifts) ── */}
      <div>
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Upcoming Operations</h2>
        {upcomingEvents.length === 0 && currentEvents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <CalendarDays className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No upcoming operations</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Operations created by command will appear here when scheduled.
            </p>
          </div>
        ) : upcomingEvents.length === 0 ? (
          <p className="text-xs text-muted-foreground/50 italic">No additional upcoming operations.</p>
        ) : (
          <div className="space-y-2">
            {upcomingEvents.map((ev: Ev) => renderOpCard(ev, false, allShiftsByEvent.get(ev.id)))}
          </div>
        )}
      </div>

      {/* ── Unlinked Shifts (not connected to any operation) ── */}
      {orphanUpcomingShifts.length > 0 && (
        <div>
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Unlinked Shifts</h2>
          <div className="space-y-2">
            {orphanUpcomingShifts.map((sh: Shift) => (
              <Card key={sh.id} className={conflictIds.has(sh.id) ? "border-amber-500/40 bg-amber-500/5" : "border-border/40"}>
                <CardContent className="flex items-center gap-4 py-3 px-4">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${conflictIds.has(sh.id) ? "bg-amber-500/10" : "bg-blue-500/10"}`}>
                    {conflictIds.has(sh.id) ? <AlertTriangle className="h-5 w-5 text-amber-500" /> : <Clock className="h-5 w-5 text-blue-500" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm">{sh.events?.name ?? "Shift"}</p>
                    <p className="text-xs text-muted-foreground">
                      {fmtDate(sh.start_time)} · {fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}
                    </p>
                    {sh.role && <p className="text-xs text-muted-foreground mt-0.5">Role: {sh.role}</p>}
                  </div>
                  <div className="flex items-center gap-1">
                    {conflictIds.has(sh.id) && <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Conflict</Badge>}
                    <Badge className={`text-[10px] capitalize ${statusColor(sh.assigned_user_id ? "confirmed" : "open")}`}>{sh.assigned_user_id ? "Confirmed" : "Open"}</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
