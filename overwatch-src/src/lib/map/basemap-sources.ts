/**
 * Free, commercially-usable basemap sources for the Operations (Cesium) map.
 *
 * Every source here is keyless and its terms allow use inside a business's
 * free-to-users service with attribution. Cesium ion assets (Bing imagery,
 * World Terrain, OSM Buildings) are NOT used unless the deployment explicitly
 * opts in with NEXT_PUBLIC_CESIUM_ION_COMMERCIAL=true *and* provides a token
 * — the ion Community tier is personal / non-commercial only, so a leftover
 * NEXT_PUBLIC_CESIUM_TOKEN on its own is ignored.
 *
 * | Source | Use | License |
 * |---|---|---|
 * | EOxCloudless 2016 (Sentinel-2 cloudless) | Global satellite base, z0–14 | CC BY 4.0 |
 * | USGS The National Map — USGSImageryOnly (NAIP / HRO) | US high-res imagery, z9–16 | US public domain |
 * | Re:Earth Terrain (Mapterhorn + EGM2008) | Quantized-mesh terrain | CC BY 4.0 (OSM water mask: ODbL) |
 * | OpenStreetMap standard tiles | Streets view (user toggle) | ODbL data, OSMF Tile Usage Policy |
 * | NASA GIBS VIIRS true colour | "Daily satellite" overlay | US public domain |
 * | NOAA nowCOAST lightning density | Lightning (15-min density) | US public domain (NOAA product, distributable) |
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumNs = any;

export const EOX_S2_2016_URL =
  "https://tiles.maps.eox.at/wmts/1.0.0/s2cloudless_3857/default/GoogleMapsCompatible/{z}/{y}/{x}.jpg";
export const EOX_S2_2016_CREDIT =
  '<a href="https://cloudless.eox.at" target="_blank" rel="noopener">EOxCloudless</a> by EOX IT Services GmbH (Contains modified Copernicus Sentinel data 2016) · CC BY 4.0';

export const USGS_IMAGERY_URL =
  "https://basemap.nationalmap.gov/arcgis/rest/services/USGSImageryOnly/MapServer/tile/{z}/{y}/{x}";
export const USGS_IMAGERY_CREDIT =
  'Imagery: <a href="https://www.usgs.gov/programs/national-geospatial-program/national-map" target="_blank" rel="noopener">USGS The National Map</a> (public domain)';

/** CONUS, Alaska, Hawaii, Puerto Rico — degrees [west, south, east, north]. */
export const USGS_IMAGERY_EXTENTS: ReadonlyArray<readonly [number, number, number, number]> = [
  [-125.0, 24.4, -66.9, 49.5],
  [-170.0, 51.0, -129.9, 71.5],
  [-160.6, 18.8, -154.7, 22.4],
  [-67.3, 17.8, -65.2, 18.6],
];

export const KEYLESS_TERRAIN_URL = "https://terrain.reearth.land/cesium-mesh/ellipsoid";
export const KEYLESS_TERRAIN_CREDIT =
  '<a href="https://terrain.reearth.land/" target="_blank" rel="noopener">Re:Earth Terrain</a> · <a href="https://mapterhorn.com/" target="_blank" rel="noopener">Mapterhorn</a> (CC BY 4.0) · EGM2008 (NGA) · © OpenStreetMap contributors';

export const OSM_STREETS_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
export const OSM_STREETS_CREDIT =
  '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';

export const GIBS_TRUECOLOR_LAYER = "VIIRS_SNPP_CorrectedReflectance_TrueColor";
export const GIBS_CREDIT =
  'Daily imagery: <a href="https://earthdata.nasa.gov/gibs" target="_blank" rel="noopener">NASA GIBS</a> / VIIRS (public domain)';

export const NOWCOAST_LIGHTNING_WMS =
  "https://nowcoast.noaa.gov/geoserver/observations/lightning_detection/ows";
export const NOWCOAST_LIGHTNING_LAYER = "ldn_lightning_strike_density";
export const NOWCOAST_LIGHTNING_STYLE = "lightning_density";
export const NOWCOAST_LIGHTNING_CREDIT =
  'Lightning density: <a href="https://nowcoast.noaa.gov/" target="_blank" rel="noopener">NOAA/NWS nowCOAST</a> (15-min, ~8 km grid)';

/** True only when the deployment explicitly licensed Cesium ion for commercial use. */
export function ionAssetsEnabled(env: Record<string, string | undefined> = {
  NEXT_PUBLIC_CESIUM_ION_COMMERCIAL: process.env.NEXT_PUBLIC_CESIUM_ION_COMMERCIAL,
  NEXT_PUBLIC_CESIUM_TOKEN: process.env.NEXT_PUBLIC_CESIUM_TOKEN,
}): boolean {
  return env.NEXT_PUBLIC_CESIUM_ION_COMMERCIAL === "true" && !!(env.NEXT_PUBLIC_CESIUM_TOKEN ?? "").trim();
}

/**
 * GIBS publishes a day's VIIRS mosaic with a lag; "yesterday (UTC)" is the
 * newest date that is reliably complete.
 */
export function gibsDate(now: Date = new Date()): string {
  const d = new Date(now.getTime() - 24 * 3600_000);
  return d.toISOString().slice(0, 10);
}

export function gibsTrueColorUrl(date: string): string {
  return `https://gibs.earthdata.nasa.gov/wmts/epsg3857/best/${GIBS_TRUECOLOR_LAYER}/default/${date}/GoogleMapsCompatible_Level9/{z}/{y}/{x}.jpg`;
}

/** Snap to the 15-minute nowCOAST cadence so tile URLs are cache-friendly. */
export function lightningCacheKey(now: Date = new Date()): string {
  const q = 15 * 60_000;
  return new Date(Math.floor(now.getTime() / q) * q).toISOString();
}

/**
 * True when a sampled RGBA tile is a USGS "no data" fill: every pixel opaque
 * pure white, or every pixel fully transparent. The National Map returns
 * solid-white JPEGs outside NAIP/HRO coverage (e.g. Mexico and Canada inside
 * the CONUS rectangle) and transparent PNGs over water.
 */
export function isNoDataTile(rgba: ArrayLike<number>): boolean {
  if (rgba.length < 4) return false;
  let white = true, clear = true;
  for (let i = 0; i < rgba.length; i += 4) {
    const a = rgba[i + 3];
    if (a !== 0) clear = false;
    if (a !== 255 || rgba[i] < 254 || rgba[i + 1] < 254 || rgba[i + 2] < 254) white = false;
    if (!white && !clear) return false;
  }
  return white || clear;
}

/**
 * Cesium TileDiscardPolicy that drops USGS no-data tiles so the EOX layer
 * underneath shows through instead of white patches. Samples the tile on an
 * 8x8 canvas (the tile is CORS-enabled, so the canvas stays readable).
 */
export function createNoDataDiscardPolicy(): { isReady(): boolean; shouldDiscardImage(image: CanvasImageSource): boolean } {
  let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null = null;
  return {
    isReady: () => true,
    shouldDiscardImage(image) {
      try {
        if (!ctx) {
          const c = typeof OffscreenCanvas !== "undefined" ? new OffscreenCanvas(8, 8) : Object.assign(document.createElement("canvas"), { width: 8, height: 8 });
          ctx = (c.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null);
          if (!ctx) return false;
        }
        ctx.clearRect(0, 0, 8, 8);
        ctx.drawImage(image, 0, 0, 8, 8);
        return isNoDataTile(ctx.getImageData(0, 0, 8, 8).data);
      } catch {
        return false;
      }
    },
  };
}

/** Base satellite imagery: EOX global + USGS high-res over the US. */
export function addFreeBaseImagery(viewer: CesiumNs, Cesium: CesiumNs): unknown[] {
  const base = viewer.imageryLayers.addImageryProvider(
    new Cesium.UrlTemplateImageryProvider({
      url: EOX_S2_2016_URL,
      credit: new Cesium.Credit(EOX_S2_2016_CREDIT, false),
      minimumLevel: 0,
      maximumLevel: 14,
    }),
    0,
  );
  const layers: unknown[] = [base];
  const discardPolicy = createNoDataDiscardPolicy();
  for (const [w, s, e, n] of USGS_IMAGERY_EXTENTS) {
    const provider = new Cesium.UrlTemplateImageryProvider({
      url: USGS_IMAGERY_URL,
      credit: new Cesium.Credit(USGS_IMAGERY_CREDIT, false),
      rectangle: Cesium.Rectangle.fromDegrees(w, s, e, n),
      minimumLevel: 0,
      maximumLevel: 16,
      // Outside NAIP coverage the service answers with solid-white tiles;
      // discard them so the EOX base shows through.
      tileDiscardPolicy: discardPolicy,
    });
    // Below ~z8 the 10 m Sentinel-2 mosaic looks better and costs fewer requests.
    const l = new Cesium.ImageryLayer(provider, { minimumTerrainLevel: 8 });
    viewer.imageryLayers.add(l);
    layers.push(l);
  }
  return layers;
}

/** Keyless terrain; ion World Terrain only when licensed. */
export async function createTerrainProvider(Cesium: CesiumNs): Promise<unknown> {
  if (ionAssetsEnabled()) {
    return Cesium.createWorldTerrainAsync({ requestVertexNormals: true, requestWaterMask: true });
  }
  return Cesium.CesiumTerrainProvider.fromUrl(KEYLESS_TERRAIN_URL, {
    requestVertexNormals: true,
    requestWaterMask: true,
    credit: new Cesium.Credit(KEYLESS_TERRAIN_CREDIT, false),
  });
}
