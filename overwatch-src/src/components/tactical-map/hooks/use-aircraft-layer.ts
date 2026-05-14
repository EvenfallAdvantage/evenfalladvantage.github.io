import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { createPinCanvas } from "../pin-canvas";
import { getAircraft, getBoundingBox, formatAltitude, formatSpeed } from "../flight-tracker";
import type { OperationPin } from "../types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

/** Wrapper so the react-compiler does not flag `Date.now()` as an inline impure call */
function currentTimestamp() { return Date.now(); }

export function useAircraftLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  operations: OperationPin[];
  /** Time Machine replay timestamp; effective only when timeMachineOpen */
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations, debouncedReplayTime, timeMachineOpen } = params;

  // OpenSky's free tier has no historical data for commercial use.
  // During Time Machine replay, hide aircraft to avoid showing live
  // positions while the rest of the map is in the past.
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;

  // ─── Live Aircraft (OpenSky Network) ───────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Clear old aircraft entities
    (entityGroupsRef.current.aircraft ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
    });
    entityGroupsRef.current.aircraft = [];

    if (!layers.aircraft || isReplaying) return;

    // Get bounding box from operations or use CONUS
    const op = operations.find(o => o.lat && o.lng);
    const center = op ? { lat: op.lat, lng: op.lng } : { lat: 39.83, lng: -98.58 };
    const bbox = getBoundingBox(center.lat, center.lng, 200); // 200km radius

    // Track active aircraft entity IDs for differential updates
    const activeIds = new Set<string>();

    function fetchAndRender() {
      getAircraft(bbox.south, bbox.north, bbox.west, bbox.east).then(planes => {
        const newIds = new Set<string>();

        planes.slice(0, 100).forEach(plane => {
          if (plane.onGround) return;
          const entityId = `plane-${plane.icao24}`;
          newIds.add(entityId);

          const existing = viewer.entities.getById(entityId);
          if (existing) {
            // Differential update: move existing entity instead of destroying/recreating
            existing.position = Cesium.Cartesian3.fromDegrees(plane.lng, plane.lat, plane.altitude) as unknown as typeof existing.position;
            if (existing.billboard) {
              existing.billboard.rotation = (-plane.heading * (Math.PI / 180)) as unknown as typeof existing.billboard.rotation;
            }
            if (existing.label) {
              existing.label.text = `${plane.callsign || plane.icao24}\n${formatAltitude(plane.altitude)}` as unknown as typeof existing.label.text;
            }
            existing.description = `<div style="font-family:monospace;font-size:11px;line-height:1.7">
              <b>${plane.callsign || plane.icao24}</b>
              <div>ICAO: ${plane.icao24}</div>
              <div>Alt: ${formatAltitude(plane.altitude)}</div>
              <div>Speed: ${formatSpeed(plane.velocity)}</div>
              <div>Heading: ${plane.heading.toFixed(0)}&deg;</div>
              <div>V/S: ${plane.verticalRate > 0 ? "+" : ""}${(plane.verticalRate * 196.85).toFixed(0)} fpm</div>
            </div>` as unknown as typeof existing.description;
          } else {
            // New aircraft — add entity
            const entity = viewer.entities.add({
              id: entityId,
              name: plane.callsign || plane.icao24,
              position: Cesium.Cartesian3.fromDegrees(plane.lng, plane.lat, plane.altitude),
              billboard: {
                image: createPinCanvas("#38bdf8", "flag"),
                scale: 0.4,
                rotation: -plane.heading * (Math.PI / 180),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              label: {
                text: `${plane.callsign || plane.icao24}\n${formatAltitude(plane.altitude)}`,
                font: "9px monospace",
                fillColor: Cesium.Color.fromCssColorString("#38bdf8"),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -18),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scale: 0.8,
                distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000),
              },
              description: `<div style="font-family:monospace;font-size:11px;line-height:1.7">
                <b>${plane.callsign || plane.icao24}</b>
                <div>ICAO: ${plane.icao24}</div>
                <div>Alt: ${formatAltitude(plane.altitude)}</div>
                <div>Speed: ${formatSpeed(plane.velocity)}</div>
                <div>Heading: ${plane.heading.toFixed(0)}&deg;</div>
                <div>V/S: ${plane.verticalRate > 0 ? "+" : ""}${(plane.verticalRate * 196.85).toFixed(0)} fpm</div>
              </div>`,
            });
            entityGroupsRef.current.aircraft.push(entity);
          }
        });

        // Remove departed aircraft (entities that no longer appear in feed)
        for (const id of activeIds) {
          if (!newIds.has(id)) {
            try { viewer.entities.removeById(id); } catch (e) { logger.swallow("cesium-layers:remove-entity", e); }
          }
        }
        activeIds.clear();
        for (const id of newIds) activeIds.add(id);

        // Update entity group ref
        entityGroupsRef.current.aircraft = Array.from(newIds).map(id => ({ id }));
      }).catch(() => {});
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [layers.aircraft, loading, operations, viewerRef, cesiumRef, entityGroupsRef, isReplaying]);
}
