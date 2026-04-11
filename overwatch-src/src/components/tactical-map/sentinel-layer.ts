/**
 * Sentinel Satellite Imagery Layers
 *
 * Uses free WMS endpoints from Copernicus Data Space Ecosystem (CDSE)
 * and EOX for Sentinel-1 and Sentinel-2 imagery.
 * No API key or account required.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CesiumRef = any;

/**
 * Add Sentinel-2 cloudless mosaic layer (EOX — free, no auth).
 * High-quality true-color satellite imagery mosaic.
 */
export function addSentinel2Layer(viewer: CesiumRef, Cesium: CesiumRef): CesiumRef {
  // EOX Sentinel-2 cloudless mosaic — free, CORS-enabled, no auth
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
 * Add Sentinel-1 SAR imagery layer (EOX — free, no auth).
 * Grayscale SAR backscatter mosaic.
 */
export function addSentinel1Layer(viewer: CesiumRef, Cesium: CesiumRef): CesiumRef {
  // EOX Sentinel-1 GRD IW mosaic — free, CORS-enabled, no auth
  const provider = new Cesium.WebMapServiceImageryProvider({
    url: "https://tiles.maps.eox.at/wms",
    layers: "s1grdiw",
    parameters: {
      transparent: true,
      format: "image/png",
    },
    credit: "Sentinel-1 SAR by EOX / Copernicus / ESA",
  });

  const layer = viewer.imageryLayers.addImageryProvider(provider);
  layer.alpha = 0.7;
  return layer;
}
