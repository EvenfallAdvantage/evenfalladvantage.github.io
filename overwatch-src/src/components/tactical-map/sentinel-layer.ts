/**
 * Satellite overlay layers.
 *
 * "Daily Satellite": NASA GIBS VIIRS (SNPP) corrected-reflectance true colour,
 *   yesterday's global mosaic (~250 m). US public domain, keyless.
 *   (Replaces the EOX s2cloudless-2021 mosaic, which is CC BY-NC-SA.)
 * "SAR Imagery": real Sentinel-1 SAR via the Copernicus Data Space Ecosystem
 *   Sentinel Hub WMS. Only offered when NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID is
 *   configured; there is NO optical "SAR proxy" fallback any more.
 */

import { GIBS_CREDIT, clampGibsDay, gibsDate, gibsTrueColorUrl } from "@/lib/map/basemap-sources";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumRef = any;

const SENTINEL_HUB_INSTANCE = process.env.NEXT_PUBLIC_SENTINEL_HUB_INSTANCE_ID || "";

/** True when a Sentinel Hub instance is configured, i.e. real SAR is available. */
export const SAR_AVAILABLE = SENTINEL_HUB_INSTANCE.length > 0;

/** NASA GIBS daily true-colour overlay for `day` (default: yesterday, UTC). */
export function addSentinel2Layer(viewer: CesiumRef, Cesium: CesiumRef, day?: string): CesiumRef {
  const date = day ? clampGibsDay(day) : gibsDate();
  const provider = new Cesium.UrlTemplateImageryProvider({
    url: gibsTrueColorUrl(date),
    credit: new Cesium.Credit(`${GIBS_CREDIT}, ${date}`, false),
    minimumLevel: 0,
    maximumLevel: 9,
  });
  const layer = viewer.imageryLayers.addImageryProvider(provider);
  layer.alpha = 0.9;
  return layer;
}

/** Real Sentinel-1 SAR (CDSE). Returns null when no instance is configured. */
export function addSentinel1Layer(viewer: CesiumRef, Cesium: CesiumRef): CesiumRef | null {
  if (!SAR_AVAILABLE) return null;
  // Sentinel-1 revisits every 6 days: snap the time range to the cycle so
  // tile URLs stay cacheable for the whole cycle.
  const timeRange = getStableTimeRange();
  const provider = new Cesium.WebMapServiceImageryProvider({
    url: `https://sh.dataspace.copernicus.eu/ogc/wms/${SENTINEL_HUB_INSTANCE}`,
    layers: "SAR-VV-20-TO-0-DB",
    parameters: { transparent: true, format: "image/jpeg", time: timeRange },
    credit: "Contains modified Copernicus Sentinel data (Sentinel-1 SAR, CDSE)",
    maximumLevel: 10,
    tileWidth: 512,
    tileHeight: 512,
  });
  const layer = viewer.imageryLayers.addImageryProvider(provider);
  layer.alpha = 0.7;
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
