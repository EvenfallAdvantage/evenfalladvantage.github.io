/**
 * Maritime static layer — global container/energy/naval ports + chokepoints.
 *
 * AIS live ships are intentionally absent (gated by INTEL_LAYER_FLAGS.maritime_ais
 * until a long-lived side worker is deployed in Phase E).
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelMaritime } from "@/lib/intel-client";
import type { IntelMaritimePort, IntelMaritimeChokepoint } from "@/lib/intel-types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const iconCache = new Map<string, HTMLCanvasElement>();

function portColor(type: IntelMaritimePort["type"]): string {
  switch (type) {
    case "container": return "#38bdf8";
    case "energy":    return "#fb923c";
    case "naval":     return "#a78bfa";
  }
}

function chokepointColor(risk: IntelMaritimeChokepoint["risk"]): string {
  switch (risk) {
    case "CRITICAL": return "#ef4444";
    case "HIGH":     return "#f97316";
    case "ELEVATED": return "#fbbf24";
    case "MODERATE": return "#84cc16";
    case "LOW":      return "#22d3ee";
  }
}

function buildPortIcon(color: string): HTMLCanvasElement {
  const cached = iconCache.get(`port-${color}`);
  if (cached) return cached;

  const size = 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const r = size / 2;

  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 3;

  // Square w/ anchor cross
  ctx.fillStyle = color;
  ctx.fillRect(2, 2, size - 4, size - 4);

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.2;
  ctx.strokeRect(2, 2, size - 4, size - 4);

  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(r, 4); ctx.lineTo(r, size - 4);
  ctx.moveTo(4, r); ctx.lineTo(size - 4, r);
  ctx.stroke();

  iconCache.set(`port-${color}`, canvas);
  return canvas;
}

function buildChokepointIcon(color: string): HTMLCanvasElement {
  const cached = iconCache.get(`choke-${color}`);
  if (cached) return cached;

  const size = 22;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const r = size / 2;

  // Diamond
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 3;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(r, 2);
  ctx.lineTo(size - 2, r);
  ctx.lineTo(r, size - 2);
  ctx.lineTo(2, r);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.5;
  ctx.stroke();

  iconCache.set(`choke-${color}`, canvas);
  return canvas;
}

function buildPortPopup(p: IntelMaritimePort): string {
  const detail = p.fleet
    ? `Fleet: ${escapeHtml(p.fleet)}`
    : p.volume
      ? `Volume: ${escapeHtml(p.volume)}${p.rank ? ` (rank #${p.rank})` : ""}`
      : "";
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:${portColor(p.type)}">${escapeHtml(p.name)}</b>
    <div>${escapeHtml(p.country)} · ${escapeHtml(p.type)}</div>
    ${detail ? `<div>${detail}</div>` : ""}
  </div>`;
}

function buildChokePopup(c: IntelMaritimeChokepoint): string {
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:${chokepointColor(c.risk)}">${escapeHtml(c.name)}</b>
    <div>${escapeHtml(c.traffic)}</div>
    <div>Risk: ${escapeHtml(c.risk)}</div>
  </div>`;
}

export function useMaritimeLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers } = params;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const existing = (entityGroupsRef.current.maritime ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try { viewer.entities.removeById(e.id); }
      catch (err) { logger.swallow("cesium-layers:remove-maritime", err); }
    });
    entityGroupsRef.current.maritime = [];

    if (!layers.maritime) return;

    let cancelled = false;

    async function loadAndRender() {
      try {
        const data = await fetchIntelMaritime();
        if (cancelled || !viewer || !Cesium) return;

        // Ports
        for (const p of data.ports ?? []) {
          if (!Number.isFinite(p.lat) || !Number.isFinite(p.lng)) continue;
          const color = portColor(p.type);
          const entity = viewer.entities.add({
            id: `port-${p.name}`.replace(/\s+/g, "_"),
            name: p.name,
            position: Cesium.Cartesian3.fromDegrees(p.lng, p.lat, 0),
            billboard: {
              image: buildPortIcon(color),
              scale: 1.0,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            },
            label: {
              text: p.name,
              font: "9px sans-serif",
              fillColor: Cesium.Color.fromCssColorString(color),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -14),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 8_000_000),
            },
            description: buildPortPopup(p),
          });
          (entityGroupsRef.current.maritime as Array<{ id: string }>).push(entity);
        }

        // Chokepoints
        for (const c of data.chokepoints ?? []) {
          if (!Number.isFinite(c.lat) || !Number.isFinite(c.lng)) continue;
          const color = chokepointColor(c.risk);
          const entity = viewer.entities.add({
            id: `choke-${c.name}`.replace(/\s+/g, "_"),
            name: c.name,
            position: Cesium.Cartesian3.fromDegrees(c.lng, c.lat, 0),
            billboard: {
              image: buildChokepointIcon(color),
              scale: 1.0,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            },
            label: {
              text: c.name,
              font: "10px sans-serif",
              fillColor: Cesium.Color.fromCssColorString(color),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -18),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 15_000_000),
            },
            description: buildChokePopup(c),
          });
          (entityGroupsRef.current.maritime as Array<{ id: string }>).push(entity);
        }
      } catch (err) {
        logger.swallow("cesium-layers:maritime-fetch", err, "warn");
      }
    }

    loadAndRender();
    return () => {
      cancelled = true;
    };
  }, [layers.maritime, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
