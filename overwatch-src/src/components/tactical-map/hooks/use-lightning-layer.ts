/**
 * Lightning — NOAA/NWS nowCOAST 15-minute lightning strike density (WMS).
 *
 * Replaces the Blitzortung / LightningMaps.org websocket feed, whose terms
 * forbid commercial use, storm-warning use and direct server access. The
 * nowCOAST product is a NOAA-published density grid (~8 km) derived from
 * Vaisala NLDN/GLD360 that NOAA permits to be redistributed; it covers the
 * Americas and Pacific. Shown under the "Severe Weather" toggle as before.
 *
 * Rendered as one imagery layer (no per-strike entities), refreshed every
 * 5 minutes on the 15-minute product cadence. In Time Machine replay the WMS
 * `time` dimension is used for the last few hours nowCOAST keeps.
 */
import { useEffect } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import {
  lightningCacheKey, NOWCOAST_LIGHTNING_CREDIT, NOWCOAST_LIGHTNING_LAYER,
  NOWCOAST_LIGHTNING_STYLE, NOWCOAST_LIGHTNING_WMS,
} from "@/lib/map/basemap-sources";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const REFRESH_MS = 5 * 60_000;
/** nowCOAST keeps roughly the last 4 hours of 15-min density frames. */
const REPLAY_HORIZON_MS = 4 * 3_600_000;

function currentTimestamp() { return Date.now(); }

export function lightningWmsTime(replayMs: number | null, now: number = Date.now()): string | undefined {
  if (replayMs == null || now - replayMs > REPLAY_HORIZON_MS) return undefined;
  return lightningCacheKey(new Date(replayMs)).replace(".000Z", "Z");
}

export function useLightningLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5_000;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const remove = () => {
      const l = entityGroupsRef.current.lightningLayer;
      if (l) {
        try { viewer.imageryLayers.remove(l, true); } catch (e) { logger.swallow("cesium-layers:lightning-remove", e); }
        entityGroupsRef.current.lightningLayer = null;
      }
    };
    remove();
    if (!layers.lightning) return;

    const add = () => {
      try {
        const time = isReplaying ? lightningWmsTime(debouncedReplayTime) : undefined;
        if (isReplaying && !time) { remove(); return; } // older than nowCOAST keeps
        const provider = new Cesium.WebMapServiceImageryProvider({
          url: NOWCOAST_LIGHTNING_WMS,
          layers: NOWCOAST_LIGHTNING_LAYER,
          parameters: {
            service: "WMS", version: "1.3.0", styles: NOWCOAST_LIGHTNING_STYLE,
            format: "image/png", transparent: true,
            // Cache-key on the 15-min cadence (or the replay frame).
            ...(time ? { time } : { _t: lightningCacheKey() }),
          },
          credit: new Cesium.Credit(NOWCOAST_LIGHTNING_CREDIT, false),
          maximumLevel: 9,
        });
        remove();
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.85;
        entityGroupsRef.current.lightningLayer = layer;
        viewer.scene.requestRender();
      } catch (err) {
        logger.swallow("cesium-layers:lightning-add", err, "warn");
      }
    };

    add();
    const stop = isReplaying ? () => {} : setVisibleInterval(add, REFRESH_MS);
    return () => { stop(); remove(); };
  }, [layers.lightning, loading, viewerRef, cesiumRef, entityGroupsRef, isReplaying, debouncedReplayTime]);
}
