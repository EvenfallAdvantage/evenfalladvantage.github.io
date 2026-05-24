/**
 * CCTV cameras layer.
 *
 * **GATED**: this hook checks `INTEL_LAYER_FLAGS.cctv.enabled` and renders
 * NOTHING if the flag is off (default until legal review per
 * docs/THIRD-PARTY-NOTICES.md). The layer toggle is still visible in the
 * panel for forward awareness; flipping the flag is the one-line change that
 * activates it.
 *
 * When enabled, fetches /intel-cctv (Singapore LTA + FL-511 + Caltrans only
 * in the initial port; more regions are added incrementally per legal
 * review). Clicking a camera dot fires `onOpenCamera` so the parent can
 * mount the camera viewer modal.
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelCctv } from "@/lib/intel-client";
import { INTEL_LAYER_FLAGS } from "@/lib/intel-feature-flags";
import type { CctvCamera } from "@/lib/intel-types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

let iconCacheValue: HTMLCanvasElement | null = null;

function buildIcon(): HTMLCanvasElement {
  if (iconCacheValue) return iconCacheValue;
  const size = 12;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const r = size / 2;

  const grad = ctx.createRadialGradient(r, r, 0.5, r, r, r);
  grad.addColorStop(0, "#86efac");
  grad.addColorStop(0.7, "#10b981");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.45, 0, Math.PI * 2);
  ctx.stroke();

  iconCacheValue = canvas;
  return canvas;
}

function buildPopup(cam: CctvCamera): string {
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:#10b981">${escapeHtml(cam.name)}</b>
    <div>${escapeHtml(cam.city)}, ${escapeHtml(cam.country)}</div>
    <div style="color:#94a3b8">${escapeHtml(cam.source)}</div>
    <div style="color:#94a3b8;margin-top:4px">Click to view</div>
  </div>`;
}

export function useCctvLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  onOpenCamera: (cam: CctvCamera) => void;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, onOpenCamera } = params;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Snapshot the ref's current value so the cleanup closure references the
    // same object even if the ref is reassigned later (React Hooks rule).
    const entityGroups = entityGroupsRef.current;

    const existing = (entityGroups.cctv ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try { viewer.entities.removeById(e.id); }
      catch (err) { logger.swallow("cesium-layers:remove-cctv", err); }
    });
    entityGroups.cctv = [];

    if (entityGroups.cctvClickHandler) {
      try { entityGroups.cctvClickHandler.destroy(); }
      catch (err) { logger.swallow("cesium-layers:destroy-cctv-handler", err); }
      entityGroups.cctvClickHandler = null;
    }

    if (!layers.cctv) return;

    // Gating: respect the feature flag. The endpoint also enforces this
    // server-side via 503, but failing fast in the client avoids a useless
    // network round-trip and the resulting empty-state confusion.
    if (!INTEL_LAYER_FLAGS.cctv.enabled) {
      logger.swallow(
        "cesium-layers:cctv-gated",
        new Error(`CCTV layer disabled: ${INTEL_LAYER_FLAGS.cctv.gatedBy ?? "feature flag off"}`),
        "debug",
      );
      return;
    }

    let cancelled = false;
    const camsById = new Map<string, CctvCamera>();

    async function loadAndRender() {
      try {
        const data = await fetchIntelCctv("all");
        if (cancelled || !viewer || !Cesium) return;
        if (data.gated_by) {
          logger.swallow("cesium-layers:cctv-server-gated", new Error(data.gated_by), "debug");
          return;
        }

        for (const cam of data.cameras ?? []) {
          if (!Number.isFinite(cam.lat) || !Number.isFinite(cam.lng)) continue;
          const entityId = `cctv-${cam.id}`;
          camsById.set(entityId, cam);
          const entity = viewer.entities.add({
            id: entityId,
            name: cam.name,
            position: Cesium.Cartesian3.fromDegrees(cam.lng, cam.lat, 0),
            billboard: {
              image: buildIcon(),
              scale: 1.0,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            },
            description: buildPopup(cam),
          });
          (entityGroups.cctv as Array<{ id: string }>).push(entity);
        }

        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click: { position: { x: number; y: number } }) => {
          const picked = viewer.scene.pick(click.position);
          const pickedId = picked?.id?.id as string | undefined;
          if (!pickedId) return;
          const cam = camsById.get(pickedId);
          if (cam) onOpenCamera(cam);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        entityGroups.cctvClickHandler = handler;
      } catch (err) {
        logger.swallow("cesium-layers:cctv-fetch", err, "warn");
      }
    }

    loadAndRender();
    return () => {
      cancelled = true;
      if (entityGroups.cctvClickHandler) {
        try { entityGroups.cctvClickHandler.destroy(); }
        catch (err) { logger.swallow("cesium-layers:destroy-cctv-handler", err); }
        entityGroups.cctvClickHandler = null;
      }
    };
  }, [layers.cctv, loading, onOpenCamera, viewerRef, cesiumRef, entityGroupsRef]);
}
