/**
 * City lights at night (NASA Black Marble via GIBS). The layer's dayAlpha is
 * 0 and nightAlpha 1, so with globe lighting on it shows only on the night
 * side of the terminator. Inserted just above the basemap so weather and
 * other overlays still draw over it. One static tile set (max zoom 8); cheap
 * enough for phones.
 */
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { aboveBasemapIndex, BLACK_MARBLE_CREDIT, BLACK_MARBLE_MAX_LEVEL, BLACK_MARBLE_URL } from "@/lib/map/city-lights";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useCityLights(params: { viewerRef: CesiumRef; cesiumRef: CesiumRef; entityGroupsRef: EntityGroupsRef; loading: boolean; layers: LayerVisibility }) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers } = params;
  useEffect(() => {
    const viewer = viewerRef.current;
    const C = cesiumRef.current;
    if (!viewer || !C || loading || !layers.cityLights) return;
    let layer: unknown = null;
    const groups = entityGroupsRef.current;
    // Cesium fades night imagery and lighting out when the camera is close
    // (defaults: below ~10,000 km). Keep the night side dark with lights at every zoom
    // while this is on; restore Cesium's defaults afterwards.
    const globe = viewer.scene.globe;
    const fade = { a: globe.nightFadeOutDistance, b: globe.nightFadeInDistance, c: globe.lightingFadeOutDistance, d: globe.lightingFadeInDistance };
    Object.assign(globe, { nightFadeOutDistance: 1, nightFadeInDistance: 2, lightingFadeOutDistance: 1, lightingFadeInDistance: 2 });
    try {
      const provider = new C.WebMapTileServiceImageryProvider({
        url: BLACK_MARBLE_URL,
        layer: "VIIRS_Black_Marble",
        style: "default",
        format: "image/png",
        tileMatrixSetID: `GoogleMapsCompatible_Level${BLACK_MARBLE_MAX_LEVEL}`,
        maximumLevel: BLACK_MARBLE_MAX_LEVEL,
        tilingScheme: new C.WebMercatorTilingScheme(),
        credit: new C.Credit(BLACK_MARBLE_CREDIT, false),
      });
      const coll = viewer.imageryLayers;
      const base = ([...(groups.baseImagery ?? []), ...(groups.osmLayerRef ?? [])] as unknown[]).map((l) => coll.indexOf(l));
      const l = new C.ImageryLayer(provider, { dayAlpha: 0, nightAlpha: 1, brightness: 4.5, gamma: 0.6, contrast: 1.4 });
      coll.add(l, aboveBasemapIndex(coll.length, base));
      layer = l;
      groups.cityLightsLayer = l;
      viewer.scene.requestRender();
    } catch (e) { logger.swallow("cesium-layers:city-lights-add", e, "warn"); }
    return () => {
      if (layer) { try { viewer.imageryLayers.remove(layer, true); } catch (e) { logger.swallow("cesium-layers:city-lights-remove", e, "debug"); } }
      if (groups.cityLightsLayer === layer) groups.cityLightsLayer = null;
      Object.assign(globe, { nightFadeOutDistance: fade.a, nightFadeInDistance: fade.b, lightingFadeOutDistance: fade.c, lightingFadeInDistance: fade.d });
      viewer.scene?.requestRender?.();
    };
    // layers.satellite / basemap swaps: re-insert above the new basemap.
  }, [layers.cityLights, layers.satellite, layers.nightVision, layers.sentinel1, layers.sentinel2, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
