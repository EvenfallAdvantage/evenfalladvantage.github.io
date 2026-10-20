/**
 * City lights at night (NASA Black Marble via GIBS), only where the ground is
 * actually in darkness. Zoomed out (whole-globe views) Cesium's per-pixel
 * day/night blend does it (dayAlpha 0, nightAlpha 1). Closer in, Cesium
 * treats the whole view as lit, so the layer's opacity follows the sun's
 * elevation at the view centre instead (none by day, fading in through civil
 * twilight). No changes to Cesium's fade distances. Inserted just above the basemap so weather and
 * other overlays still draw over it. One static tile set (max zoom 8); cheap
 * enough for phones.
 */
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { viewDarkness } from "@/lib/map/sun";

const CLOSE_TAPER_M = 150_000;
import { GLOBE_BLEND_MIN_HEIGHT_M, aboveBasemapIndex, BLACK_MARBLE_CREDIT, BLACK_MARBLE_MAX_LEVEL, BLACK_MARBLE_URL } from "@/lib/map/city-lights";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useCityLights(params: { viewerRef: CesiumRef; cesiumRef: CesiumRef; entityGroupsRef: EntityGroupsRef; loading: boolean; layers: LayerVisibility }) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers } = params;
  useEffect(() => {
    const viewer = viewerRef.current;
    const C = cesiumRef.current;
    if (!viewer || !C || loading || !layers.cityLights) return;
    let layer: unknown = null;
    const groups = entityGroupsRef.current;
    try {
      const provider = new C.WebMapTileServiceImageryProvider({
        url: BLACK_MARBLE_URL,
        layer: "VIIRS_Black_Marble",
        style: "default",
        format: "image/png",
        tileMatrixSetID: `GoogleMapsCompatible_Level${BLACK_MARBLE_MAX_LEVEL}`,
        maximumLevel: BLACK_MARBLE_MAX_LEVEL,
        tilingScheme: new C.WebMercatorTilingScheme(),
        credit: new C.Credit(BLACK_MARBLE_CREDIT, false),
      });
      const coll = viewer.imageryLayers;
      const base = ([...(groups.baseImagery ?? []), ...(groups.osmLayerRef ?? [])] as unknown[]).map((l) => coll.indexOf(l));
      const l = new C.ImageryLayer(provider, { dayAlpha: 0, nightAlpha: 1, brightness: 3.2, gamma: 0.7, contrast: 1.3 });
      coll.add(l, aboveBasemapIndex(coll.length, base));
      layer = l;
      groups.cityLightsLayer = l;
      viewer.scene.requestRender();
    } catch (e) { logger.swallow("cesium-layers:city-lights-add", e, "warn"); }
    let lastCheck = 0;
    const scratch = new C.Cartesian2();
    const gate = () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const l = layer as any;
      if (!l) return;
      const now = performance.now();
      if (now - lastCheck < 400) return;
      lastCheck = now;
      const cam = viewer.camera.positionCartographic;
      if (cam.height >= GLOBE_BLEND_MIN_HEIGHT_M) {
        if (l.dayAlpha !== 0 || l.nightAlpha !== 1 || l.alpha !== 1 || !l.show) { l.dayAlpha = 0; l.nightAlpha = 1; l.alpha = 1; l.show = true; viewer.scene.requestRender(); }
        return;
      }
      let lat = C.Math.toDegrees(cam.latitude), lon = C.Math.toDegrees(cam.longitude);
      try {
        const cv = viewer.scene.canvas;
        scratch.x = cv.clientWidth / 2; scratch.y = cv.clientHeight / 2;
        const ray = viewer.camera.getPickRay(scratch);
        const hit = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
        if (hit) { const c = C.Cartographic.fromCartesian(hit); lat = C.Math.toDegrees(c.latitude); lon = C.Math.toDegrees(c.longitude); }
      } catch { /* keep camera point */ }
      const ms = C.JulianDate.toDate(viewer.clock.currentTime).getTime();
      // Only where the whole view is dark: sample the centre and four points
      // around it scaled to the view size (no lights on any day-side ground).
      const aSun = viewDarkness(ms, lat, lon, cam.height);
      // Below the lighting fade distance Cesium ignores dayAlpha/nightAlpha and
      // draws the layer at plain alpha, so drive alpha itself (and hide when ~0).
      // Black Marble is ~500 m/px and saturates over big cities; at street
      // zoom full opacity reads as a white sheet between buildings, so taper it.
      const a = aSun * Math.min(1, Math.max(0.15, cam.height / CLOSE_TAPER_M));
      const show = a > 0.01;
      if (l.dayAlpha !== 1 || l.nightAlpha !== 1 || Math.abs(l.alpha - a) > 0.01 || l.show !== show) {
        l.dayAlpha = 1; l.nightAlpha = 1; l.alpha = a; l.show = show; viewer.scene.requestRender();
      }
    };
    const removeGate = viewer.scene.preRender.addEventListener(gate);
    return () => {
      removeGate?.();
      if (layer) { try { viewer.imageryLayers.remove(layer, true); } catch (e) { logger.swallow("cesium-layers:city-lights-remove", e, "debug"); } }
      if (groups.cityLightsLayer === layer) groups.cityLightsLayer = null;
      viewer.scene?.requestRender?.();
    };
    // layers.satellite / basemap swaps: re-insert above the new basemap.
  }, [layers.cityLights, layers.satellite, layers.nightVision, layers.sentinel1, layers.sentinel2, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
