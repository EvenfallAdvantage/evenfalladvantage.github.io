/**
 * Rocket launches (last 30 days, Launch Library 2) as pad markers, plus the
 * estimated-ascent replay for the selected launch. Desktop only (Infrastructure
 * → Space). Markers use the near-side depth rule and go dark under NVG/thermal.
 */
import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { isHighContrastLook } from "@/lib/map/contact-models";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";
import { getTacticalIcon, iconSize } from "@/lib/map/tactical-icons";
import { ascentLabel, estimatedAscent, launchAzimuth, LL2_CREDIT, loadLaunches, REPLAY_SECONDS, typicalInclination, type Launch } from "@/lib/map/launches";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const PREFIX = "launch-";
const COLOR = { success: "#22c55e", failure: "#ef4444", partial: "#f59e0b", other: "#94a3b8" } as const;

export function useLaunchesLayer(params: {
  viewerRef: CesiumRef; cesiumRef: CesiumRef; entityGroupsRef: EntityGroupsRef; loading: boolean; layers: LayerVisibility;
  onOpenLaunch: (l: Launch) => void;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, onOpenLaunch } = params;
  const dark = isHighContrastLook(layers);
  useEffect(() => {
    const viewer = viewerRef.current;
    const C = cesiumRef.current;
    if (!viewer || !C || loading || !layers.rocketLaunches) return;
    const ds = new C.CustomDataSource("rocket-launches");
    void viewer.dataSources.add(ds);
    const groups = entityGroupsRef.current;
    groups.launchesSource = ds;
    const ctrl = new AbortController();
    const credit = new C.Credit(LL2_CREDIT, false);
    try { viewer.creditDisplay.addStaticCredit?.(credit); } catch (e) { logger.swallow("launches:credit", e, "debug"); }
    const byId = new Map<string, Launch>();
    void loadLaunches(ctrl.signal).then((list) => {
      if (ctrl.signal.aborted) return;
      ds.entities.suspendEvents();
      for (const l of list) {
        const id = `${PREFIX}${l.id}`;
        byId.set(id, l);
        ds.entities.add({
          id, position: C.Cartesian3.fromDegrees(l.lng, l.lat, 0),
          billboard: {
            image: getTacticalIcon("rocket", COLOR[l.outcome], { highContrast: dark }),
            ...iconSize(getTacticalIcon("rocket", COLOR[l.outcome], { highContrast: dark })),
            scale: 0.42, // 24 px × 0.42 ≈ 10 px (pre-#215 dot: 9 px + 1.5 px outline)
            verticalOrigin: C.VerticalOrigin.CENTER,
            disableDepthTestDistance: nearSideDepthProperty(viewer, C),
            distanceDisplayCondition: new C.DistanceDisplayCondition(0, 2.5e7),
          },
        });
      }
      ds.entities.resumeEvents();
      groups.launches = list;
      viewer.scene.requestRender();
    }).catch((e) => logger.swallow("launches:load", e, "warn"));

    const handler = new C.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: unknown }) => {
      const id = viewer.scene.pick(click.position)?.id?.id;
      if (typeof id === "string" && id.startsWith(PREFIX)) { const l = byId.get(id); if (l) onOpenLaunch(l); }
    }, C.ScreenSpaceEventType.LEFT_CLICK);

    return () => {
      ctrl.abort(); handler.destroy();
      try { viewer.creditDisplay.removeStaticCredit?.(credit); } catch { /* ignore */ }
      try { viewer.dataSources.remove(ds, true); } catch (e) { logger.swallow("launches:remove", e, "debug"); }
      groups.launchesSource = null; groups.launches = null;
      viewer.scene?.requestRender?.();
    };
  }, [layers.rocketLaunches, dark, loading, onOpenLaunch, viewerRef, cesiumRef, entityGroupsRef]);
}

export interface ReplayHandle { stop: () => void }

/**
 * Animate the estimated ascent: the path grows from the pad while a marker
 * rides its tip; the camera frames the pad, then pulls back. Calls
 * `onProgress(0..1)` and resolves when done or stopped.
 */
export function startAscentReplay(viewer: any, C: any, launch: Launch, opts: { speed: number; onProgress: (f: number) => void; onDone: () => void }): ReplayHandle | null { // eslint-disable-line @typescript-eslint/no-explicit-any
  const pts = estimatedAscent(launch);
  if (!pts) return null;
  const cart = pts.map((p) => C.Cartesian3.fromDegrees(p.lng, p.lat, p.altM));
  let f = 0;
  const shown = () => cart.slice(0, Math.max(2, Math.ceil(f * (cart.length - 1)) + 1));
  const tip = () => {
    const x = f * (cart.length - 1), i = Math.min(cart.length - 2, Math.floor(x));
    return C.Cartesian3.lerp(cart[i], cart[i + 1], x - i, new C.Cartesian3());
  };
  const path = viewer.entities.add({ id: "launch-replay-path", polyline: { positions: new C.CallbackProperty(shown, false), width: 3, material: new C.PolylineGlowMaterialProperty({ glowPower: 0.25, color: C.Color.ORANGE }) } });
  const ghost = viewer.entities.add({ id: "launch-replay-ghost", polyline: { positions: cart, width: 1, material: new C.PolylineDashMaterialProperty({ color: C.Color.WHITE.withAlpha(0.35), dashLength: 12 }) } });
  const vehicle = viewer.entities.add({ id: "launch-replay-vehicle", position: new C.CallbackProperty(tip, false), point: { pixelSize: 10, color: C.Color.WHITE, outlineColor: C.Color.ORANGE, outlineWidth: 3 } });
  // Frame the whole estimated path side-on (camera heading perpendicular to the launch azimuth).
  const az = launchAzimuth(launch.lat, typicalInclination(launch.orbitAbbrev, launch.lat));
  const sphere = C.BoundingSphere.fromPoints(cart);
  viewer.camera.flyToBoundingSphere(sphere, { offset: new C.HeadingPitchRange(C.Math.toRadians(az - 90), C.Math.toRadians(-28), sphere.radius * 2.4), duration: 1.5 });
  // T+ readout as an HTML tag that follows the tip. A Cesium label with
  // changing text re-rasterised glyphs and showed missing/overlapping digits.
  const tag = document.createElement("div");
  tag.dataset.testid = "launch-replay-label";
  Object.assign(tag.style, { position: "absolute", left: "0", top: "0", pointerEvents: "none", zIndex: "3", font: "12px ui-monospace, monospace", whiteSpace: "pre", color: "#fff", background: "rgba(0,0,0,0.6)", padding: "1px 5px", borderRadius: "3px", transform: "translate(-50%, -150%)", display: "none" });
  viewer.container.appendChild(tag);
  const placeTag = () => {
    const p = tip();
    const occ = new C.EllipsoidalOccluder(viewer.scene.globe.ellipsoid, viewer.camera.positionWC);
    const w = occ.isPointVisible(p) ? C.SceneTransforms.worldToWindowCoordinates(viewer.scene, p) : null;
    if (!w) { tag.style.display = "none"; return; }
    const txt = ascentLabel(f);
    if (tag.textContent !== txt) tag.textContent = txt;
    tag.style.display = "block";
    tag.style.left = `${w.x}px`; tag.style.top = `${w.y}px`;
  };
  const removePost = viewer.scene.postRender.addEventListener(placeTag);
  let raf = 0, last = 0, stopped = false;
  const step = (t: number) => {
    if (stopped) return;
    if (last) f = Math.min(1, f + ((t - last) / 1000) * (opts.speed / REPLAY_SECONDS));
    last = t;
    opts.onProgress(f);
    viewer.scene.requestRender();
    if (f >= 1) { opts.onDone(); return; }
    raf = requestAnimationFrame(step);
  };
  const startTimer = setTimeout(() => { raf = requestAnimationFrame(step); }, 1600);
  return {
    stop: () => {
      stopped = true; clearTimeout(startTimer); cancelAnimationFrame(raf);
      removePost(); tag.remove();
      for (const e of [path, ghost, vehicle]) { try { viewer.entities.remove(e); } catch { /* ignore */ } }
      viewer.scene.requestRender();
    },
  };
}
