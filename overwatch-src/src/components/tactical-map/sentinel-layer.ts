/**
 * Sentinel Satellite Imagery Layers
 *
 * Provides Sentinel-1 (SAR radar) and Sentinel-2 (optical) imagery
 * as Cesium imagery layers via free Copernicus WMS endpoints.
 *
 * - Sentinel-1: C-band SAR — sees through clouds, works at night
 * - Sentinel-2: True-color optical — 10m resolution, updated every 5 days
 *
 * Data source: Copernicus Open Access Hub / Sentinel Hub WMS (free tier)
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumRef = any;

/**
 * Add Sentinel-1 SAR imagery layer to the Cesium viewer.
 * Uses the Copernicus Sentinel Hub WMS (free, no account needed).
 */
export function addSentinel1Layer(viewer: CesiumRef, Cesium: CesiumRef): CesiumRef {
  // Sentinel-1 IW GRD (Ground Range Detected) — VV polarization
  // Using the free WMS endpoint from Sentinel Hub's public instances
  const provider = new Cesium.WebMapServiceImageryProvider({
    url: "https://services.sentinel-hub.com/ogc/wms/cd280189-7c51-45a6-ab05-f96a76067710",
    layers: "SENTINEL-1-IW-DV-VV",
    parameters: {
      transparent: true,
      format: "image/png",
      time: getRecentDateRange(12), // Last 12 days
      maxcc: 100,
    },
    credit: "Copernicus Sentinel-1 / ESA",
  });

  const layer = viewer.imageryLayers.addImageryProvider(provider);
  layer.alpha = 0.7;
  return layer;
}

/**
 * Add Sentinel-2 optical imagery layer to the Cesium viewer.
 * True-color composite (B4/B3/B2) at 10m resolution.
 */
export function addSentinel2Layer(viewer: CesiumRef, Cesium: CesiumRef): CesiumRef {
  const provider = new Cesium.WebMapServiceImageryProvider({
    url: "https://services.sentinel-hub.com/ogc/wms/cd280189-7c51-45a6-ab05-f96a76067710",
    layers: "TRUE-COLOR-S2L2A",
    parameters: {
      transparent: false,
      format: "image/png",
      time: getRecentDateRange(30), // Last 30 days
      maxcc: 20, // Max 20% cloud cover
    },
    credit: "Copernicus Sentinel-2 / ESA",
  });

  const layer = viewer.imageryLayers.addImageryProvider(provider);
  layer.alpha = 0.85;
  return layer;
}

/**
 * Generate a date range string for Sentinel Hub WMS (ISO format).
 * Returns "YYYY-MM-DD/YYYY-MM-DD" for the last N days.
 */
function getRecentDateRange(daysBack: number): string {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return `${start.toISOString().split("T")[0]}/${end.toISOString().split("T")[0]}`;
}
