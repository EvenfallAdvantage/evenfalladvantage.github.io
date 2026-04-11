/**
 * Sentinel Satellite Imagery Layers
 *
 * Sentinel-2 cloudless: EOX free tiles (no auth needed)
 * Sentinel-1 SAR: Copernicus Data Space Ecosystem Sentinel Hub WMS
 *   - Requires free registration at dataspace.copernicus.eu
 *   - Set NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID env var
 *   - Falls back to grayscale Sentinel-2 if no instance ID configured
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumRef = any;

const SENTINEL_HUB_INSTANCE = process.env.NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID || "";

/**
 * Add Sentinel-2 cloudless mosaic layer (EOX — free, no auth).
 */
export function addSentinel2Layer(viewer: CesiumRef, Cesium: CesiumRef): CesiumRef {
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
    credit: "Sentinel-2 cloudless by EOX / Copernicus / ESA",
    minimumLevel: 0,
    maximumLevel: 14,
  });
  const layer = viewer.imageryLayers.addImageryProvider(provider);
  layer.alpha = 0.85;
  return layer;
}

/**
 * Add Sentinel-1 SAR imagery layer.
 * If SENTINEL_HUB_INSTANCE_ID is configured, uses real SAR data from CDSE.
 * Otherwise falls back to grayscale Sentinel-2 as a visual proxy.
 */
export function addSentinel1Layer(viewer: CesiumRef, Cesium: CesiumRef): CesiumRef {
  if (SENTINEL_HUB_INSTANCE) {
    // Real Sentinel-1 SAR via Copernicus Data Space Ecosystem
    const provider = new Cesium.WebMapServiceImageryProvider({
      url: `https://sh.dataspace.copernicus.eu/ogc/wms/${SENTINEL_HUB_INSTANCE}`,
      layers: "SENTINEL-1-IW-VV",
      parameters: {
        transparent: true,
        format: "image/png",
        time: getRecentDateRange(12),
      },
      credit: "Sentinel-1 SAR / Copernicus / ESA",
    });
    const layer = viewer.imageryLayers.addImageryProvider(provider);
    layer.alpha = 0.7;
    return layer;
  }

  // Fallback: Sentinel-2 in grayscale mode to simulate SAR appearance
  console.info("[Sentinel] No SENTINEL_HUB_INSTANCE_ID configured. Using grayscale Sentinel-2 as SAR proxy. Register free at dataspace.copernicus.eu for real SAR data.");
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless-2021_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg",
    credit: "Sentinel-2 (SAR-proxy) by EOX / Copernicus / ESA",
    minimumLevel: 0,
    maximumLevel: 14,
  });
  const layer = viewer.imageryLayers.addImageryProvider(provider);
  layer.alpha = 0.7;
  layer.brightness = 0.6;
  layer.contrast = 1.8;
  layer.saturation = 0.0;
  return layer;
}

function getRecentDateRange(daysBack: number): string {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return `${start.toISOString().split("T")[0]}/${end.toISOString().split("T")[0]}`;
}
