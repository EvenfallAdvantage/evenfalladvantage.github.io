import { useEffect, useRef } from "react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { subscribeAdsb } from "@/lib/sdr/adsb-store";
import type { AdsbAircraftMap } from "@/lib/sdr/adsb-types";
import type { LayerVisibility } from "../map-layers-panel";
import { createPinCanvas } from "../pin-canvas";
import { getAircraft, getBoundingBox } from "../flight-tracker";
import type { OperationPin } from "../types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";
import { AircraftTrack, type AircraftFix } from "@/lib/map/aircraft-motion";
import { aggregateGnss, matchesAircraftFilter, type AircraftFilter } from "@/lib/map/aircraft-filter";
import { escapeHtml } from "@/lib/security";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";

/** Render cadence while aircraft are moving (requestRenderMode is on). */
const MOTION_FRAME_MS = 66;

function currentTimestamp() { return Date.now(); }

/** Feed timestamps are epoch seconds (OpenSky shape) or ms; fall back to "now" if implausible. */
export function fixTimeMs(lastContact: number, now: number): number {
  if (!(lastContact > 0)) return now;
  const ms = lastContact > 1e12 ? lastContact : lastContact * 1000;
  return ms > now + 5_000 || now - ms > 10 * 60_000 ? now : ms;
}

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
  military?: boolean;
  emergency?: boolean;
  squawk?: string | null;
  emergencyStatus?: string | null;
  nacp?: number | null;
  typeCode?: string | null;
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
  // Filter changes re-draw from the data already fetched (no refetch).
  const filterRef = useRef<AircraftFilter>(layers.aircraftFilter ?? "all");
  const showPlanesRef = useRef(layers.aircraft);
  const showGnssRef = useRef(layers.gnss);
  const redrawRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    filterRef.current = layers.aircraftFilter ?? "all";
    showPlanesRef.current = layers.aircraft;
    showGnssRef.current = layers.gnss;
    redrawRef.current?.();
  }, [layers.aircraftFilter, layers.aircraft, layers.gnss]);
  const wantData = layers.aircraft || layers.gnss;

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

    if (!wantData || isReplaying) {
      (entityGroups.aircraft as { id: string }[]).forEach((e) => {
        try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("aircraft-layer:remove", e_, "debug"); }
      });
      entityGroups.aircraft = [];
      return;
    }
    const gnssSource = new Cesium.CustomDataSource("gnss-interference");
    viewer.dataSources.add(gnssSource);

    const bbox = getBoundingBox(centerRef.current.lat, centerRef.current.lng, 200);
    let activeIds = new Set<string>();

    // Combined aircraft map: ADSB entries take priority over OpenSky
    const merged = new Map<string, MergedAircraft>();
    // Motion state per aircraft (shared with the tracking UI via entityGroups).
    const tracks = new Map<string, AircraftTrack>();
    entityGroups.aircraftTracks = tracks;

    // Trail for the tracked aircraft (click-to-track), drawn from its fix history.
    const trailEntity = viewer.entities.add({
      id: "aircraft-track-trail",
      polyline: {
        positions: new Cesium.CallbackProperty(() => {
          const id = entityGroupsRef.current.trackedAircraftId as string | undefined;
          const t = id ? tracks.get(id.replace(/^plane-/, "")) : undefined;
          if (!t) return [];
          const pts = t.trail.map((p) => Cesium.Cartesian3.fromDegrees(p.lng, p.lat, p.altM));
          const head = t.position(currentTimestamp());
          pts.push(Cesium.Cartesian3.fromDegrees(head.lng, head.lat, head.altM));
          return pts;
        }, false),
        width: 2,
        material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.25, color: Cesium.Color.fromCssColorString("#22d3ee") }),
      },
    });

    // requestRenderMode is on: keep frames coming while aircraft are moving.
    const stopMotionPump = setVisibleInterval(() => {
      if (tracks.size > 0 && showPlanesRef.current && !viewer.isDestroyed?.()) viewer.scene.requestRender();
    }, MOTION_FRAME_MS);

    function renderAll() {
      const v = viewerRef.current;
      const C = cesiumRef.current;
      if (!v || !C) return;

      const newIds = new Set<string>();

      const now = currentTimestamp();
      for (const [icao24, plane] of merged) {
        if (plane.onGround) continue;
        const entityId = `plane-${icao24}`;
        // Motion tracks are kept for every aircraft so switching the filter is instant.
        const visible = showPlanesRef.current && matchesAircraftFilter(plane, filterRef.current);
        if (visible) newIds.add(entityId);

        const fix: AircraftFix = {
          lat: plane.lat, lng: plane.lng, altM: plane.altitude,
          speedMps: plane.velocity, trackDeg: plane.heading, vsMps: plane.verticalRate,
          tMs: fixTimeMs(plane.lastContact, now),
        };
        let track = tracks.get(icao24);
        if (track) track.update(fix, now);
        else { track = new AircraftTrack(fix); tracks.set(icao24, track); }
        if (!visible) continue;

        const existing = v.entities.getById(entityId);
        const color = plane.emergency ? "#ef4444" : plane.military ? "#a3e635" : plane.source === "adsb" ? "#22d3ee" : "#38bdf8";
        const scale = plane.emergency ? 0.55 : plane.source === "adsb" ? 0.45 : 0.35;

        if (existing) {
          if (existing.billboard) {
            existing.billboard.rotation = -plane.heading * (Math.PI / 180);
            existing.billboard.scale = scale;
            if (existing._owColor !== color) { existing.billboard.image = createPinCanvas(color, "flag"); existing._owColor = color; }
          }
          if (existing.label) existing.label.text = planeLabel(plane);
          existing.description = buildDesc(plane);
        } else {
          const t = track;
          const scratch = new C.Cartesian3();
          const entity = v.entities.add({
            id: entityId,
            name: plane.callsign || plane.icao24,
            // Dead-reckoned between fixes (aircraft-motion.ts, adapted from gods-eye-view).
            position: new C.CallbackPositionProperty((_time: unknown, result?: unknown) => {
              const p = t.position(currentTimestamp());
              return C.Cartesian3.fromDegrees(p.lng, p.lat, p.altM, undefined, result ?? scratch);
            }, false),
            billboard: {
              image: createPinCanvas(color, "flag"),
              scale,
              rotation: -plane.heading * (Math.PI / 180),
              disableDepthTestDistance: nearSideDepthProperty(v, C),
            },
            label: {
              text: planeLabel(plane),
              font: "9px monospace",
              fillColor: C.Color.fromCssColorString(color),
              outlineColor: C.Color.BLACK,
              outlineWidth: 2,
              style: C.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new C.Cartesian2(0, -18),
              disableDepthTestDistance: nearSideDepthProperty(v, C),
              scale: 0.8,
              distanceDisplayCondition: new C.DistanceDisplayCondition(0, 500000),
            },
            description: buildDesc(plane),
          });
          entityGroupsRef.current.aircraft.push(entity);
        }
      }

      // Drop aircraft whose last fix is too old to keep coasting.
      for (const [icao24, t] of tracks) {
        if (t.isStale(now)) { tracks.delete(icao24); merged.delete(icao24); newIds.delete(`plane-${icao24}`); }
      }

      for (const id of activeIds) {
        if (!newIds.has(id)) {
          try { v.entities.removeById(id); } catch (e) { logger.swallow("aircraft-layer:remove", e, "debug"); }
        }
      }
      activeIds = newIds;
      // Latest positions for Site Watch (emergency aircraft near sites).
      entityGroupsRef.current.aircraftLatest = [...merged.values()];
      renderGnss();
    }
    redrawRef.current = renderAll;

    function renderGnss() {
      const C = cesiumRef.current;
      gnssSource.entities.removeAll();
      if (!C || !showGnssRef.current) return;
      const cells = aggregateGnss([...merged.values()]);
      for (const c of cells) {
        const alpha = Math.min(0.55, 0.2 + c.ratio * 0.4);
        gnssSource.entities.add({
          id: `gnss-${c.lat0}-${c.lng0}`,
          name: "Possible GPS interference",
          rectangle: {
            coordinates: C.Rectangle.fromDegrees(c.lng0, c.lat0, c.lng0 + c.sizeDeg, c.lat0 + c.sizeDeg),
            material: C.Color.fromCssColorString("#f43f5e").withAlpha(alpha),
            outline: false,
          },
          description: `<div style="font-family:monospace;font-size:11px;line-height:1.7;max-width:280px">
            <b style="color:#f43f5e">GPS accuracy anomaly</b>
            <div>${c.degraded} of ${c.total} aircraft here report degraded position accuracy (NACp &lt; 8).</div>
            <div style="color:#94a3b8;margin-top:4px">An anomaly is not confirmed jamming: older transponders also report low accuracy. Source: adsb.lol (ODbL 1.0).</div>
          </div>`,
        });
      }
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
              military: plane.military,
              emergency: plane.emergency,
              squawk: plane.squawk,
              emergencyStatus: plane.emergencyStatus,
              nacp: plane.nacp,
              typeCode: plane.typeCode,
            });
          }
        }
        renderAll();
      }).catch((err) => {
        logger.swallow("aircraft-layer:opensky", err, "warn");
      });
    }

    fetchOpenSky();
    const stopOpenSkyPolling = setVisibleInterval(fetchOpenSky, 15000);
    const groups = entityGroupsRef.current;

    return () => {
      redrawRef.current = null;
      groups.aircraftLatest = [];
      try { viewer.dataSources.remove(gnssSource, true); } catch (e_) { logger.swallow("aircraft-layer:gnss", e_, "debug"); }
      unsubAdsb();
      stopOpenSkyPolling();
      stopMotionPump();
      try { viewer.entities.remove(trailEntity); } catch (e_) { logger.swallow("aircraft-layer:trail", e_, "debug"); }
      tracks.clear();
      if (entityGroups.aircraftTracks === tracks) entityGroups.aircraftTracks = undefined;
      (entityGroups.aircraft ?? []).forEach((e: { id: string }) => {
        try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("aircraft-layer:remove", e_, "debug"); }
      });
      entityGroups.aircraft = [];
    };
  }, [wantData, loading, viewerRef, cesiumRef, entityGroupsRef, isReplaying]);
}

function planeLabel(plane: MergedAircraft): string {
  const tag = plane.emergency ? `⚠ ${plane.squawk && ["7500", "7600", "7700"].includes(plane.squawk) ? plane.squawk : "EMERG"} ` : "";
  return `${tag}${plane.callsign || plane.icao24}\n${formatAltFt(plane.altitude)}`;
}

const SQUAWK_MEANING: Record<string, string> = { "7500": "unlawful interference", "7600": "radio failure", "7700": "general emergency" };

function buildDesc(plane: MergedAircraft): string {
  const vs = plane.verticalRate;
  const emerg = plane.emergency
    ? `<div style="color:#ef4444"><b>EMERGENCY</b> ${plane.squawk && SQUAWK_MEANING[plane.squawk] ? `squawk ${plane.squawk} (${SQUAWK_MEANING[plane.squawk]})` : escapeHtml(plane.emergencyStatus ?? "")}</div>`
    : "";
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b>${escapeHtml(plane.callsign || plane.icao24)}</b>${plane.military ? ' <span style="color:#a3e635">MIL</span>' : ""}
    ${emerg}
    <div>ICAO: ${escapeHtml(plane.icao24)}${plane.typeCode ? ` · ${escapeHtml(plane.typeCode)}` : ""}</div>
    <div>Alt: ${formatAltFt(plane.altitude)}</div>
    <div>Speed: ${formatSpeedKt(plane.velocity)}</div>
    <div>Heading: ${plane.heading.toFixed(0)}&deg;</div>
    <div>V/S: ${vs > 0 ? "+" : ""}${(vs * 196.85).toFixed(0)} fpm</div>
    <div style="font-size:9px;opacity:0.5;margin-top:4px">Source: ${plane.source === "adsb" ? "Local ADS-B receiver" : "adsb.lol (ODbL 1.0)"}</div>
  </div>`;
}
