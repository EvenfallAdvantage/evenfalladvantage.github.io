import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import type { MapAnnotation } from "@/lib/supabase/db-annotations";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useAnnotationsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  annotations: MapAnnotation[];
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, annotations } = params;

  // Render annotations on the globe
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.annotations ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
    });
    entityGroupsRef.current.annotations = [];

    if (!layers.annotations) return;

    annotations.forEach(ann => {
      const color = Cesium.Color.fromCssColorString(ann.color).withAlpha(0.8);
      if ((ann.type === "line" || ann.type === "arrow" || ann.type === "freehand") && ann.geometry.positions.length >= 2) {
        const positions = ann.geometry.positions.flatMap(([lng, lat]: [number, number]) => [lng, lat]);
        const entity = viewer.entities.add({
          id: `ann-${ann.id}`,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(positions),
            width: ann.type === "arrow" ? 12 : 3,
            material: ann.type === "arrow"
              ? new Cesium.PolylineArrowMaterialProperty(color)
              : color,
            clampToGround: true,
          },
        });
        entityGroupsRef.current.annotations.push(entity);
      } else if (ann.type === "polygon" && ann.geometry.positions.length >= 3) {
        const hierarchy = Cesium.Cartesian3.fromDegreesArray(
          ann.geometry.positions.flatMap(([lng, lat]: [number, number]) => [lng, lat])
        );
        const entity = viewer.entities.add({
          id: `ann-${ann.id}`,
          polygon: {
            hierarchy,
            material: color.withAlpha(0.2),
            outline: true,
            outlineColor: color,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        entityGroupsRef.current.annotations.push(entity);
      } else if (ann.type === "circle" && ann.geometry.positions.length >= 1 && ann.geometry.radius) {
        const [lng, lat] = ann.geometry.positions[0];
        const entity = viewer.entities.add({
          id: `ann-${ann.id}`,
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          ellipse: {
            semiMajorAxis: ann.geometry.radius,
            semiMinorAxis: ann.geometry.radius,
            material: color.withAlpha(0.15),
            outline: true,
            outlineColor: color,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        entityGroupsRef.current.annotations.push(entity);
      } else if (ann.type === "text" && ann.geometry.positions.length >= 1 && ann.label) {
        const [lng, lat] = ann.geometry.positions[0];
        const entity = viewer.entities.add({
          id: `ann-${ann.id}`,
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          label: {
            text: ann.label,
            font: "bold 14px monospace",
            fillColor: color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        entityGroupsRef.current.annotations.push(entity);
      }
    });
  }, [annotations, layers.annotations, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
