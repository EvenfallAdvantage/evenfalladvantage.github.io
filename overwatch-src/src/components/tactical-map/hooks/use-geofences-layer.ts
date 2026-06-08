/**
 * Geofences layer (Phase 7).
 *
 * Plots per-company geofence polygons stored as GeoJSON in the `geofences`
 * table. Each fence is a Cesium polygon entity with configurable fill +
 * stroke color. Hidden by default; controlled via the OPERATIONS group in
 * map-layers-panel.
 *
 * Refresh strategy: re-fetch only when `layers.geofences` toggles ON or the
 * `companyId` changes. We do NOT subscribe to realtime updates - admin
 * edits via the geofence-editor force a refresh by toggling the layer or
 * calling the refresh callback returned from the hook.
 */

import { useEffect, useState, useCallback } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";
import { getGeofences } from "@/lib/supabase/db-geofences";
import type { Geofence } from "@/lib/supabase/db-geofences";

interface UseGeofencesLayerParams {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  companyId: string;
}

function buildPopup(g: Geofence): string {
  const desc = g.description ? `<div style="opacity:0.75;margin-top:2px">${escapeHtml(g.description)}</div>` : "";
  const team = g.teamId ? `<div style="opacity:0.55;font-size:10px;margin-top:4px">Team: ${escapeHtml(g.teamId.slice(0, 8))}</div>` : "";
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:${g.color}">${escapeHtml(g.name)}</b>
    ${desc}
    ${team}
  </div>`;
}

/**
 * Flatten a GeoJSON Polygon ring into Cesium-friendly degree triplets.
 * Cesium expects [lng, lat] pairs as a flat array passed to
 * `Cartesian3.fromDegreesArray`.
 */
function ringToDegreesArray(ring: Array<[number, number]>): number[] {
  const out: number[] = [];
  for (const [lng, lat] of ring) {
    out.push(lng, lat);
  }
  return out;
}

export function useGeofencesLayer(params: UseGeofencesLayerParams): {
  refresh: () => void;
  geofences: Geofence[];
} {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, companyId } = params;
  const [geofences, setGeofences] = useState<Geofence[]>([]);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => {
    setTick((t) => t + 1);
  }, []);

  // Fetch when the layer comes on or when refresh() is called.
  useEffect(() => {
    if (!companyId || !layers.geofences) return;
    let cancelled = false;
    void (async () => {
      try {
        const data = await getGeofences(companyId, { activeOnly: true });
        if (!cancelled) setGeofences(data);
      } catch (err) {
        logger.swallow("cesium-layers:geofences-fetch", err, "warn");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [companyId, layers.geofences, tick]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Clear existing entities every time geofence list or visibility changes.
    const existing = (entityGroupsRef.current.geofences ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try {
        viewer.entities.removeById(e.id);
      } catch (err) {
        logger.swallow("cesium-layers:remove-geofence", err);
      }
    });
    entityGroupsRef.current.geofences = [];

    if (!layers.geofences) return;

    for (const g of geofences) {
      try {
        const fillColor = Cesium.Color.fromCssColorString(g.color).withAlpha(
          Math.max(0, Math.min(1, g.fillOpacity)),
        );
        const strokeColor = Cesium.Color.fromCssColorString(g.color);

        const polys =
          g.geometry.type === "Polygon"
            ? [g.geometry.coordinates]
            : g.geometry.coordinates;

        polys.forEach((poly, polyIdx) => {
          // First ring is the outer ring; subsequent rings are holes (not
          // commonly used at the venue level; we render them as overlapping
          // negative polygons for now).
          const outer = poly[0];
          if (!outer || outer.length < 3) return;

          const entityId = `geofence-${g.id}-${polyIdx}`;
          const entity = viewer.entities.add({
            id: entityId,
            name: g.name,
            polygon: {
              hierarchy: Cesium.Cartesian3.fromDegreesArray(ringToDegreesArray(outer)),
              material: fillColor,
              outline: true,
              outlineColor: strokeColor,
              outlineWidth: g.strokeWidth,
              // Conform to the terrain so fences hug the ground.
              perPositionHeight: false,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              classificationType: Cesium.ClassificationType.TERRAIN,
            },
            description: buildPopup(g),
          });
          (entityGroupsRef.current.geofences as Array<{ id: string }>).push(entity);
        });
      } catch (err) {
        logger.swallow("cesium-layers:add-geofence", err, "warn");
      }
    }
  }, [geofences, layers.geofences, loading, viewerRef, cesiumRef, entityGroupsRef]);

  return { refresh, geofences };
}
