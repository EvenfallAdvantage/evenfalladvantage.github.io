import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { escapeHtml } from "@/lib/security";
import { createPinCanvas, parseIncidentNarrative } from "../pin-canvas";
import type { IncidentPin } from "../types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useIncidentsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  incidents: IncidentPin[];
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, incidents } = params;

  // ─── Plot Incidents ──────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.incidents ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
    });
    entityGroupsRef.current.incidents = [];
    if (!layers.incidents) return;

    incidents.forEach((inc) => {
      const color = inc.severity === "critical" ? "#ef4444"
        : inc.severity === "high" ? "#f97316"
        : inc.severity === "medium" ? "#eab308" : "#6b7280";

      const entity = viewer.entities.add({
        id: `inc-${inc.id}`,
        name: inc.title,
        position: Cesium.Cartesian3.fromDegrees(inc.lng, inc.lat, 5),
        billboard: {
          image: createPinCanvas(color, "alert"),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scale: 0.55,
          heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
          // Always render through buildings at venue scale (camera < 500 km).
          // Beyond that, depth-test against the globe so far-side pins are
          // hidden when viewing the whole earth.
          disableDepthTestDistance: 500_000,
        },
        description: (() => {
          const narrative = parseIncidentNarrative(inc.description ?? "");
          const numberLine = inc.incidentNumber
            ? `<div style="opacity:0.55;font-size:10px;font-weight:bold;margin-bottom:2px">${escapeHtml(inc.incidentNumber)}</div>`
            : "";
          const priorityChip = inc.priority
            ? ` <span style="opacity:0.7;font-size:10px;padding:1px 4px;border-radius:3px;background:rgba(100,100,120,0.15)">PRIO: ${escapeHtml(inc.priority.toUpperCase())}</span>`
            : "";
          const teamLine = inc.teamName
            ? `<div style="margin:4px 0"><span style="font-weight:bold;padding:1px 6px;border-radius:3px;background:${inc.teamColor || "#6366f1"}33;color:${inc.teamColor || "#6366f1"}">TEAM: ${escapeHtml(inc.teamName)}</span></div>`
            : "";
          return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
            ${numberLine}
            <b>${escapeHtml(inc.title)}</b>
            <div style="margin:4px 0"><span style="color:${color};font-weight:bold;padding:1px 6px;border-radius:3px;background:${color}22">${escapeHtml(inc.severity.toUpperCase())}</span> <span style="opacity:0.6">${escapeHtml(inc.status.toUpperCase())}</span>${priorityChip}</div>
            ${teamLine}
            ${narrative ? `<div style="opacity:0.85;margin:4px 0">${escapeHtml(narrative)}</div>` : ""}
            ${inc.location ? `<div style="opacity:0.5;font-size:10px">📍 ${escapeHtml(inc.location)}</div>` : ""}
            ${inc.reportedBy ? `<div style="opacity:0.5;font-size:10px">👤 ${escapeHtml(inc.reportedBy)}${inc.assignedTo ? ` → ${escapeHtml(inc.assignedTo)}` : ""}</div>` : ""}
            <div style="opacity:0.3;font-size:9px;margin-top:4px">${new Date(inc.createdAt).toLocaleString()}</div>
          </div>`;
        })(),
      });
      entityGroupsRef.current.incidents.push(entity);
    });
  }, [incidents, layers.incidents, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
