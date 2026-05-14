import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { getLocationHistory, getLocationHistoryAt } from "@/lib/supabase/db-location";
import type { StaffPin } from "../types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useTrailsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  staff: StaffPin[];
  companyId: string;
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const {
    viewerRef,
    cesiumRef,
    entityGroupsRef,
    loading,
    layers,
    staff,
    companyId,
    debouncedReplayTime,
    timeMachineOpen,
  } = params;

  // ─── Breadcrumb Trails (patrol history) ──────────────
  // Renders + refreshes every 60s while enabled
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    function renderTrails() {
      if (!viewer || !Cesium) return;
      // Clear old breadcrumb entities
      (entityGroupsRef.current.breadcrumbs ?? []).forEach((e: { id: string }) => {
        try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
      });
      entityGroupsRef.current.breadcrumbs = [];

      if (!layers.breadcrumbs || staff.length === 0) return;

      const now = Date.now();
      const isTimeMachine = timeMachineOpen && debouncedReplayTime < now - 5000;
      // Trail window: 4h baseline. When the Time Machine is engaged, expand
      // to cover the playback depth so the trail visibly elongates as the
      // slider moves back. Floor at 4h, cap at 7d to keep queries bounded.
      const replayDepthHours = isTimeMachine ? (now - debouncedReplayTime) / (60 * 60 * 1000) : 0;
      const trailHours = Math.min(168, Math.max(4, 4 + replayDepthHours));
      // Downsample threshold: for windows beyond 4h, take every Nth point so
      // a 168h trail stays under ~600 points. Below 4h, render every point.
      // 1pt/min × 4h = 240 base; aim for ≤ 600 points: stride = ceil(hours/10).
      const stride = trailHours <= 4 ? 1 : Math.max(1, Math.ceil(trailHours / 10));
      staff.forEach(s => {
        const trailPromise = isTimeMachine
          ? getLocationHistoryAt(s.userId, companyId, trailHours, debouncedReplayTime)
          : getLocationHistory(s.userId, companyId, trailHours);
        trailPromise.then(trail => {
          if (trail.length < 2) return;
          // Apply downsampling: keep every Nth point, plus always the last
          // point so the trail ends precisely at the user's current pin.
          const sampled = stride === 1
            ? trail
            : [...trail.filter((_, i) => i % stride === 0), trail[trail.length - 1]];
          // Remove existing trail for this user first
          try { viewer.entities.removeById(`trail-${s.userId}`); } catch (e) { logger.swallow("cesium-layers:remove-trail", e); }
          const positions = sampled.flatMap(p => [p.lng, p.lat]);
          const entity = viewer.entities.add({
            id: `trail-${s.userId}`,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(positions),
              width: 2,
              material: new Cesium.PolylineGlowMaterialProperty({
                glowPower: 0.2,
                color: Cesium.Color.CYAN.withAlpha(0.6),
              }),
              clampToGround: true,
            },
          });
          entityGroupsRef.current.breadcrumbs.push(entity);
        }).catch(() => {});
      });
    }

    // Render immediately
    renderTrails();

    // Refresh trails every 60s
    const interval = setInterval(renderTrails, 60000);
    return () => clearInterval(interval);
  }, [staff, layers.breadcrumbs, loading, companyId, timeMachineOpen, debouncedReplayTime, viewerRef, cesiumRef, entityGroupsRef]);
}
