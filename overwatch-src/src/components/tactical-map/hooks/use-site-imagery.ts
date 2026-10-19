/**
 * Draws one day of NASA HLS imagery (GIBS WMTS, public domain) inside a
 * site box, on top of the basemap, and flies to the site the first time a
 * site is picked. Removed when the selection clears.
 */
import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import { GIBS_ACK, HLS_PRODUCTS, hlsTileUrl } from "@/lib/map/site-imagery";
import type { SiteImagerySelection } from "../site-imagery-panel";
import type { CesiumRef } from "./cesium-layer-types";

export function useSiteImagery(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  loading: boolean;
  selection: SiteImagerySelection | null;
}) {
  const { viewerRef, cesiumRef, loading, selection } = params;
  const flownTo = useRef<string>("");

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading || !selection) { if (!selection) flownTo.current = ""; return; }
    const { box, day, product } = selection;
    const rect = Cesium.Rectangle.fromDegrees(box.west, box.south, box.east, box.north);
    let layer: unknown = null;
    let outline: unknown = null;
    try {
      const provider = new Cesium.UrlTemplateImageryProvider({
        url: hlsTileUrl(product, day),
        rectangle: rect,
        minimumLevel: 0,
        // Phones stop one level short: a quarter of the tiles, still ~40 m.
        maximumLevel: HLS_PRODUCTS[product].maxLevel - (isConstrainedDevice() ? 1 : 0),
        credit: new Cesium.Credit(`${GIBS_ACK} · ${HLS_PRODUCTS[product].label} ${day}`, true),
      });
      layer = viewer.imageryLayers.addImageryProvider(provider);
      outline = viewer.entities.add({
        id: "site-imagery-box",
        name: `${selection.label} · imagery ${day}`,
        polyline: {
          positions: Cesium.Cartesian3.fromDegreesArray([
            box.west, box.south, box.east, box.south, box.east, box.north, box.west, box.north, box.west, box.south,
          ]),
          width: 1.5,
          clampToGround: true,
          material: Cesium.Color.fromCssColorString("#6ee7b7").withAlpha(0.85),
        },
      });
      const key = `${selection.lat},${selection.lng}`;
      if (flownTo.current !== key) {
        flownTo.current = key;
        viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(box.west - 0.02, box.south - 0.02, box.east + 0.02, box.north + 0.02), duration: 1.4 });
      }
      viewer.scene.requestRender();
    } catch (err) { logger.swallow("site-imagery:add", err, "warn"); }
    return () => {
      try { if (layer) viewer.imageryLayers.remove(layer, true); } catch (err) { logger.swallow("site-imagery:remove", err, "debug"); }
      try { if (outline) viewer.entities.remove(outline); } catch (err) { logger.swallow("site-imagery:outline", err, "debug"); }
      try { viewer.scene.requestRender(); } catch { /* viewer gone */ }
    };
  }, [selection, loading, viewerRef, cesiumRef]);
}
