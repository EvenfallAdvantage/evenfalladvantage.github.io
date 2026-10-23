import { useEffect } from "react";
import { OSM_BUILDINGS_TILEJSON_URL, tileKey, tileTemplateFromTileJson, tileUrl } from "@/lib/map/osm-buildings";
import { nearSideDepthDistance } from "@/lib/map/near-side-depth";
import { declutter, decodePlaceLabels, maxRankForZoom, mergePlaceLabels, placeFontPx, placeZoomForHeight, tilesForRect, type PlaceLabel } from "@/lib/map/place-labels";
import type { CesiumRef } from "./cesium-layer-types";

/**
 * Hybrid basemap: free place-name layer (OpenFreeMap vector tiles) drawn as
 * light-on-dark Cesium labels, so names read over satellite imagery at any
 * height. Uses its own LabelCollection (not viewer.entities). Removed when off.
 */
export const PLACE_LABEL_STYLE = Object.freeze({ fill: [0.96, 0.96, 0.96, 1], outline: [0, 0, 0, 1], outlineWidth: 3, plate: [0.06, 0.06, 0.06, 0.62], padX: 5, padY: 3 });
const MAX_CACHE = 64;

export function useHybridPlaceLabels(params: { viewerRef: CesiumRef; cesiumRef: CesiumRef; loading: boolean; enabled: boolean }) {
  const { viewerRef, cesiumRef, loading, enabled } = params;
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const viewer = viewerRef.current as any, C = cesiumRef.current as any;
    if (!viewer || !C || loading || !enabled) return;
    let disposed = false;
    let template: string | null = null;
    const cache = new Map<string, Promise<PlaceLabel[]>>();
    const labels = viewer.scene.primitives.add(new C.LabelCollection({ scene: viewer.scene }));
    let seq = 0;

    const loadTile = (t: { z: number; x: number; y: number }, maxRank: number) => {
      const k = `${tileKey(t)}:${maxRank}`;
      let p = cache.get(k);
      if (!p) {
        p = fetch(tileUrl(template!, t)).then((r) => (r.ok ? r.arrayBuffer() : null))
          .then((b) => (b ? decodePlaceLabels(new Uint8Array(b), t, maxRank) : []))
          .catch(() => []);
        cache.set(k, p);
        if (cache.size > MAX_CACHE) cache.delete(cache.keys().next().value as string);
      }
      return p;
    };

    const refresh = async () => {
      const my = ++seq;
      if (!template) {
        try { template = tileTemplateFromTileJson(await (await fetch(OSM_BUILDINGS_TILEJSON_URL)).json()); } catch { template = null; }
        if (!template || disposed) return;
      }
      const carto = viewer.camera.positionCartographic;
      const z = placeZoomForHeight(carto?.height ?? 1e7);
      const rect = viewer.camera.computeViewRectangle?.(viewer.scene.globe.ellipsoid);
      const d = C.Math.toDegrees;
      const [w, s, e, n] = rect ? [d(rect.west), d(rect.south), d(rect.east), d(rect.north)]
        : [d(carto.longitude) - 1, d(carto.latitude) - 1, d(carto.longitude) + 1, d(carto.latitude) + 1];
      const maxRank = maxRankForZoom(z);
      const lists = await Promise.all(tilesForRect(w, s, e, n, z).map((t) => loadTile(t, maxRank)));
      if (disposed || my !== seq) return;
      const proj = (lon: number, lat: number): [number, number] | null => {
        const p = C.SceneTransforms.worldToWindowCoordinates?.(viewer.scene, C.Cartesian3.fromDegrees(lon, lat))
          ?? C.SceneTransforms.wgs84ToWindowCoordinates?.(viewer.scene, C.Cartesian3.fromDegrees(lon, lat));
        return p ? [p.x, p.y] : null;
      };
      const shown = declutter(mergePlaceLabels(lists), proj);
      labels.removeAll();
      const st = PLACE_LABEL_STYLE;
      for (const l of shown) {
        labels.add({
          position: C.Cartesian3.fromDegrees(l.lon, l.lat),
          text: l.name,
          font: `${Math.floor(l.rank / 100) <= 4 ? 600 : 500} ${placeFontPx(Math.floor(l.rank / 100))}px system-ui, sans-serif`,
          fillColor: new C.Color(...st.fill), outlineColor: new C.Color(...st.outline), outlineWidth: st.outlineWidth,
          style: C.LabelStyle.FILL_AND_OUTLINE,
          showBackground: true, backgroundColor: new C.Color(...st.plate), backgroundPadding: new C.Cartesian2(st.padX, st.padY),
          horizontalOrigin: C.HorizontalOrigin.CENTER, verticalOrigin: C.VerticalOrigin.CENTER,
          heightReference: C.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: nearSideDepthDistance(viewer, C),
        });
      }
      viewer.scene.requestRender();
    };
    const off = viewer.camera.moveEnd.addEventListener(() => { void refresh(); });
    void refresh();
    return () => {
      disposed = true;
      off?.();
      if (!viewer.isDestroyed?.()) { viewer.scene.primitives.remove(labels); viewer.scene.requestRender(); }
    };
  }, [enabled, loading, viewerRef, cesiumRef]);
}
