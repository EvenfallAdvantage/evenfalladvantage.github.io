/**
 * OSM critical-infrastructure layer (panel v2): data centres, substations,
 * water treatment and military bases from static 10x10-deg cells under
 * /data/infra/, built offline by scripts/fetch-infra-extract.mjs. Loads only
 * the cells in view on camera moveEnd and only while zoomed below 2,500 km.
 * Credit: (c) OpenStreetMap contributors (ODbL).
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { escapeHtml, safeHttpUrl } from "@/lib/security";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import {
  decodeInfraLine, decodeInfraRow, INFRA_KINDS, infraCellsForView, infraContrastStyle, infraLimits, keepInfraFeature, lineInView, lineStyle, nearestLines,
  type InfraCell, type InfraFeature, type InfraIndex,
} from "@/lib/map/infra-extract";
import { getInfraIcon, iconSize } from "@/lib/map/tactical-icons";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const BASE = "/overwatch/data/infra";
let indexPromise: Promise<InfraIndex | null> | null = null;
const cellCache = new Map<string, Promise<InfraCell | null>>();

function loadIndex(): Promise<InfraIndex | null> {
  if (!indexPromise) {
    indexPromise = fetch(`${BASE}/index.json`).then((r) => (r.ok ? (r.json() as Promise<InfraIndex>) : null)).catch((e) => {
      logger.swallow("infra:index", e, "warn");
      indexPromise = null;
      return null;
    });
  }
  return indexPromise;
}

function loadCell(key: string): Promise<InfraCell | null> {
  let p = cellCache.get(key);
  if (!p) {
    p = fetch(`${BASE}/c_${key}.json`).then((r) => (r.ok ? (r.json() as Promise<InfraCell>) : null)).catch((e) => {
      logger.swallow("infra:cell", e, "warn");
      cellCache.delete(key);
      return null;
    });
    cellCache.set(key, p);
  }
  return p;
}

function toDeg(rad: number): number { return (rad * 180) / Math.PI; }

function buildPopup(f: InfraFeature): string {
  const meta = INFRA_KINDS[f.kind];
  const link = f.osmUrl ? safeHttpUrl(f.osmUrl) : null;
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7;max-width:260px">
    <b style="color:${meta.color}">${escapeHtml(f.name || meta.label)}</b>
    <div>${escapeHtml(f.detail)}</div>
    ${link ? `<div><a href="${escapeHtml(link)}" target="_blank" rel="noopener noreferrer" style="color:#38bdf8">OpenStreetMap →</a></div>` : ""}
    <div style="color:#64748b;margin-top:4px;font-size:9px">© OpenStreetMap contributors (ODbL)</div>
  </div>`;
}

export function useInfraLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  enabled: boolean;
  highContrast: boolean;
  filter?: (lat: number, lng: number) => boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, enabled, highContrast, filter } = params;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;
    const entityGroups = entityGroupsRef.current;

    const clear = () => {
      for (const e of (entityGroups.infra ?? []) as Array<{ id: string }>) {
        try { viewer.entities.removeById(e.id); } catch (err) { logger.swallow("infra:remove", err); }
      }
      entityGroups.infra = [];
    };
    clear();
    if (!enabled) return;

    let cancelled = false;
    let runSeq = 0;
    const limits = infraLimits(isConstrainedDevice());
    const contrast = infraContrastStyle(highContrast);

    async function refresh() {
      const seq = ++runSeq;
      const height = viewer.camera?.positionCartographic?.height ?? Infinity;
      if (height > limits.maxHeightM) { clear(); viewer.scene.requestRender(); return; }
      const index = await loadIndex();
      if (cancelled || seq !== runSeq || !index) return;

      const r = viewer.camera.computeViewRectangle();
      const view = r
        ? { west: toDeg(r.west), south: toDeg(r.south), east: toDeg(r.east), north: toDeg(r.north) }
        : { west: -180, south: -90, east: 180, north: 90 };
      const keys = infraCellsForView(view, index.cells, limits.maxCells);
      const cells = await Promise.all(keys.map(loadCell));
      if (cancelled || seq !== runSeq) return;

      clear();
      let idx = 0;

      // Collect in-view point features and prioritize strategic facilities
      // (data centres, water treatment, military) ahead of dense substations,
      // capped at limits.maxPoints so dense urban cells never stall WebGL.
      const primaryFeatures: InfraFeature[] = [];
      const substationFeatures: InfraFeature[] = [];
      for (const cell of cells) {
        for (const raw of cell?.f ?? []) {
          const f = decodeInfraRow(raw);
          if (!f || !keepInfraFeature(f, limits, height)) continue;
          if (filter && !filter(f.lat, f.lng)) continue;
          if (f.kind === "s") substationFeatures.push(f);
          else primaryFeatures.push(f);
        }
      }
      const selectedFeatures = primaryFeatures.length >= limits.maxPoints
        ? primaryFeatures.slice(0, limits.maxPoints)
        : primaryFeatures.concat(substationFeatures.slice(0, limits.maxPoints - primaryFeatures.length));

      for (const f of selectedFeatures) {
        const meta = INFRA_KINDS[f.kind];
        const entity = viewer.entities.add({
          id: `infra-${idx++}`,
          name: f.name || meta.label,
          position: Cesium.Cartesian3.fromDegrees(f.lng, f.lat, 5),
          billboard: {
            image: getInfraIcon(f.kind, meta.color, { highContrast }),
            ...iconSize(getInfraIcon(f.kind, meta.color, { highContrast })),
            // ~8–9 px on screen, close to the pre-#215 4–7 px dots while keeping glyphs legible.
            scale: f.kind === "s" ? 0.45 : 0.4,
            verticalOrigin: Cesium.VerticalOrigin.CENTER,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: nearSideDepthProperty(viewer, Cesium),
          },
          label: limits.labels && f.name ? {
            text: f.name,
            font: "9px monospace",
            fillColor: Cesium.Color.fromCssColorString(contrast.labelFill ?? meta.color),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -14),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: nearSideDepthProperty(viewer, Cesium),
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 250_000),
          } : undefined,
          description: buildPopup(f),
        });
        (entityGroups.infra as Array<{ id: string }>).push(entity);
      }

      if (height <= limits.powerMaxHeightM) {
        const candidates = [];
        for (const cell of cells) {
          for (const raw of cell?.l ?? []) {
            const line = decodeInfraLine(raw);
            if (!line || !lineInView(line.pts, view)) continue;
            if (filter && !line.pts.some(([lng, lat]) => filter(lat, lng))) continue;
            candidates.push(line);
          }
        }
        const cp = viewer.camera?.positionCartographic;
        const focus = cp
          ? { lng: toDeg(cp.longitude), lat: toDeg(cp.latitude) }
          : { lng: (view.west + view.east) / 2, lat: (view.south + view.north) / 2 };
        const chosen = nearestLines(candidates, focus, limits.maxLines);
        for (const line of chosen) {
          const s = lineStyle(line.kv);
          const mat = Cesium.Color.fromCssColorString(contrast.lineColor ?? s.color).withAlpha(contrast.lineAlpha);
          const flat = line.pts.flatMap(([lng, lat]) => [lng, lat]);
          const entity = viewer.entities.add({
            id: `infra-line-${idx++}`,
            name: `${line.kv} kV transmission line`,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray(flat),
              width: s.width + contrast.lineWidthBoost,
              material: mat,
              clampToGround: true,
            },
            description: `<div style="font-family:monospace;font-size:11px;line-height:1.7"><b style="color:${s.color}">${line.kv} kV transmission line</b><div>High-voltage grid corridor</div><div style="color:#64748b;margin-top:4px;font-size:9px">© OpenStreetMap contributors (ODbL)</div></div>`,
          });
          (entityGroups.infra as Array<{ id: string }>).push(entity);
        }
      }
      viewer.scene.requestRender();
    }

    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    const onMove = () => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => void refresh(), 220);
    };
    void refresh();
    viewer.camera.moveEnd.addEventListener(onMove);
    return () => {
      cancelled = true;
      if (moveTimer) clearTimeout(moveTimer);
      try { viewer.camera.moveEnd.removeEventListener(onMove); } catch { /* viewer gone */ }
      clear();
    };
  }, [enabled, highContrast, loading, viewerRef, cesiumRef, entityGroupsRef, filter]);
}
