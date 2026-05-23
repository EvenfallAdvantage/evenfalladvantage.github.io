/**
 * Active fires layer (NASA FIRMS VIIRS/MODIS + EONET volcanoes).
 *
 * The Edge Function already samples FIRMS down to ~2000 points globally so
 * the client doesn't choke. We refresh every hour while the layer is on.
 *
 * Volcanoes are rendered with the same dot but a distinct color and label.
 * Hidden during Time Machine replay because FIRMS only returns the most
 * recent 24h.
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelFires } from "@/lib/intel-client";
import type { IntelFire } from "@/lib/intel-types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const iconCache = new Map<string, HTMLCanvasElement>();

function buildFireIcon(kind: "fire" | "volcano"): HTMLCanvasElement {
  const cached = iconCache.get(kind);
  if (cached) return cached;

  const size = kind === "volcano" ? 18 : 12;
  const color = kind === "volcano" ? "#a855f7" : "#f97316";

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const r = size / 2;

  const grad = ctx.createRadialGradient(r, r, r * 0.2, r, r, r);
  grad.addColorStop(0, kind === "volcano" ? "#fde047" : "#fbbf24");
  grad.addColorStop(0.7, color);
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
  ctx.fill();

  iconCache.set(kind, canvas);
  return canvas;
}

function buildPopup(f: IntelFire): string {
  if (f.type === "volcano") {
    return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
      <b style="color:#a855f7">${escapeHtml(f.title ?? "Volcano")}</b>
      <div>Date: ${escapeHtml(f.date || "unknown")}</div>
    </div>`;
  }
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:#f97316">Active fire</b>
    <div>Brightness: ${f.brightness.toFixed(1)}K</div>
    <div>FRP: ${f.frp.toFixed(1)} MW</div>
    <div>Confidence: ${escapeHtml(f.confidence)}</div>
    <div>${escapeHtml(f.date)} ${escapeHtml(f.time)}Z</div>
  </div>`;
}

const REFRESH_INTERVAL_MS = 60 * 60_000; // 1 hour

/** Wrapper so the react-compiler doesn't flag Date.now() as an inline impure call. */
function currentTimestamp() {
  return Date.now();
}

export function useFiresLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;

  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5_000;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const existing = (entityGroupsRef.current.fires ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try {
        viewer.entities.removeById(e.id);
      } catch (err) {
        logger.swallow("cesium-layers:remove-fire", err);
      }
    });
    entityGroupsRef.current.fires = [];

    if (!layers.fires || isReplaying) return;

    let cancelled = false;

    async function fetchAndRender() {
      try {
        const data = await fetchIntelFires();
        if (cancelled || !viewer || !Cesium) return;

        // Clear current entities (full-refresh; FIRMS sample shifts per fetch).
        const stale = (entityGroupsRef.current.fires ?? []) as Array<{ id: string }>;
        stale.forEach((e) => {
          try {
            viewer.entities.removeById(e.id);
          } catch (err) {
            logger.swallow("cesium-layers:remove-fire-stale", err);
          }
        });
        entityGroupsRef.current.fires = [];

        const fires = data.fires ?? [];
        for (let i = 0; i < fires.length; i++) {
          const f = fires[i];
          if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng)) continue;
          // FIRMS rows don't carry a stable id; index-based is fine since we
          // wipe and re-add the whole set on each refresh.
          const entityId = `fire-${i}-${f.lat.toFixed(3)}-${f.lng.toFixed(3)}-${f.type}`;
          const entity = viewer.entities.add({
            id: entityId,
            name: f.title ?? (f.type === "volcano" ? "Volcano" : "Fire"),
            position: Cesium.Cartesian3.fromDegrees(f.lng, f.lat, 0),
            billboard: {
              image: buildFireIcon(f.type),
              scale: 1.0,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            description: buildPopup(f),
          });
          (entityGroupsRef.current.fires as Array<{ id: string }>).push(entity);
        }
      } catch (err) {
        logger.swallow("cesium-layers:fires-fetch", err, "warn");
      }
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [layers.fires, loading, isReplaying, viewerRef, cesiumRef, entityGroupsRef]);
}
