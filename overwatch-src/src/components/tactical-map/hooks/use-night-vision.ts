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

    // Remove existing dark basemap layer
    if (entityGroupsRef.current.nvDarkLayer) {
      try { viewer.imageryLayers.remove(entityGroupsRef.current.nvDarkLayer, false); } catch (e) { logger.swallow("cesium-layers:remove-nv-dark", e); }
      entityGroupsRef.current.nvDarkLayer = null;
    }

    // Restore default building style
    const buildings = entityGroupsRef.current.buildings?.[0];

    if (!layers.nightVision) {
      // Restore: show base imagery, reset building style
      const baseLayer = viewer.imageryLayers.get(0);
      if (baseLayer) baseLayer.show = true;
      if (buildings) {
        // eslint-disable-next-line react-hooks/immutability -- mutating the 3D tileset style on the ref-stored instance is intentional
        buildings.style = undefined;
      }
      viewer.scene.globe.enableLighting = false;
      return;
    }

    // Hide the default satellite/street base imagery
    const baseLayer = viewer.imageryLayers.get(0);
    if (baseLayer) baseLayer.show = false;
    // Also hide OSM layer if active
    const osmRef = entityGroupsRef.current.osmLayerRef;
    if (osmRef?.[0]) osmRef[0].show = false;

    // Add CartoDB Dark Matter tiles as the base
    const darkProvider = new Cesium.UrlTemplateImageryProvider({
      url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      credit: "CartoDB Dark Matter",
      minimumLevel: 0,
      maximumLevel: 18,
    });
    const darkLayer = viewer.imageryLayers.addImageryProvider(darkProvider, 0);
    darkLayer.alpha = 1.0;
    entityGroupsRef.current.nvDarkLayer = darkLayer;

    // Style 3D buildings: dark fill with neon green edges
    // Using a very low-alpha bright green — the building faces render
    // semi-transparent while edges (where multiple faces overlap at
    // geometry seams) accumulate to a brighter neon green outline effect.
    if (buildings) {
      buildings.style = new Cesium.Cesium3DTileStyle({
        color: "color('rgba(0, 255, 65, 0.15)')",
        show: true,
      });
    }

    // Enable silhouette-like effect via scene lighting
    viewer.scene.globe.enableLighting = true;
  }, [layers.nightVision, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
