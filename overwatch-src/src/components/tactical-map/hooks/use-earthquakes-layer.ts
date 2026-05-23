/**
 * Earthquakes layer (USGS, M2.5+, last 24h).
 *
 * Fetches from the `intel-earthquakes` Supabase Edge Function on mount and
 * every 15 minutes while the layer is enabled. Renders one Cesium entity
 * per quake with size/color interpolated on magnitude:
 *
 *   M < 4: gold dot, small
 *   M 4–6: orange, medium
 *   M 6+: red, large
 *
 * Hidden during Time Machine replay because USGS only returns the most
 * recent 24h — there's no historical replay source.
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelEarthquakes } from "@/lib/intel-client";
import type { IntelEarthquake } from "@/lib/intel-types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const quakeIconCache = new Map<string, HTMLCanvasElement>();

/** Build a colored circle billboard for a given magnitude bucket. */
function buildQuakeIcon(magnitude: number): HTMLCanvasElement {
  const bucket = magnitude < 4 ? "small" : magnitude < 6 ? "medium" : "large";
  const cached = quakeIconCache.get(bucket);
  if (cached) return cached;

  const size = bucket === "small" ? 18 : bucket === "medium" ? 28 : 40;
  const color = bucket === "small" ? "#fbbf24" : bucket === "medium" ? "#f97316" : "#ef4444";

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const r = size / 2;
  // Outer halo
  const halo = ctx.createRadialGradient(r, r, r * 0.3, r, r, r);
  halo.addColorStop(0, color);
  halo.addColorStop(0.7, color);
  halo.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(r, r, r - 1, 0, Math.PI * 2);
  ctx.fill();
  // Solid core
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  // White outline ring
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.55, 0, Math.PI * 2);
  ctx.stroke();

  quakeIconCache.set(bucket, canvas);
  return canvas;
}

function buildPopup(q: IntelEarthquake): string {
  const when = q.time ? new Date(q.time).toUTCString() : "unknown";
  const tsunamiLine = q.tsunami
    ? `<div style="color:#fca5a5"><b>TSUNAMI ALERT</b></div>`
    : "";
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b>M${q.magnitude.toFixed(1)} — ${escapeHtml(q.place || "Unknown location")}</b>
    <div>Depth: ${q.depth.toFixed(1)} km</div>
    <div>UTC: ${when}</div>
    ${q.felt != null ? `<div>Felt reports: ${q.felt}</div>` : ""}
    ${q.alert ? `<div>PAGER alert: ${escapeHtml(q.alert)}</div>` : ""}
    ${tsunamiLine}
    ${q.url ? `<div style="margin-top:4px"><a href="${escapeHtml(q.url)}" target="_blank" rel="noopener" style="color:#7dd3fc">USGS event page →</a></div>` : ""}
  </div>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const REFRESH_INTERVAL_MS = 15 * 60_000; // 15 min

/** Wrapper so the react-compiler doesn't flag Date.now() as an inline impure call. */
function currentTimestamp() {
  return Date.now();
}

export function useEarthquakesLayer(params: {
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

    // Clear previously-rendered quake entities.
    const existing = (entityGroupsRef.current.earthquakes ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try {
        viewer.entities.removeById(e.id);
      } catch (err) {
        logger.swallow("cesium-layers:remove-earthquake", err);
      }
    });
    entityGroupsRef.current.earthquakes = [];

    if (!layers.earthquakes || isReplaying) return;

    let cancelled = false;
    const activeIds = new Set<string>();

    async function fetchAndRender() {
      try {
        const data = await fetchIntelEarthquakes();
        if (cancelled || !viewer || !Cesium) return;

        const newIds = new Set<string>();
        for (const q of data.earthquakes ?? []) {
          if (!Number.isFinite(q.lat) || !Number.isFinite(q.lng)) continue;
          const entityId = `earthquake-${q.id}`;
          newIds.add(entityId);

          const existingEntity = viewer.entities.getById(entityId);
          if (existingEntity) continue; // immutable record; no need to mutate

          const entity = viewer.entities.add({
            id: entityId,
            name: `M${q.magnitude.toFixed(1)} ${q.place || ""}`,
            position: Cesium.Cartesian3.fromDegrees(q.lng, q.lat, 0),
            billboard: {
              image: buildQuakeIcon(q.magnitude),
              scale: 0.9,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            description: buildPopup(q),
          });
          (entityGroupsRef.current.earthquakes as Array<{ id: string }>).push(entity);
        }

        // Remove stale entities that no longer appear in the feed.
        for (const id of activeIds) {
          if (!newIds.has(id)) {
            try {
              viewer.entities.removeById(id);
            } catch (e) {
              logger.swallow("cesium-layers:remove-earthquake", e);
            }
          }
        }
        activeIds.clear();
        for (const id of newIds) activeIds.add(id);
        entityGroupsRef.current.earthquakes = Array.from(newIds).map((id) => ({ id }));
      } catch (err) {
        logger.swallow("cesium-layers:earthquakes-fetch", err, "warn");
      }
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, REFRESH_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [layers.earthquakes, loading, isReplaying, viewerRef, cesiumRef, entityGroupsRef]);
}
