/**
 * Conflict zones layer — 13 curated active war / high-tension regions.
 *
 * Static data (refreshed only when the underlying JSON in the
 * `intel-conflict-zones` Edge Function changes). Rendered as
 * severity-colored warning triangles with text labels.
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelConflictZones } from "@/lib/intel-client";
import type { IntelConflictZone } from "@/lib/intel-types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const iconCache = new Map<string, HTMLCanvasElement>();

function severityColor(severity: IntelConflictZone["severity"]): string {
  switch (severity) {
    case "active_war":
      return "#ef4444";
    case "high_tension":
      return "#f97316";
    case "elevated":
      return "#fbbf24";
  }
}

function buildIcon(severity: IntelConflictZone["severity"]): HTMLCanvasElement {
  const key = severity;
  const cached = iconCache.get(key);
  if (cached) return cached;
  const color = severityColor(severity);
  const size = 32;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  // Drop shadow halo
  ctx.shadowColor = "rgba(0,0,0,0.6)";
  ctx.shadowBlur = 4;

  // Triangle
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(size / 2, 4);
  ctx.lineTo(size - 4, size - 5);
  ctx.lineTo(4, size - 5);
  ctx.closePath();
  ctx.fill();

  // Outline
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.stroke();

  // Exclamation
  ctx.fillStyle = "#0f1a2e";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("!", size / 2, size / 2 + 3);

  iconCache.set(key, canvas);
  return canvas;
}

function buildPopup(z: IntelConflictZone): string {
  const tags = z.tags.length > 0
    ? `<div style="margin-top:4px;color:#94a3b8">${z.tags.map(escapeHtml).join(" · ")}</div>`
    : "";
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:${severityColor(z.severity)}">${escapeHtml(z.name)}</b>
    <div>Severity: ${escapeHtml(z.severity.replace("_", " "))}</div>
    ${tags}
  </div>`;
}

export function useConflictZonesLayer(params: {
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

    const existing = (entityGroupsRef.current.conflictZones ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try {
        viewer.entities.removeById(e.id);
      } catch (err) {
        logger.swallow("cesium-layers:remove-conflict-zone", err);
      }
    });
    entityGroupsRef.current.conflictZones = [];

    if (!layers.conflictZones) return;

    let cancelled = false;

    async function loadAndRender() {
      try {
        const data = await fetchIntelConflictZones();
        if (cancelled || !viewer || !Cesium) return;

        for (const z of data.zones ?? []) {
          if (!Number.isFinite(z.lat) || !Number.isFinite(z.lng)) continue;
          const entityId = `conflict-${z.id}`;
          const entity = viewer.entities.add({
            id: entityId,
            name: z.name,
            position: Cesium.Cartesian3.fromDegrees(z.lng, z.lat, 0),
            billboard: {
              image: buildIcon(z.severity),
              scale: 1.0,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
            label: {
              text: z.name,
              font: "10px sans-serif",
              fillColor: Cesium.Color.fromCssColorString(severityColor(z.severity)),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -22),
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 20_000_000),
            },
            description: buildPopup(z),
          });
          (entityGroupsRef.current.conflictZones as Array<{ id: string }>).push(entity);
        }
      } catch (err) {
        logger.swallow("cesium-layers:conflict-zones-fetch", err, "warn");
      }
    }

    loadAndRender();
    return () => {
      cancelled = true;
    };
  }, [layers.conflictZones, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
