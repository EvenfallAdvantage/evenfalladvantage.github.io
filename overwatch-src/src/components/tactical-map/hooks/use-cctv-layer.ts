/**
 * CCTV cameras layer (viewport-driven).
 *
 * **GATED**: renders nothing unless `INTEL_LAYER_FLAGS.cctv.enabled`.
 *
 * On camera moveEnd (400 ms debounce) the hook requests
 * `/intel-cctv?bbox=…&zoom=…` for the visible rectangle. Below zoom 7 the
 * server returns clusters (count bubbles); above, individual cameras capped
 * by the device point budget (mobile cap). Stale in-flight requests are
 * aborted, entities are diffed by id (only adds/removes touch Cesium), and
 * a Cesium credit lists attribution for the sources currently in view.
 *
 * Rollout-safe: if the deployed function predates bbox mode (no `mode`
 * field), the legacy full list is rendered once and viewport refetch stops.
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import type { LayerVisibility } from "../map-layers-panel";
import { fetchIntelCctvBbox } from "@/lib/intel-client";
import { INTEL_LAYER_FLAGS } from "@/lib/intel-feature-flags";
import type { CctvCamera, CctvCluster } from "@/lib/intel-types";
import { pointBudget, withSuspendedEvents } from "@/lib/map/device-profile";
import {
  attributionLine, bboxKey, clusterLabel, diffIds, rectToBBox, roundBBox, zoomFromHeight,
} from "@/lib/map/cctv-viewport";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import { CONE_MOUNT_M, cameraPose, coneArc } from "@/lib/map/camera-cone";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";

let iconCacheValue: HTMLCanvasElement | null = null;

function buildIcon(): HTMLCanvasElement {
  if (iconCacheValue) return iconCacheValue;
  const size = 12;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;
  const r = size / 2;
  const grad = ctx.createRadialGradient(r, r, 0.5, r, r, r);
  grad.addColorStop(0, "#86efac");
  grad.addColorStop(0.7, "#10b981");
  grad.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(r, r, r - 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.arc(r, r, r * 0.45, 0, Math.PI * 2);
  ctx.stroke();
  iconCacheValue = canvas;
  return canvas;
}

const clusterIconCache = new Map<string, HTMLCanvasElement>();
function buildClusterIcon(count: number): HTMLCanvasElement {
  const label = clusterLabel(count);
  const hit = clusterIconCache.get(label);
  if (hit) return hit;
  const size = count >= 1000 ? 34 : count >= 100 ? 28 : 22;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    const r = size / 2;
    ctx.fillStyle = "rgba(16,185,129,0.85)";
    ctx.beginPath();
    ctx.arc(r, r, r - 1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.9)";
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${size >= 28 ? 11 : 10}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(label, r, r + 0.5);
  }
  if (clusterIconCache.size > 300) clusterIconCache.clear();
  clusterIconCache.set(label, canvas);
  return canvas;
}

function buildPopup(cam: CctvCamera): string {
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:#10b981">${escapeHtml(cam.name)}</b>
    <div>${escapeHtml(cam.city)}, ${escapeHtml(cam.country)}</div>
    <div style="color:#94a3b8">${escapeHtml(cam.source)}</div>
    <div style="color:#94a3b8;margin-top:4px">Click to view</div>
  </div>`;
}

const DEBOUNCE_MS = 400;
const CONE_SUFFIX = "-cone";
/** Cones only draw when the camera is this close (keeps city views clean). */
const CONE_MAX_DISTANCE_M = 12_000;

/**
 * Field-of-view cone for one camera (desktop only): a translucent wedge on
 * the ground plus a 3D fan from a mount point above the camera. Null when
 * the facing is unknown. See camera-cone.ts for where the facing comes from.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cesium module/viewer have no published types
function coneEntity(Cesium: any, viewer: any, id: string, cam: CctvCamera, contrast: () => boolean): Record<string, unknown> | null {
  const pose = cameraPose(cam);
  if (!pose) return null;
  const arc = coneArc(cam.lat, cam.lng, pose);
  let ground = 0;
  try {
    const h = viewer.scene?.globe?.getHeight?.(Cesium.Cartographic.fromDegrees(cam.lng, cam.lat));
    if (Number.isFinite(h)) ground = h;
  } catch (err) { logger.swallow("cesium-layers:cctv-cone-height", err, "debug"); }
  const fan = [cam.lng, cam.lat, ground + CONE_MOUNT_M, ...arc.flatMap(([x, y]) => [x, y, ground + 1])];
  // Under NVG/thermal (brightness-only looks) the cone turns dark so it reads
  // against lit terrain; the callback follows the look without rebuilding.
  const fill = Cesium.Color.fromCssColorString("#34d399").withAlpha(0.28);
  const fillDark = Cesium.Color.BLACK.withAlpha(0.5);
  const edge = Cesium.Color.fromCssColorString("#d1fae5").withAlpha(0.95);
  const edgeDark = Cesium.Color.BLACK.withAlpha(0.95);
  const pick = (light: unknown, dark: unknown) => new Cesium.CallbackProperty(() => (contrast() ? dark : light), false);
  const show = new Cesium.DistanceDisplayCondition(0, CONE_MAX_DISTANCE_M);
  return {
    id,
    name: `${cam.name} (field of view${pose.source === "name" ? ", from the direction in its name" : ""})`,
    polygon: {
      hierarchy: Cesium.Cartesian3.fromDegreesArrayHeights(fan),
      perPositionHeight: true,
      material: new Cesium.ColorMaterialProperty(pick(fill, fillDark)),
      outline: false,
      distanceDisplayCondition: show,
    },
    polyline: {
      positions: Cesium.Cartesian3.fromDegreesArrayHeights([...fan, cam.lng, cam.lat, ground + CONE_MOUNT_M]),
      // Light edge with a dark rim: the dark rim is what still reads under the
      // NVG/thermal post-processing, which flattens colour to brightness.
      width: 3.5,
      material: new Cesium.PolylineOutlineMaterialProperty({
        color: pick(edge, edgeDark),
        outlineColor: Cesium.Color.BLACK.withAlpha(0.85),
        outlineWidth: 1,
      }),
      distanceDisplayCondition: show,
    },
  };
}
const CLUSTER_PREFIX = "cctv-cl-";

type Item = { kind: "cam"; cam: CctvCamera } | { kind: "cluster"; cl: CctvCluster };

export function useCctvLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  onOpenCamera: (cam: CctvCamera) => void;
  /** Optional scope filter (near my sites / map view) for individual cameras. */
  filter?: (lat: number, lng: number) => boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, onOpenCamera, filter } = params;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;
    const entityGroups = entityGroupsRef.current;

    const clearAll = () => {
      for (const e of (entityGroups.cctv ?? []) as Array<{ id: string }>) {
        try { viewer.entities.removeById(e.id); }
        catch (err) { logger.swallow("cesium-layers:remove-cctv", err); }
      }
      entityGroups.cctv = [];
    };
    clearAll();
    if (entityGroups.cctvClickHandler) {
      try { entityGroups.cctvClickHandler.destroy(); }
      catch (err) { logger.swallow("cesium-layers:destroy-cctv-handler", err); }
      entityGroups.cctvClickHandler = null;
    }

    if (!layers.cctv) return;
    if (!INTEL_LAYER_FLAGS.cctv.enabled) {
      logger.swallow(
        "cesium-layers:cctv-gated",
        new Error(`CCTV layer disabled: ${INTEL_LAYER_FLAGS.cctv.gatedBy ?? "feature flag off"}`),
        "debug",
      );
      return;
    }

    let disposed = false;
    let legacy = false;
    let lastKey = "";
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inflight: AbortController | null = null;
    let credit: unknown = null;
    const live = new Map<string, { entity: { id: string }; item: Item }>();
    const cones = new Map<string, { id: string }>();
    const budget = pointBudget("cctv");
    const conesOn = !isConstrainedDevice();

    const setCredit = (text: string) => {
      const cd = viewer.creditDisplay;
      try {
        if (credit) cd?.removeStaticCredit?.(credit);
        credit = text ? new Cesium.Credit(escapeHtml(text), false) : null;
        if (credit) cd?.addStaticCredit?.(credit);
      } catch (err) { logger.swallow("cesium-layers:cctv-credit", err); }
    };

    const render = (next: Map<string, Item>) => {
      const { add, remove } = diffIds(live.keys(), next.keys());
      if (!add.length && !remove.length) return;
      withSuspendedEvents(viewer.entities, () => {
        for (const id of remove) {
          try { viewer.entities.removeById(id); }
          catch (err) { logger.swallow("cesium-layers:remove-cctv", err); }
          live.delete(id);
          if (cones.has(id)) {
            try { viewer.entities.removeById(id + CONE_SUFFIX); }
            catch (err) { logger.swallow("cesium-layers:remove-cctv-cone", err); }
            cones.delete(id);
          }
        }
        for (const id of add) {
          const item = next.get(id)!;
          const lat = item.kind === "cam" ? item.cam.lat : item.cl.lat;
          const lng = item.kind === "cam" ? item.cam.lng : item.cl.lng;
          if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
          const entity = viewer.entities.add(item.kind === "cam"
            ? {
                id, name: item.cam.name,
                position: Cesium.Cartesian3.fromDegrees(lng, lat, 5),
                billboard: {
                  image: buildIcon(), scale: 1.0,
                  heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
                  verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
                },
                description: buildPopup(item.cam),
              }
            : {
                id, name: `${item.cl.count} cameras`,
                position: Cesium.Cartesian3.fromDegrees(lng, lat, 5),
                billboard: {
                  image: buildClusterIcon(item.cl.count),
                  heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                  disableDepthTestDistance: nearSideDepthProperty(viewer, Cesium),
                },
              });
          live.set(id, { entity, item });
          if (conesOn && item.kind === "cam") {
            const cone = coneEntity(Cesium, viewer, id + CONE_SUFFIX, item.cam, () => !!entityGroups.highContrastLook);
            if (cone) cones.set(id, viewer.entities.add(cone));
          }
        }
      });
      entityGroups.cctv = [...live.values()].map((v) => v.entity).concat([...cones.values()]);
      // Plain camera list for aircraft→camera hand-off (tracking chip).
      entityGroups.cctvCams = [...live.values()].flatMap((v) => (v.item.kind === "cam" ? [v.item.cam] : []));
    };

    const load = async () => {
      if (disposed || legacy) return;
      const rect = viewer.camera.computeViewRectangle?.(viewer.scene.globe.ellipsoid);
      const zoom = zoomFromHeight(viewer.camera.positionCartographic?.height ?? 1e7);
      const raw = rect ? rectToBBox(rect) : { west: -180, south: -90, east: 180, north: 90 };
      // Rounding only applies to non-wrapping boxes; wrapping ones go as-is.
      const bbox = raw.west <= raw.east ? roundBBox(raw, zoom) : raw;
      const key = bboxKey(bbox, zoom);
      if (key === lastKey) return;
      lastKey = key;
      inflight?.abort();
      const ctl = new AbortController();
      inflight = ctl;
      try {
        const data = await fetchIntelCctvBbox(bbox, zoom, budget, ctl.signal);
        if (disposed || ctl.signal.aborted) return;
        if (data.gated_by) {
          logger.swallow("cesium-layers:cctv-server-gated", new Error(data.gated_by), "debug");
          return;
        }
        const next = new Map<string, Item>();
        if (data.mode === "clusters") {
          for (const cl of data.clusters ?? []) {
            // A 1-camera cluster renders as a bubble too; clicking zooms in.
            next.set(`${CLUSTER_PREFIX}${cl.id}`, { kind: "cluster", cl });
          }
        } else {
          if (!data.mode) legacy = true; // old deployment: full list, render once
          const cams = data.cameras ?? [];
          const credits = data.attribution ?? {};
          for (const cam of legacy ? cams : cams.slice(0, budget)) {
            if (filter && !filter(cam.lat, cam.lng)) continue;
            next.set(`cctv-${cam.id}`, { kind: "cam", cam: { ...cam, attribution: cam.attribution ?? credits[cam.source] } });
          }
        }
        render(next);
        setCredit(attributionLine(data.attribution ?? Object.fromEntries(Object.keys(data.sources ?? {}).map((s) => [s, s]))));
      } catch (err) {
        if (ctl.signal.aborted) return;
        lastKey = ""; // allow retry on next move
        logger.swallow("cesium-layers:cctv-fetch", err, "warn");
      } finally {
        if (inflight === ctl) inflight = null;
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void load(); }, DEBOUNCE_MS);
    };
    const removeMoveListener = viewer.camera.moveEnd.addEventListener(schedule);
    void load();

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: { x: number; y: number } }) => {
      const picked = viewer.scene.pick(click.position);
      const rawId = picked?.id?.id as string | undefined;
      if (!rawId) return;
      const pickedId = rawId.endsWith(CONE_SUFFIX) ? rawId.slice(0, -CONE_SUFFIX.length) : rawId;
      const hit = live.get(pickedId);
      if (!hit) return;
      if (hit.item.kind === "cam") { onOpenCamera(hit.item.cam); return; }
      const { lat, lng } = hit.item.cl;
      const h = viewer.camera.positionCartographic?.height ?? 5e6;
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lng, lat, Math.max(20_000, h / 4)), duration: 0.8 });
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    entityGroups.cctvClickHandler = handler;

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      inflight?.abort();
      try { removeMoveListener?.(); } catch (err) { logger.swallow("cesium-layers:cctv-move", err); }
      setCredit("");
      if (entityGroups.cctvClickHandler) {
        try { entityGroups.cctvClickHandler.destroy(); }
        catch (err) { logger.swallow("cesium-layers:destroy-cctv-handler", err); }
        entityGroups.cctvClickHandler = null;
      }
    };
  }, [layers.cctv, loading, onOpenCamera, filter, viewerRef, cesiumRef, entityGroupsRef]);
}
