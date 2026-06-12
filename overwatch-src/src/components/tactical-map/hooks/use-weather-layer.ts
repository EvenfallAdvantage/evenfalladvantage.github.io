import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef } from "./cesium-layer-types";

function currentTimestamp() { return Date.now(); }

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
  const weatherLayerRef = useRef<any>(null);

  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    if (weatherLayerRef.current) {
      viewer.imageryLayers.remove(weatherLayerRef.current, false);
      weatherLayerRef.current = null;
    }
    if (!layers.weather || isReplaying) return;

    function addRadarLayer() {
      const v = viewerRef.current;
      const C = cesiumRef.current;
      if (!v || !C) return;

      if (weatherLayerRef.current) {
        v.imageryLayers.remove(weatherLayerRef.current, false);
        weatherLayerRef.current = null;
      }

      try {
        const radarProvider = new C.UrlTemplateImageryProvider({
          url: `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png?_t=${Date.now()}`,
          credit: "Iowa State Mesonet / NOAA NEXRAD",
          minimumLevel: 0,
          maximumLevel: 12,
        });
        const layer = v.imageryLayers.addImageryProvider(radarProvider);
        layer.alpha = 0.6;
        weatherLayerRef.current = layer;
      } catch {
        try {
          const weatherProvider = new C.WebMapServiceImageryProvider({
            url: "https://mapservices.weather.noaa.gov/eventdriven/services/radar/radar_base_reflectivity_time/MapServer/WMSServer",
            layers: "0",
            parameters: { transparent: true, format: "image/png" },
            credit: "NOAA/NWS",
          });
          const layer = v.imageryLayers.addImageryProvider(weatherProvider);
          layer.alpha = 0.5;
          weatherLayerRef.current = layer;
        } catch (e) { logger.swallow("cesium-layers:weather-refresh", e); }
      }
    }

    // Defer initial load so Cesium internals settle after loading state change
    const initialTimer = setTimeout(addRadarLayer, 0);

    const interval = setInterval(addRadarLayer, 300000);
    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [layers.weather, viewerRef, cesiumRef, isReplaying, loading]);
}
