"use client";

/**
 * Click-to-track overlay for aircraft: follows the target with the camera,
 * shows its live trail (drawn by use-aircraft-layer), and offers a hand-off
 * to the nearest public traffic camera under its flight path.
 * Interaction pattern inspired by gods-eye-view's tracking HUD (MIT).
 */
import { useEffect, useState } from "react";
import { Crosshair, Video, X } from "lucide-react";
import type { CctvCamera } from "@/lib/intel-types";
import { nearestWithin, type AircraftTrack } from "@/lib/map/aircraft-motion";
import type { CesiumRef, EntityGroupsRef } from "./hooks/cesium-layer-types";

const HANDOFF_RADIUS_M = 25_000;

export function TrackingChip({ viewerRef, entityGroupsRef, trackedId, label, onStop, onOpenCamera }: {
  viewerRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  trackedId: string;
  label: string;
  onStop: () => void;
  onOpenCamera: (cam: CctvCamera) => void;
}) {
  const [nearest, setNearest] = useState<{ cam: CctvCamera; km: number } | null>(null);
  const [lost, setLost] = useState(false);

  useEffect(() => {
    const viewer = viewerRef.current;
    const groups = entityGroupsRef.current;
    const entity = viewer?.entities.getById(trackedId);
    if (viewer && entity) viewer.trackedEntity = entity;
    groups.trackedAircraftId = trackedId;

    const tick = () => {
      const tracks = groups.aircraftTracks as Map<string, AircraftTrack> | undefined;
      const t = tracks?.get(trackedId.replace(/^plane-/, ""));
      if (!t) { setLost(true); setNearest(null); return; }
      setLost(false);
      const p = t.position(Date.now());
      const cams = (groups.cctvCams ?? []) as CctvCamera[];
      const hit = nearestWithin(p, cams, HANDOFF_RADIUS_M);
      setNearest(hit ? { cam: hit.item, km: hit.distanceM / 1000 } : null);
    };
    tick();
    const id = setInterval(tick, 2_000);
    return () => {
      clearInterval(id);
      if (viewer && !viewer.isDestroyed?.() && viewer.trackedEntity?.id === trackedId) viewer.trackedEntity = undefined;
      if (groups.trackedAircraftId === trackedId) groups.trackedAircraftId = undefined;
    };
  }, [viewerRef, entityGroupsRef, trackedId]);

  // Top-centre on wide maps, dropped below the top row on narrower ones so
  // it never sits under top-right controls (e.g. the Ops Mode bar).
  return (
    <div className="absolute top-14 lg:top-3 left-1/2 -translate-x-1/2 z-30 max-w-[calc(100%-1.5rem)] lg:max-w-[min(36rem,calc(100%-36rem))] pointer-events-auto flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-mono text-white/90 backdrop-blur-md border border-cyan-400/40 bg-black/60 shadow-lg">
      <Crosshair className="h-3.5 w-3.5 shrink-0 text-cyan-300 animate-pulse" />
      <span className="truncate min-w-0" title={`Tracking ${label}`}>TRACKING {label}</span>
      {lost && <span className="shrink-0 text-amber-300">· signal lost</span>}
      {nearest && (
        <button
          onClick={() => onOpenCamera(nearest.cam)}
          className="flex min-w-0 items-center gap-1 rounded-full px-2 py-0.5 bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-200"
          title={`Nearest traffic camera: ${nearest.cam.name}`}
        >
          <Video className="h-3 w-3 shrink-0" /> <span className="truncate">{nearest.cam.name.slice(0, 24)}</span><span className="shrink-0">· {nearest.km.toFixed(1)} km</span>
        </button>
      )}
      <button onClick={onStop} className="shrink-0 text-white/50 hover:text-white" aria-label="Stop tracking">
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
