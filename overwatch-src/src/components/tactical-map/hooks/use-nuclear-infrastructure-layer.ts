/**
 * Nuclear infrastructure layer (curated static list of ~56 NPPs worldwide).
 *
 * Static data; loaded once when the layer is toggled on. Operational state
 * (active / decommissioned / partial shutdown / etc.) influences color.
 * Labels show only at lower zoom levels to keep the map readable.
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelInfrastructure } from "@/lib/intel-client";
import type { IntelNuclearFacility } from "@/lib/intel-types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const iconCache = new Map<string, HTMLCanvasElement>();

function statusColor(status: string): string {
  const s = status.toLowerCase();
  if (s.includes("conflict") || s.includes("destroyed")) return "#ef4444";
  if (s.includes("decommission") || s.includes("exclusion")) return "#94a3b8";
  if (s.includes("suspended") || s.includes("partial") || s.includes("construction")) return "#fbbf24";
  return "#22d3ee"; // operational default
}

function buildIcon(color: string): HTMLCanvasElement {
  const cached = iconCache.get(color);
  if (cached) return cached;

  const size = 22;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const r = size / 2;

  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 3;

  // Trefoil-style hexagon for nuclear
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = (Math.PI / 3) * i - Math.PI / 2;
    const x = r + (r - 3) * Math.cos(a);
    const y = r + (r - 3) * Math.sin(a);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "rgba(255,255,255,0.9)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Inner dot
  ctx.fillStyle = "rgba(255,255,255,0.95)";
  ctx.beginPath();
  ctx.arc(r, r, 2.5, 0, Math.PI * 2);
  ctx.fill();

  iconCache.set(color, canvas);
  return canvas;
}

function buildPopup(f: IntelNuclearFacility): string {
  const color = statusColor(f.status);
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:${color}">${escapeHtml(f.name)}</b>
    <div>${escapeHtml(f.city)}, ${escapeHtml(f.country)}</div>
    <div>Status: ${escapeHtml(f.status)}</div>
    <div>Reactors: ${f.reactors} · ${f.capacityMW.toLocaleString()} MW</div>
    <div>Owner: ${escapeHtml(f.owner)}</div>
  </div>`;
}

export function useNuclearInfrastructureLayer(params: {
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

    const existing = (entityGroupsRef.current.nuclearInfrastructure ?? []) as Array<{ id: string }>;
    existing.forEach((e) => {
      try { viewer.entities.removeById(e.id); }
      catch (err) { logger.swallow("cesium-layers:remove-nuclear", err); }
    });
    entityGroupsRef.current.nuclearInfrastructure = [];

    if (!layers.nuclearInfrastructure) return;

    let cancelled = false;

    async function loadAndRender() {
      try {
        const data = await fetchIntelInfrastructure();
        if (cancelled || !viewer || !Cesium) return;

        for (const f of data.infrastructure ?? []) {
          if (!Number.isFinite(f.lat) || !Number.isFinite(f.lng)) continue;
          const color = statusColor(f.status);
          const entity = viewer.entities.add({
            id: `nuclear-${f.id}`,
            name: f.name,
            position: Cesium.Cartesian3.fromDegrees(f.lng, f.lat, 5),
            billboard: {
              image: buildIcon(color),
              scale: 1.0,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            },
            label: {
              text: f.name,
              font: "9px sans-serif",
              fillColor: Cesium.Color.fromCssColorString(color),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -16),
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              // Only show label once the camera is zoomed in enough.
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 5_000_000),
            },
            description: buildPopup(f),
          });
          (entityGroupsRef.current.nuclearInfrastructure as Array<{ id: string }>).push(entity);
        }
      } catch (err) {
        logger.swallow("cesium-layers:nuclear-fetch", err, "warn");
      }
    }

    loadAndRender();
    return () => {
      cancelled = true;
    };
  }, [layers.nuclearInfrastructure, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
