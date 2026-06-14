import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { subscribeAdsb } from "@/lib/sdr/adsb-store";
import { createPinCanvas } from "../pin-canvas";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

function formatAltFt(m: number | null): string {
  if (m == null) return "";
  const ft = Math.round(m * 3.281);
  return ft > 1000 ? `FL${Math.round(ft / 100)}` : `${ft}ft`;
}

function formatSpeedKt(ms: number | null): string {
  if (ms == null) return "";
  return `${Math.round(ms * 1.944)}kt`;
}

export function useAdsbLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers } = params;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const entityGroups = entityGroupsRef.current;
    if (!entityGroups.adsbLocal) entityGroups.adsbLocal = [];

    if (!layers.adsbLocal) {
      (entityGroups.adsbLocal as { id: string }[]).forEach((e) => {
        try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("adsb-layer:remove", e_, "debug"); }
      });
      entityGroups.adsbLocal = [];
      return;
    }

    let activeIds = new Set<string>();

    const unsub = subscribeAdsb((aircraft) => {
      const v = viewerRef.current;
      const C = cesiumRef.current;
      if (!v || !C) return;

      const newIds = new Set<string>();

      for (const icao in aircraft) {
        const a = aircraft[icao];
        if (a.lat == null || a.lng == null) continue;
        const entityId = `adsb-${icao}`;
        newIds.add(entityId);

        const existing = v.entities.getById(entityId);
        const pos = C.Cartesian3.fromDegrees(a.lng, a.lat, a.altitude ?? 3000);

        if (existing) {
          existing.position = new C.ConstantPositionProperty(pos);
          if (existing.billboard) existing.billboard.rotation = -(a.heading ?? 0) * (Math.PI / 180);
          if (existing.label) existing.label.text = `${a.callsign || a.icao24}\n${formatAltFt(a.altitude)}`;
          existing.description = `<div style="font-family:monospace;font-size:11px;line-height:1.7">
            <b>${a.callsign || a.icao24}</b>
            <div>ICAO: ${a.icao24}</div>
            <div>Alt: ${formatAltFt(a.altitude)}</div>
            <div>Speed: ${formatSpeedKt(a.velocity)}</div>
            <div>Heading: ${(a.heading ?? 0).toFixed(0)}&deg;</div>
            <div>V/S: ${a.verticalRate != null ? (a.verticalRate > 0 ? "+" : "") + (a.verticalRate * 196.85).toFixed(0) + " fpm" : "—"}</div>
          </div>`;
        } else {
          const entity = v.entities.add({
            id: entityId,
            name: a.callsign || a.icao24,
            position: pos,
            billboard: {
              image: createPinCanvas("#22d3ee", "flag"),
              scale: 0.4,
              rotation: -(a.heading ?? 0) * (Math.PI / 180),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: `${a.callsign || a.icao24}\n${formatAltFt(a.altitude)}`,
              font: "9px monospace",
              fillColor: C.Color.fromCssColorString("#22d3ee"),
              outlineColor: C.Color.BLACK,
              outlineWidth: 2,
              style: C.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new C.Cartesian2(0, -18),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              scale: 0.8,
              distanceDisplayCondition: new C.DistanceDisplayCondition(0, 500000),
            },
            description: `<div style="font-family:monospace;font-size:11px;line-height:1.7">
              <b>${a.callsign || a.icao24}</b>
              <div>ICAO: ${a.icao24}</div>
              <div>Alt: ${formatAltFt(a.altitude)}</div>
              <div>Speed: ${formatSpeedKt(a.velocity)}</div>
              <div>Heading: ${(a.heading ?? 0).toFixed(0)}&deg;</div>
              <div>V/S: ${a.verticalRate != null ? (a.verticalRate > 0 ? "+" : "") + (a.verticalRate * 196.85).toFixed(0) + " fpm" : "—"}</div>
            </div>`,
          });
          entityGroupsRef.current.adsbLocal.push(entity);
        }
      }

      for (const id of activeIds) {
        if (!newIds.has(id)) {
          try { v.entities.removeById(id); } catch (e) { logger.swallow("adsb-layer:stale-remove", e, "debug"); }
        }
      }
      activeIds = newIds;
    });

    return () => {
      unsub();
      (entityGroups.adsbLocal ?? []).forEach((e: { id: string }) => {
        try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("adsb-layer:cleanup", e_, "debug"); }
      });
      entityGroups.adsbLocal = [];
    };
  }, [layers.adsbLocal, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
