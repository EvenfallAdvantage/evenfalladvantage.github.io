/**
 * SIGINT news layer — RSS items with keyword-derived coordinates and a
 * deterministic risk score from /intel-news. Renders only items with a
 * keyword match (coords != null) and risk_score >= 4 to keep noise down.
 *
 * Refresh every 15 min; full-refresh on each tick.
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml, safeHttpUrl } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelNews } from "@/lib/intel-client";
import type { IntelNewsItem } from "@/lib/intel-types";
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
  grad.addColorStop(0, "#fde68a");
  grad.addColorStop(0.7, "#ca8a04");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.45, 0, Math.PI * 2);
  ctx.stroke();

  iconCacheValue = canvas;
  return canvas;
}

function riskColor(score: number): string {
  if (score >= 8) return "#ef4444";
  if (score >= 6) return "#f97316";
  return "#fbbf24";
}

function buildPopup(item: IntelNewsItem): string {
  const safeLink = safeHttpUrl(item.link);
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7;max-width:300px">
    <b style="color:${riskColor(item.risk_score)}">${escapeHtml(item.source)} · risk ${item.risk_score}</b>
    <div style="margin-top:4px">${escapeHtml(item.title)}</div>
    ${item.published ? `<div style="color:#94a3b8;margin-top:4px">${escapeHtml(item.published)}</div>` : ""}
    ${safeLink ? `<div style="margin-top:4px"><a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener" style="color:#7dd3fc">Read article →</a></div>` : ""}
  </div>`;
}

const REFRESH_INTERVAL_MS = 15 * 60_000;

/** Wrapper so the react-compiler doesn't flag Date.now() as inline impure. */
function currentTimestamp() {
  return Date.now();
}

export function useSigintNewsLayer(params: {
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

    const existing = (entityGroupsRef.current.sigintNews ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try { viewer.entities.removeById(e.id); }
      catch (err) { logger.swallow("cesium-layers:remove-sigint", err); }
    });
    entityGroupsRef.current.sigintNews = [];

    if (!layers.sigintNews || isReplaying) return;

    let cancelled = false;

    async function fetchAndRender() {
      try {
        const data = await fetchIntelNews();
        if (cancelled || !viewer || !Cesium) return;

        const stale = (entityGroupsRef.current.sigintNews ?? []) as Array<{ id: string }>;
        stale.forEach((e) => {
          try { viewer.entities.removeById(e.id); }
          catch (err) { logger.swallow("cesium-layers:remove-sigint-stale", err); }
        });
        entityGroupsRef.current.sigintNews = [];

        let idx = 0;
        for (const item of data.news ?? []) {
          if (!item.coords) continue;
          if (item.risk_score < 4) continue;
          const [lat, lng] = item.coords;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const entityId = `sigint-${idx++}`;
          const entity = viewer.entities.add({
            id: entityId,
            name: item.title,
            position: Cesium.Cartesian3.fromDegrees(lng, lat, 0),
            billboard: {
              image: buildIcon(),
              scale: 1.0,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            },
            description: buildPopup(item),
          });
          (entityGroupsRef.current.sigintNews as Array<{ id: string }>).push(entity);
        }
      } catch (err) {
        logger.swallow("cesium-layers:sigint-fetch", err, "warn");
      }
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [layers.sigintNews, loading, isReplaying, viewerRef, cesiumRef, entityGroupsRef]);
}
