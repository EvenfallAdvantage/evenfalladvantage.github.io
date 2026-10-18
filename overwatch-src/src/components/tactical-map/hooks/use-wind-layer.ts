/**
 * Wind: NOAA/NWS observed surface wind barbs (knots) from the NWS
 * surface_obs MapServer. Hourly observations; refreshed every 20 minutes.
 * (Animated model wind is deferred: free commercial-OK sources need GRIB2.)
 */

import { useEffect } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { NWS_WIND_CREDIT, NWS_WIND_LAYER, NWS_WIND_MAPSERVER } from "@/lib/map/nowcoast";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

function currentTimestamp() { return Date.now(); }
const REFRESH_MS = 20 * 60_000;

export function useWindLayer(params: {
  viewerRef: CesiumRef; cesiumRef: CesiumRef; entityGroupsRef: EntityGroupsRef; loading: boolean;
  layers: LayerVisibility; debouncedReplayTime: number; timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;
    let cancelled = false;
    const remove = () => {
      const l = entityGroupsRef.current.windLayer;
      if (l) { try { viewer.imageryLayers.remove(l, true); } catch (e) { logger.swallow("cesium-layers:wind-remove", e, "debug"); } }
      entityGroupsRef.current.windLayer = null;
    };
    remove();
    if (!layers.wind || isReplaying) return;
    const add = async () => {
      try {
        const provider = await Cesium.ArcGisMapServerImageryProvider.fromUrl(NWS_WIND_MAPSERVER, {
          layers: NWS_WIND_LAYER,
          enablePickFeatures: false,
          credit: new Cesium.Credit(NWS_WIND_CREDIT, false),
          // Request the dynamic export (not cached tiles) so barbs are current.
          usePreCachedTilesIfAvailable: false,
        });
        if (cancelled) return;
        remove();
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.9;
        entityGroupsRef.current.windLayer = layer;
        viewer.scene.requestRender();
      } catch (e) { logger.swallow("cesium-layers:wind-add", e, "warn"); }
    };
    void add();
    const stop = setVisibleInterval(() => void add(), REFRESH_MS);
    return () => { cancelled = true; stop(); remove(); };
  }, [layers.wind, isReplaying, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
