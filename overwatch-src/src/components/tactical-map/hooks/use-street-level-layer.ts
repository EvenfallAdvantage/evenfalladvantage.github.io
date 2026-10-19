/**
 * Street-level photo points (Panoramax, KartaView, Mapillary when a token is
 * configured). Queried only at street scale (camera below 3 km), once the
 * camera settles, inside a small box around the view centre. Points use the
 * near-side depth rule so far-side points never draw through the globe, are
 * drawn dark under NVG/thermal, and are capped lower on phones. Clicking a
 * point opens the photo viewer (with provider attribution).
 */
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import { isHighContrastLook } from "@/lib/map/contact-models";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";
import { fetchStreetPhotos, mapillaryToken, streetBudget, STREET_CREDITS, STREET_MAX_CAMERA_HEIGHT_M, type BBox, type StreetPhoto } from "@/lib/map/street-level";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const PREFIX = "street-";
const COLORS = { panoramax: "#38bdf8", kartaview: "#a78bfa", mapillary: "#34d399" } as const;

export function useStreetLevelLayer(params: {
  viewerRef: CesiumRef; cesiumRef: CesiumRef; entityGroupsRef: EntityGroupsRef; loading: boolean; layers: LayerVisibility;
  onOpenPhoto: (p: StreetPhoto) => void;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, onOpenPhoto } = params;
  const dark = isHighContrastLook(layers);

  useEffect(() => {
    const viewer = viewerRef.current;
    const C = cesiumRef.current;
    if (!viewer || !C || loading || !layers.streetPhotos) return;
    const constrained = isConstrainedDevice();
    const groups = entityGroupsRef.current;
    const ds = new C.CustomDataSource("street-photos");
    void viewer.dataSources.add(ds);
    const byId = new Map<string, StreetPhoto>();
    let ctrl: AbortController | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let credits: unknown[] = [];
    const setCredits = (provs: (keyof typeof STREET_CREDITS)[]) => {
      for (const c of credits) { try { viewer.creditDisplay.removeStaticCredit?.(c); } catch { /* ignore */ } }
      credits = provs.map((p) => new C.Credit(STREET_CREDITS[p], true));
      for (const c of credits) { try { viewer.creditDisplay.addStaticCredit?.(c); } catch (e) { logger.swallow("street-level:credit", e, "debug"); } }
    };
    const draw = (photos: StreetPhoto[]) => {
      ds.entities.suspendEvents();
      ds.entities.removeAll(); byId.clear();
      for (const p of photos) {
        const id = `${PREFIX}${p.provider}-${p.id}`;
        byId.set(id, p);
        ds.entities.add({
          id,
          position: C.Cartesian3.fromDegrees(p.lng, p.lat, 0),
          point: {
            pixelSize: constrained ? 9 : 8,
            color: dark ? C.Color.BLACK.withAlpha(0.9) : C.Color.fromCssColorString(COLORS[p.provider]).withAlpha(0.95),
            outlineColor: dark ? C.Color.WHITE.withAlpha(0.8) : C.Color.BLACK.withAlpha(0.6), outlineWidth: 1.5,
            heightReference: C.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: nearSideDepthProperty(viewer, C),
          },
        });
      }
      ds.entities.resumeEvents();
      viewer.scene.requestRender();
    };
    const refresh = () => {
      ctrl?.abort();
      const cam = viewer.camera;
      if ((cam.positionCartographic?.height ?? Infinity) > STREET_MAX_CAMERA_HEIGHT_M) { draw([]); setCredits([]); return; }
      const r = cam.computeViewRectangle?.(viewer.scene.globe.ellipsoid);
      if (!r) return;
      const b: BBox = [C.Math.toDegrees(r.west), C.Math.toDegrees(r.south), C.Math.toDegrees(r.east), C.Math.toDegrees(r.north)];
      ctrl = new AbortController();
      const mine = ctrl;
      void fetchStreetPhotos(b, { limit: streetBudget(constrained), token: mapillaryToken() || undefined, signal: ctrl.signal })
        .then(({ photos, providers }) => { if (mine.signal.aborted) return; draw(photos); setCredits(providers); groups.streetPhotos = photos; })
        .catch((e) => logger.swallow("street-level:fetch", e, "debug"));
    };
    const onMoveEnd = () => { if (timer) clearTimeout(timer); timer = setTimeout(refresh, 700); };
    const offMove = viewer.camera.moveEnd.addEventListener(onMoveEnd);
    refresh();

    const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: unknown }) => {
      const picked = viewer.scene.pick(click.position);
      const id = picked?.id?.id;
      if (typeof id === "string" && id.startsWith(PREFIX)) { const p = byId.get(id); if (p) onOpenPhoto(p); }
    }, C.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      ctrl?.abort(); if (timer) clearTimeout(timer);
      offMove?.(); handler.destroy();
      setCredits([]);
      try { viewer.dataSources.remove(ds, true); } catch (e) { logger.swallow("street-level:remove", e, "debug"); }
      groups.streetPhotos = null;
      viewer.scene?.requestRender?.();
    };
  }, [layers.streetPhotos, dark, loading, onOpenPhoto, viewerRef, cesiumRef, entityGroupsRef]);
}
