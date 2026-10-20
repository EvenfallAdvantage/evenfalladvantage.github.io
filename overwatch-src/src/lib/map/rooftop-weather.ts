/**
 * Weather over the rooftops: with 3D buildings shown, radar and clouds
 * (normally draped on the ground, hidden under buildings) are also drawn as
 * a translucent sheet just above the tallest building in view. Same NOAA/NWS
 * nowCOAST WMS sources (public domain) as the ground layers.
 */
import { NOWCOAST_CLOUDS_LAYER, NOWCOAST_RADAR_LAYER, NOWCOAST_RADAR_WMS, NOWCOAST_SATELLITE_WMS, radarFrameTimes } from "./nowcoast";

export const ROOFTOP_HALF_EXTENT_M = 2500;
export const ROOFTOP_CLEARANCE_M = 20;
export const ROOFTOP_MAX_ALT_M = 4000;
export const ROOFTOP_IMAGE_PX = 512;

export interface Box { w: number; s: number; e: number; n: number }

/** A square box of ±halfM around a point (degrees). */
export function boxAround(lon: number, lat: number, halfM = ROOFTOP_HALF_EXTENT_M): Box {
  const dLat = halfM / 111_320;
  const dLon = halfM / (111_320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));
  return { w: lon - dLon, s: lat - dLat, e: lon + dLon, n: lat + dLat };
}

/** WMS 1.3.0 GetMap (EPSG:4326 axis order is lat,lon). */
export function wmsGetMap(base: string, layer: string, b: Box, time?: string, px = ROOFTOP_IMAGE_PX): string {
  const q = new URLSearchParams({
    service: "WMS", version: "1.3.0", request: "GetMap", layers: layer, styles: "", format: "image/png", transparent: "true",
    crs: "EPSG:4326", bbox: `${b.s.toFixed(6)},${b.w.toFixed(6)},${b.n.toFixed(6)},${b.e.toFixed(6)}`, width: String(px), height: String(px),
  });
  if (time) q.set("time", time);
  return `${base}?${q.toString()}`;
}

export function rooftopRadarUrl(b: Box, nowMs: number): string {
  return wmsGetMap(NOWCOAST_RADAR_WMS, NOWCOAST_RADAR_LAYER, b, radarFrameTimes(nowMs, 1)[0]);
}
export function rooftopCloudsUrl(b: Box): string {
  return wmsGetMap(NOWCOAST_SATELLITE_WMS, NOWCOAST_CLOUDS_LAYER, b);
}

/** Sheet height: ground + tallest building + clearance. */
export const sheetHeight = (groundM: number, tallestM: number) => groundM + Math.max(30, tallestM) + ROOFTOP_CLEARANCE_M;
