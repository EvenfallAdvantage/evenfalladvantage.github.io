"use client";

import { useEffect, useState, useCallback } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import {
  CalendarDays, MapPin, Clock, Loader2, QrCode,
  Plus, ArrowUpFromLine, ArrowDownToLine, Trash2, Bell,
  FileText, Camera, ScanLine, CheckCircle2, AlertCircle, AlertTriangle,
  ClipboardList, Flag, ChevronDown, ChevronLeft, ChevronRight, List,
} from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";
import {
  getUpcomingEvents, getUserShifts, getAssets, createAsset, checkoutAsset, checkinAsset, deleteAsset, getAssetByQrCode,
  getEventDocuments, setAvailability, getMyAvailability,
} from "@/lib/supabase/db";
import type { OperationDocument } from "@/types/operations";
import type { AvailabilityStatus, OperationAvailability } from "@/lib/supabase/db-availability";
import { DocsPopup, DocViewerModal } from "@/components/ops/staff-doc-viewer";

const QrScanner = dynamic(() => import("@/components/qr-scanner"), { ssr: false });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Ev = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Shift = any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Asset = any;

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
}
function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function ShiftAccordion({ shifts, highlight, conflictIds, statusColor }: {
  shifts: Shift[];
  highlight: boolean;
  conflictIds: Set<string>;
  statusColor: (s: string) => string;
}) {
  const [open, setOpen] = useState(highlight);
  return (
    <div className="mt-2 ml-14 border-t border-primary/10 pt-2">
      <button type="button" onClick={() => setOpen(!open)}
        className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? "" : "-rotate-90"}`} />
        {shifts.length} shift{shifts.length !== 1 ? "s" : ""} assigned
      </button>
      {open && (
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
    </div>
  );
}

export default function SchedulePage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");

  const [tab, setTab] = useState<"schedule" | "armory">("schedule");
  const [scheduleView, setScheduleView] = useState<"list" | "calendar">("list");
  const [calMonth, setCalMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [calSelectedDay, setCalSelectedDay] = useState<string | null>(null);

  // Schedule state
  const [events, setEvents] = useState<Ev[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [loading, setLoading] = useState(true);

  // Document & availability state
  const user = useAuthStore((s) => s.user);
  const [eventDocs, setEventDocs] = useState<Record<string, OperationDocument[]>>({});
  const [myAvail, setMyAvail] = useState<Record<string, OperationAvailability | null>>({});
  const [settingAvail, setSettingAvail] = useState<string | null>(null);
  const [docsPopupEvent, setDocsPopupEvent] = useState<string | null>(null);
  const [viewingDoc, setViewingDoc] = useState<OperationDocument | null>(null);

  // Armory state
  const [assets, setAssets] = useState<Asset[]>([]);
  const [assetsLoading, setAssetsLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState("");
  const [newSerial, setNewSerial] = useState("");
  const [creating, setCreating] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [deletingAsset, setDeletingAsset] = useState<string | null>(null);
  const [sendingReminders, setSendingReminders] = useState(false);
  const [remindersSent, setRemindersSent] = useState(false);

  // QR scanner state
  const [scanMode, setScanMode] = useState<null | "serial" | "checkinout">(null);
  const [scanResult, setScanResult] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const loadSchedule = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const [ev, sh] = await Promise.all([
        getUpcomingEvents(activeCompanyId),
        getUserShifts(activeCompanyId),
      ]);
      setEvents(ev);
      setShifts(sh);
    } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  const loadAssets = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setAssetsLoading(false); return; }
    try { setAssets(await getAssets(activeCompanyId)); } catch {} finally { setAssetsLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadSchedule(); loadAssets(); }, [loadSchedule, loadAssets]);

  // Load issued documents & my availability for each event
  useEffect(() => {
    if (!events.length || !user?.id) return;
    (async () => {
      const docsMap: Record<string, OperationDocument[]> = {};
      const availMap: Record<string, OperationAvailability | null> = {};
      await Promise.all(events.map(async (ev: Ev) => {
        try {
          const [docs, avail] = await Promise.all([
            getEventDocuments(ev.id),
            getMyAvailability(ev.id, user.id),
          ]);
          docsMap[ev.id] = docs.filter((d: OperationDocument) => d.status === "issued");
          availMap[ev.id] = avail;
        } catch {}
      }));
      setEventDocs(docsMap);
      setMyAvail(availMap);
    })();
  }, [events, user?.id]);

  async function handleAvailability(eventId: string, status: AvailabilityStatus) {
    if (!user?.id) return;
    setSettingAvail(eventId);
    try {
      const result = await setAvailability({ eventId, userId: user.id, status });
      setMyAvail(prev => ({ ...prev, [eventId]: result }));
    } catch (err) { console.error(err); }
    finally { setSettingAvail(null); }
  }

  const statusColor = (s: string) => {
    if (s === "published" || s === "confirmed") return "bg-green-500/15 text-green-600";
    if (s === "draft") return "bg-amber-500/15 text-amber-600";
    return "bg-muted text-muted-foreground";
  };

  const assetStatusColor = (s: string) => {
    if (s === "available") return "bg-green-500/15 text-green-600";
    if (s === "checked_out") return "bg-amber-500/15 text-amber-600";
    return "bg-muted text-muted-foreground";
  };

  async function handleCreateAsset() {
    if (!newName.trim() || !activeCompanyId || activeCompanyId === "pending") return;
    setCreating(true);
    try {
      await createAsset({ companyId: activeCompanyId, name: newName.trim(), assetType: newType || undefined, serialNumber: newSerial || undefined });
      setNewName(""); setNewType(""); setNewSerial(""); setShowCreate(false); await loadAssets();
    } catch (err) { console.error(err); } finally { setCreating(false); }
  }

  async function handleCheckout(id: string) {
    setActing(id);
    try { await checkoutAsset(id); await loadAssets(); }
    catch (err) { console.error(err); }
    finally { setActing(null); }
  }

  async function handleCheckin(id: string) {
    setActing(id);
    try { await checkinAsset(id); await loadAssets(); }
    catch (err) { console.error(err); }
    finally { setActing(null); }
  }

  async function handleSendReminders() {
    if (!activeCompanyId || activeCompanyId === "pending" || !shifts.length) return;
    setSendingReminders(true);
    try {
      const { dispatch } = await import("@/lib/services/notification-dispatcher");
      const { sendWhatsAppShiftReminder } = await import("@/lib/services/whatsapp-service");
      const { sendShiftReminderSMS } = await import("@/lib/services/sms-service");
      const { sendEmail, buildShiftReminderEmail } = await import("@/lib/services/email-service");
      const { getCompanyDetails } = await import("@/lib/supabase/db");
      const company = await getCompanyDetails(activeCompanyId);
      const companyName = company?.name ?? "Your Company";

      for (const sh of shifts) {
        const u = Array.isArray(sh.users) ? sh.users[0] : sh.users;
        if (!u?.id) continue;
        const firstName = u.first_name ?? "Team member";
        const shiftDate = fmtDate(sh.start_time);
        const shiftTime = `${fmtTime(sh.start_time)} — ${fmtTime(sh.end_time)}`;
        const location = sh.events?.location;
        // In-app + push notification
        dispatch({
          userId: u.id, companyId: activeCompanyId,
          title: "Shift Reminder",
          body: `${shiftDate} at ${shiftTime}${location ? ` — ${location}` : ""}`,
          type: "shift_reminder", actionUrl: "/schedule",
          phone: u.phone, email: u.email,
          urgent: true, emailFallback: true,
        }).catch(() => {});
        // WhatsApp
        if (u.phone) sendWhatsAppShiftReminder(activeCompanyId, { phone: u.phone, firstName, shiftDate, shiftTime, location }).catch(() => {});
        // SMS
        if (u.phone) sendShiftReminderSMS(activeCompanyId, { phone: u.phone, firstName, shiftDate, shiftTime, location }).catch(() => {});
        // Email
        if (u.email) {
          const tpl = buildShiftReminderEmail({ firstName, companyName, shiftDate, shiftTime, location });
          tpl.to = u.email;
          sendEmail(activeCompanyId, tpl).catch(() => {});
        }
      }
      setRemindersSent(true);
      setTimeout(() => setRemindersSent(false), 3000);
    } catch (err) { console.error("Send reminders failed:", err); }
    finally { setSendingReminders(false); }
  }

  async function handleDeleteAsset(id: string) {
    if (!confirm("Delete this asset?")) return;
    setDeletingAsset(id);
    try { await deleteAsset(id); await loadAssets(); }
    catch (err) { console.error(err); }
    finally { setDeletingAsset(null); }
  }

  // QR scan: populate serial number field
  function handleSerialScan(value: string) {
    setNewSerial(value);
    setScanMode(null);
    setScanResult({ type: "success", message: `Scanned: ${value}` });
    setTimeout(() => setScanResult(null), 3000);
  }

  // QR scan: check-in or check-out by scanning asset QR code
  async function handleCheckinoutScan(value: string) {
    setScanMode(null);
    if (!activeCompanyId || activeCompanyId === "pending") {
      setScanResult({ type: "error", message: "No active company." });
      setTimeout(() => setScanResult(null), 4000);
      return;
    }
    try {
      const asset = await getAssetByQrCode(activeCompanyId, value);
      if (!asset) {
        setScanResult({ type: "error", message: `No equipment found for scanned code.` });
        setTimeout(() => setScanResult(null), 4000);
        return;
      }
      if (asset.status === "available") {
        await checkoutAsset(asset.id);
        setScanResult({ type: "success", message: `Checked out: ${asset.name}` });
      } else if (asset.status === "checked_out") {
        await checkinAsset(asset.id);
        setScanResult({ type: "success", message: `Returned: ${asset.name}` });
      } else {
        setScanResult({ type: "error", message: `Asset "${asset.name}" status: ${asset.status}` });
      }
      await loadAssets();
    } catch (err) {
      console.error(err);
      setScanResult({ type: "error", message: "Scan action failed. Try again." });
    }
    setTimeout(() => setScanResult(null), 4000);
  }

  return (
    <>
      <div className="space-y-6">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2"><CalendarDays className="h-5 w-5 sm:h-6 sm:w-6" /> OPERATIONS</h1>
          <p className="text-xs sm:text-sm text-muted-foreground mb-4">Your assigned shifts, operations, and equipment</p>
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit">
            <button onClick={() => setTab("schedule")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "schedule" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              <CalendarDays className="h-3.5 w-3.5" />Schedule
            </button>
            <button onClick={() => setTab("armory")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "armory" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              <QrCode className="h-3.5 w-3.5" />Armory
            </button>
          </div>
        </div>

        {/* ── Schedule Tab ── */}
        {tab === "schedule" && (
          loading ? (
            <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (() => {
            const today = new Date(); today.setHours(0,0,0,0);
            const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
            const todayStr = today.toISOString().slice(0, 10);
            const isToday = (iso: string) => { const d = new Date(iso); d.setHours(0,0,0,0); return d.getTime() === today.getTime(); };
            const isCurrent = (startIso: string, endIso: string) => {
              const s = new Date(startIso); s.setHours(0,0,0,0);
              const e = new Date(endIso); e.setHours(0,0,0,0);
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
                if (new Date(a.start_time) < new Date(b.end_time) && new Date(a.end_time) > new Date(b.start_time)) {
                  conflictIds.add(a.id); conflictIds.add(b.id);
                }
              }
            }

            // Group ALL shifts by day for calendar view
            const shiftsByDay = new Map<string, Shift[]>();
            for (const sh of shifts) {
              const day = new Date(sh.start_time).toISOString().slice(0, 10);
              if (!shiftsByDay.has(day)) shiftsByDay.set(day, []);
              shiftsByDay.get(day)!.push(sh);
            }

            // Calendar grid computation
            const calYear = calMonth.getFullYear();
            const calMon = calMonth.getMonth();
            const firstOfMonth = new Date(calYear, calMon, 1);
            const lastOfMonth = new Date(calYear, calMon + 1, 0);
            const startPad = firstOfMonth.getDay();
            const calDays: (string | null)[] = [];
            for (let i = 0; i < startPad; i++) calDays.push(null);
            for (let d = 1; d <= lastOfMonth.getDate(); d++) {
              calDays.push(new Date(calYear, calMon, d).toISOString().slice(0, 10));
            }
            while (calDays.length % 7 !== 0) calDays.push(null);
            const monthLabel = calMonth.toLocaleDateString([], { month: "long", year: "numeric" });

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
                            onViewDoc={(doc) => { setDocsPopupEvent(null); setViewingDoc(doc); }}
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
                    <ShiftAccordion shifts={myShifts} highlight={!!highlight} conflictIds={conflictIds} statusColor={statusColor} />
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

            // Group today's shifts by their event for folding
            const shiftsByEvent = new Map<string, Shift[]>();
            for (const sh of currentShifts) {
              const eid = sh.events?.id ?? sh.event_id;
              if (!shiftsByEvent.has(eid)) shiftsByEvent.set(eid, []);
              shiftsByEvent.get(eid)!.push(sh);
            }
            // Find shifts whose event is NOT in currentEvents (orphan shifts)
            const currentEventIds = new Set(currentEvents.map((ev: Ev) => ev.id));
            const orphanShifts = currentShifts.filter((sh: Shift) => !currentEventIds.has(sh.events?.id ?? sh.event_id));

            // Group upcoming shifts by their event for nesting
            const upcomingShiftsByEvent = new Map<string, Shift[]>();
            for (const sh of upcomingShifts) {
              const eid = sh.events?.id ?? sh.event_id;
              if (eid) {
                if (!upcomingShiftsByEvent.has(eid)) upcomingShiftsByEvent.set(eid, []);
                upcomingShiftsByEvent.get(eid)!.push(sh);
              }
            }
            const upcomingEventIds = new Set(upcomingEvents.map((ev: Ev) => ev.id));
            const orphanUpcomingShifts = upcomingShifts.filter((sh: Shift) => {
              const eid = sh.events?.id ?? sh.event_id;
              return !eid || !upcomingEventIds.has(eid);
            });

            return (
            <>
              {/* ── View Toggle ── */}
              <div className="flex items-center justify-between">
                <div className="flex gap-1 rounded-lg bg-muted/50 p-0.5 w-fit">
                  <button onClick={() => setScheduleView("list")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${scheduleView === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    <List className="h-3 w-3" /> List
                  </button>
                  <button onClick={() => setScheduleView("calendar")}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${scheduleView === "calendar" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
                    <CalendarDays className="h-3 w-3" /> Calendar
                  </button>
                </div>
                {isAdmin && shifts.length > 0 && (
                  <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                    onClick={handleSendReminders} disabled={sendingReminders}>
                    {sendingReminders ? <Loader2 className="h-3 w-3 animate-spin" /> : remindersSent ? <Bell className="h-3 w-3 text-green-500" /> : <Bell className="h-3 w-3" />}
                    {remindersSent ? "Sent!" : "Send Reminders"}
                  </Button>
                )}
              </div>

              {/* ── Calendar View ── */}
              {scheduleView === "calendar" && (
                <div>
                  {/* Month navigation */}
                  <div className="flex items-center justify-between mb-3">
                    <button onClick={() => setCalMonth(new Date(calYear, calMon - 1, 1))}
                      className="rounded-md p-1 hover:bg-muted transition-colors"><ChevronLeft className="h-4 w-4" /></button>
                    <h3 className="text-sm font-semibold">{monthLabel}</h3>
                    <button onClick={() => setCalMonth(new Date(calYear, calMon + 1, 1))}
                      className="rounded-md p-1 hover:bg-muted transition-colors"><ChevronRight className="h-4 w-4" /></button>
                  </div>

                  {/* Day headers */}
                  <div className="grid grid-cols-7 gap-px mb-1">
                    {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                      <div key={d} className="text-center text-[9px] font-semibold uppercase tracking-wider text-muted-foreground/40 py-1">{d}</div>
                    ))}
                  </div>

                  {/* Calendar grid */}
                  <div className="grid grid-cols-7 gap-1">
                    {calDays.map((day, i) => {
                      if (!day) return <div key={`pad-${i}`} className="min-h-[60px]" />;
                      const dayShifts = shiftsByDay.get(day) ?? [];
                      const dayNum = new Date(day + "T12:00:00").getDate();
                      const isDayToday = day === todayStr;
                      const isSelected = calSelectedDay === day;
                      const hasConflict = dayShifts.some((s: Shift) => conflictIds.has(s.id));
                      const totalHrs = dayShifts.reduce((sum: number, s: Shift) => {
                        const ms = new Date(s.end_time).getTime() - new Date(s.start_time).getTime();
                        return sum + (ms > 0 ? ms / 3600000 : ms / 3600000 + 24);
                      }, 0);

                      return (
                        <button key={day} onClick={() => dayShifts.length > 0 ? setCalSelectedDay(isSelected ? null : day) : undefined}
                          className={`relative rounded-lg p-1.5 min-h-[60px] text-left transition-all border ${
                            isSelected ? "border-primary bg-primary/10 ring-1 ring-primary/30" :
                            hasConflict ? "border-amber-500/30 bg-amber-500/[0.04]" :
                            dayShifts.length > 0 ? "border-primary/20 bg-primary/[0.03] hover:bg-primary/[0.07]" :
                            "border-transparent hover:bg-muted/20"
                          }`}>
                          <div className="flex items-center justify-between">
                            <span className={`text-[11px] font-mono font-semibold ${isDayToday ? "text-primary" : dayShifts.length > 0 ? "" : "text-muted-foreground/30"}`}>{dayNum}</span>
                            {dayShifts.length > 0 && <span className="text-[8px] font-mono text-muted-foreground/60">{totalHrs.toFixed(0)}h</span>}
                          </div>
                          {dayShifts.length > 0 && (
                            <div className="mt-0.5">
                              <span className={`inline-flex items-center rounded px-1 py-0.5 text-[8px] font-bold ${hasConflict ? "bg-amber-500/15 text-amber-600" : "bg-primary/15 text-primary"}`}>
                                {dayShifts.length} shift{dayShifts.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                          {isDayToday && <span className="absolute bottom-1 left-1/2 -translate-x-1/2 h-1 w-1 rounded-full bg-primary" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mt-3 pt-2 border-t border-border/10">
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-primary/30" /> Has Shifts</span>
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-2 w-2 rounded-sm bg-amber-500/30" /> Conflict</span>
                    <span className="flex items-center gap-1 text-[9px] text-muted-foreground"><span className="h-1 w-1 rounded-full bg-primary" /> Today</span>
                  </div>

                  {/* Expanded day detail */}
                  {calSelectedDay && shiftsByDay.has(calSelectedDay) && (
                    <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.02] p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5">
                          <CalendarDays className="h-3.5 w-3.5 text-primary" />
                          {new Date(calSelectedDay + "T12:00:00").toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" })}
                        </h4>
                        <button onClick={() => setCalSelectedDay(null)} className="text-muted-foreground hover:text-foreground text-xs">✕</button>
                      </div>
                      <div className="space-y-1.5">
                        {(shiftsByDay.get(calSelectedDay) ?? []).map((sh: Shift) => {
                          const hasConflict = conflictIds.has(sh.id);
                          return (
                            <div key={sh.id} className={`rounded-lg border px-2.5 py-2 ${hasConflict ? "border-amber-500/30 bg-amber-500/[0.04]" : "border-primary/15 bg-primary/[0.02]"}`}>
                              <div className="flex items-center gap-2 text-xs">
                                {hasConflict ? <AlertTriangle className="h-3 w-3 text-amber-500 shrink-0" /> : <Clock className="h-3 w-3 text-primary/60 shrink-0" />}
                                <span className="font-medium">{sh.events?.name ?? "Shift"}</span>
                                <span className="text-muted-foreground font-mono ml-auto">{fmtTime(sh.start_time)} — {fmtTime(sh.end_time)}</span>
                              </div>
                              {sh.role && <div className="text-muted-foreground/60 text-[10px] ml-5 mt-0.5">Role: {sh.role}</div>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── List View ── */}
              {scheduleView === "list" && <>

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
                    {currentEvents.map((ev: Ev) => renderOpCard(ev, true, shiftsByEvent.get(ev.id)))}
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
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">Upcoming Operations</h2>
                  {isAdmin && shifts.length > 0 && (
                    <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs"
                      onClick={handleSendReminders} disabled={sendingReminders}>
                      {sendingReminders ? <Loader2 className="h-3 w-3 animate-spin" /> : remindersSent ? <Bell className="h-3 w-3 text-green-500" /> : <Bell className="h-3 w-3" />}
                      {remindersSent ? "Sent!" : "Send Reminders"}
                    </Button>
                  )}
                </div>
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
                    {upcomingEvents.map((ev: Ev) => renderOpCard(ev, false, upcomingShiftsByEvent.get(ev.id)))}
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
            </>}
            </>
            );
          })()
        )}

        {/* ── Armory Tab ── */}
        {tab === "armory" && (
          <>
            {/* QR Scanner Modal */}
            {scanMode === "serial" && (
              <QrScanner
                title="Scan Serial / Barcode"
                hint="Point at equipment barcode or QR code to populate serial number"
                onScan={handleSerialScan}
                onClose={() => setScanMode(null)}
              />
            )}
            {scanMode === "checkinout" && (
              <QrScanner
                title="Scan to Check In / Out"
                hint="Scan an asset's QR code to toggle check-in or check-out"
                onScan={handleCheckinoutScan}
                onClose={() => setScanMode(null)}
              />
            )}

            {/* Scan result toast */}
            {scanResult && (
              <div className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium ${scanResult.type === "success" ? "bg-green-500/15 text-green-600" : "bg-red-500/15 text-red-600"}`}>
                {scanResult.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                {scanResult.message}
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center justify-between">
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setScanMode("checkinout")}>
                <ScanLine className="h-4 w-4" /> Scan Check In / Out
              </Button>
              {isAdmin && (
                <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
                  <Plus className="h-4 w-4" /> Add Gear
                </Button>
              )}
            </div>

            {showCreate && (
              <div className="space-y-2 rounded-xl border border-primary/30 bg-card p-4">
                <Input placeholder="Equipment name *" value={newName} onChange={(e) => setNewName(e.target.value)} />
                <div className="flex gap-2">
                  <Input placeholder="Type (e.g. Radio, Vest)" value={newType} onChange={(e) => setNewType(e.target.value)} className="flex-1" />
                  <div className="flex-1 relative">
                    <Input placeholder="Serial #" value={newSerial} onChange={(e) => setNewSerial(e.target.value)} className="pr-9" />
                    <button
                      type="button"
                      onClick={() => setScanMode("serial")}
                      className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors"
                      title="Scan barcode / QR code"
                    >
                      <Camera className="h-4 w-4" />
                    </button>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleCreateAsset} disabled={!newName.trim() || creating}>
                    {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
                </div>
              </div>
            )}

            {assetsLoading ? (
              <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
            ) : assets.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
                <QrCode className="mb-3 h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">No gear registered</p>
                <p className="mt-1 max-w-xs text-xs text-muted-foreground">
                  {isAdmin ? "Add equipment to start tracking inventory." : "Your organization hasn't registered any gear yet."}
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {assets.map((a: Asset) => (
                  <div key={a.id} className="rounded-xl border border-border/50 bg-card px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 shrink-0">
                        <QrCode className="h-5 w-5 text-emerald-500" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{a.name}</p>
                          <Badge className={`text-[10px] shrink-0 ${assetStatusColor(a.status)}`}>
                            {a.status === "checked_out" ? "Out" : a.status}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-0.5">
                          {a.asset_type && <span className="text-xs text-muted-foreground">{a.asset_type}</span>}
                          {a.serial_number && <span className="text-xs text-muted-foreground">SN: {a.serial_number}</span>}
                          {a.users && <span className="text-xs text-primary font-medium">→ {a.users.first_name} {a.users.last_name}</span>}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-2 ml-[52px]">
                      {a.status === "available" ? (
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleCheckout(a.id)} disabled={acting === a.id}>
                          {acting === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpFromLine className="h-3 w-3" />}
                          Check Out
                        </Button>
                      ) : a.status === "checked_out" ? (
                        <Button size="sm" variant="outline" className="h-7 gap-1 text-xs" onClick={() => handleCheckin(a.id)} disabled={acting === a.id}>
                          {acting === a.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowDownToLine className="h-3 w-3" />}
                          Return
                        </Button>
                      ) : null}
                      {isAdmin && (
                        <button onClick={() => handleDeleteAsset(a.id)} disabled={deletingAsset === a.id}
                          className="rounded-md p-1 text-muted-foreground/40 transition-colors hover:bg-red-500/10 hover:text-red-500" title="Delete asset">
                          {deletingAsset === a.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Doc Viewer Modal ── */}
      {viewingDoc && (
        <DocViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}
    </>
  );
}

