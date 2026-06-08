"use client";

import { useEffect, useState, useCallback } from "react";
import { ErrorBoundary } from "@/components/error-boundary";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import {
  CalendarDays, Loader2, QrCode, Globe, Plus, ArrowLeftRight,
} from "lucide-react";
import dynamic from "next/dynamic";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import {
  getUpcomingEvents, getUserShifts, getAssets, createAsset, checkoutAsset, checkinAsset, deleteAsset, getAssetByQrCode,
  getEventDocuments, setAvailability, getMyAvailability,
} from "@/lib/supabase/db";
import type { OperationDocument } from "@/types/operations";
import type { AvailabilityStatus, OperationAvailability } from "@/lib/supabase/db-availability";
import { DocViewerModal } from "@/components/ops/staff-doc-viewer";
import { toast } from "sonner";
import { usePageHeader } from "@/stores/page-header-store";
import { getStaffLocations, subscribeStaffLocations } from "@/lib/supabase/db-location";
import { getIncidents, getTeams } from "@/lib/supabase/db";
import type { OperationPin, StaffPin, IncidentPin } from "@/components/tactical-map/types";
import { fmtDate, fmtTime, type Ev, type Shift, type Asset } from "./components/schedule-helpers";
import { ScheduleTab } from "./components/schedule-tab";
import { ArmoryTab } from "./components/armory-tab";
import { ShiftSwapTab } from "./components/shift-swap-tab";
import { logger } from "@/lib/logger";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";

const TacticalMap = dynamic(() => import("@/components/tactical-map").then(m => ({ default: m.TacticalMap })), { ssr: false, loading: () => <div className="flex justify-center py-24"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div> });

export default function SchedulePage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = hasMinRole((activeCompany?.role ?? "staff") as CompanyRole, "manager");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);
  const { confirm, ConfirmDialog } = useConfirmDialog();

  const [tab, setTab] = useState<"schedule" | "armory" | "map" | "swaps">("map");

  // Armory "show create" state
  const [showCreate, setShowCreate] = useState(false);

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

  // Map tab state
  const [mapOps, setMapOps] = useState<OperationPin[]>([]);
  const [mapStaff, setMapStaff] = useState<StaffPin[]>([]);
  const [mapIncidents, setMapIncidents] = useState<IncidentPin[]>([]);

  useEffect(() => {
    setHeader("OPERATIONS", "Your assigned shifts, operations, and equipment",
      tab === "armory" ? <QrCode className="h-5 w-5" /> : tab === "map" ? <Globe className="h-5 w-5" /> : <CalendarDays className="h-5 w-5" />,
      tab === "armory" && isAdmin ? (
        <Button size="sm" className="gap-1.5" onClick={() => setShowCreate(true)}>
          <Plus className="h-4 w-4" /> Add Gear
        </Button>
      ) : undefined
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, tab, isAdmin]);

  const loadSchedule = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    try {
      const [ev, sh] = await Promise.all([
        getUpcomingEvents(activeCompanyId),
        getUserShifts(activeCompanyId),
      ]);
      setEvents(ev);
      setShifts(sh);
    } catch (e) { logger.swallow("schedule:load", e, "warn"); } finally { setLoading(false); }
  }, [activeCompanyId]);

  const loadAssets = useCallback(async () => {
    if (!activeCompanyId) { setAssetsLoading(false); return; }
    try { setAssets(await getAssets(activeCompanyId)); } catch (e) { logger.swallow("schedule:load-assets", e, "debug"); } finally { setAssetsLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadSchedule(); loadAssets(); }, [loadSchedule, loadAssets]);

  // ─── Map Tab: load operation pins, staff locations, incidents ────
  const loadMapData = useCallback(async () => {
    if (!activeCompanyId || tab !== "map") return;
    try {
      const ops: OperationPin[] = events
        .filter((ev: Ev) => ev.location_lat && ev.location_lng)
        .map((ev: Ev) => ({
          id: ev.id, name: ev.name, location: ev.location ?? "",
          lat: ev.location_lat, lng: ev.location_lng,
          status: ev.status ?? "draft", startDate: ev.start_date ?? "",
          geofenceRadius: ev.geofence_radius_meters ?? undefined,
          siteMapUrl: ev.site_map_url ?? null,
        }));
      setMapOps(ops);

      const [staffLocs, incidentsRaw, teamsList] = await Promise.all([
        getStaffLocations(activeCompanyId),
        getIncidents(activeCompanyId, "all"),
        getTeams(activeCompanyId),
      ]);

      setMapStaff(staffLocs.map((s: { userId: string; name: string; lat: number; lng: number; heading: number | null; speed: number | null; updatedAt: string }) => ({
        userId: s.userId, name: s.name, role: "staff",
        lat: s.lat, lng: s.lng,
        heading: s.heading ?? undefined, speed: s.speed ?? undefined,
        updatedAt: s.updatedAt,
      })));

      const teamById = new Map(teamsList.map((t) => [t.id, t]));

      setMapIncidents(
        (incidentsRaw ?? [])
          .filter((inc: Ev) => inc.location_lat && inc.location_lng)
          .map((inc: Ev) => {
            const team = inc.team_id ? teamById.get(inc.team_id) : null;
            return {
              id: inc.id, title: inc.title ?? "Incident",
              description: inc.description ?? undefined, type: inc.type ?? undefined,
              priority: inc.priority ?? undefined,
              lat: inc.location_lat, lng: inc.location_lng,
              severity: inc.severity ?? "low", status: inc.status ?? "open",
              reportedBy: inc.reported_user ? `${inc.reported_user.first_name ?? ""} ${inc.reported_user.last_name ?? ""}`.trim() : undefined,
              assignedTo: inc.assigned_user ? `${inc.assigned_user.first_name ?? ""} ${inc.assigned_user.last_name ?? ""}`.trim() : undefined,
              location: inc.location ?? undefined, createdAt: inc.created_at ?? "",
              incidentNumber: inc.incident_number ?? null,
              teamId: inc.team_id ?? null,
              teamName: team?.name ?? null,
              teamColor: team?.color ?? null,
            };
          })
      );
    } catch (err) { console.error("[Map] Failed to load map data:", err); }
  }, [activeCompanyId, tab, events]);

  useEffect(() => { loadMapData(); }, [loadMapData]);

  // Subscribe to real-time staff location updates when map tab is active
  useEffect(() => {
    if (tab !== "map" || !activeCompanyId) return;
    const refreshStaff = () => {
      getStaffLocations(activeCompanyId).then((locs) => {
        setMapStaff(locs.map((s: { userId: string; name: string; lat: number; lng: number; heading: number | null; speed: number | null; updatedAt: string }) => ({
          userId: s.userId, name: s.name, role: "staff",
          lat: s.lat, lng: s.lng,
          heading: s.heading ?? undefined, speed: s.speed ?? undefined,
          updatedAt: s.updatedAt,
        })));
      });
    };
    const unsub = subscribeStaffLocations(activeCompanyId, refreshStaff);
    const pollInterval = setInterval(refreshStaff, 30000);
    return () => { unsub(); clearInterval(pollInterval); };
  }, [tab, activeCompanyId]);

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
        } catch (e) { logger.swallow("schedule:load-event-docs", e, "debug"); }
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

  // ─── Armory handlers ────
  async function handleCreateAsset() {
    if (!newName.trim() || !activeCompanyId) return;
    setCreating(true);
    try {
      await createAsset({ companyId: activeCompanyId, name: newName.trim(), assetType: newType || undefined, serialNumber: newSerial || undefined });
      setNewName(""); setNewType(""); setNewSerial(""); setShowCreate(false); await loadAssets();
      toast.success("Asset created");
    } catch (err) { console.error(err); toast.error("Failed to create asset"); } finally { setCreating(false); }
  }

  async function handleCheckout(id: string) {
    setActing(id);
    try { await checkoutAsset(id); await loadAssets(); toast.success("Asset checked out"); }
    catch (err) { console.error(err); toast.error("Checkout failed"); }
    finally { setActing(null); }
  }

  async function handleCheckin(id: string) {
    setActing(id);
    try { await checkinAsset(id); await loadAssets(); toast.success("Asset checked in"); }
    catch (err) { console.error(err); toast.error("Check-in failed"); }
    finally { setActing(null); }
  }

  async function handleSendReminders() {
    if (!activeCompanyId || !shifts.length) return;
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
        dispatch({ userId: u.id, companyId: activeCompanyId, title: "Shift Reminder", body: `${shiftDate} at ${shiftTime}${location ? ` — ${location}` : ""}`, type: "shift_reminder", actionUrl: "/schedule", phone: u.phone, email: u.email, urgent: true, emailFallback: true }).catch(() => {});
        if (u.phone) sendWhatsAppShiftReminder(activeCompanyId, { phone: u.phone, firstName, shiftDate, shiftTime, location }).catch(() => {});
        if (u.phone) sendShiftReminderSMS(activeCompanyId, { phone: u.phone, firstName, shiftDate, shiftTime, location }).catch(() => {});
        if (u.email) { const tpl = buildShiftReminderEmail({ firstName, companyName, shiftDate, shiftTime, location }); tpl.to = u.email; sendEmail(activeCompanyId, tpl).catch(() => {}); }
      }
      setRemindersSent(true);
      setTimeout(() => setRemindersSent(false), 3000);
      toast.success("Reminders sent");
    } catch (err) { console.error("Send reminders failed:", err); toast.error("Failed to send reminders"); }
    finally { setSendingReminders(false); }
  }

  async function handleDeleteAsset(id: string) {
    if (!await confirm({ description: "Delete this asset?", variant: "destructive" })) return;
    setDeletingAsset(id);
    try { await deleteAsset(id); await loadAssets(); toast.success("Asset deleted"); }
    catch (err) { console.error(err); toast.error("Failed to delete asset"); }
    finally { setDeletingAsset(null); }
  }

  function handleSerialScan(value: string) {
    setNewSerial(value); setScanMode(null);
    setScanResult({ type: "success", message: `Scanned: ${value}` });
    setTimeout(() => setScanResult(null), 3000);
  }

  async function handleCheckinoutScan(value: string) {
    setScanMode(null);
    if (!activeCompanyId) {
      setScanResult({ type: "error", message: "No active company." });
      setTimeout(() => setScanResult(null), 4000); return;
    }
    try {
      const asset = await getAssetByQrCode(activeCompanyId, value);
      if (!asset) { setScanResult({ type: "error", message: "No equipment found for scanned code." }); }
      else if (asset.status === "available") { await checkoutAsset(asset.id); setScanResult({ type: "success", message: `Checked out: ${asset.name}` }); }
      else if (asset.status === "checked_out") { await checkinAsset(asset.id); setScanResult({ type: "success", message: `Returned: ${asset.name}` }); }
      else { setScanResult({ type: "error", message: `Asset "${asset.name}" status: ${asset.status}` }); }
      await loadAssets();
    } catch (err) { console.error(err); setScanResult({ type: "error", message: "Scan action failed. Try again." }); }
    setTimeout(() => setScanResult(null), 4000);
  }

  return (
    <>
      <div className="space-y-4">
        <div>
          <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto max-w-full scrollbar-hide">
            <button onClick={() => setTab("map")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${tab === "map" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              {tab === "map" && <Globe className="h-3.5 w-3.5 text-primary" />}Map
            </button>
            <button onClick={() => setTab("schedule")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${tab === "schedule" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              {tab === "schedule" && <CalendarDays className="h-3.5 w-3.5 text-primary" />}Schedule
            </button>
            <button onClick={() => setTab("swaps")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${tab === "swaps" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              {tab === "swaps" && <ArrowLeftRight className="h-3.5 w-3.5 text-primary" />}Swaps
            </button>
            <button onClick={() => setTab("armory")}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap shrink-0 ${tab === "armory" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              {tab === "armory" && <QrCode className="h-3.5 w-3.5 text-primary" />}Armory
            </button>
          </div>
        </div>

        {/* ── Schedule Tab ── */}
        {tab === "schedule" && (
          <ScheduleTab
            loading={loading} events={events} shifts={shifts} isAdmin={isAdmin}
            eventDocs={eventDocs} myAvail={myAvail} settingAvail={settingAvail}
            docsPopupEvent={docsPopupEvent} setDocsPopupEvent={setDocsPopupEvent}
            onViewDoc={setViewingDoc}
            handleAvailability={handleAvailability}
            sendingReminders={sendingReminders} remindersSent={remindersSent}
            handleSendReminders={handleSendReminders}
          />
        )}

        {/* ── Swaps Tab ── */}
        {tab === "swaps" && <ShiftSwapTab />}

        {/* ── Armory Tab ── */}
        {tab === "armory" && (
          <ArmoryTab
            isAdmin={isAdmin} assets={assets} assetsLoading={assetsLoading}
            showCreate={showCreate} setShowCreate={setShowCreate}
            newName={newName} setNewName={setNewName}
            newType={newType} setNewType={setNewType}
            newSerial={newSerial} setNewSerial={setNewSerial}
            creating={creating} handleCreateAsset={handleCreateAsset}
            acting={acting} handleCheckout={handleCheckout} handleCheckin={handleCheckin}
            deletingAsset={deletingAsset} handleDeleteAsset={handleDeleteAsset}
            scanMode={scanMode} setScanMode={setScanMode}
            scanResult={scanResult}
            handleSerialScan={handleSerialScan} handleCheckinoutScan={handleCheckinoutScan}
          />
        )}
      </div>

      {/* ── Map Tab ── */}
      {tab === "map" && (
        <ErrorBoundary fallback={<div className="flex justify-center py-24 text-sm text-muted-foreground">Failed to load map. Try refreshing the page.</div>}>
          <TacticalMap
            operations={mapOps} staff={mapStaff} incidents={mapIncidents}
            companyId={activeCompanyId ?? ""} isAdmin={isAdmin}
            onSelectOperation={(id) => { window.location.href = `/overwatch/admin/events?expand=${id}`; }}
            onMessageStaff={(userId) => { window.location.href = `/overwatch/chat?dm=${userId}`; }}
          />
        </ErrorBoundary>
      )}

      {/* ── Doc Viewer Modal ── */}
      {viewingDoc && (
        <DocViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}

      <ConfirmDialog />
    </>
  );
}
