/**
 * OpenStreetMap infrastructure layer (Infrastructure > "Data centres, dams,
 * power & military"; power = US substations and transmission lines). Reads the pre-built, cached extract in
 * /overwatch/data/infra (see scripts/build-infra-extract.mjs): the index
 * once, then only the 10° cells under the view, and only when zoomed in
 * below INFRA_MAX_HEIGHT_M. No live API calls. Credit: © OpenStreetMap
 * contributors (ODbL).
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";
import {
  INFRA_CREDIT, INFRA_KINDS, INFRA_LABEL_DISTANCE_M, INFRA_LINE_LIFT_M, INFRA_LINE_TERRAIN_LEVEL, INFRA_MAX_SAMPLED_VERTICES,
  decodeInfraLine, densifyLine, infraLimits, keepInfraFeature, lineInView, lineStyle, nearestLines,
  decodeInfraRow, infraCellsForView, type InfraCell, type InfraFeature, type InfraIndex,
} from "@/lib/map/infra-extract";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export const INFRA_BASE = "/overwatch/data/infra";
const DEBOUNCE_MS = 450;
/** Renders requested after a refresh (SETTLE_RENDERS × SETTLE_INTERVAL_MS ≈ 3 s). */
const SETTLE_RENDERS = 12;
const SETTLE_INTERVAL_MS = 250;


let indexPromise: Promise<InfraIndex | null> | null = null;
const cellCache = new Map<string, Promise<InfraCell | null>>();

function loadIndex(): Promise<InfraIndex | null> {
  indexPromise ??= fetch(`${INFRA_BASE}/index.json`)
    .then((r) => (r.ok ? (r.json() as Promise<InfraIndex>) : null))
    .catch((err) => { logger.swallow("infra-layer:index", err, "warn"); indexPromise = null; return null; });
  return indexPromise;
}

function loadCell(key: string): Promise<InfraCell | null> {
  let p = cellCache.get(key);
  if (!p) {
    p = fetch(`${INFRA_BASE}/c_${key}.json`)
      .then((r) => (r.ok ? (r.json() as Promise<InfraCell>) : null))
      .catch((err) => { logger.swallow("infra-layer:cell", err, "warn"); cellCache.delete(key); return null; });
    cellCache.set(key, p);
  }
  return p;
}

function popup(f: InfraFeature, built: string): string {
  const color = INFRA_KINDS[f.kind].color;
  const link = f.osmUrl
    ? `<div><a href="${escapeHtml(f.osmUrl)}" target="_blank" rel="noopener" style="color:#93c5fd">View on OpenStreetMap</a></div>`
    : "";
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b style="color:${color}">${escapeHtml(f.name)}</b>
    <div>${escapeHtml(f.detail)}</div>${link}
    <div style="color:#94a3b8;margin-top:4px">${escapeHtml(INFRA_CREDIT)} · extract ${escapeHtml(built)}</div>
  </div>`;
}

export function useInfraLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  enabled: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, enabled } = params;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading || !enabled) return;
    const groups = entityGroupsRef.current;

    let disposed = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    // Under requestRenderMode, ground-clamped points get their terrain height a few
    // frames after they are added; keep rendering briefly so they appear without
    // waiting for the next camera move or idle tick.
    let settle: ReturnType<typeof setInterval> | null = null;
    const settleRenders = () => {
      if (settle) clearInterval(settle);
      let left = SETTLE_RENDERS;
      settle = setInterval(() => {
        if (disposed || --left < 0) { if (settle) clearInterval(settle); settle = null; return; }
        try { viewer.scene.requestRender(); } catch { /* viewer gone */ }
      }, SETTLE_INTERVAL_MS);
    };
    let shown = "";
    let drawGeneration = 0;
    const source = new Cesium.CustomDataSource("osm-infrastructure");
    viewer.dataSources.add(source);
    groups.osmInfraSource = source;
    let credit: unknown = null;
    const setCredit = (on: boolean) => {
      const cd = viewer.creditDisplay;
      try {
        if (credit) { cd?.removeStaticCredit?.(credit); credit = null; }
        if (on) { credit = new Cesium.Credit(escapeHtml(INFRA_CREDIT), false); cd?.addStaticCredit?.(credit); }
      } catch (err) { logger.swallow("infra-layer:credit", err, "debug"); }
    };

    const colors = Object.fromEntries(
      Object.entries(INFRA_KINDS).map(([k, v]) => [k, Cesium.Color.fromCssColorString(v.color)]),
    );
    // Phones: fewer cells, closer zoom, no labels (tap a point for its name).
    const limits = infraLimits(isConstrainedDevice());
    const labelShow = new Cesium.DistanceDisplayCondition(0, INFRA_LABEL_DISTANCE_M);
    const lineColors: Record<string, unknown> = {};

    const refresh = async () => {
      if (disposed) return;
      const height = viewer.camera.positionCartographic?.height ?? 1e7;
      const index = await loadIndex();
      if (disposed || !index) return;
      const rect = viewer.camera.computeViewRectangle?.(viewer.scene.globe.ellipsoid);
      let keys: string[] = [];
      let view: { west: number; south: number; east: number; north: number } | null = null;
      if (rect && height <= limits.maxHeightM) {
        const deg = Cesium.Math.toDegrees;
        view = { west: deg(rect.west), south: deg(rect.south), east: deg(rect.east), north: deg(rect.north) };
        keys = infraCellsForView(view, index.cells, index.cell).slice(0, limits.maxCells);
      }
      // Power follows height and (for lines) the view inside a cell, so both are part of what is "shown".
      const linesOn = !!view && height <= limits.powerMaxHeightM;
      const key = keys.join(",") + (linesOn && view
        ? `|lines:${[view.west, view.south, view.east, view.north].map((d) => Math.round(d)).join(",")}`
        : "");
      if (key === shown) return;
      const cells = await Promise.all(keys.map(loadCell));
      if (disposed) return;
      shown = key;
      const generation = ++drawGeneration;
      const lineEntities: Array<{ entity: { polyline?: { positions?: unknown } }; pts: Array<[number, number]> }> = [];
      source.entities.suspendEvents();
      try {
        source.entities.removeAll();
        let n = 0;
        for (const cell of cells) {
          for (const row of cell?.f ?? []) {
            const f = decodeInfraRow(row);
            if (!f || !keepInfraFeature(f, limits, height)) continue;
            source.entities.add({
              id: `infra-${f.kind}-${n++}`,
              name: f.name,
              position: Cesium.Cartesian3.fromDegrees(f.lng, f.lat, 0),
              point: {
                pixelSize: f.kind === "m" ? 7 : f.kind === "s" && (f.kv ?? 0) < 230 ? 4 : 6,
                color: colors[f.kind],
                outlineColor: Cesium.Color.BLACK.withAlpha(0.8),
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                // Near side reads over terrain; the globe hides the far side (#107). Shared per viewer.
                disableDepthTestDistance: nearSideDepthProperty(viewer, Cesium),
              },
              // Labels skip the many small substations (their name is in the popup).
              label: limits.labels && !(f.kind === "s" && (f.kv ?? 0) < 230) ? {
                text: f.name,
                font: "10px sans-serif",
                fillColor: colors[f.kind],
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -12),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                distanceDisplayCondition: labelShow,
              } : undefined,
              description: popup(f, index.built),
            });
          }
        }
        // Transmission lines (ODbL, US): only when zoomed in, capped per view.
        if (linesOn && view) {
          const inView: Array<{ kv: number; pts: Array<[number, number]> }> = [];
          for (const cell of cells) {
            for (const raw of cell?.l ?? []) {
              const line = decodeInfraLine(raw);
              if (line && lineInView(line.pts, view)) inView.push(line);
            }
          }
          // Over the cap, keep the lines nearest where the camera looks (screen centre).
          const canvas = viewer.scene.canvas;
          const centre = viewer.camera.pickEllipsoid?.(
            new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2),
            viewer.scene.globe.ellipsoid,
          );
          const cg = centre
            ? Cesium.Cartographic.fromCartesian(centre)
            : viewer.camera.positionCartographic;
          const focus = { lng: Cesium.Math.toDegrees(cg.longitude), lat: Cesium.Math.toDegrees(cg.latitude) };
          const drawn = nearestLines(inView, focus, limits.maxLines);
          for (const line of drawn) {
            const st = lineStyle(line.kv);
            const label = line.kv > 0 ? `${line.kv} kV transmission line` : "Transmission line";
            const entity = source.entities.add({
              id: `infra-l-${n++}`,
              name: label,
              // Not ground-clamped: clamped (ground-primitive) lines hid the layer's clamped
              // points under the reduced-quality renderer, and cost far more. Lines start on the
              // ellipsoid and are lifted onto sampled terrain heights below (3D terrain on).
              // Only lines inside the current view are drawn, so none reach the far side.
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(line.pts.flat()),
                width: st.width,
                arcType: Cesium.ArcType.GEODESIC,
                material: (lineColors[st.color] ??= Cesium.Color.fromCssColorString(st.color).withAlpha(0.85)),
                depthFailMaterial: (lineColors[`${st.color}-df`] ??= Cesium.Color.fromCssColorString(st.color).withAlpha(0.4)),
              },
              description: `<div style="font-family:monospace;font-size:11px">${escapeHtml(label)}<br/><span style="color:#94a3b8">${escapeHtml(INFRA_CREDIT)} · extract ${escapeHtml(index.built)}</span></div>`,
            });
            lineEntities.push({ entity, pts: line.pts });
          }
        }
        setCredit(n > 0);
      } finally {
        source.entities.resumeEvents();
      }
      settleRenders();
      if (lineEntities.length) void liftLines(lineEntities, generation);
    };

    // With 3D terrain on, lines on the ellipsoid sink under hills and mountains. Sample the
    // ground once per drawn view (coarse level, densified vertices) and lift them onto it.
    const liftLines = async (
      items: Array<{ entity: { polyline?: { positions?: unknown } }; pts: Array<[number, number]> }>,
      generation: number,
    ) => {
      const tp = viewer.terrainProvider;
      if (!tp || tp instanceof Cesium.EllipsoidTerrainProvider) return;
      let dense = items.map((it) => densifyLine(it.pts));
      if (dense.reduce((a, d) => a + d.length, 0) > INFRA_MAX_SAMPLED_VERTICES) dense = items.map((it) => it.pts);
      const cartos = dense.flat().map(([lng, lat]) => Cesium.Cartographic.fromDegrees(lng, lat));
      try {
        const sampled = await Cesium.sampleTerrain(tp, INFRA_LINE_TERRAIN_LEVEL, cartos);
        if (disposed || generation !== drawGeneration) return;
        let i = 0;
        source.entities.suspendEvents();
        try {
          dense.forEach((pts, k) => {
            const flat: number[] = [];
            for (const [lng, lat] of pts) {
              const h = sampled[i++]?.height;
              flat.push(lng, lat, (Number.isFinite(h) ? h : 0) + INFRA_LINE_LIFT_M);
            }
            const pl = items[k].entity.polyline;
            if (pl) pl.positions = Cesium.Cartesian3.fromDegreesArrayHeights(flat);
          });
        } finally {
          source.entities.resumeEvents();
        }
        viewer.scene.requestRender();
      } catch (err) {
        logger.swallow("infra-layer:terrain", err, "debug");
      }
    };

    const schedule = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void refresh(); }, DEBOUNCE_MS);
    };
    const removeMove = viewer.camera.moveEnd.addEventListener(schedule);
    void refresh();

    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      if (settle) clearInterval(settle);
      try { removeMove?.(); } catch (err) { logger.swallow("infra-layer:move", err, "debug"); }
      setCredit(false);
      try { viewer.dataSources.remove(source, true); } catch (err) { logger.swallow("infra-layer:remove", err, "debug"); }
      groups.osmInfraSource = null;
    };
  }, [enabled, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
