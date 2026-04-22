import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { escapeHtml } from "@/lib/security";
import { createPinCanvas } from "../pin-canvas";
import type { StaffPin } from "../types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useStaffLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  staff: StaffPin[];
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, staff } = params;

  // ─── Plot Staff Pins ──────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.staff ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
    });
    entityGroupsRef.current.staff = [];
    if (!layers.staff) return;

    staff.forEach((s) => {
      const entity = viewer.entities.add({
        id: `staff-${s.userId}`,
        name: s.name,
        position: Cesium.Cartesian3.fromDegrees(s.lng, s.lat),
        billboard: {
          image: createPinCanvas("#22d3ee", "person"),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scale: 0.6,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: s.name,
          font: "11px monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          fillColor: Cesium.Color.CYAN,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -36),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `<div style="font-family:monospace;font-size:12px;padding:8px">
          <strong>${escapeHtml(s.name)}</strong><br/>Role: ${escapeHtml(s.role)}<br/>
          Updated: ${new Date(s.updatedAt).toLocaleTimeString()}
          ${s.speed ? `<br/>Speed: ${(s.speed * 2.237).toFixed(1)} mph` : ""}
          ${s.heading ? `<br/>Heading: ${s.heading.toFixed(0)}&deg;` : ""}
          <br/><span style="cursor:pointer;display:inline-block;margin-top:6px;padding:3px 10px;background:#22d3ee22;border:1px solid #22d3ee44;border-radius:6px;color:#22d3ee;font-size:10px;font-weight:600" onclick="window.__openStaffDM&&window.__openStaffDM('${s.userId}','${escapeHtml(s.name)}')">💬 Message ${escapeHtml(s.name.split(" ")[0])}</span>
        </div>`,
      });
      entityGroupsRef.current.staff.push(entity);
    });
  }, [staff, layers.staff, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
