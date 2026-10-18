/**
 * NOAA/NWS nowCOAST (public domain) WMS layers for the weather group:
 * radar loop, satellite clouds. nowCOAST's time dimension uses nearest-value
 * matching, so any timestamp returns the closest frame.
 */

export const NOWCOAST_RADAR_WMS = "https://nowcoast.noaa.gov/geoserver/weather_radar/ows";
export const NOWCOAST_RADAR_LAYER = "base_reflectivity_mosaic";
export const NOWCOAST_RADAR_CREDIT =
  'Radar: <a href="https://nowcoast.noaa.gov/" target="_blank" rel="noopener">NOAA/NWS nowCOAST</a> (MRMS base reflectivity)';

export const NOWCOAST_SATELLITE_WMS = "https://nowcoast.noaa.gov/geoserver/satellite/ows";
/** Global infrared mosaic: shows clouds day and night. */
export const NOWCOAST_CLOUDS_LAYER = "global_longwave_imagery_mosaic";
export const NOWCOAST_CLOUDS_CREDIT =
  'Clouds: <a href="https://nowcoast.noaa.gov/" target="_blank" rel="noopener">NOAA/NWS nowCOAST</a> (GOES/global infrared)';

export const NWS_WIND_MAPSERVER = "https://mapservices.weather.noaa.gov/vector/rest/services/obs/surface_obs/MapServer";
/** "Wind Velocity (knots)" observed barbs. */
export const NWS_WIND_LAYER = "200";
export const NWS_WIND_CREDIT =
  'Wind: <a href="https://www.weather.gov/" target="_blank" rel="noopener">NOAA/NWS</a> surface observations';

/** nowCOAST keeps about 4 hours of radar frames. */
export const RADAR_HORIZON_MS = 4 * 3_600_000;

/**
 * Timestamps for a radar loop ending at `endMs`: `count` frames `stepMin`
 * apart, aligned to the step, oldest first, ISO without milliseconds.
 */
export function radarFrameTimes(endMs: number, count: number, stepMin = 10): string[] {
  const step = stepMin * 60_000;
  // Newest frame a few minutes back so it's published.
  const last = Math.floor((endMs - 4 * 60_000) / step) * step;
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) out.push(new Date(last - i * step).toISOString().replace(".000Z", "Z"));
  return out;
}

/** Single radar frame for a Time Machine replay instant, or undefined when nowCOAST no longer has it. */
export function radarReplayTime(replayMs: number, now = Date.now()): string | undefined {
  if (now - replayMs > RADAR_HORIZON_MS || replayMs > now) return undefined;
  return radarFrameTimes(replayMs + 4 * 60_000, 1, 5)[0];
}

/** Loop frame display schedule: dwell longer on the newest frame. */
export function loopDelayMs(frameIndex: number, frameCount: number): number {
  return frameIndex === frameCount - 1 ? 1800 : 550;
}
