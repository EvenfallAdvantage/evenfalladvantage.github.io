/**
 * OpenStreetMap infrastructure layer (Infrastructure > "Data centres, dams &
 * military areas"). Reads the pre-built, cached extract in
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
  INFRA_CREDIT, INFRA_KINDS, INFRA_LABEL_DISTANCE_M, infraLimits,
  decodeInfraRow, infraCellsForView, type InfraCell, type InfraFeature, type InfraIndex,
} from "@/lib/map/infra-extract";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export const INFRA_BASE = "/overwatch/data/infra";
const DEBOUNCE_MS = 450;


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
    let shown = "";
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

    const refresh = async () => {
      if (disposed) return;
      const height = viewer.camera.positionCartographic?.height ?? 1e7;
      const index = await loadIndex();
      if (disposed || !index) return;
      const rect = viewer.camera.computeViewRectangle?.(viewer.scene.globe.ellipsoid);
      let keys: string[] = [];
      if (rect && height <= limits.maxHeightM) {
        const deg = Cesium.Math.toDegrees;
        keys = infraCellsForView(
          { west: deg(rect.west), south: deg(rect.south), east: deg(rect.east), north: deg(rect.north) },
          index.cells, index.cell,
        ).slice(0, limits.maxCells);
      }
      const key = keys.join(",");
      if (key === shown) return;
      const cells = await Promise.all(keys.map(loadCell));
      if (disposed) return;
      shown = key;
      source.entities.suspendEvents();
      try {
        source.entities.removeAll();
        let n = 0;
        for (const cell of cells) {
          for (const row of cell?.f ?? []) {
            const f = decodeInfraRow(row);
            if (!f) continue;
            source.entities.add({
              id: `infra-${f.kind}-${n++}`,
              name: f.name,
              position: Cesium.Cartesian3.fromDegrees(f.lng, f.lat, 0),
              point: {
                pixelSize: f.kind === "m" ? 7 : 6,
                color: colors[f.kind],
                outlineColor: Cesium.Color.BLACK.withAlpha(0.8),
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                // Near side reads over terrain; the globe hides the far side (#107). Shared per viewer.
                disableDepthTestDistance: nearSideDepthProperty(viewer, Cesium),
              },
              label: limits.labels ? {
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
          for (const [kv, pts] of cell?.l ?? []) {
            if (pts.length < 2) continue;
            source.entities.add({
              id: `infra-l-${n++}`,
              name: `${kv} kV transmission line`,
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(pts.flat()),
                width: kv >= 500 ? 2 : 1.4,
                material: colors.s.withAlpha(0.7),
                clampToGround: true,
              },
              description: `<div style="font-family:monospace;font-size:11px">${kv} kV transmission line<br/><span style="color:#94a3b8">${escapeHtml(INFRA_CREDIT)}</span></div>`,
            });
          }
        }
        setCredit(n > 0);
      } finally {
        source.entities.resumeEvents();
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
      try { removeMove?.(); } catch (err) { logger.swallow("infra-layer:move", err, "debug"); }
      setCredit(false);
      try { viewer.dataSources.remove(source, true); } catch (err) { logger.swallow("infra-layer:remove", err, "debug"); }
      groups.osmInfraSource = null;
    };
  }, [enabled, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
