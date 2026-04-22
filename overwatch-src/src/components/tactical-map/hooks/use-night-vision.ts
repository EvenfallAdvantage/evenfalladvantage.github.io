import { useEffect } from "react";
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

  // ─── Night Vision Mode ───────────────────────────────
  // Swaps to a dark basemap (CartoDB Dark Matter) and styles 3D buildings
  // with green outlines for a tactical night-ops aesthetic.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Delay slightly on initial load to ensure Cesium base imagery layers
    // are fully initialized before we try to toggle them.
    const timerId = setTimeout(() => {
      if (!viewerRef.current || !cesiumRef.current) return;

      // Remove existing dark basemap layer
      if (entityGroupsRef.current.nvDarkLayer) {
        try { viewer.imageryLayers.remove(entityGroupsRef.current.nvDarkLayer, false); } catch (e) { logger.swallow("cesium-layers:remove-nv-dark", e); }
        entityGroupsRef.current.nvDarkLayer = null;
      }

      const buildings = entityGroupsRef.current.buildings?.[0];

      if (!layers.nightVision) {
        // Restore: show all base imagery layers, reset building style
        for (let i = 0; i < viewer.imageryLayers.length; i++) {
          viewer.imageryLayers.get(i).show = true;
        }
        if (buildings) {
          buildings.style = undefined;
        }
        viewer.scene.globe.enableLighting = false;
        return;
      }

      // Hide ALL existing base imagery layers (satellite + OSM)
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
      // Hide all other layers again (the add may have shifted indices)
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
