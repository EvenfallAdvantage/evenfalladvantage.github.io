/**
 * EONET severe weather layer (NASA EONET — severe storms, volcanoes, sea ice).
 *
 * Distinct from the existing `weather` (NEXRAD radar) layer: EONET tracks
 * named cyclones/storms, active volcanoes, and major iceberg/sea-ice events
 * globally. Wildfires + earthquakes are explicitly excluded server-side
 * (handled by the dedicated fires + earthquakes layers).
 *
 * Hidden during Time Machine replay (EONET only returns currently-open events).
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml, safeHttpUrl } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelEonetWeather } from "@/lib/intel-client";
import type { IntelEonetEvent } from "@/lib/intel-types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const iconCache = new Map<string, HTMLCanvasElement>();

function iconColor(icon: IntelEonetEvent["icon"]): string {
  switch (icon) {
    case "cyclone":
      return "#06b6d4";
    case "volcano":
      return "#a855f7";
    case "ice":
      return "#bae6fd";
    default:
      return "#fbbf24";
  }
}

function iconGlyph(icon: IntelEonetEvent["icon"]): string {
  // Unicode glyphs; rendered into the canvas. Avoid emoji to keep cross-platform.
  switch (icon) {
    case "cyclone":
      return "\u{1F300}"; // cyclone — wide font fallback to "@"
    case "volcano":
      return "\u25B2"; // black up triangle
    case "ice":
      return "\u2744"; // snowflake
    default:
      return "\u26A0"; // warning
  }
}

function buildIcon(event: IntelEonetEvent): HTMLCanvasElement {
  const key = `${event.icon}-${event.severity}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const color = iconColor(event.icon);
  const size = event.severity === "high" ? 30 : event.severity === "medium" ? 24 : 20;

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const r = size / 2;

  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 3;

  // Filled circle background
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(r, r, r - 2, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowColor = "transparent";

  // White ring
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // Glyph
  ctx.fillStyle = "#0f1a2e";
  ctx.font = `bold ${Math.floor(size * 0.55)}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(iconGlyph(event.icon), r, r + 1);

  iconCache.set(key, canvas);
  return canvas;
}

function buildPopup(e: IntelEonetEvent): string {
  const safeSource = safeHttpUrl(e.source);
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:${iconColor(e.icon)}">${escapeHtml(e.type)}</b>
    <div>${escapeHtml(e.title)}</div>
    ${e.date ? `<div style="color:#94a3b8">${escapeHtml(e.date.split("T")[0])}</div>` : ""}
    ${safeSource ? `<div style="margin-top:4px"><a href="${escapeHtml(safeSource)}" target="_blank" rel="noopener" style="color:#7dd3fc">Source →</a></div>` : ""}
  </div>`;
}

const REFRESH_INTERVAL_MS = 30 * 60_000; // 30 min

/** Wrapper so the react-compiler doesn't flag Date.now() as inline impure. */
function currentTimestamp() {
  return Date.now();
}

export function useEonetWeatherLayer(params: {
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

    const existing = (entityGroupsRef.current.eonetWeather ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try { viewer.entities.removeById(e.id); }
      catch (err) { logger.swallow("cesium-layers:remove-eonet", err); }
    });
    entityGroupsRef.current.eonetWeather = [];

    if (!layers.eonetWeather || isReplaying) return;

    let cancelled = false;

    async function fetchAndRender() {
      try {
        const data = await fetchIntelEonetWeather();
        if (cancelled || !viewer || !Cesium) return;

        const stale = (entityGroupsRef.current.eonetWeather ?? []) as Array<{ id: string }>;
        stale.forEach((e) => {
          try { viewer.entities.removeById(e.id); }
          catch (err) { logger.swallow("cesium-layers:remove-eonet-stale", err); }
        });
        entityGroupsRef.current.eonetWeather = [];

        for (const e of data.events ?? []) {
          if (!Number.isFinite(e.lat) || !Number.isFinite(e.lng)) continue;
          const entityId = `eonet-${e.id}`;
          const entity = viewer.entities.add({
            id: entityId,
            name: e.title,
            position: Cesium.Cartesian3.fromDegrees(e.lng, e.lat, 0),
            billboard: {
              image: buildIcon(e),
              scale: 1.0,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            description: buildPopup(e),
          });
          (entityGroupsRef.current.eonetWeather as Array<{ id: string }>).push(entity);
        }
      } catch (err) {
        logger.swallow("cesium-layers:eonet-fetch", err, "warn");
      }
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [layers.eonetWeather, loading, isReplaying, viewerRef, cesiumRef, entityGroupsRef]);
}
