"use client";

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { escapeHtml } from "@/lib/security";
import { createPinCanvas } from "../pin-canvas";
import { getRadioFrequenciesWithLocation } from "@/lib/supabase/db";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const FREQ_COLORS: Record<string, string> = {
  state_police: "#3b82f6",
  city_pd: "#1d4ed8",
  sheriff: "#6366f1",
  fire: "#f97316",
  ems: "#22c55e",
  federal: "#a855f7",
  interop: "#06b6d4",
  emergency_management: "#eab308",
  custom: "#6b7280",
};

function getColor(category: string): string {
  return FREQ_COLORS[category] ?? "#6b7280";
}

export function useFrequencyLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  companyId: string;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, companyId } = params;

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const entityGroups = entityGroupsRef.current;
    let cancelled = false;

    entityGroups.frequencies ??= [];
    entityGroups.freqData ??= new Map<string, { freqHz: number; mode: string }>();

    (entityGroups.frequencies as { id: string }[]).forEach((e) => {
      try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-freq-entity", e_); }
    });
    entityGroups.frequencies = [];
    (entityGroups.freqData as Map<string, { freqHz: number; mode: string }>).clear();

    if (!layers.radioFrequencies || !companyId) return;

    (async () => {
      try {
        const freqs = await getRadioFrequenciesWithLocation(companyId);
        if (cancelled) return;
        for (const f of freqs) {
          if (f.latitude == null || f.longitude == null) continue;
          const color = getColor(f.category);
          const freqMhz = f.frequency.toFixed(4);
          const mode = (f.mode || "FM").toLowerCase();
          const entityId = `freq-${f.id}`;

          (entityGroups.freqData as Map<string, { freqHz: number; mode: string }>)
            .set(entityId, { freqHz: f.frequency * 1_000_000, mode });

          const description = `<div style="font-family:monospace;font-size:11px;line-height:1.7">
            <b>${escapeHtml(f.name)}</b>
            <div style="margin:4px 0"><span style="color:${color};font-weight:bold">${escapeHtml(freqMhz)} MHz</span> <span style="opacity:0.6">${escapeHtml(f.mode || "FM")}</span></div>
            ${f.ctcss_dcs ? `<div style="opacity:0.7;font-size:10px">Tone: ${escapeHtml(f.ctcss_dcs)}</div>` : ""}
            ${f.city ? `<div style="opacity:0.5;font-size:10px">${escapeHtml(f.city)}${f.state ? `, ${escapeHtml(f.state)}` : ""}</div>` : f.state ? `<div style="opacity:0.5;font-size:10px">${escapeHtml(f.state)}</div>` : ""}
            ${f.description ? `<div style="opacity:0.7;margin-top:4px">${escapeHtml(f.description)}</div>` : ""}
            <div style="margin-top:6px;opacity:0.8;font-size:10px;color:#dd8c33">Double-click this pin to tune the SDR</div>
          </div>`;

          const entity = viewer.entities.add({
            id: entityId,
            name: `${freqMhz} MHz — ${f.name}`,
            position: Cesium.Cartesian3.fromDegrees(f.longitude, f.latitude, 5),
            billboard: {
              image: createPinCanvas(color, "alert"),
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              scale: 0.5,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              disableDepthTestDistance: 500_000,
            },
            label: {
              text: `${freqMhz} MHz`,
              font: "9px monospace",
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              outlineWidth: 2,
              outlineColor: Cesium.Color.BLACK,
              fillColor: Cesium.Color.fromCssColorString(color),
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -28),
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              disableDepthTestDistance: 500_000,
              scale: 0.8,
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000),
            },
            description,
          });
          (entityGroups.frequencies as { id: string }[]).push(entity);
        }

        // Register double-click handler to tune SDR
        const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
        handler.setInputAction((click: { position: { x: number; y: number } }) => {
          if (cancelled) return;
          const picked = viewer.scene.pick(click.position);
          if (!Cesium.defined(picked) || !picked.id?.id) return;
          const entityId = picked.id.id as string;
          if (!entityId.startsWith("freq-")) return;
          const data = (entityGroups.freqData as Map<string, { freqHz: number; mode: string }>).get(entityId);
          if (!data) return;
          import("@/hooks/use-sdr").then((m) => m.globalTune(data.freqHz, data.mode as "fm" | "nfm" | "am"));
        }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);
        entityGroups.freqClickHandler = handler;
      } catch (e) {
        logger.swallow("frequency-layer:fetch", e, "warn");
      }
    })();

    return () => {
      cancelled = true;
      if (entityGroups.freqClickHandler) {
        try { entityGroups.freqClickHandler.destroy(); }
        catch (e) { logger.swallow("cesium-layers:destroy-freq-handler", e); }
        entityGroups.freqClickHandler = null;
      }
    };
  }, [layers.radioFrequencies, companyId, loading, viewerRef, cesiumRef, entityGroupsRef]);
}
