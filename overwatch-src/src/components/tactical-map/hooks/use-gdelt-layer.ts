/**
 * GDELT incidents layer (RSS keyword-geomap fallback).
 *
 * Server-side aggregates BBC / Al Jazeera / NYT World feeds, filters for
 * conflict keywords, jitters coordinates so coincident events don't pile up.
 * Refreshed every 15 minutes; hidden in Time Machine replay since the
 * underlying RSS only carries current items.
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelGdelt } from "@/lib/intel-client";
import type { IntelGdeltEvent } from "@/lib/intel-types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

let iconCacheValue: HTMLCanvasElement | null = null;

function buildIcon(): HTMLCanvasElement {
  if (iconCacheValue) return iconCacheValue;
  const size = 14;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const r = size / 2;

  const grad = ctx.createRadialGradient(r, r, 1, r, r, r);
  grad.addColorStop(0, "#fda4af");
  grad.addColorStop(0.7, "#e11d48");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.45, 0, Math.PI * 2);
  ctx.stroke();

  iconCacheValue = canvas;
  return canvas;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildPopup(e: IntelGdeltEvent): string {
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:#e11d48">${escapeHtml(e.source)}</b>
    <div>${escapeHtml(e.title)}</div>
    ${e.url ? `<div style="margin-top:4px"><a href="${escapeHtml(e.url)}" target="_blank" rel="noopener" style="color:#7dd3fc">Read article →</a></div>` : ""}
  </div>`;
}

const REFRESH_INTERVAL_MS = 15 * 60_000;

/** Wrapper so the react-compiler doesn't flag Date.now() as inline impure. */
function currentTimestamp() {
  return Date.now();
}

export function useGdeltLayer(params: {
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

    const existing = (entityGroupsRef.current.gdelt ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try { viewer.entities.removeById(e.id); }
      catch (err) { logger.swallow("cesium-layers:remove-gdelt", err); }
    });
    entityGroupsRef.current.gdelt = [];

    if (!layers.gdelt || isReplaying) return;

    let cancelled = false;

    async function fetchAndRender() {
      try {
        const data = await fetchIntelGdelt();
        if (cancelled || !viewer || !Cesium) return;

        // Full refresh on each fetch (jittered coords change between fetches).
        const stale = (entityGroupsRef.current.gdelt ?? []) as Array<{ id: string }>;
        stale.forEach((e) => {
          try { viewer.entities.removeById(e.id); }
          catch (err) { logger.swallow("cesium-layers:remove-gdelt-stale", err); }
        });
        entityGroupsRef.current.gdelt = [];

        const events = data.events ?? [];
        for (const e of events) {
          if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng)) continue;
          const entity = viewer.entities.add({
            id: `gdelt-${e.id}`,
            name: e.title,
            position: Cesium.Cartesian3.fromDegrees(e.lng, e.lat, 0),
            billboard: {
              image: buildIcon(),
              scale: 1.0,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            description: buildPopup(e),
          });
          (entityGroupsRef.current.gdelt as Array<{ id: string }>).push(entity);
        }
      } catch (err) {
        logger.swallow("cesium-layers:gdelt-fetch", err, "warn");
      }
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [layers.gdelt, loading, isReplaying, viewerRef, cesiumRef, entityGroupsRef]);
}
