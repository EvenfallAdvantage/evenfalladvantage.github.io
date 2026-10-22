/**
 * Live AIS ships (Air & Sea > "Ships (live AIS)").
 *
 * Reads public.ships through the ships_in_bbox RPC (any signed-in user; the
 * table is filled every minute by the ais-collector Edge function from
 * aisstream.io and Fintraffic Digitraffic). The query box follows the camera
 * like aircraft (#108), read in 1000-row pages (PostgREST max_rows).
 *
 * Level of detail, all capped by the performance-governor level:
 *  - every ship: one GPU billboard in a single BillboardCollection (no
 *    per-ship Entity, so thousands cost one draw call and no per-frame
 *    property evaluation); click picking still opens the ship popup;
 *  - nearest ships when the camera is low: name labels (LabelCollection);
 *  - desktop, nearest ships: a CC BY 4.0 3D model (ship.glb) as an Entity,
 *    clamped to sea level with its waterline origin and the underwater hull
 *    clipped, dark and outlined under NVG/thermal like the aircraft models.
 * Markers use the near-side depth rule (#107) so far-side ships never draw
 * through the globe.
 */
import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { setVisibleInterval } from "@/lib/visible-interval";
import { logger } from "@/lib/logger";
import { escapeHtml } from "@/lib/security";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import { nearSideDepthDistance } from "@/lib/map/near-side-depth";
import { modelStyle } from "@/lib/map/contact-models";
import { boxKey, type GeoBox } from "@/lib/map/aircraft-viewport";
import {
  CATEGORY_COLOR, CATEGORY_LABEL, SHIP_CATEGORY_MODEL, SHIP_POLL_MS, SHIP_POLL_MS_PHONE, SHIP_RPC_PAGE,
  capShips, inShipBox, mergeShipPages, navStatusLabel, selectShipLabelIds, selectShipModelIds, shipCap, shipCategory,
  shipHeadingDeg, shipModelHeadingDeg, shipModelScale, shipPageRanges, shipQueryBox, type Ship,
} from "@/lib/map/ships";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

const TICK_MS = 1_000;
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cesium has no published TS types here
type Any = any;
/** Pick target for billboards/labels: the click handler reads id, name, description and position like an Entity. */
interface ShipPick { id: string; name: string; description: { getValue: () => string }; position: { getValue: () => Any }; _owShip: Ship }
interface Drawn { bb: Any; label: Any | null; pick: ShipPick; color: string; pos: Any }

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
    for (const e of viewer.entities.values) {
      if (!e.model || !String(e.id).startsWith("ship-")) continue;
      const st = modelStyle(highContrast, CATEGORY_COLOR[shipCategory(e._owShip?.ship_type)]);
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
    const level = () => Number(entityGroupsRef.current.perfLevel ?? 0);
    let cap = shipCap(phone, level());
    const supabase = createClient();
    const ships = new Map<number, Ship>();
    const drawn = new Map<number, Drawn>();
    const modelled = new Set<number>();
    const bbs = viewer.scene.primitives.add(new C.BillboardCollection());
    const labels = viewer.scene.primitives.add(new C.LabelCollection());
    let depth = nearSideDepthDistance(viewer, C);
    let disposed = false;
    let fetchSeq = 0;

    const toDeg = (r: number) => (r * 180) / Math.PI;
    const readView = (): GeoBox | null => {
      try {
        const r = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
        return r ? { south: toDeg(r.south), north: toDeg(r.north), west: toDeg(r.west), east: toDeg(r.east) } : null;
      } catch { return null; }
    };
    const camera = () => {
      const cam = viewer.camera.positionCartographic;
      return { lat: C.Math.toDegrees(cam.latitude), lng: C.Math.toDegrees(cam.longitude), heightM: cam.height };
    };
    let box = shipQueryBox(readView(), fallbackRef.current);
    let boxId = boxKey(box);

    const removeLabel = (d: Drawn) => { if (d.label) { labels.remove(d.label); d.label = null; } };
    const removeModel = (mmsi: number) => {
      try { viewer.entities.removeById(idOf(mmsi)); } catch (err) { logger.swallow("ships-layer:remove-model", err, "debug"); }
      modelled.delete(mmsi);
      const d = drawn.get(mmsi); if (d) d.bb.show = true;
    };

    const render = () => {
      if (disposed || viewer.isDestroyed?.()) return;
      const list = capShips([...ships.values()].filter((s) => inShipBox(box, s.lat, s.lon)), cap);
      const want = new Set<number>();
      for (const s of list) {
        want.add(s.mmsi);
        const color = CATEGORY_COLOR[shipCategory(s.ship_type)];
        const rot = -shipHeadingDeg(s) * (Math.PI / 180);
        const pos = C.Cartesian3.fromDegrees(s.lon, s.lat, 0);
        const d = drawn.get(s.mmsi);
        if (d) {
          d.pos = pos; d.bb.position = pos; d.bb.rotation = rot; d.pick._owShip = s; d.pick.name = s.name || `MMSI ${s.mmsi}`;
          if (d.color !== color) {
            d.bb.setImage(`ship-icon-${color}`, shipIcon(color)); d.color = color;
            // Type arrived (static data) after the model was drawn: rebuild it with the right model and colour.
            if (modelled.has(s.mmsi)) { removeModel(s.mmsi); d.bb.show = true; }
          }
          if (d.label) { d.label.position = pos; d.label.text = s.name || String(s.mmsi); }
        } else {
          const rec = { pos } as Drawn;
          const pick: ShipPick = {
            id: idOf(s.mmsi), name: s.name || `MMSI ${s.mmsi}`, _owShip: s,
            description: { getValue: () => shipDesc(pick._owShip) },
            position: { getValue: () => rec.pos },
          };
          const bb = bbs.add({
            position: pos, scale: phone ? 0.32 : 0.38, rotation: rot, alignedAxis: C.Cartesian3.ZERO,
            disableDepthTestDistance: nearSideDepthDistance(viewer, C), id: pick,
          });
          bb.setImage(`ship-icon-${color}`, shipIcon(color));
          Object.assign(rec, { bb, label: null, pick, color });
          drawn.set(s.mmsi, rec);
        }
      }
      for (const [mmsi, d] of drawn) if (!want.has(mmsi)) {
        removeLabel(d); bbs.remove(d.bb); drawn.delete(mmsi);
        if (modelled.has(mmsi)) removeModel(mmsi);
      }
      entityGroupsRef.current.ships = [...drawn.keys()].map(idOf);
      setCount(drawn.size);
      updateLabels();
      viewer.scene.requestRender();
    };

    const fetchShips = async () => {
      const b = box, seq = ++fetchSeq, want = cap;
      const page = async (from: number, to: number): Promise<Ship[]> => {
        const { data, error } = await supabase
          .rpc("ships_in_bbox", { p_south: b.south, p_north: b.north, p_west: b.west, p_east: b.east, p_limit: want })
          .range(from, to);
        if (error) throw error;
        return (data ?? []) as Ship[];
      };
      try {
        const [first, ...rest] = shipPageRanges(want);
        const p0 = await page(first[0], first[1]);
        // Sparse view: one request. Busy view: the remaining pages in parallel.
        const more = p0.length >= SHIP_RPC_PAGE && rest.length ? await Promise.all(rest.map(([f, t]) => page(f, t))) : [];
        if (disposed || seq !== fetchSeq || boxKey(b) !== boxId) return;
        ships.clear();
        for (const s of mergeShipPages([p0, ...more])) ships.set(s.mmsi, s);
        render();
      } catch (err) { logger.swallow("ships-layer:fetch", err, "warn"); }
    };

    // Labels for the nearest ships when the camera is low (both platforms).
    const updateLabels = () => {
      const want = new Set(selectShipLabelIds(camera(), [...drawn.values()].map((d) => d.pick._owShip), phone, level()));
      for (const [mmsi, d] of drawn) {
        if (!want.has(mmsi)) { removeLabel(d); continue; }
        if (d.label) continue;
        const s = d.pick._owShip;
        d.label = labels.add({
          position: d.pos, text: s.name || String(s.mmsi), font: "9px monospace",
          fillColor: C.Color.fromCssColorString(d.color), outlineColor: C.Color.BLACK, outlineWidth: 2,
          style: C.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new C.Cartesian2(0, -14), scale: 0.8,
          disableDepthTestDistance: nearSideDepthDistance(viewer, C), id: d.pick,
        });
      }
    };

    // Desktop 3D models near the camera (Entities, at most 30).
    const updateModels = () => {
      if (phone) return;
      const want = new Set(selectShipModelIds(camera(), [...drawn.values()].map((d) => d.pick._owShip), level()));
      for (const mmsi of [...modelled]) if (!want.has(mmsi)) removeModel(mmsi);
      for (const mmsi of want) {
        if (modelled.has(mmsi)) continue;
        const d = drawn.get(mmsi);
        if (!d) continue;
        const s = d.pick._owShip;
        const cat = shipCategory(s.ship_type);
        const mdl = SHIP_CATEGORY_MODEL[cat];
        const st = modelStyle(contrastRef.current, CATEGORY_COLOR[cat]);
        viewer.entities.add({
          id: idOf(mmsi), name: d.pick.name, position: d.pos, description: shipDesc(s),
          orientation: C.Transforms.headingPitchRollQuaternion(d.pos, new C.HeadingPitchRoll(C.Math.toRadians(shipModelHeadingDeg(shipHeadingDeg(s), mdl.headingOffsetDeg)), 0, 0)),
          model: new C.ModelGraphics({
            uri: mdl.url, scale: shipModelScale(s.length_m), minimumPixelSize: 40, maximumScale: 20, shadows: C.ShadowMode.DISABLED,
            // Origin = waterline (ship.glb re-rooted), so clamping puts the hull on the sea surface.
            heightReference: C.HeightReference.CLAMP_TO_GROUND,
            // Trim everything below the waterline: with 3D terrain off there is no depth test against the sea.
            clippingPlanes: new C.ClippingPlaneCollection({ planes: [new C.ClippingPlane(new C.Cartesian3(0, 0, 1), 0)], edgeWidth: 0 }),
            color: C.Color.fromCssColorString(st.color), colorBlendMode: C.ColorBlendMode.MIX, colorBlendAmount: st.blend,
            silhouetteColor: C.Color.fromCssColorString(st.silhouette).withAlpha(st.silhouetteAlpha), silhouetteSize: st.silhouetteSize,
          }),
        })._owShip = s;
        d.bb.show = false;
        modelled.add(mmsi);
      }
      entityGroupsRef.current.modelledShips = modelled.size;
      setModelsShown(modelled.size > 0);
    };

    const tick = () => {
      if (disposed || viewer.isDestroyed?.()) return;
      try {
        // Governor level changed: re-cap (and fetch more when the cap went up).
        const next = shipCap(phone, level());
        if (next !== cap) { const up = next > cap; cap = next; render(); if (up) fetchShips(); }
        updateLabels();
        updateModels();
        viewer.scene.requestRender();
      } catch (err) { logger.swallow("ships-layer:tick", err, "debug"); }
    };

    // Near-side depth rule (#107) for primitives: update only when the horizon distance moves > 1 %.
    const removePreRender = viewer.scene.preRender.addEventListener(() => {
      const d = nearSideDepthDistance(viewer, C);
      if (d === depth || (Number.isFinite(d) && Number.isFinite(depth) && Math.abs(d - depth) <= depth * 0.01)) return;
      depth = d;
      for (let i = 0; i < bbs.length; i++) bbs.get(i).disableDepthTestDistance = nearSideDepthDistance(viewer, C);
      for (let i = 0; i < labels.length; i++) labels.get(i).disableDepthTestDistance = nearSideDepthDistance(viewer, C);
    });

    fetchShips();
    const stopPoll = setVisibleInterval(fetchShips, phone ? SHIP_POLL_MS_PHONE : SHIP_POLL_MS);
    const stopTick = setVisibleInterval(tick, TICK_MS);
    let moveTimer: ReturnType<typeof setTimeout> | null = null;
    const removeMoveEnd = viewer.camera.moveEnd.addEventListener(() => {
      if (moveTimer) clearTimeout(moveTimer);
      moveTimer = setTimeout(() => {
        moveTimer = null;
        tick();
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
      stopPoll(); stopTick();
      if (moveTimer) clearTimeout(moveTimer);
      try { removeMoveEnd(); removePreRender(); } catch (err) { logger.swallow("ships-layer:listeners", err, "debug"); }
      if (!viewer.isDestroyed?.()) {
        for (const mmsi of [...modelled]) { try { viewer.entities.removeById(idOf(mmsi)); } catch (err) { logger.swallow("ships-layer:remove", err, "debug"); } }
        try { viewer.scene.primitives.remove(bbs); viewer.scene.primitives.remove(labels); } catch (err) { logger.swallow("ships-layer:primitives", err, "debug"); }
        viewer.scene.requestRender();
      }
      drawn.clear(); modelled.clear(); ships.clear();
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
