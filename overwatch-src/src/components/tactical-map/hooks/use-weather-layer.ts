/**
 * Weather radar (US): NOAA/NWS nowCOAST MRMS base reflectivity, animated as a
 * short loop (desktop 7 frames / 60 min, phones 4 frames / 30 min). The loop
 * swaps layer opacity, so frames are fetched once and re-used. During a Time
 * Machine replay it shows the single frame nearest the replay time (nowCOAST
 * keeps ~4 h). Replaces the Iowa State Mesonet tiles.
 */

import { useEffect, useRef } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import { NOWCOAST_RADAR_CREDIT, NOWCOAST_RADAR_LAYER, NOWCOAST_RADAR_WMS, loopDelayMs, radarFrameTimes, radarReplayTime } from "@/lib/map/nowcoast";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef } from "./cesium-layer-types";

function currentTimestamp() { return Date.now(); }

const REFRESH_MS = 5 * 60_000;
const RADAR_ALPHA = 0.65;

export function useWeatherLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  loading: boolean;
  layers: LayerVisibility;
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const framesRef = useRef<any[]>([]);
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const removeFrames = () => {
      for (const l of framesRef.current) {
        try { viewer.imageryLayers.remove(l, true); } catch (e) { logger.swallow("cesium-layers:radar-remove", e, "debug"); }
      }
      framesRef.current = [];
    };
    removeFrames();
    if (!layers.weather) return;

    const addFrame = (time: string, alpha: number) => {
      const provider = new Cesium.WebMapServiceImageryProvider({
        url: NOWCOAST_RADAR_WMS,
        layers: NOWCOAST_RADAR_LAYER,
        parameters: { service: "WMS", version: "1.3.0", format: "image/png", transparent: true, time },
        credit: new Cesium.Credit(NOWCOAST_RADAR_CREDIT, false),
        maximumLevel: 10,
      });
      const layer = viewer.imageryLayers.addImageryProvider(provider);
      layer.alpha = alpha;
      return layer;
    };

    if (isReplaying) {
      const t = radarReplayTime(debouncedReplayTime);
      if (t) framesRef.current = [addFrame(t, RADAR_ALPHA)];
      viewer.scene.requestRender();
      return removeFrames;
    }

    let timer: ReturnType<typeof setTimeout> | null = null;
    let idx = 0;
    const count = isConstrainedDevice() ? 4 : 7;

    const build = () => {
      const prev = framesRef.current;
      try {
        framesRef.current = radarFrameTimes(Date.now(), count).map((t, i) => addFrame(t, i === count - 1 ? RADAR_ALPHA : 0));
        idx = count - 1;
      } catch (e) { logger.swallow("cesium-layers:radar-add", e, "warn"); }
      for (const l of prev) {
        try { viewer.imageryLayers.remove(l, true); } catch (e) { logger.swallow("cesium-layers:radar-remove", e, "debug"); }
      }
      viewer.scene.requestRender();
    };

    const tick = () => {
      const frames = framesRef.current;
      if (frames.length > 1 && !document.hidden) {
        frames[idx].alpha = 0;
        idx = (idx + 1) % frames.length;
        frames[idx].alpha = RADAR_ALPHA;
        viewer.scene.requestRender();
      }
      timer = setTimeout(tick, loopDelayMs(idx, framesRef.current.length || 1));
    };

    build();
    timer = setTimeout(tick, loopDelayMs(idx, count));
    const stop = setVisibleInterval(build, REFRESH_MS);
    return () => {
      if (timer) clearTimeout(timer);
      stop();
      removeFrames();
    };
  }, [layers.weather, viewerRef, cesiumRef, isReplaying, debouncedReplayTime, loading]);
}
