import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { createPinCanvas } from "../pin-canvas";
import { getAircraft, getBoundingBox, formatAltitude, formatSpeed } from "../flight-tracker";
import type { OperationPin } from "../types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

function currentTimestamp() { return Date.now(); }

export function useAircraftLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  operations: OperationPin[];
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations, debouncedReplayTime, timeMachineOpen } = params;

  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;

  const centerRef = useRef({ lat: 39.83, lng: -98.58 });

  useEffect(() => {
    const op = operations.find(o => o.lat && o.lng);
    if (op) centerRef.current = { lat: op.lat, lng: op.lng };
  }, [operations]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const entityGroups = entityGroupsRef.current;
    if (!entityGroups.aircraft) entityGroups.aircraft = [];

    if (!layers.aircraft || isReplaying) {
      (entityGroups.aircraft as { id: string }[]).forEach((e) => {
        try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("aircraft-layer:remove", e_, "debug"); }
      });
      entityGroups.aircraft = [];
      return;
    }

    const bbox = getBoundingBox(centerRef.current.lat, centerRef.current.lng, 200);
    const activeIds = new Set<string>();

    function fetchAndRender() {
      getAircraft(bbox.south, bbox.north, bbox.west, bbox.east).then(planes => {
        const v = viewerRef.current;
        const C = cesiumRef.current;
        if (!v || !C) return;

        const newIds = new Set<string>();

        planes.slice(0, 100).forEach(plane => {
          if (plane.onGround) return;
          const entityId = `plane-${plane.icao24}`;
          newIds.add(entityId);

          const existing = v.entities.getById(entityId);
          const pos = C.Cartesian3.fromDegrees(plane.lng, plane.lat, plane.altitude);

          if (existing) {
            existing.position = new C.ConstantPositionProperty(pos);
            if (existing.billboard) existing.billboard.rotation = -plane.heading * (Math.PI / 180);
            if (existing.label) existing.label.text = `${plane.callsign || plane.icao24}\n${formatAltitude(plane.altitude)}`;
            existing.description = `<div style="font-family:monospace;font-size:11px;line-height:1.7">
              <b>${plane.callsign || plane.icao24}</b>
              <div>ICAO: ${plane.icao24}</div>
              <div>Alt: ${formatAltitude(plane.altitude)}</div>
              <div>Speed: ${formatSpeed(plane.velocity)}</div>
              <div>Heading: ${plane.heading.toFixed(0)}&deg;</div>
              <div>V/S: ${plane.verticalRate > 0 ? "+" : ""}${(plane.verticalRate * 196.85).toFixed(0)} fpm</div>
            </div>`;
          } else {
            const entity = v.entities.add({
              id: entityId,
              name: plane.callsign || plane.icao24,
              position: pos,
              billboard: {
                image: createPinCanvas("#38bdf8", "flag"),
                scale: 0.4,
                rotation: -plane.heading * (Math.PI / 180),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              label: {
                text: `${plane.callsign || plane.icao24}\n${formatAltitude(plane.altitude)}`,
                font: "9px monospace",
                fillColor: C.Color.fromCssColorString("#38bdf8"),
                outlineColor: C.Color.BLACK,
                outlineWidth: 2,
                style: C.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new C.Cartesian2(0, -18),
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scale: 0.8,
                distanceDisplayCondition: new C.DistanceDisplayCondition(0, 500000),
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

        for (const id of activeIds) {
          if (!newIds.has(id)) {
            try { v.entities.removeById(id); } catch (e) { logger.swallow("aircraft-layer:remove", e, "debug"); }
          }
        }
        activeIds.clear();
        for (const id of newIds) activeIds.add(id);
      }).catch((err) => {
        logger.swallow("aircraft-layer:fetch", err, "warn");
      });
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, 15000);
    return () => {
      clearInterval(interval);
      (entityGroups.aircraft ?? []).forEach((e: { id: string }) => {
        try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("aircraft-layer:remove", e_, "debug"); }
      });
      entityGroups.aircraft = [];
    };
  }, [layers.aircraft, loading, viewerRef, cesiumRef, entityGroupsRef, isReplaying]);
}
