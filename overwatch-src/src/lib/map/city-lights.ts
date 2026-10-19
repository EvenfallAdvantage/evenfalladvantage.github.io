/**
 * City lights at night: NASA Black Marble (VIIRS, 2016 annual composite)
 * from NASA GIBS. Public domain (NASA data policy); keyless WMTS, fetched by
 * the browser. Drawn on the night side of the globe only, via Cesium's
 * per-layer day/night alpha with globe lighting on.
 */
export const BLACK_MARBLE_LAYER = "VIIRS_Black_Marble";
export const BLACK_MARBLE_DATE = "2016-01-01";
export const BLACK_MARBLE_MAX_LEVEL = 8;
export const BLACK_MARBLE_URL =
  `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${BLACK_MARBLE_LAYER}/default/${BLACK_MARBLE_DATE}/GoogleMapsCompatible_Level${BLACK_MARBLE_MAX_LEVEL}/{TileMatrix}/{TileRow}/{TileCol}.png`;
export const BLACK_MARBLE_CREDIT =
  "City lights: NASA Earth Observatory Black Marble (VIIRS 2016) via NASA GIBS";

/** Globe lighting is needed for the Dark basemap and for the night-side city lights. */
export function wantsGlobeLighting(l: { nightVision?: boolean; cityLights?: boolean }): boolean {
  return !!(l.nightVision || l.cityLights);
}

/** Index just above the basemap layers (so radar, clouds and other overlays stay on top). */
export function aboveBasemapIndex(layerCount: number, baseIndices: readonly number[]): number {
  const valid = baseIndices.filter((i) => i >= 0 && i < layerCount);
  return valid.length ? Math.max(...valid) + 1 : Math.min(1, layerCount);
}
