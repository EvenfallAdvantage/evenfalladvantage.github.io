/**
 * Clouds: NOAA/NWS nowCOAST global infrared satellite mosaic (works day and
 * night). Refreshed every 30 minutes; hidden during Time Machine replay.
 */

import { useEffect } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { NOWCOAST_CLOUDS_CREDIT, NOWCOAST_CLOUDS_LAYER, NOWCOAST_SATELLITE_WMS } from "@/lib/map/nowcoast";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

function currentTimestamp() { return Date.now(); }
const REFRESH_MS = 30 * 60_000;

export function useCloudsLayer(params: {
  viewerRef: CesiumRef; cesiumRef: CesiumRef; entityGroupsRef: EntityGroupsRef; loading: boolean;
  layers: LayerVisibility; debouncedReplayTime: number; timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;
    const remove = () => {
      const l = entityGroupsRef.current.cloudsLayer;
      if (l) { try { viewer.imageryLayers.remove(l, true); } catch (e) { logger.swallow("cesium-layers:clouds-remove", e, "debug"); } }
      entityGroupsRef.current.cloudsLayer = null;
    };
    remove();
    if (!layers.clouds || isReplaying) return;
    const add = () => {
      try {
        const provider = new Cesium.WebMapServiceImageryProvider({
          url: NOWCOAST_SATELLITE_WMS,
          layers: NOWCOAST_CLOUDS_LAYER,
          parameters: { service: "WMS", version: "1.3.0", format: "image/png", transparent: true, _t: Math.floor(Date.now() / REFRESH_MS) },
          credit: new Cesium.Credit(NOWCOAST_CLOUDS_CREDIT, false),
          maximumLevel: 8,
        });
        remove();
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.45;
        entityGroupsRef.current.cloudsLayer = layer;
        viewer.scene.requestRender();
      } catch (e) { logger.swallow("cesium-layers:clouds-add", e, "warn"); }
    };
    add();
    const stop = setVisibleInterval(add, REFRESH_MS);
    return () => { stop(); remove(); };
  }, [layers.clouds, isReplaying, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
