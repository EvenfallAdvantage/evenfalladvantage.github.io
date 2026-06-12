import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef } from "./cesium-layer-types";

function currentTimestamp() { return Date.now(); }

export function useLightningLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  loading: boolean;
  layers: LayerVisibility;
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;

  const lightningLayerRef = useRef<unknown>(null);

  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    if (lightningLayerRef.current) {
      viewer.imageryLayers.remove(lightningLayerRef.current as never, false);
      lightningLayerRef.current = null;
    }
    if (!layers.eonetWeather || isReplaying) return;

    try {
      const boltProvider = new Cesium.UrlTemplateImageryProvider({
        url: "https://tiles.blitzortung.org/Tiles/01/{z}/{x}/{y}.png",
        credit: "Blitzortung.org",
        minimumLevel: 0,
        maximumLevel: 18,
      });
      const layer = viewer.imageryLayers.addImageryProvider(boltProvider);
      layer.alpha = 0.55;
      lightningLayerRef.current = layer;
    } catch (e) {
      logger.swallow("cesium-layers:lightning", e);
    }

    return () => {
      if (lightningLayerRef.current) {
        try { viewer.imageryLayers.remove(lightningLayerRef.current as never, false); } catch { /* ok */ }
        lightningLayerRef.current = null;
      }
    };
  }, [layers.eonetWeather, loading, viewerRef, cesiumRef, isReplaying]);
}
