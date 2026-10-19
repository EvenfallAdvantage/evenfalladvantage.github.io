"use client";

/**
 * Click-to-track overlay for aircraft: follows the target with the camera,
 * shows its live trail (drawn by use-aircraft-layer) plus up to 24 h of
 * Overwatch-recorded track history (viewed areas only), a nearby-contacts list (~250 km, click to jump),
 * and a hand-off to the nearest public traffic camera under its flight path.
 * Interaction pattern inspired by gods-eye-view's tracking HUD (MIT).
 */
import { useEffect, useState } from "react";
import { ChevronDown, Crosshair, History, Video, X } from "lucide-react";
import type { CctvCamera } from "@/lib/intel-types";
import { nearestWithin, type AircraftTrack } from "@/lib/map/aircraft-motion";
import { fetchAircraftTrace, splitTraceSegments, TRACE_COVERAGE_HINT, TRACE_CREDIT } from "@/lib/map/aircraft-trace";
import { compass, nearbyContacts, type ContactLike, type Contact } from "@/lib/map/nearby-contacts";
import type { CesiumRef, EntityGroupsRef } from "./hooks/cesium-layer-types";

const HANDOFF_RADIUS_M = 25_000;
const HISTORY_ID = "aircraft-track-history";

type HistoryState = { status: "loading" } | { status: "ok"; points: number; hours: number } | { status: "none"; reason: string };

export function TrackingChip({ viewerRef, cesiumRef, entityGroupsRef, trackedId, label, onStop, onOpenCamera, onJump }: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  trackedId: string;
  label: string;
  onStop: () => void;
  onOpenCamera: (cam: CctvCamera) => void;
  /** Switch tracking to another contact. */
  onJump?: (target: { id: string; label: string }) => void;
}) {
  const [nearest, setNearest] = useState<{ cam: CctvCamera; km: number } | null>(null);
  const [lost, setLost] = useState(false);
  const [contacts, setContacts] = useState<Contact<ContactLike>[]>([]);
  const [listOpen, setListOpen] = useState(false);
  const [history, setHistory] = useState<HistoryState>({ status: "loading" });

  useEffect(() => {
    const viewer = viewerRef.current;
    const groups = entityGroupsRef.current;
    const entity = viewer?.entities.getById(trackedId);
    if (viewer && entity) viewer.trackedEntity = entity;
    groups.trackedAircraftId = trackedId;
    const hex = trackedId.replace(/^plane-/, "");

    const tick = () => {
      const tracks = groups.aircraftTracks as Map<string, AircraftTrack> | undefined;
      const t = tracks?.get(hex);
      if (!t) { setLost(true); setNearest(null); return; }
      setLost(false);
      const p = t.position(Date.now());
      const cams = (groups.cctvCams ?? []) as CctvCamera[];
      const hit = nearestWithin(p, cams, HANDOFF_RADIUS_M);
      setNearest(hit ? { cam: hit.item, km: hit.distanceM / 1000 } : null);
      setContacts(nearbyContacts(p, (groups.aircraftLatest ?? []) as ContactLike[], hex));
    };
    tick();
    const id = setInterval(tick, 2_000);
    return () => {
      clearInterval(id);
      if (viewer && !viewer.isDestroyed?.() && viewer.trackedEntity?.id === trackedId) viewer.trackedEntity = undefined;
      if (groups.trackedAircraftId === trackedId) groups.trackedAircraftId = undefined;
    };
  }, [viewerRef, entityGroupsRef, trackedId]);

  // 24 h history (best effort): dimmed polylines under the live trail.
  useEffect(() => {
    const ctrl = new AbortController();
    const added: unknown[] = [];
    const hex = trackedId.replace(/^plane-/, "");
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    void fetchAircraftTrace(hex, { signal: ctrl.signal }).then(({ points, error }) => {
      if (ctrl.signal.aborted) return;
      const segs = splitTraceSegments(points);
      if (!segs.length || !viewer || !Cesium || viewer.isDestroyed?.()) {
        setHistory({ status: "none", reason: error ?? "no recorded history (only areas Overwatch users viewed in the last 24 h)" });
        return;
      }
      const color = Cesium.Color.fromCssColorString("#67e8f9").withAlpha(0.45);
      segs.forEach((seg, i) => {
        let lastAlt = 0;
        const flat: number[] = [];
        for (const [, lat, lon, alt] of seg) { if (alt != null) lastAlt = alt; flat.push(lon, lat, lastAlt); }
        added.push(viewer.entities.add({
          id: `${HISTORY_ID}-${i}`,
          polyline: { positions: Cesium.Cartesian3.fromDegreesArrayHeights(flat), width: 1.5, material: color },
        }));
      });
      viewer.scene.requestRender();
      setHistory({ status: "ok", points: points.length, hours: Math.max(1, Math.round((points[points.length - 1][0] - points[0][0]) / 3_600_000)) });
    });
    return () => {
      ctrl.abort();
      if (viewer && !viewer.isDestroyed?.()) {
        for (const e of added) viewer.entities.remove(e);
        viewer.scene.requestRender();
      }
    };
  }, [viewerRef, cesiumRef, trackedId]);

  // Top-centre on wide maps, dropped below the top row on narrower ones so
  // it never sits under top-right controls (e.g. the Ops Mode bar).
  return (
    <div className="absolute top-14 lg:top-3 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-1.5rem)] lg:max-w-[min(40rem,calc(100%-36rem))] pointer-events-auto" data-testid="tracking-chip">
      <div className="flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-mono text-white/90 backdrop-blur-md border border-cyan-400/40 bg-black/60 shadow-lg">
        <Crosshair className="h-3.5 w-3.5 shrink-0 text-cyan-300 animate-pulse" />
        <span className="truncate min-w-0" title={`Tracking ${label}`}>TRACKING {label}</span>
        {lost && <span className="shrink-0 text-amber-300">· signal lost</span>}
        {history.status === "ok" && (
          <span className="shrink-0 flex items-center gap-1 text-cyan-200/70" title={`${TRACE_CREDIT} · ${history.points} points. ${TRACE_COVERAGE_HINT}`} data-testid="tracking-history">
            <History className="h-3 w-3" />{history.hours}h · partial · ODbL
          </span>
        )}
        {history.status === "none" && (
          <span className="shrink-0 flex items-center gap-1 text-white/40" title={`${history.reason}. ${TRACE_COVERAGE_HINT}`} data-testid="tracking-history">
            <History className="h-3 w-3" />no history
          </span>
        )}
        {nearest && (
          <button
            onClick={() => onOpenCamera(nearest.cam)}
            className="flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200"
            title={`Nearest traffic camera: ${nearest.cam.name}`}
          >
            <Video className="h-3 w-3 shrink-0" /> <span className="truncate">{nearest.cam.name.slice(0, 24)}</span><span className="shrink-0">· {nearest.km.toFixed(1)} km</span>
          </button>
        )}
        {onJump && (
          <button
            onClick={() => setListOpen((o) => !o)}
            className="shrink-0 flex items-center gap-0.5 rounded-full px-2 py-0.5 bg-white/10 hover:bg-white/20"
            title="Nearby aircraft within 250 km" aria-expanded={listOpen}
          >
            {contacts.length} nearby <ChevronDown className={`h-3 w-3 transition-transform ${listOpen ? "rotate-180" : ""}`} />
          </button>
        )}
        <button onClick={onStop} className="shrink-0 text-white/50 hover:text-white" aria-label="Stop tracking">
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      {listOpen && onJump && (
        <div className="mt-1 mx-auto w-72 max-w-full max-h-64 overflow-y-auto rounded-lg border border-white/10 bg-black/75 backdrop-blur-md text-[11px] font-mono text-white/85 shadow-lg" data-testid="nearby-contacts">
          {contacts.length === 0 && <div className="px-3 py-2 text-white/50">No other aircraft within 250 km</div>}
          {contacts.map(({ item, distanceM, bearingDeg }) => (
            <button
              key={item.icao24}
              onClick={() => { setListOpen(false); onJump({ id: `plane-${item.icao24}`, label: item.callsign || item.icao24.toUpperCase() }); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 text-left hover:bg-white/10"
            >
              <span className={`w-16 truncate ${item.emergency ? "text-red-300" : item.military ? "text-amber-200" : ""}`}>{item.callsign || item.icao24.toUpperCase()}</span>
              <span className="flex-1 text-white/50">{item.onGround ? "ground" : `${Math.round(item.altitude * 3.28084 / 100) * 100} ft`}</span>
              <span className="text-white/70">{(distanceM / 1000).toFixed(0)} km {compass(bearingDeg)}</span>
            </button>
          ))}
          <div className="px-3 py-1 text-[9px] text-white/35 border-t border-white/10">Live positions: adsb.lol (ODbL 1.0)</div>
        </div>
      )}
    </div>
  );
}
