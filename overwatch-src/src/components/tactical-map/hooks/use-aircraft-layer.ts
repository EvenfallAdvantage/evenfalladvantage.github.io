import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import { subscribeAdsb } from "@/lib/sdr/adsb-store";
import type { AdsbAircraftMap } from "@/lib/sdr/adsb-types";
import type { LayerVisibility } from "../map-layers-panel";
import { createPinCanvas } from "../pin-canvas";
import { getAircraft, getBoundingBox } from "../flight-tracker";
import type { OperationPin } from "../types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

function currentTimestamp() { return Date.now(); }

function formatAltFt(m: number | null): string {
  if (m == null) return "";
  const ft = Math.round(m * 3.281);
  return ft > 1000 ? `FL${Math.round(ft / 100)}` : `${ft}ft`;
}

function formatSpeedKt(ms: number | null): string {
  if (ms == null) return "";
  return `${Math.round(ms * 1.944)}kt`;
}

interface MergedAircraft {
  icao24: string;
  callsign: string;
  lat: number;
  lng: number;
  altitude: number;
  velocity: number;
  heading: number;
  verticalRate: number;
  onGround: boolean;
  lastContact: number;
  source: "adsb" | "opensky";
}

export function useAircraftLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  operations: OperationPin[];
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations, debouncedReplayTime, timeMachineOpen } = params;

  const isReplaying = timeMachineOpen && debouncedReplayTime < currentTimestamp() - 5000;

  const centerRef = useRef({ lat: 39.83, lng: -98.58 });

  useEffect(() => {
    const op = operations.find(o => o.lat && o.lng);
    if (op) centerRef.current = { lat: op.lat, lng: op.lng };
  }, [operations]);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const entityGroups = entityGroupsRef.current;
    if (!entityGroups.aircraft) entityGroups.aircraft = [];

    if (!layers.aircraft || isReplaying) {
      (entityGroups.aircraft as { id: string }[]).forEach((e) => {
        try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("aircraft-layer:remove", e_, "debug"); }
      });
      entityGroups.aircraft = [];
      return;
    }

    const bbox = getBoundingBox(centerRef.current.lat, centerRef.current.lng, 200);
    let activeIds = new Set<string>();

    // Combined aircraft map: ADSB entries take priority over OpenSky
    const merged = new Map<string, MergedAircraft>();

    function renderAll() {
      const v = viewerRef.current;
      const C = cesiumRef.current;
      if (!v || !C) return;

      const newIds = new Set<string>();

      for (const [icao24, plane] of merged) {
        if (plane.onGround) continue;
        const entityId = `plane-${icao24}`;
        newIds.add(entityId);

        const existing = v.entities.getById(entityId);
        const pos = C.Cartesian3.fromDegrees(plane.lng, plane.lat, plane.altitude);
        const color = plane.source === "adsb" ? "#22d3ee" : "#38bdf8";
        const scale = plane.source === "adsb" ? 0.45 : 0.35;

        if (existing) {
          existing.position = new C.ConstantPositionProperty(pos);
          if (existing.billboard) {
            existing.billboard.rotation = -plane.heading * (Math.PI / 180);
            existing.billboard.scale = scale;
          }
          if (existing.label) existing.label.text = `${plane.callsign || plane.icao24}\n${formatAltFt(plane.altitude)}`;
          existing.description = buildDesc(plane);
        } else {
          const entity = v.entities.add({
            id: entityId,
            name: plane.callsign || plane.icao24,
            position: pos,
            billboard: {
              image: createPinCanvas(color, "flag"),
              scale,
              rotation: -plane.heading * (Math.PI / 180),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: `${plane.callsign || plane.icao24}\n${formatAltFt(plane.altitude)}`,
              font: "9px monospace",
              fillColor: C.Color.fromCssColorString(color),
              outlineColor: C.Color.BLACK,
              outlineWidth: 2,
              style: C.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new C.Cartesian2(0, -18),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              scale: 0.8,
              distanceDisplayCondition: new C.DistanceDisplayCondition(0, 500000),
            },
            description: buildDesc(plane),
          });
          entityGroupsRef.current.aircraft.push(entity);
        }
      }

      for (const id of activeIds) {
        if (!newIds.has(id)) {
          try { v.entities.removeById(id); } catch (e) { logger.swallow("aircraft-layer:remove", e, "debug"); }
        }
      }
      activeIds = newIds;
    }

    // ── ADSB subscription (high-refresh, local SDR) ──
    const unsubAdsb = subscribeAdsb((adsbMap: AdsbAircraftMap) => {
      for (const icao24 in adsbMap) {
        const a = adsbMap[icao24];
        if (a.lat == null || a.lng == null) continue;
        merged.set(icao24, {
          icao24: a.icao24,
          callsign: a.callsign || "",
          lat: a.lat,
          lng: a.lng,
          altitude: a.altitude ?? 3000,
          velocity: a.velocity ?? 0,
          heading: a.heading ?? 0,
          verticalRate: a.verticalRate ?? 0,
          onGround: a.onGround,
          lastContact: a.lastContact,
          source: "adsb",
        });
      }
      renderAll();
    });

    // ── OpenSky polling (broad coverage, 15s) ──
    function fetchOpenSky() {
      getAircraft(bbox.south, bbox.north, bbox.west, bbox.east).then(planes => {
        for (const plane of planes) {
          if (plane.onGround) continue;
          const icao24 = plane.icao24;
          // Only add if not already tracked by ADSB
          if (!merged.has(icao24) || merged.get(icao24)!.source !== "adsb") {
            merged.set(icao24, {
              icao24,
              callsign: plane.callsign,
              lat: plane.lat,
              lng: plane.lng,
              altitude: plane.altitude,
              velocity: plane.velocity,
              heading: plane.heading,
              verticalRate: plane.verticalRate,
              onGround: plane.onGround,
              lastContact: plane.lastContact,
              source: "opensky",
            });
          }
        }
        renderAll();
      }).catch((err) => {
        logger.swallow("aircraft-layer:opensky", err, "warn");
      });
    }

    fetchOpenSky();
    const openskyInterval = setInterval(fetchOpenSky, 15000);

    return () => {
      unsubAdsb();
      clearInterval(openskyInterval);
      (entityGroups.aircraft ?? []).forEach((e: { id: string }) => {
        try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("aircraft-layer:remove", e_, "debug"); }
      });
      entityGroups.aircraft = [];
    };
  }, [layers.aircraft, loading, viewerRef, cesiumRef, entityGroupsRef, isReplaying]);
}

function buildDesc(plane: MergedAircraft): string {
  const vs = plane.verticalRate;
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b>${plane.callsign || plane.icao24}</b>
    <div>ICAO: ${plane.icao24}</div>
    <div>Alt: ${formatAltFt(plane.altitude)}</div>
    <div>Speed: ${formatSpeedKt(plane.velocity)}</div>
    <div>Heading: ${plane.heading.toFixed(0)}&deg;</div>
    <div>V/S: ${vs > 0 ? "+" : ""}${(vs * 196.85).toFixed(0)} fpm</div>
    <div style="font-size:9px;opacity:0.5;margin-top:4px">Source: ${plane.source === "adsb" ? "Local ADSB" : "OpenSky"}</div>
  </div>`;
}
