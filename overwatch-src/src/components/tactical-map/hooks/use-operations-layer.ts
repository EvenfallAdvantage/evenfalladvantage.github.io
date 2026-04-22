import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { escapeHtml } from "@/lib/security";
import { createPinCanvas } from "../pin-canvas";
import type { OperationPin } from "../types";
import type { OperationDocument } from "@/types/operations";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useOperationsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  operations: OperationPin[];
  eventDocs: Record<string, OperationDocument[]>;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations, eventDocs } = params;

  // ─── Plot Operations ─────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.operations ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
    });
    entityGroupsRef.current.operations = [];

    if (!layers.operations) return;

    operations.forEach((op) => {
      const color = op.status === "active" ? Cesium.Color.LIME
        : op.status === "upcoming" || op.status === "draft" ? Cesium.Color.DODGERBLUE
        : Cesium.Color.GRAY;

      const entity = viewer.entities.add({
        id: `op-${op.id}`,
        name: op.name,
        position: Cesium.Cartesian3.fromDegrees(op.lng, op.lat),
        billboard: {
          image: createPinCanvas(color.toCssColorString(), "flag"),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scale: 0.7,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: op.name,
          font: "12px monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          fillColor: Cesium.Color.WHITE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -40),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          // Operations labels always visible — key info at any zoom level
        },
        description: `<div style="font-family:monospace;font-size:11px;line-height:1.7">
          <b>${escapeHtml(op.name)}</b>
          <div style="margin:4px 0"><span style="color:${color.toCssColorString()};font-weight:bold;padding:1px 6px;border-radius:3px;background:${color.toCssColorString()}22">${escapeHtml(op.status.toUpperCase())}</span></div>
          ${op.location ? `<div style="opacity:0.7;font-size:10px">📍 ${escapeHtml(op.location)}</div>` : ""}
          ${op.startDate ? `<div style="opacity:0.6;font-size:10px">📅 ${new Date(op.startDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>` : ""}
          ${op.shiftCount ? `<div style="opacity:0.6;font-size:10px">👥 ${op.shiftCount} shift${op.shiftCount !== 1 ? "s" : ""}</div>` : ""}
          ${op.geofenceRadius ? `<div style="opacity:0.5;font-size:10px">⊙ ${op.geofenceRadius}m geofence</div>` : ""}
          ${op.siteMapUrl ? `<div style="opacity:0.5;font-size:10px">🗺 Site map available</div>` : ""}
          ${(() => {
            const docs = eventDocs[op.id] ?? [];
            if (docs.length === 0) return `<div style="opacity:0.3;font-size:9px;margin-top:6px">No documents yet</div>`;
            const docLabels: Record<string, string> = { intake: "📋 Intake", warno: "⚠️ WARNO", opord: "📑 OPORD", frago: "🔄 FRAGO", gotwa: "🎯 GOTWA" };
            return `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${docs.map(d =>
              `<span style="cursor:pointer;display:inline-block;padding:2px 8px;background:${d.status === "issued" ? "#22c55e22" : "#f59e0b22"};border:1px solid ${d.status === "issued" ? "#22c55e44" : "#f59e0b44"};border-radius:5px;color:${d.status === "issued" ? "#4ade80" : "#fbbf24"};font-size:9px;font-weight:600" onclick="window.__openOpDoc&&window.__openOpDoc('${op.id}','${d.doc_type}')">${docLabels[d.doc_type] || d.doc_type.toUpperCase()}</span>`
            ).join("")}</div>`;
          })()}
        </div>`,
      });
      entityGroupsRef.current.operations.push(entity);

      if (op.geofenceRadius && op.geofenceRadius > 0 && layers.geofences) {
        const gfEntity = viewer.entities.add({
          id: `gf-${op.id}`,
          position: Cesium.Cartesian3.fromDegrees(op.lng, op.lat),
          ellipse: {
            semiMajorAxis: op.geofenceRadius,
            semiMinorAxis: op.geofenceRadius,
            material: color.withAlpha(0.12),
            outline: true,
            outlineColor: color.withAlpha(0.5),
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        entityGroupsRef.current.operations.push(gfEntity);
      }
    });
  }, [operations, layers.operations, layers.geofences, loading, eventDocs, viewerRef, cesiumRef, entityGroupsRef]);
}
