import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef } from "./cesium-layer-types";

export function useWeatherLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  loading: boolean;
  layers: LayerVisibility;
}) {
  const { viewerRef, cesiumRef, loading, layers } = params;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weatherLayerRef = useRef<any>(null);

  // ─── Weather Radar Layer ─────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    if (weatherLayerRef.current) {
      viewer.imageryLayers.remove(weatherLayerRef.current, false);
      weatherLayerRef.current = null;
    }
    if (!layers.weather) return;

    // Use Iowa State Mesonet NEXRAD radar tiles (reliable, free, no API key)
    // Falls back to NWS WMS if Mesonet is unavailable
    try {
      const radarProvider = new Cesium.UrlTemplateImageryProvider({
        url: "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png",
        credit: "Iowa State Mesonet / NOAA NEXRAD",
        minimumLevel: 0,
        maximumLevel: 12,
      });
      const layer = viewer.imageryLayers.addImageryProvider(radarProvider);
      layer.alpha = 0.6;
      weatherLayerRef.current = layer;
    } catch {
      // Fallback to NWS WMS
      const weatherProvider = new Cesium.WebMapServiceImageryProvider({
        url: "https://mapservices.weather.noaa.gov/eventdriven/services/radar/radar_base_reflectivity_time/MapServer/WMSServer",
        layers: "0",
        parameters: { transparent: true, format: "image/png" },
        credit: "NOAA/NWS",
      });
      const layer = viewer.imageryLayers.addImageryProvider(weatherProvider);
      layer.alpha = 0.5;
      weatherLayerRef.current = layer;
    }
  }, [layers.weather, loading, viewerRef, cesiumRef]);

  // ─── Weather Radar Auto-Refresh (every 5 min) ──────
  useEffect(() => {
    if (!layers.weather) return;
    const interval = setInterval(() => {
      const viewer = viewerRef.current;
      const Cesium = cesiumRef.current;
      if (!viewer || !Cesium) return;

      // Remove and re-add to force tile refresh with cache buster
      if (weatherLayerRef.current) {
        viewer.imageryLayers.remove(weatherLayerRef.current, false);
      }
      try {
        const radarProvider = new Cesium.UrlTemplateImageryProvider({
          url: `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png?_t=${Date.now()}`,
          credit: "Iowa State Mesonet / NOAA NEXRAD",
          minimumLevel: 0,
          maximumLevel: 12,
        });
        const layer = viewer.imageryLayers.addImageryProvider(radarProvider);
        layer.alpha = 0.6;
        weatherLayerRef.current = layer;
      } catch (e) { logger.swallow("cesium-layers:weather-refresh", e); }
    }, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [layers.weather, viewerRef, cesiumRef]);
}
