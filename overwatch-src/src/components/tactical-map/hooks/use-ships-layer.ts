/**
 * Live AIS ships (Air & Sea > "Ships (live AIS)").
 *
 * Reads public.ships through the ships_in_bbox RPC (any signed-in user; the
 * table is filled every minute by the ais-collector Edge function from
 * aisstream.io and Fintraffic Digitraffic). The query box follows the camera
 * like aircraft (#108). Phones: flat icons only, at most SHIP_CAP_PHONE.
 * Desktop: a CC BY 4.0 3D model (ship.glb, gods-eye-view) replaces the icon
 * for ships near the camera, capped by the performance governor level, dark
 * and outlined under NVG/thermal like the aircraft models. Markers use the
 * near-side depth rule (#107) so far-side ships never draw through the globe.
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";
import { modelStyle } from "@/lib/map/contact-models";
import { boxKey, type GeoBox } from "@/lib/map/aircraft-viewport";
import {
  CATEGORY_COLOR, CATEGORY_LABEL, SHIP_CAP_DESKTOP, SHIP_CAP_PHONE, SHIP_MODEL_URL, SHIP_POLL_MS, SHIP_POLL_MS_PHONE,
  capShips, inShipBox, navStatusLabel, selectShipModelIds, shipCategory, shipHeadingDeg, shipModelHeadingDeg, shipModelScale, shipQueryBox, type Ship,
} from "@/lib/map/ships";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const MODEL_TICK_MS = 1_000;
const idOf = (mmsi: number) => `ship-${mmsi}`;

/** Hull-shaped icon, bow up (billboard rotation = -heading), cached per colour. */
const iconCache = new Map<string, HTMLCanvasElement>();
function shipIcon(color: string): HTMLCanvasElement {
  let c = iconCache.get(color);
  if (c) return c;
  c = document.createElement("canvas");
  c.width = 20; c.height = 32;
  const g = c.getContext("2d");
  if (g) {
    g.beginPath();
    g.moveTo(10, 1); g.quadraticCurveTo(18, 10, 17, 30); g.lineTo(3, 30); g.quadraticCurveTo(2, 10, 10, 1); g.closePath();
    g.fillStyle = color; g.fill();
    g.lineWidth = 2; g.strokeStyle = "rgba(0,0,0,0.85)"; g.stroke();
  }
  iconCache.set(color, c);
  return c;
}

export function useShipsLayer(params: {
  viewerRef: CesiumRef; cesiumRef: CesiumRef; entityGroupsRef: EntityGroupsRef;
  loading: boolean; enabled: boolean; highContrast?: boolean; fallback?: { lat: number; lng: number };
}): { modelsShown: boolean; count: number } {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, enabled, highContrast = false } = params;
  const fallbackRef = useRef(params.fallback ?? { lat: 39.83, lng: -98.58 });
  const contrastRef = useRef(highContrast);
  const [modelsShown, setModelsShown] = useState(false);
  const [count, setCount] = useState(0);

  useEffect(() => { if (params.fallback) fallbackRef.current = params.fallback; }, [params.fallback]);

  // Restyle models already on screen when NVG/thermal toggles.
  useEffect(() => {
    contrastRef.current = highContrast;
    const viewer = viewerRef.current, C = cesiumRef.current;
    if (!viewer || !C || viewer.isDestroyed?.()) return;
    const st = modelStyle(highContrast);
    for (const e of viewer.entities.values) {
      if (!e.model || !String(e.id).startsWith("ship-")) continue;
      e.model.color = C.Color.fromCssColorString(st.color);
      e.model.colorBlendAmount = st.blend;
      e.model.silhouetteColor = C.Color.fromCssColorString(st.silhouette).withAlpha(st.silhouetteAlpha);
      e.model.silhouetteSize = st.silhouetteSize;
    }
    viewer.scene.requestRender();
  }, [highContrast, viewerRef, cesiumRef]);

  useEffect(() => {
    const viewer = viewerRef.current, C = cesiumRef.current;
    if (!viewer || !C || loading || !enabled) return;
    const phone = isConstrainedDevice();
    const cap = phone ? SHIP_CAP_PHONE : SHIP_CAP_DESKTOP;
    const supabase = createClient();
    const ships = new Map<number, Ship>();
    const drawn = new Set<string>();
    const modelled = new Set<string>();
    let disposed = false;

    const toDeg = (r: number) => (r * 180) / Math.PI;
    const readView = (): GeoBox | null => {
      try {
        const r = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
        return r ? { south: toDeg(r.south), north: toDeg(r.north), west: toDeg(r.west), east: toDeg(r.east) } : null;
      } catch { return null; }
    };
    let box = shipQueryBox(readView(), fallbackRef.current);
    let boxId = boxKey(box);

    const render = () => {
      if (disposed || viewer.isDestroyed?.()) return;
      const list = capShips([...ships.values()].filter((s) => inShipBox(box, s.lat, s.lon)), cap);
      const want = new Set<string>();
      for (const s of list) {
        const id = idOf(s.mmsi);
        want.add(id);
        const cat = shipCategory(s.ship_type);
        const color = CATEGORY_COLOR[cat];
        const rot = -shipHeadingDeg(s) * (Math.PI / 180);
        const pos = C.Cartesian3.fromDegrees(s.lon, s.lat, 0);
        const e = viewer.entities.getById(id);
        if (e) {
          e.position = pos;
          if (e.billboard) {
            e.billboard.rotation = rot;
            if (e._owColor !== color) { e.billboard.image = shipIcon(color); e._owColor = color; }
          }
          e.description = shipDesc(s);
          e._owShip = s;
        } else {
          const ent = viewer.entities.add({
            id, name: s.name || `MMSI ${s.mmsi}`, position: pos,
            billboard: {
              image: shipIcon(color), scale: phone ? 0.32 : 0.38, rotation: rot,
              alignedAxis: C.Cartesian3.ZERO,
              disableDepthTestDistance: nearSideDepthProperty(viewer, C),
            },
            label: {
              text: s.name || String(s.mmsi), font: "9px monospace",
              fillColor: C.Color.fromCssColorString(color), outlineColor: C.Color.BLACK, outlineWidth: 2,
              style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -14), scale: 0.8,
              disableDepthTestDistance: nearSideDepthProperty(viewer, C),
              distanceDisplayCondition: new C.DistanceDisplayCondition(0, 60_000),
            },
            description: shipDesc(s),
          });
          ent._owColor = color;
          ent._owShip = s;
        }
      }
      for (const id of drawn) if (!want.has(id)) { try { viewer.entities.removeById(id); } catch (err) { logger.swallow("ships-layer:remove", err, "debug"); } modelled.delete(id); }
      drawn.clear(); for (const id of want) drawn.add(id);
      entityGroupsRef.current.ships = [...drawn];
      setCount(drawn.size);
      viewer.scene.requestRender();
    };

    const fetchShips = async () => {
      const b = box;
      try {
        const { data, error } = await supabase.rpc("ships_in_bbox", { p_south: b.south, p_north: b.north, p_west: b.west, p_east: b.east, p_limit: cap });
        if (error) throw error;
        if (disposed || boxKey(b) !== boxId) return;
        ships.clear();
        for (const s of (data ?? []) as Ship[]) ships.set(s.mmsi, s);
        render();
      } catch (err) { logger.swallow("ships-layer:fetch", err, "warn"); }
    };

    // Desktop models near the camera.
    const modelTick = () => {
      if (phone || disposed || viewer.isDestroyed?.()) return;
      try {
        const cam = viewer.camera.positionCartographic;
        const visible = [...drawn].map((id) => viewer.entities.getById(id)?._owShip as Ship | undefined).filter((s): s is Ship => !!s);
        const want = new Set(selectShipModelIds({ lat: C.Math.toDegrees(cam.latitude), lng: C.Math.toDegrees(cam.longitude), heightM: cam.height }, visible, Number(entityGroupsRef.current.perfLevel ?? 0)).map(idOf));
        for (const id of [...modelled]) if (!want.has(id)) {
          const e = viewer.entities.getById(id);
          if (e) { e.model = undefined; e.orientation = undefined; if (e.billboard) e.billboard.show = true; }
          modelled.delete(id);
        }
        for (const id of want) {
          if (modelled.has(id)) continue;
          const e = viewer.entities.getById(id);
          const s = e?._owShip as Ship | undefined;
          if (!e || !s) continue;
          const pos = C.Cartesian3.fromDegrees(s.lon, s.lat, 0);
          e.orientation = C.Transforms.headingPitchRollQuaternion(pos, new C.HeadingPitchRoll(C.Math.toRadians(shipModelHeadingDeg(shipHeadingDeg(s))), 0, 0));
          const st = modelStyle(contrastRef.current);
          e.model = new C.ModelGraphics({
            uri: SHIP_MODEL_URL, scale: shipModelScale(s.length_m), minimumPixelSize: 40, maximumScale: 20, shadows: C.ShadowMode.DISABLED,
            heightReference: C.HeightReference.CLAMP_TO_GROUND,
            color: C.Color.fromCssColorString(st.color), colorBlendMode: C.ColorBlendMode.MIX, colorBlendAmount: st.blend,
            silhouetteColor: C.Color.fromCssColorString(st.silhouette).withAlpha(st.silhouetteAlpha), silhouetteSize: st.silhouetteSize,
          });
          if (e.billboard) e.billboard.show = false;
          modelled.add(id);
        }
        if (want.size || modelled.size) viewer.scene.requestRender();
        entityGroupsRef.current.modelledShips = modelled.size;
        setModelsShown(modelled.size > 0);
      } catch (err) { logger.swallow("ships-layer:models", err, "debug"); }
    };

    fetchShips();
    const stopPoll = setVisibleInterval(fetchShips, phone ? SHIP_POLL_MS_PHONE : SHIP_POLL_MS);
    const stopModels = phone ? () => {} : setVisibleInterval(modelTick, MODEL_TICK_MS);
    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    const removeMoveEnd = viewer.camera.moveEnd.addEventListener(() => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        moveTimer = null;
        const next = shipQueryBox(readView(), fallbackRef.current);
        const id = boxKey(next);
        if (id === boxId) return;
        box = next; boxId = id;
        render();
        fetchShips();
      }, 600);
    });
    const groups = entityGroupsRef.current;

    return () => {
      disposed = true;
      stopPoll(); stopModels();
      if (moveTimer) clearTimeout(moveTimer);
      try { removeMoveEnd(); } catch (err) { logger.swallow("ships-layer:move-end", err, "debug"); }
      if (!viewer.isDestroyed?.()) {
        for (const id of drawn) { try { viewer.entities.removeById(id); } catch (err) { logger.swallow("ships-layer:remove", err, "debug"); } }
        viewer.scene.requestRender();
      }
      drawn.clear(); modelled.clear();
      groups.ships = []; groups.modelledShips = 0;
      setModelsShown(false); setCount(0);
    };
  }, [viewerRef, cesiumRef, entityGroupsRef, loading, enabled]);

  return { modelsShown: modelsShown && enabled && !loading, count };
}

function shipDesc(s: Ship): string {
  const cat = shipCategory(s.ship_type);
  const nav = navStatusLabel(s.nav_status);
  const src = s.source === "digitraffic" ? "Fintraffic Digitraffic (CC BY 4.0)" : "aisstream.io";
  const ago = Math.max(0, Math.round((Date.now() - Date.parse(s.updated_at)) / 60_000));
  return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
    <b>${escapeHtml(s.name || "Unknown vessel")}</b> <span style="color:${CATEGORY_COLOR[cat]}">${CATEGORY_LABEL[cat]}</span>
    <div>MMSI: ${s.mmsi}${s.callsign ? ` · ${escapeHtml(s.callsign)}` : ""}</div>
    ${s.sog != null ? `<div>Speed: ${s.sog.toFixed(1)} kn${s.cog != null ? ` · Course ${Math.round(s.cog)}&deg;` : ""}</div>` : ""}
    ${nav ? `<div>Status: ${escapeHtml(nav)}</div>` : ""}
    ${s.length_m ? `<div>Length: ${s.length_m} m</div>` : ""}
    ${s.destination ? `<div>Destination: ${escapeHtml(s.destination)}</div>` : ""}
    <div style="font-size:9px;opacity:0.5;margin-top:4px">Updated ${ago} min ago · Source: ${src}. AIS is self-reported and may be wrong or missing.</div>
  </div>`;
}
