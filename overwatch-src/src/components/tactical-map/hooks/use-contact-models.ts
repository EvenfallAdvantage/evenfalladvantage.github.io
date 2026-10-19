import { useEffect, useState } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import { classifyAircraft } from "@/lib/map/aircraft-class";
import type { AircraftTrack } from "@/lib/map/aircraft-motion";
import { CLASS_MODEL, MODEL_BASE, modelHeadingDeg, selectModelIds, type ModelCandidate } from "@/lib/map/contact-models";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const TICK_MS = 1_000;

/**
 * Desktop only: swap the flat aircraft icon for a CC BY 4.0 3D model on
 * contacts near the camera and on the tracked aircraft (see contact-models.ts).
 * The governor level (entityGroups.perfLevel) lowers the model cap.
 */
export function useContactModels(params: { viewerRef: CesiumRef; cesiumRef: CesiumRef; entityGroupsRef: EntityGroupsRef; loading: boolean; enabled: boolean }) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, enabled } = params;
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const viewer = viewerRef.current;
    const C = cesiumRef.current;
    if (!viewer || !C || loading || !enabled || isConstrainedDevice()) return;
    const groups = entityGroupsRef.current;
    const modelled = new Map<string, string>(); // entity id → model url

    const strip = (id: string) => {
      const e = viewer.entities.getById(id);
      if (e) { e.model = undefined; e.orientation = undefined; if (e.billboard) e.billboard.show = true; }
      modelled.delete(id);
    };

    const tick = () => {
      if (viewer.isDestroyed?.()) return;
      try {
        const tracks = groups.aircraftTracks as Map<string, AircraftTrack> | undefined;
        const latest = (groups.aircraftLatest ?? []) as Array<{ icao24: string; typeCode?: string | null }>;
        const typeOf = new Map(latest.map((a) => [a.icao24, a.typeCode ?? null]));
        const now = Date.now();
        const items: ModelCandidate[] = [];
        if (tracks) for (const [hex, t] of tracks) {
          const id = `plane-${hex}`;
          if (!viewer.entities.getById(id)) continue;
          const p = t.position(now);
          items.push({ id, lat: p.lat, lng: p.lng, altM: p.altM });
        }
        const cam = viewer.camera.positionCartographic;
        const want = selectModelIds(
          { lat: C.Math.toDegrees(cam.latitude), lng: C.Math.toDegrees(cam.longitude), heightM: cam.height },
          items, groups.trackedAircraftId as string | undefined, Number(groups.perfLevel ?? 0),
        );
        const wantSet = new Set(want);
        for (const id of [...modelled.keys()]) if (!wantSet.has(id)) strip(id);
        for (const id of want) {
          const hex = id.slice(6);
          const url = `${MODEL_BASE}/${CLASS_MODEL[classifyAircraft({ typeCode: typeOf.get(hex) })]}`;
          if (modelled.get(id) === url) continue;
          const e = viewer.entities.getById(id);
          const t = tracks?.get(hex);
          if (!e || !t) continue;
          const hpr = new C.HeadingPitchRoll();
          e.orientation = new C.CallbackProperty((time: unknown, result?: unknown) => {
            const pos = e.position?.getValue(time);
            if (!pos) return undefined;
            hpr.heading = C.Math.toRadians(modelHeadingDeg(t.fix.trackDeg || 0));
            return C.Transforms.headingPitchRollQuaternion(pos, hpr, C.Ellipsoid.WGS84, undefined, result);
          }, false);
          e.model = new C.ModelGraphics({
            uri: url,
            minimumPixelSize: 48,
            // Low cap: a large scale inflates the bounding sphere that trackedEntity zooms to.
            maximumScale: 20,
            shadows: C.ShadowMode.DISABLED,
            color: C.Color.WHITE,
            colorBlendMode: C.ColorBlendMode.MIX,
            colorBlendAmount: 0.35,
            silhouetteColor: C.Color.fromCssColorString("#22d3ee").withAlpha(0.6),
            silhouetteSize: 1,
          });
          if (e.billboard) e.billboard.show = false;
          modelled.set(id, url);
        }
        if (want.length || modelled.size) viewer.scene.requestRender();
        groups.modelledContacts = modelled.size;
        setShown(modelled.size > 0);
      } catch (err) {
        logger.swallow("contact-models:tick", err, "debug");
      }
    };
    const first = setTimeout(tick, 0);
    const stop = setVisibleInterval(tick, TICK_MS);
    return () => {
      clearTimeout(first);
      stop();
      if (!viewer.isDestroyed?.()) { for (const id of [...modelled.keys()]) strip(id); viewer.scene.requestRender(); }
      groups.modelledContacts = 0;
    };
  }, [viewerRef, cesiumRef, entityGroupsRef, loading, enabled]);
  /** True while at least one model is on screen (drives the CC BY credit). */
  return shown && enabled && !loading;
}
