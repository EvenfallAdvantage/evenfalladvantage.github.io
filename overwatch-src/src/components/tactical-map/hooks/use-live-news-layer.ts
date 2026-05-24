/**
 * Live news broadcasters layer.
 *
 * Renders ~25 24/7 broadcaster dots at their HQ city locations. Clicking a
 * dot fires the supplied `onOpenFeed` callback so the parent can mount a
 * viewer modal for embed-allowed feeds or open the URL externally.
 *
 * Static data; loaded once when the layer is toggled on.
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelLiveNews } from "@/lib/intel-client";
import type { IntelLiveNewsFeed } from "@/lib/intel-types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const iconCache = new Map<string, HTMLCanvasElement>();

function categoryColor(category: IntelLiveNewsFeed["category"]): string {
  switch (category) {
    case "mainstream": return "#38bdf8";
    case "government": return "#a78bfa";
    case "finance":    return "#fbbf24";
    case "conflict":   return "#ef4444";
    case "state":      return "#f97316";
  }
}

function buildIcon(color: string): HTMLCanvasElement {
  const cached = iconCache.get(color);
  if (cached) return cached;

  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const r = size / 2;

  // Pulsing-style halo
  const halo = ctx.createRadialGradient(r, r, 1, r, r, r);
  halo.addColorStop(0, color);
  halo.addColorStop(0.6, color);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
  ctx.fill();

  // White ring outline
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.5, 0, Math.PI * 2);
  ctx.stroke();

  iconCache.set(color, canvas);
  return canvas;
}

function buildPopup(f: IntelLiveNewsFeed): string {
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:${categoryColor(f.category)}">${escapeHtml(f.name)}</b>
    <div>${escapeHtml(f.city)}, ${escapeHtml(f.country)}</div>
    <div style="color:#94a3b8">${escapeHtml(f.category)} · ${escapeHtml(f.language)}</div>
    <div style="color:#94a3b8;margin-top:4px">Click pin to ${f.embed_allowed ? "watch live" : "open feed"}</div>
  </div>`;
}

export function useLiveNewsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  onOpenFeed: (feed: IntelLiveNewsFeed) => void;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, onOpenFeed } = params;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Snapshot the ref's current value so the cleanup closure references the
    // same object even if the ref is reassigned later (React Hooks rule).
    const entityGroups = entityGroupsRef.current;

    // Clear any previous entities from a prior toggle cycle.
    const existing = (entityGroups.liveNews ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try { viewer.entities.removeById(e.id); }
      catch (err) { logger.swallow("cesium-layers:remove-live-news", err); }
    });
    entityGroups.liveNews = [];

    // Drop any previously-attached click handler.
    if (entityGroups.liveNewsClickHandler) {
      try { entityGroups.liveNewsClickHandler.destroy(); }
      catch (err) { logger.swallow("cesium-layers:destroy-livenews-handler", err); }
      entityGroups.liveNewsClickHandler = null;
    }

    if (!layers.liveNews) return;

    let cancelled = false;
    const feedsById = new Map<string, IntelLiveNewsFeed>();

    async function loadAndRender() {
      try {
        const data = await fetchIntelLiveNews();
        if (cancelled || !viewer || !Cesium) return;

        for (const f of data.feeds ?? []) {
          if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng)) continue;
          const entityId = `live-news-${f.id}`;
          feedsById.set(entityId, f);
          const entity = viewer.entities.add({
            id: entityId,
            name: f.name,
            position: Cesium.Cartesian3.fromDegrees(f.lng, f.lat, 0),
            billboard: {
              image: buildIcon(categoryColor(f.category)),
              scale: 1.0,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            },
            description: buildPopup(f),
          });
          (entityGroups.liveNews as Array<{ id: string }>).push(entity);
        }

        // Attach a dedicated click handler that only fires onOpenFeed when
        // the user clicks one of our entities. Other clicks fall through to
        // the global click handler unchanged because we don't preventDefault.
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click: { position: { x: number; y: number } }) => {
          const picked = viewer.scene.pick(click.position);
          const pickedId = picked?.id?.id as string | undefined;
          if (!pickedId) return;
          const feed = feedsById.get(pickedId);
          if (feed) onOpenFeed(feed);
        }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

        entityGroups.liveNewsClickHandler = handler;
      } catch (err) {
        logger.swallow("cesium-layers:live-news-fetch", err, "warn");
      }
    }

    loadAndRender();

    return () => {
      cancelled = true;
      if (entityGroups.liveNewsClickHandler) {
        try { entityGroups.liveNewsClickHandler.destroy(); }
        catch (err) { logger.swallow("cesium-layers:destroy-livenews-handler", err); }
        entityGroups.liveNewsClickHandler = null;
      }
    };
  }, [layers.liveNews, loading, onOpenFeed, viewerRef, cesiumRef, entityGroupsRef]);
}
