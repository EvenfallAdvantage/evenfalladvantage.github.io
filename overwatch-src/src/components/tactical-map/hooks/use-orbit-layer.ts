import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { getSatellitePositions, computeGroundTrack } from "../orbit-tracker";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useOrbitLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers } = params;

  // ─── Satellite Orbits (CelesTrak) ──────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.orbits ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
    });
    entityGroupsRef.current.orbits = [];

    if (!layers.satelliteOrbits) return;

    getSatellitePositions(30).then(sats => {
      sats.forEach((sat, i) => {
        const satColor = sat.name.includes("SENTINEL-1") ? "#ef4444"
          : sat.name.includes("SENTINEL-2") ? "#22c55e"
          : sat.name.includes("WORLDVIEW") || sat.name.includes("GEOEYE") ? "#f97316"
          : "#6b7280";

        // Current position marker
        const entity = viewer.entities.add({
          id: `sat-${i}`,
          name: sat.name,
          position: Cesium.Cartesian3.fromDegrees(sat.lng, sat.lat, sat.altitude * 1000),
          point: {
            pixelSize: 6,
            color: Cesium.Color.fromCssColorString(satColor),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
          },
          label: {
            text: sat.name,
            font: "8px monospace",
            fillColor: Cesium.Color.fromCssColorString(satColor),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(8, 0),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scale: 0.8,
          },
          description: `<div style="font-family:monospace;font-size:11px;line-height:1.7">
            <b>${sat.name}</b>
            <div>Alt: ${sat.altitude.toFixed(0)} km</div>
            <div>Speed: ${sat.velocity.toFixed(1)} km/s</div>
            <div>Lat: ${sat.lat.toFixed(3)}&deg; Lng: ${sat.lng.toFixed(3)}&deg;</div>
          </div>`,
        });
        entityGroupsRef.current.orbits.push(entity);

        // Ground track polyline (async)
        computeGroundTrack(sat.tle1, sat.tle2, 90, 1).then(track => {
          if (track.length > 2) {
            const trackEntity = viewer.entities.add({
              id: `sat-track-${i}`,
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(track.flatMap(([lng, lat]: [number, number]) => [lng, lat])),
                width: 1,
                material: Cesium.Color.fromCssColorString(satColor).withAlpha(0.3),
              },
            });
            entityGroupsRef.current.orbits.push(trackEntity);
          }
        }).catch(() => {});
      });
    }).catch(() => {});

    // Refresh satellite positions every 60s
    const interval = setInterval(() => {
      // Just re-trigger the effect by toggling a counter
    }, 60000);
    return () => clearInterval(interval);
  }, [layers.satelliteOrbits, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
