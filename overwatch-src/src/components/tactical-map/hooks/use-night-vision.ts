import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useNightVision(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers } = params;

  // Track which imagery layers were visible before night mode was toggled on
  // so we can restore only those layers when night mode is turned off
  const savedLayerVisibility = useRef<boolean[]>([]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Delay slightly to ensure Cesium imagery layers are fully initialized
    const timerId = setTimeout(() => {
      if (!viewerRef.current || !cesiumRef.current) return;

      // Remove existing dark basemap layer
      if (entityGroupsRef.current.nvDarkLayer) {
        try { viewer.imageryLayers.remove(entityGroupsRef.current.nvDarkLayer, false); } catch (e) { logger.swallow("cesium-layers:remove-nv-dark", e); }
        entityGroupsRef.current.nvDarkLayer = null;
      }

      const buildings = entityGroupsRef.current.buildings?.[0];

      if (!layers.nightVision) {
        // Restore only the layers that were visible before night mode
        const saved = savedLayerVisibility.current;
        for (let i = 0; i < viewer.imageryLayers.length; i++) {
          // If we have saved state, use it; otherwise default to showing the base layer only
          viewer.imageryLayers.get(i).show = saved.length > i ? saved[i] : (i === 0);
        }
        savedLayerVisibility.current = [];
        if (buildings) {
          buildings.style = undefined;
        }
        viewer.scene.globe.enableLighting = false;
        return;
      }

      // Save current layer visibility state BEFORE hiding anything
      savedLayerVisibility.current = [];
      for (let i = 0; i < viewer.imageryLayers.length; i++) {
        savedLayerVisibility.current.push(viewer.imageryLayers.get(i).show);
      }

      // Hide ALL existing imagery layers
      for (let i = 0; i < viewer.imageryLayers.length; i++) {
        viewer.imageryLayers.get(i).show = false;
      }

      // Add CartoDB Dark Matter tiles as the sole basemap
      const darkProvider = new Cesium.UrlTemplateImageryProvider({
        url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
        credit: "CartoDB Dark Matter",
        minimumLevel: 0,
        maximumLevel: 18,
      });
      const darkLayer = viewer.imageryLayers.addImageryProvider(darkProvider, 0);
      darkLayer.alpha = 1.0;
      // Ensure the dark layer is the only visible one
      for (let i = 1; i < viewer.imageryLayers.length; i++) {
        viewer.imageryLayers.get(i).show = false;
      }
      entityGroupsRef.current.nvDarkLayer = darkLayer;

      // Style 3D buildings with neon green edges
      if (buildings) {
        buildings.style = new Cesium.Cesium3DTileStyle({
          color: "color('rgba(0, 255, 65, 0.15)')",
          show: true,
        });
      }

      viewer.scene.globe.enableLighting = true;
    }, 300);

    return () => clearTimeout(timerId);
  }, [layers.nightVision, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
