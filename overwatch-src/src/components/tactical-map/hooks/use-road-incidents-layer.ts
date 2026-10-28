/**
 * Road Closures & Crashes layer (viewport-driven).
 *
 * Fetches live road closures, crashes, lane restrictions, chain controls, and
 * work zones from `/intel-traffic` (Caltrans CWWP2, State/Provincial 511 feeds,
 * Iowa DOT, DriveBC, Austin, TfL, Fintraffic Digitraffic, and TomTom Incident
 * Details v5 when configured).
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import { setVisibleInterval } from "@/lib/visible-interval";
import { fetchIntelTrafficIncidents } from "@/lib/intel-client";
import { INTEL_LAYER_FLAGS } from "@/lib/intel-feature-flags";
import type { IntelRoadIncident, RoadIncidentKind, RoadIncidentSeverity } from "@/lib/intel-types";
import { isConstrainedDevice, withSuspendedEvents } from "@/lib/map/device-profile";
import { bboxKey, diffIds, rectToBBox, roundBBox, zoomFromHeight } from "@/lib/map/cctv-viewport";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const DEBOUNCE_MS = 450;
const REFRESH_MS = 4 * 60_000;
const ENTITY_PREFIX = "road-inc-";

export function roadIncidentColor(kind: RoadIncidentKind): string {
  switch (kind) {
    case "closure":
      return "#dc2626";
    case "crash":
    case "hazard":
      return "#ef4444";
    case "construction":
      return "#f59e0b";
    case "congestion":
      return "#eab308";
  }
}

export function roadIncidentLabel(kind: RoadIncidentKind): string {
  switch (kind) {
    case "closure":
      return "ROAD CLOSURE";
    case "crash":
      return "CRASH";
    case "construction":
      return "WORK ZONE";
    case "hazard":
      return "ROAD HAZARD";
    case "congestion":
      return "CONGESTION";
  }
}

const iconCache = new Map<string, HTMLCanvasElement>();

function buildIncidentIcon(kind: RoadIncidentKind, severity: RoadIncidentSeverity): HTMLCanvasElement {
  const key = `${kind}:${severity}`;
  const cached = iconCache.get(key);
  if (cached) return cached;

  const size = severity === "critical" || severity === "major" ? 20 : 16;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return canvas;

  const r = size / 2;
  const color = roadIncidentColor(kind);

  ctx.fillStyle = color;
  ctx.beginPath();
  if (kind === "construction") {
    // Diamond marker for work zones
    ctx.moveTo(r, 1.5);
    ctx.lineTo(size - 1.5, r);
    ctx.lineTo(r, size - 1.5);
    ctx.lineTo(1.5, r);
    ctx.closePath();
  } else {
    ctx.arc(r, r, r - 1.5, 0, Math.PI * 2);
  }
  ctx.fill();

  ctx.strokeStyle = "rgba(255,255,255,0.95)";
  ctx.lineWidth = 1.4;
  ctx.stroke();

  ctx.fillStyle = "#ffffff";
  if (kind === "closure") {
    // Horizontal "do not enter" bar
    const barW = size * 0.48;
    const barH = Math.max(2, size * 0.14);
    ctx.fillRect(r - barW / 2, r - barH / 2, barW, barH);
  } else {
    ctx.font = `bold ${size >= 20 ? 11 : 9}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const glyph = kind === "crash" || kind === "hazard" ? "!" : kind === "construction" ? "W" : "~";
    ctx.fillText(glyph, r, r + 0.5);
  }

  iconCache.set(key, canvas);
  return canvas;
}

export function buildRoadIncidentPopup(inc: IntelRoadIncident): string {
  const color = roadIncidentColor(inc.kind);
  const badge = roadIncidentLabel(inc.kind);
  const roadLine = [inc.road, inc.direction].filter(Boolean).join(" · ");
  const desc = inc.description && inc.description !== inc.title ? inc.description : "";
  return `<div style="font-family:monospace;font-size:11px;line-height:1.6">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:2px">
      <span style="background:${color};color:#fff;padding:1px 5px;border-radius:3px;font-size:9px;font-weight:700">${escapeHtml(badge)}</span>
      <span style="color:#cbd5e1;font-size:10px;text-transform:uppercase">${escapeHtml(inc.severity)}</span>
    </div>
    <b style="color:#f8fafc">${escapeHtml(inc.title)}</b>
    ${roadLine ? `<div style="color:#38bdf8">${escapeHtml(roadLine)}</div>` : ""}
    ${desc ? `<div style="color:#cbd5e1;margin-top:3px">${escapeHtml(desc)}</div>` : ""}
    <div style="color:#94a3b8;margin-top:4px;font-size:10px">${escapeHtml(inc.attribution)}</div>
  </div>`;
}

export function useRoadIncidentsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  debouncedReplayTime?: number;
  timeMachineOpen?: boolean;
  filter?: (lat: number, lng: number) => boolean;
}) {
  const {
    viewerRef,
    cesiumRef,
    entityGroupsRef,
    loading,
    layers,
    debouncedReplayTime = 0,
    timeMachineOpen = false,
    filter,
  } = params;
  const isReplaying = timeMachineOpen && debouncedReplayTime < Date.now() - 5000;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;
    const entityGroups = entityGroupsRef.current;

    const clearAll = () => {
      for (const e of (entityGroups.roadIncidents ?? []) as Array<{ id: string }>) {
        try {
          viewer.entities.removeById(e.id);
        } catch (err) {
          logger.swallow("cesium-layers:remove-road-incident", err);
        }
      }
      entityGroups.roadIncidents = [];
    };
    clearAll();

    if (!layers.roadIncidents || isReplaying || !INTEL_LAYER_FLAGS.road_incidents.enabled) {
      return;
    }

    let disposed = false;
    let lastKey = "";
    let timer: ReturnType<typeof setTimeout> | null = null;
    let inflight: AbortController | null = null;
    let credit: unknown = null;
    const live = new Map<string, { id: string }>();
    const budget = isConstrainedDevice() ? 150 : 500;

    const setCredit = (attributions: string[]) => {
      const cd = viewer.creditDisplay;
      try {
        if (credit) cd?.removeStaticCredit?.(credit);
        const text = attributions.length ? `Road incidents: ${attributions.join(" · ")}` : "";
        credit = text ? new Cesium.Credit(escapeHtml(text), false) : null;
        if (credit) cd?.addStaticCredit?.(credit);
      } catch (err) {
        logger.swallow("cesium-layers:road-incidents-credit", err);
      }
    };

    const render = (items: IntelRoadIncident[]) => {
      const next = new Map<string, IntelRoadIncident>();
      for (const inc of items) {
        if (!Number.isFinite(inc.lat) || !Number.isFinite(inc.lng)) continue;
        if (filter && !filter(inc.lat, inc.lng)) continue;
        next.set(`${ENTITY_PREFIX}${inc.id}`, inc);
        if (next.size >= budget) break;
      }

      const { add, remove } = diffIds(live.keys(), next.keys());
      if (!add.length && !remove.length) return;

      withSuspendedEvents(viewer.entities, () => {
        for (const id of remove) {
          try {
            viewer.entities.removeById(id);
          } catch (err) {
            logger.swallow("cesium-layers:remove-road-incident", err);
          }
          live.delete(id);
        }
        for (const id of add) {
          const inc = next.get(id)!;
          const entity = viewer.entities.add({
            id,
            name: inc.title,
            position: Cesium.Cartesian3.fromDegrees(inc.lng, inc.lat, 8),
            billboard: {
              image: buildIncidentIcon(inc.kind, inc.severity),
              scale: 1.0,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.CENTER,
              disableDepthTestDistance: nearSideDepthProperty(viewer, Cesium),
            },
            description: buildRoadIncidentPopup(inc),
          });
          live.set(id, entity);
        }
      });

      entityGroups.roadIncidents = [...live.values()];
      viewer.scene?.requestRender?.();
    };

    const load = async (force = false) => {
      if (disposed) return;
      const rect = viewer.camera.computeViewRectangle?.(viewer.scene.globe.ellipsoid);
      const zoom = zoomFromHeight(viewer.camera.positionCartographic?.height ?? 1e7);
      const raw = rect ? rectToBBox(rect) : { west: -130, south: 24, east: -65, north: 52 };
      const bbox = raw.west <= raw.east ? roundBBox(raw, Math.min(zoom, 10)) : raw;
      const key = bboxKey(bbox, Math.min(zoom, 10));
      if (!force && key === lastKey) return;
      lastKey = key;

      inflight?.abort();
      const ctl = new AbortController();
      inflight = ctl;
      try {
        const data = await fetchIntelTrafficIncidents({
          bbox,
          limit: budget,
          signal: ctl.signal,
        });
        if (disposed || ctl.signal.aborted) return;
        render(data.incidents ?? []);
        setCredit(data.attributions ?? []);
      } catch (err) {
        if (ctl.signal.aborted) return;
        lastKey = "";
        logger.swallow("cesium-layers:road-incidents-fetch", err, "warn");
      } finally {
        if (inflight === ctl) inflight = null;
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        void load(false);
      }, DEBOUNCE_MS);
    };

    const removeMoveListener = viewer.camera.moveEnd.addEventListener(schedule);
    void load(true);
    const stopInterval = setVisibleInterval(() => void load(true), REFRESH_MS);

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      stopInterval();
      inflight?.abort();
      try {
        removeMoveListener?.();
      } catch (err) {
        logger.swallow("cesium-layers:road-incidents-move", err);
      }
      setCredit([]);
      clearAll();
    };
  }, [layers.roadIncidents, isReplaying, loading, filter, viewerRef, cesiumRef, entityGroupsRef]);
}
