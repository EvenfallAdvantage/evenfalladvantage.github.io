/**
 * Draws radar (and clouds, if on) as translucent sheets just above the
 * rooftops while the OSM 3D buildings are shown, so weather reads "over" the
 * city instead of only on the ground between buildings. Rebuilt when the
 * view moves more than ~1 km or every 10 minutes. See lib/map/rooftop-weather.ts.
 */
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { maxBuildingHeight } from "@/lib/map/building-heightfield";
import { ROOFTOP_MAX_ALT_M, boxAround, rooftopCloudsUrl, rooftopRadarUrl, sheetHeight } from "@/lib/map/rooftop-weather";
import type { CesiumRef } from "./cesium-layer-types";

const REBUILD_MOVE_M = 1000;
const REFRESH_MS = 10 * 60_000;

export function useRooftopWeather(params: { viewerRef: CesiumRef; cesiumRef: CesiumRef; loading: boolean; buildingsOn: boolean; radar: boolean; clouds: boolean; buildingCount: number }) {
  const { viewerRef, cesiumRef, loading, buildingsOn, radar, clouds, buildingCount } = params;
  const hasBuildings = buildingCount > 0;
  useEffect(() => {
    const viewer = viewerRef.current;
    const C = cesiumRef.current;
    if (!viewer || !C || loading || !buildingsOn || (!radar && !clouds)) return;
    const coll = new C.PrimitiveCollection();
    viewer.scene.primitives.add(coll);
    let last: { lon: number; lat: number; at: number } | null = null;
    let disposed = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;

    const sheet = (url: string, rect: unknown, height: number, alpha: number) => new C.Primitive({
      geometryInstances: new C.GeometryInstance({ geometry: new C.RectangleGeometry({ rectangle: rect, height, vertexFormat: C.EllipsoidSurfaceAppearance.VERTEX_FORMAT }) }),
      appearance: new C.EllipsoidSurfaceAppearance({ aboveGround: true, translucent: true, material: C.Material.fromType("Image", { image: url, color: new C.Color(1, 1, 1, alpha) }) }),
      asynchronous: true, allowPicking: false,
    });

    const rebuild = (force = false) => {
      if (disposed) return;
      const cc = viewer.camera.positionCartographic;
      const ground = viewer.scene.globe.getHeight(cc) ?? 0;
      const agl = cc.height - ground;
      coll.show = agl < ROOFTOP_MAX_ALT_M * 1.1;
      if (!coll.show) { viewer.scene.requestRender(); return; }
      let lon = C.Math.toDegrees(cc.longitude), lat = C.Math.toDegrees(cc.latitude);
      try {
        const cv = viewer.scene.canvas;
        const ray = viewer.camera.getPickRay(new C.Cartesian2(cv.clientWidth / 2, cv.clientHeight / 2));
        const hit = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
        if (hit) { const c = C.Cartographic.fromCartesian(hit); lon = C.Math.toDegrees(c.longitude); lat = C.Math.toDegrees(c.latitude); }
      } catch { /* camera point */ }
      const now = Date.now();
      if (!force && last && now - last.at < REFRESH_MS && Math.hypot((lon - last.lon) * 111_320 * Math.cos(lat * Math.PI / 180), (lat - last.lat) * 111_320) < REBUILD_MOVE_M) return;
      last = { lon, lat, at: now };
      const b = boxAround(lon, lat);
      const rect = C.Rectangle.fromDegrees(b.w, b.s, b.e, b.n);
      const h = sheetHeight(ground, maxBuildingHeight());
      try {
        coll.removeAll();
        if (clouds) coll.add(sheet(rooftopCloudsUrl(b), rect, h + 8, 0.3));
        if (radar) coll.add(sheet(rooftopRadarUrl(b, now), rect, h, 0.55));
        viewer.scene.requestRender();
      } catch (e) { logger.swallow("rooftop-weather:build", e, "debug"); }
    };
    const onMove = () => { if (debounce) clearTimeout(debounce); debounce = setTimeout(() => rebuild(), 400); };
    const removeMove = viewer.camera.moveEnd.addEventListener(onMove);
    const timer = setInterval(() => rebuild(true), REFRESH_MS);
    rebuild(true);
    return () => {
      disposed = true;
      if (debounce) clearTimeout(debounce);
      clearInterval(timer);
      removeMove?.();
      try { if (!viewer.isDestroyed?.()) { viewer.scene.primitives.remove(coll); viewer.scene.requestRender(); } } catch (e) { logger.swallow("rooftop-weather:cleanup", e, "debug"); }
    };
    // buildingCount: re-place the sheet once taller buildings load.
  }, [viewerRef, cesiumRef, loading, buildingsOn, radar, clouds, hasBuildings]);
}
