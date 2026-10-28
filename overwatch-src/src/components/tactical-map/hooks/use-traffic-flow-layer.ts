/**
 * Live Traffic Flow imagery overlay (TomTom Traffic Flow Tiles v4, relative0-dark).
 *
 * Renders colour-coded road congestion speeds (green = free flow, yellow = slow,
 * orange = heavy, red = standstill/closed) from regional zoom (z >= 6) down to
 * street level (z <= 18).
 *
 * Uses `NEXT_PUBLIC_TOMTOM_API_KEY` directly when configured, or falls back to
 * the `intel-traffic` Edge Function tile proxy (`?tile={z}/{x}/{y}`).
 */

import { useEffect, useRef } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { trafficFlowTileUrlTemplate } from "@/lib/intel-client";
import { INTEL_LAYER_FLAGS } from "@/lib/intel-feature-flags";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef } from "./cesium-layer-types";

export const TRAFFIC_FLOW_MIN_ZOOM = 6;
export const TRAFFIC_FLOW_MAX_ZOOM = 18;
export const TRAFFIC_FLOW_ALPHA = 0.85;
export const TRAFFIC_FLOW_CREDIT = "Traffic flow © TomTom";
const REFRESH_MS = 3 * 60_000;

function currentTimestamp() {
  return Date.now();
}

export function useTrafficFlowLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  loading: boolean;
  layers: LayerVisibility;
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const layerRef = useRef<any>(null);
  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const removeLayer = () => {
      if (layerRef.current) {
        try {
          viewer.imageryLayers.remove(layerRef.current, true);
        } catch (e) {
          logger.swallow("cesium-layers:traffic-flow-remove", e, "debug");
        }
        layerRef.current = null;
      }
    };

    removeLayer();
    if (!layers.trafficFlow || isReplaying || !INTEL_LAYER_FLAGS.traffic_flow.enabled) {
      viewer.scene?.requestRender?.();
      return;
    }

    const addLayer = (bustCache = false) => {
      removeLayer();
      try {
        const baseTemplate = trafficFlowTileUrlTemplate("relative0-dark");
        const url = bustCache
          ? `${baseTemplate}${baseTemplate.includes("?") ? "&" : "?"}_t=${Math.floor(Date.now() / 60_000)}`
          : baseTemplate;
        const provider = new Cesium.UrlTemplateImageryProvider({
          url,
          minimumLevel: TRAFFIC_FLOW_MIN_ZOOM,
          maximumLevel: TRAFFIC_FLOW_MAX_ZOOM,
          tileWidth: 256,
          tileHeight: 256,
          credit: new Cesium.Credit(TRAFFIC_FLOW_CREDIT, false),
        });
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = TRAFFIC_FLOW_ALPHA;
        layerRef.current = layer;
        viewer.scene?.requestRender?.();
      } catch (e) {
        logger.swallow("cesium-layers:traffic-flow-add", e, "warn");
      }
    };

    addLayer(false);
    const stop = setVisibleInterval(() => addLayer(true), REFRESH_MS);

    return () => {
      stop();
      removeLayer();
    };
  }, [layers.trafficFlow, viewerRef, cesiumRef, isReplaying, loading]);
}
