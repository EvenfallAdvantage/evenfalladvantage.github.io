/**
 * News layer (panel v2): GDELT geotagged events and RSS headlines merged into
 * one de-duplicated set of pins (lib/map/news-merge.ts). Replaces the separate
 * "World News" and "SIGINT News" layers. Refresh every 15 min.
 */

import { useEffect } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { escapeHtml, safeHttpUrl } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelGdelt, fetchIntelNews } from "@/lib/intel-client";
import { mergeNews, type MergedNewsItem } from "@/lib/map/news-merge";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";

const REFRESH_INTERVAL_MS = 15 * 60_000;
const iconCache = new Map<string, HTMLCanvasElement>();

function riskColor(score: number): string {
  if (score >= 8) return "#ef4444";
  if (score >= 6) return "#f97316";
  return "#fbbf24";
}

function buildIcon(color: string): HTMLCanvasElement {
  const hit = iconCache.get(color);
  if (hit) return hit;
  const size = 14;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const r = size / 2;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(r, r, r - 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.95)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.fillStyle = "#111";
    ctx.fillRect(r - 2.5, r - 2, 5, 1.2);
    ctx.fillRect(r - 2.5, r + 0.5, 5, 1.2);
  }
  iconCache.set(color, canvas);
  return canvas;
}

function buildPopup(item: MergedNewsItem): string {
  const safeLink = safeHttpUrl(item.url);
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7;max-width:300px">
    <b style="color:${riskColor(item.risk)}">NEWS · ${escapeHtml(item.source)}</b>
    <div style="margin-top:4px">${escapeHtml(item.title)}</div>
    ${item.published ? `<div style="color:#94a3b8;margin-top:4px">${escapeHtml(item.published)}</div>` : ""}
    ${safeLink ? `<div style="margin-top:4px"><a href="${escapeHtml(safeLink)}" target="_blank" rel="noopener" style="color:#7dd3fc">Read article →</a></div>` : ""}
    <div style="color:#64748b;margin-top:4px;font-size:9px">Location is inferred from the headline and may be approximate.</div>
  </div>`;
}

function currentTimestamp() {
  return Date.now();
}

export function useNewsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
  /** Optional filter (e.g. near-my-sites) applied before drawing. */
  filter?: (item: MergedNewsItem) => boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, debouncedReplayTime, timeMachineOpen, filter } = params;
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5_000;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const clear = () => {
      for (const e of (entityGroupsRef.current.news ?? []) as Array<{ id: string }>) {
        try { viewer.entities.removeById(e.id); } catch (err) { logger.swallow("cesium-layers:remove-news", err); }
      }
      entityGroupsRef.current.news = [];
    };
    clear();
    if (!layers.news || isReplaying) return;

    let cancelled = false;
    async function fetchAndRender() {
      const [g, n] = await Promise.allSettled([fetchIntelGdelt(), fetchIntelNews()]);
      if (cancelled || !viewer || !Cesium) return;
      if (g.status === "rejected") logger.swallow("cesium-layers:news-gdelt", g.reason, "warn");
      if (n.status === "rejected") logger.swallow("cesium-layers:news-rss", n.reason, "warn");
      const merged = mergeNews(g.status === "fulfilled" ? g.value.events ?? [] : [], n.status === "fulfilled" ? n.value.news ?? [] : []);
      clear();
      let idx = 0;
      for (const item of merged) {
        if (filter && !filter(item)) continue;
        const entity = viewer.entities.add({
          id: `news-${idx++}`,
          name: item.title,
          position: Cesium.Cartesian3.fromDegrees(item.lng, item.lat, 5),
          billboard: {
            image: buildIcon(riskColor(item.risk)),
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            disableDepthTestDistance: nearSideDepthProperty(viewer, Cesium),
          },
          description: buildPopup(item),
        });
        (entityGroupsRef.current.news as Array<{ id: string }>).push(entity);
      }
      viewer.scene.requestRender();
    }

    void fetchAndRender();
    const stop = setVisibleInterval(() => void fetchAndRender(), REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      stop();
      clear();
    };
  }, [layers.news, loading, isReplaying, viewerRef, cesiumRef, entityGroupsRef, filter]);
}
