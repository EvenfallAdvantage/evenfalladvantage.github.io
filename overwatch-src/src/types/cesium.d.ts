/**
 * CesiumJS is loaded from CDN at runtime (not bundled).
 * This declares the global Cesium namespace to avoid TypeScript errors.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
declare namespace Cesium {
  // Minimal type stubs — CesiumJS has 1000+ types, we only declare what we use
  const Ion: { defaultAccessToken: string };
  const Terrain: { fromWorldTerrain: (opts?: any) => any };
  const Cartesian3: { fromDegrees: (lng: number, lat: number, height?: number) => any };
  const Cartesian2: new (x: number, y: number) => any;
  const Color: {
    LIME: any; DODGERBLUE: any; GRAY: any; BLACK: any; WHITE: any; CYAN: any;
    fromCssColorString: (css: string) => any;
  };
  const VerticalOrigin: { BOTTOM: any };
  const HeightReference: { CLAMP_TO_GROUND: any };
  const LabelStyle: { FILL_AND_OUTLINE: any };
  const ScreenSpaceEventType: { LEFT_DOUBLE_CLICK: any };
  class Viewer { constructor(container: HTMLElement, opts?: any); [key: string]: any; }
  class ScreenSpaceEventHandler { constructor(canvas: HTMLCanvasElement); [key: string]: any; }
  class WebMapServiceImageryProvider { constructor(opts: any); }
  class SingleTileImageryProvider { constructor(opts: any); }
  class OpenStreetMapImageryProvider { constructor(opts: any); }
  const Rectangle: { fromDegrees: (west: number, south: number, east: number, north: number) => any };
  function createOsmBuildingsAsync(): Promise<any>;
  function defined(value: any): boolean;
}

declare interface Window {
  Cesium: typeof Cesium;
  CESIUM_BASE_URL: string;
}
