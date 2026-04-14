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
  // EOX Sentinel-2 cloudless is a 2021 annual mosaic — it NEVER changes.
  // The browser HTTP cache handles this naturally since the URLs are
  // completely static (no time parameter, no cache busters).
  // EOX also sets Cache-Control headers with long TTLs.
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
    //
    // Caching strategy: Sentinel-1 revisits every 6 days, so we snap the
    // time parameter to the nearest 6-day boundary. This makes tile URLs
    // deterministic for each revisit cycle, allowing the browser's HTTP
    // cache to serve tiles without re-fetching.
    const timeRange = getStableTimeRange();

    const provider = new Cesium.WebMapServiceImageryProvider({
      url: `https://sh.dataspace.copernicus.eu/ogc/wms/${SENTINEL_HUB_INSTANCE}`,
      layers: "SAR-VV-20-TO-0-DB",
      parameters: {
        transparent: true,
        format: "image/jpeg", // JPEG is smaller than PNG, faster loading
        time: timeRange,
      },
      credit: "Sentinel-1 SAR / Copernicus / ESA",
      // Limit to zoom level 10 (city-level) with larger tiles to minimize requests
      // SAR resolution is 10m, so street-level zoom doesn't add detail
      maximumLevel: 10,
      tileWidth: 512,
      tileHeight: 512,
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

/**
 * Get a stable time range that aligns with Sentinel-1's 6-day revisit cycle.
 * The end date snaps to the most recent 6-day boundary, so the URL stays
 * the same for ~6 days — enabling effective browser HTTP caching.
 *
 * Example: If today is April 11 and the epoch is Jan 1 2024:
 *   - Day of cycle = (101 days since epoch) % 6 = 5
 *   - Snap to April 6 as the end of the most recent cycle
 *   - Time range: "2026-03-31/2026-04-06"
 */
function getStableTimeRange(): string {
  const CYCLE_DAYS = 6;
  const epoch = new Date("2024-01-01").getTime();
  const now = Date.now();
  const daysSinceEpoch = Math.floor((now - epoch) / (24 * 60 * 60 * 1000));
  const cycleDay = daysSinceEpoch % CYCLE_DAYS;
  const cycleEnd = new Date(now - cycleDay * 24 * 60 * 60 * 1000);
  const cycleStart = new Date(cycleEnd.getTime() - CYCLE_DAYS * 24 * 60 * 60 * 1000);
  return `${cycleStart.toISOString().split("T")[0]}/${cycleEnd.toISOString().split("T")[0]}`;
}

function _getRecentDateRange(daysBack: number): string {
  const end = new Date();
  const start = new Date(end.getTime() - daysBack * 24 * 60 * 60 * 1000);
  return `${start.toISOString().split("T")[0]}/${end.toISOString().split("T")[0]}`;
}
