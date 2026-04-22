import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { createPinCanvas } from "../pin-canvas";
import { getAircraft, getBoundingBox, formatAltitude, formatSpeed } from "../flight-tracker";
import type { OperationPin } from "../types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useAircraftLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  operations: OperationPin[];
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations } = params;

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

    if (!layers.aircraft) return;

    // Get bounding box from operations or use CONUS
    const op = operations.find(o => o.lat && o.lng);
    const center = op ? { lat: op.lat, lng: op.lng } : { lat: 39.83, lng: -98.58 };
    const bbox = getBoundingBox(center.lat, center.lng, 200); // 200km radius

    function fetchAndRender() {
      getAircraft(bbox.south, bbox.north, bbox.west, bbox.east).then(planes => {
        // Clear old
        (entityGroupsRef.current.aircraft ?? []).forEach((e: { id: string }) => {
          try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
        });
        entityGroupsRef.current.aircraft = [];

        planes.slice(0, 100).forEach(plane => {
          if (plane.onGround) return;
          const entity = viewer.entities.add({
            id: `plane-${plane.icao24}`,
            name: plane.callsign || plane.icao24,
            position: Cesium.Cartesian3.fromDegrees(plane.lng, plane.lat, plane.altitude),
            billboard: {
              image: createPinCanvas("#38bdf8", "flag"),
              scale: 0.4,
              rotation: -plane.heading * (Math.PI / 180),
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
        });
      }).catch(() => {});
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [layers.aircraft, loading, operations, viewerRef, cesiumRef, entityGroupsRef]);
}
