import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { createPinCanvas } from "../pin-canvas";
import { getNearbyPOIs, type NearbyPOI } from "../env-intel";
import type { OperationPin } from "../types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function usePoiLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  operations: OperationPin[];
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations } = params;

  const [nearbyPOIs, setNearbyPOIs] = useState<NearbyPOI[]>([]);

  // ─── Nearby POIs (hospitals, police, fire stations) ─
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.pois ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
    });
    entityGroupsRef.current.pois = [];

    if (!layers.nearbyPOIs || operations.length === 0) return;

    // Fetch POIs near the first operation with coordinates
    const op = operations.find(o => o.lat && o.lng);
    if (!op) return;

    getNearbyPOIs(op.lat, op.lng, 5000).then(pois => {
      setNearbyPOIs(pois);
      const poiColors: Record<string, string> = {
        hospital: "#ef4444",
        police: "#3b82f6",
        fire_station: "#f97316",
        pharmacy: "#22c55e",
      };
      pois.forEach((poi, i) => {
        const color = poiColors[poi.type] || "#6b7280";
        const entity = viewer.entities.add({
          id: `poi-${poi.id || i}`,
          name: poi.name,
          position: Cesium.Cartesian3.fromDegrees(poi.lng, poi.lat),
          billboard: {
            image: createPinCanvas(color, "alert"),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 0.45,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: poi.name,
            font: "9px monospace",
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            fillColor: Cesium.Color.fromCssColorString(color),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -28),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scale: 0.8,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000),
          },
          description: `<b>${poi.name}</b><br/>Type: ${poi.type.replace("_", " ")}`,
        });
        entityGroupsRef.current.pois.push(entity);
      });
    }).catch(() => {});
  }, [operations, layers.nearbyPOIs, loading, viewerRef, cesiumRef, entityGroupsRef]);

  return { nearbyPOIs };
}
