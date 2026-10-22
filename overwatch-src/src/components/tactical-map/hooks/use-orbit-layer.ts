import { setVisibleInterval } from "@/lib/visible-interval";
import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { escapeHtml } from "@/lib/security";
import { SAT_CATEGORY_COLOR, SAT_CATEGORY_LABEL, SAT_MODEL_MAX_DISTANCE_M, SAT_MODEL_MIN_PIXELS, satCategory, satModelUrl, satOrientation } from "@/lib/map/sat-category";
import { getSatellitePositions, computeGroundTrack } from "../orbit-tracker";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

/** Wrapper so the react-compiler does not flag `Date.now()` as an inline impure call */
function currentTimestamp() { return Date.now(); }

export function useOrbitLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  /** Time Machine replay timestamp; effective only when timeMachineOpen */
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;

  const [refreshTick, setRefreshTick] = useState(0);

  // Whether the user is actively replaying past (>5s ago). Live tracking
  // window allows tiny clock drift to still count as "now".
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;

  // ─── Satellite orbit refresh timer ─────────────────
  // Only auto-refresh in live mode — during replay the time is fixed and
  // we should not advance the propagation behind the user's back.
  useEffect(() => {
    if (!layers.satelliteOrbits || isReplaying) return;
    return setVisibleInterval(() => setRefreshTick(t => t + 1), 60000);
  }, [layers.satelliteOrbits, isReplaying]);

  // ─── Satellite Orbits (CelesTrak) ──────────────────
  // Orbits are deterministic from TLE — we can render them at any timestamp.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.orbits ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
    });
    entityGroupsRef.current.orbits = [];

    if (!layers.satelliteOrbits) return;

    const atTime = isReplaying ? debouncedReplayTime : undefined;

    getSatellitePositions(30, atTime).then(sats => {
      sats.forEach((sat, i) => {
        const cat = satCategory(sat);
        const satColor = SAT_CATEGORY_COLOR[cat];
        const pos = Cesium.Cartesian3.fromDegrees(sat.lng, sat.lat, sat.altitude * 1000);
        // Dot when far, 3D model when the camera is close (rendering only; propagation unchanged).
        const near = new Cesium.DistanceDisplayCondition(0, SAT_MODEL_MAX_DISTANCE_M);
        const far = new Cesium.DistanceDisplayCondition(SAT_MODEL_MAX_DISTANCE_M, Number.MAX_VALUE);

        // Current position marker
        const entity = viewer.entities.add({
          id: `sat-${i}`,
          name: sat.name,
          position: pos,
          point: {
            distanceDisplayCondition: far,
            pixelSize: 6,
            color: Cesium.Color.fromCssColorString(satColor),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
            // No disableDepthTestDistance — satellites at orbital altitude
            // are naturally occluded by the globe via depth testing
          },
          model: {
            uri: satModelUrl(sat),
            minimumPixelSize: SAT_MODEL_MIN_PIXELS,
            maximumScale: 20_000,
            distanceDisplayCondition: near,
            shadows: Cesium.ShadowMode.DISABLED,
            color: Cesium.Color.fromCssColorString(satColor),
            colorBlendMode: Cesium.ColorBlendMode.MIX,
            colorBlendAmount: 0.6,
            silhouetteColor: Cesium.Color.fromCssColorString(satColor).withAlpha(0.95),
            silhouetteSize: 1.5,
          },
          label: {
            text: sat.name,
            font: "8px monospace",
            fillColor: Cesium.Color.fromCssColorString(satColor),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(8, 0),
            scale: 0.8,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000),
          },
          description: `<div style="font-family:monospace;font-size:11px;line-height:1.7">
            <b>${escapeHtml(sat.name)}</b> <span style="color:${satColor}">${SAT_CATEGORY_LABEL[cat]}</span>
            <div>Alt: ${sat.altitude.toFixed(0)} km</div>
            <div>Speed: ${sat.velocity.toFixed(1)} km/s</div>
            <div>Lat: ${sat.lat.toFixed(3)}&deg; Lng: ${sat.lng.toFixed(3)}&deg;</div>
          </div>`,
        });
        (entity as { _owColor?: string })._owColor = satColor;
        entityGroupsRef.current.orbits.push(entity);

        // Ground track polyline at orbital altitude (async).
        // Ground track always starts from the same `atTime` as the satellite
        // position so the line begins exactly under the marker.
        const orbitAltM = sat.altitude * 1000; // km → meters
        computeGroundTrack(sat.tle1, sat.tle2, 90, 1, atTime).then(track => {
          if (track.length > 2) {
            // Point the model along its direction of flight (first track step = 1 min ahead).
            try {
              const next = Cesium.Cartesian3.fromDegrees(track[1][0], track[1][1], orbitAltM);
              const q = satOrientation(pos, next);
              if (q) entity.orientation = new Cesium.ConstantProperty(new Cesium.Quaternion(q[0], q[1], q[2], q[3]));
            } catch (e_) { logger.swallow("orbit-layer:orientation", e_, "debug"); }
            // Build positions with orbital altitude so the track arcs above the globe
            const positions = track.map(([lng, lat]: [number, number]) =>
              Cesium.Cartesian3.fromDegrees(lng, lat, orbitAltM)
            );
            const trackEntity = viewer.entities.add({
              id: `sat-track-${i}`,
              polyline: {
                positions,
                width: 1,
                material: Cesium.Color.fromCssColorString(satColor).withAlpha(0.3),
              },
            });
            entityGroupsRef.current.orbits.push(trackEntity);
          }
        }).catch(() => {});
      });
    }).catch(() => {});

  }, [layers.satelliteOrbits, loading, viewerRef, cesiumRef, entityGroupsRef, refreshTick, isReplaying, debouncedReplayTime]);
}
