"use client";

import { SubTab, SubTabList } from "@/components/ui/sub-tabs";
import { useEffect, useState, useCallback } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
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
import { formatMemberName } from "@/lib/format-names";
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
import { resolveStorageUrl } from "@/lib/supabase/db-helpers";
import { getMapOperations } from "@/lib/supabase/db-events";
import { classifyStaffFreshness, hasValidCoords, isUuid } from "@/lib/map/map-ops-window";

type StaffLoc = { userId: string; name: string; lat: number; lng: number; heading: number | null; speed: number | null; updatedAt: string };

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
  const [mapLoaded, setMapLoaded] = useState(false);

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
  // Operations come from getMapOperations (active + upcoming + ended in the
  // last 30 days), not the Schedule tab's upcoming-only list, so recently
  // finished ops and their site maps / geofence rings stay visible.
  const toStaffPins = useCallback((locs: StaffLoc[]): StaffPin[] => {
    const now = Date.now();
    return locs
      .filter((s: StaffLoc) => hasValidCoords(s.lat, s.lng) && classifyStaffFreshness(s.updatedAt, now) !== "hidden")
      .map((s: StaffLoc) => ({
        userId: s.userId, name: s.name, role: "staff",
        lat: s.lat, lng: s.lng,
        heading: s.heading ?? undefined, speed: s.speed ?? undefined,
        updatedAt: s.updatedAt,
      }));
  }, []);

  const loadMapData = useCallback(async () => {
    if (!isUuid(activeCompanyId) || tab !== "map") return;
    try {
      const [opsRaw, staffLocs, incidentsRaw, teamsList] = await Promise.all([
        getMapOperations(activeCompanyId),
        getStaffLocations(activeCompanyId),
        getIncidents(activeCompanyId, "all"),
        getTeams(activeCompanyId),
      ]);

      const ops: OperationPin[] = (opsRaw as Ev[])
        .filter((ev: Ev) => hasValidCoords(ev.location_lat, ev.location_lng))
        .map((ev: Ev) => ({
          id: ev.id, name: ev.name, location: ev.location ?? "",
          lat: Number(ev.location_lat), lng: Number(ev.location_lng),
          status: ev.status ?? "draft", startDate: ev.start_date ?? "",
          geofenceRadius: ev.geofence_radius_meters ?? undefined,
          siteMapUrl: ev.site_map_url ?? null,
        }));
      // operation-maps is private: swap stored public URLs for signed ones (24h).
      const signedOps = await Promise.all(ops.map(async (op) => (
        op.siteMapUrl ? { ...op, siteMapUrl: await resolveStorageUrl(op.siteMapUrl, 24 * 3600) } : op
      )));
      setMapOps(signedOps);

      setMapStaff(toStaffPins(staffLocs));

      const teamById = new Map(teamsList.map((t) => [t.id, t]));

      setMapIncidents(
        (incidentsRaw ?? [])
          .filter((inc: Ev) => hasValidCoords(inc.location_lat, inc.location_lng))
          .map((inc: Ev) => {
            const team = inc.team_id ? teamById.get(inc.team_id) : null;
            return {
              id: inc.id, title: inc.title ?? "Incident",
              description: inc.description ?? undefined, type: inc.type ?? undefined,
              priority: inc.priority ?? undefined,
              lat: Number(inc.location_lat), lng: Number(inc.location_lng),
              severity: inc.severity ?? "low", status: inc.status ?? "open",
              reportedBy: inc.reported_user ? formatMemberName(inc.reported_user) || undefined : undefined,
              assignedTo: inc.assigned_user ? formatMemberName(inc.assigned_user) || undefined : undefined,
              location: inc.location ?? undefined, createdAt: inc.created_at ?? "",
              incidentNumber: inc.incident_number ?? null,
              teamId: inc.team_id ?? null,
              teamName: team?.name ?? null,
              teamColor: team?.color ?? null,
            };
          })
      );
      setMapLoaded(true);
    } catch (err) { console.error("[Map] Failed to load map data:", err); }
  }, [activeCompanyId, tab, toStaffPins]);

  useEffect(() => { loadMapData(); }, [loadMapData]);

  // Site-map overlays use 24h signed URLs. Reload map data every 12h while the
  // tab is visible (and immediately on return if a tick was missed) so a
  // long-open command screen never ends up with expired overlay images.
  useEffect(() => {
    if (tab !== "map") return;
    return setVisibleInterval(() => { loadMapData(); }, 12 * 3600 * 1000);
  }, [tab, loadMapData]);

  // Staff positions: realtime (staff_locations is in supabase_realtime after
  // migration 20261015210709) plus a 30s poll as a fallback. The poll also
  // re-classifies freshness so pins grey out / disappear without new rows.
  useEffect(() => {
    if (tab !== "map" || !isUuid(activeCompanyId)) return;
    const refreshStaff = () => {
      getStaffLocations(activeCompanyId).then((locs) => setMapStaff(toStaffPins(locs)))
        .catch((e) => logger.swallow("schedule:map-staff-refresh", e, "debug"));
    };
    const unsub = subscribeStaffLocations(activeCompanyId, refreshStaff);
    const stopPolling = setVisibleInterval(refreshStaff, 30000);
    return () => { unsub(); stopPolling(); };
  }, [tab, activeCompanyId, toStaffPins]);

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

      for (const sh of shifts) {
        const u = Array.isArray(sh.users) ? sh.users[0] : sh.users;
        if (!u?.id) continue;
        const firstName = u.first_name ?? "Team member";
        const tz = sh.events?.timezone ?? undefined;
        const shiftDate = fmtDate(sh.start_time, tz);
        const shiftTime = `${fmtTime(sh.start_time, tz)} — ${fmtTime(sh.end_time, tz)}`;
        const location = sh.events?.location;
        // In-app + email + SMS (server-side via notify-send).
        dispatch({ userId: u.id, companyId: activeCompanyId, title: "Shift Reminder", body: `${shiftDate} at ${shiftTime}${location ? ` — ${location}` : ""}`, type: "shift_reminder", actionUrl: "/schedule", urgent: true, emailFallback: true }).catch(() => {});
        if (u.phone) sendWhatsAppShiftReminder(activeCompanyId, { phone: u.phone, firstName, shiftDate, shiftTime, location }).catch(() => {});
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
          <SubTabList>
            <SubTab active={tab === "map"} onClick={() => setTab("map")} icon={Globe}>
              Map
            </SubTab>
            <SubTab active={tab === "schedule"} onClick={() => setTab("schedule")} icon={CalendarDays}>
              Schedule
            </SubTab>
            <SubTab active={tab === "swaps"} onClick={() => setTab("swaps")} icon={ArrowLeftRight}>
              Swaps
            </SubTab>
            <SubTab active={tab === "armory"} onClick={() => setTab("armory")} icon={QrCode}>
              Armory
            </SubTab>
          </SubTabList>
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
          {mapLoaded && (mapOps.length === 0 || mapStaff.length === 0 || mapIncidents.length === 0) && (
            <div className="mb-2 rounded-lg border border-border/60 bg-muted/40 px-3 py-2 text-[11px] text-muted-foreground space-y-0.5" data-testid="map-empty-hints">
              {mapOps.length === 0 && <p>No operations with a location that are active, upcoming, or ended in the last 30 days. Add a location in Admin → Operations to pin one.</p>}
              {mapStaff.length === 0 && <p>No staff positions in the last 12 hours. Staff appear while clocked in with location sharing on; positions older than 15 min show greyed.</p>}
              {mapIncidents.length === 0 && <p>No incidents with a location. Incidents reported without GPS coordinates aren&apos;t shown on the map.</p>}
            </div>
          )}
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
