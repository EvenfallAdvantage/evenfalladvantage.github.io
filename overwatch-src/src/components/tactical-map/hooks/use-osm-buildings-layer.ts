/**
 * 3D Buildings (OpenStreetMap) for the Operations map.
 *
 * Free and keyless: z14 OpenMapTiles vector tiles from OpenFreeMap's public
 * instance (commercial use allowed, no request limits; data ODbL), decoded in
 * the browser and extruded with Cesium. No Cesium ion, no paid service.
 *
 *  - Only at city scale: shown when the camera is <= 4 km above ground
 *    (2.5 km on phones), hidden above 1.25x that (hysteresis).
 *  - Loads the tiles nearest the view centre after the camera stops moving;
 *    downloads are capped (4 / 2 at a time) and abandoned when the view moves on.
 *  - Bounded memory: at most 9 visible / 15 cached tiles (4 / 6 on phones),
 *    at most 6,000 buildings per tile (2,500 on phones), tallest kept first.
 *  - One batched, non-pickable Cesium Primitive per tile (geometry built in
 *    Cesium's web workers).
 *  - With 3D terrain on, buildings sit on sampled ground heights.
 *  - Post-process looks (NVG, thermal, noir, CRT, bloom) apply on top as for
 *    the rest of the scene; imagery overlays (radar, clouds) stay on the globe.
 *  - Attribution "© OpenMapTiles © OpenStreetMap contributors" is shown in the
 *    map footer whenever the layer is on (see MapLegalFooter).
 * The browser's HTTP cache keeps tiles (they're immutable); we store nothing.
 */

import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import {
  OSM_BUILDINGS_TILEJSON_URL, buildingBudget, buildingsVisibleAt, decodeBuildingsTile, interpolateGround,
  tileFraction, tileKey, tileTemplateFromTileJson, tileUrl, tilesAround, tilesToEvict,
  type Building, type TileXY,
} from "@/lib/map/osm-buildings";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export type OsmBuildingsState = "off" | "zoomIn" | "loading" | "on" | "error";
export interface OsmBuildingsStatus { state: OsmBuildingsState; buildings: number }

const LIGHT_COLOR = "#c4beb1";
const DARK_COLOR = "#3a4656";
/** Sink ground-level bases so slopes and terrain error don't show gaps. */
const BASE_SINK_M = 3;
const GROUND_GRID = 8;
const ERROR_BACKOFF_MS = 60_000;
const MOVE_DEBOUNCE_MS = 250;

let templatePromise: Promise<string> | null = null;
/** OpenFreeMap's TileJSON names the current dated tile set; fetched once per page load. */
function getTileTemplate(): Promise<string> {
  if (!templatePromise) {
    templatePromise = fetch(OSM_BUILDINGS_TILEJSON_URL, { signal: AbortSignal.timeout(10_000) })
      .then((r) => { if (!r.ok) throw new Error(`TileJSON ${r.status}`); return r.json(); })
      .then((j) => {
        const t = tileTemplateFromTileJson(j);
        if (!t) throw new Error("TileJSON has no usable tile URL");
        return t;
      })
      .catch((e) => { templatePromise = null; throw e; });
  }
  return templatePromise;
}

interface CachedTile {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cesium Primitive (no published types)
  primitive: any | null;
  count: number;
  lastUsed: number;
}

export function useOsmBuildingsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  enabled: boolean;
  terrain: boolean;
  /** Dark basemap: dim the buildings to match. */
  dark: boolean;
  constrained: boolean;
}): OsmBuildingsStatus {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, enabled, terrain, dark, constrained } = params;
  const [status, setStatus] = useState<OsmBuildingsStatus>({ state: "off", buildings: 0 });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const collectionRef = useRef<any>(null);
  const darkRef = useRef(dark);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading || !enabled) {
      setStatus((s) => (s.state === "off" ? s : { state: "off", buildings: 0 }));
      return;
    }
    const budget = buildingBudget(constrained);
    const collection = new Cesium.PrimitiveCollection();
    viewer.scene.primitives.add(collection);
    collectionRef.current = collection;
    const cache = new Map<string, CachedTile>();
    const inflight = new Map<string, AbortController>();
    const queue: TileXY[] = [];
    let wanted = new Set<string>();
    let visible = false;
    let disposed = false;
    let errorUntil = 0;
    let lastError = false;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const renderTimers = new Set<ReturnType<typeof setInterval>>();

    // The licensed ion OSM Buildings tileset (if any) would double up.
    const ionBuildings = entityGroupsRef.current.buildings?.[0];
    if (ionBuildings) ionBuildings.show = false;

    const requestRender = () => { try { viewer.scene.requestRender(); } catch { /* destroyed */ } };

    const publish = () => {
      if (disposed) return;
      let shown = 0;
      for (const k of wanted) shown += cache.get(k)?.count ?? 0;
      const pending = [...wanted].some((k) => !cache.has(k));
      const state: OsmBuildingsState = !visible ? "zoomIn" : lastError && shown === 0 ? "error" : pending && shown === 0 ? "loading" : "on";
      setStatus((s) => (s.state === state && s.buildings === shown ? s : { state, buildings: shown }));
    };

    const colorFor = (isDark: boolean) => Cesium.Color.fromCssColorString(isDark ? DARK_COLOR : LIGHT_COLOR);

    const groundGrid = async (t: TileXY): Promise<number[] | null> => {
      if (!terrain) return null;
      // Wait briefly for the async terrain provider to replace the ellipsoid.
      for (let i = 0; i < 20 && viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider; i++) {
        await new Promise((r) => setTimeout(r, 250));
        if (disposed) return null;
      }
      if (viewer.terrainProvider instanceof Cesium.EllipsoidTerrainProvider) return null;
      const n = 2 ** t.z;
      const cartos = [];
      for (let j = 0; j <= GROUND_GRID; j++) {
        for (let i = 0; i <= GROUND_GRID; i++) {
          const wx = (t.x + i / GROUND_GRID) / n;
          const wy = (t.y + j / GROUND_GRID) / n;
          const lon = wx * 360 - 180;
          const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * wy))) * 180) / Math.PI;
          cartos.push(Cesium.Cartographic.fromDegrees(lon, lat));
        }
      }
      try {
        const sampled = await Cesium.sampleTerrainMostDetailed(viewer.terrainProvider, cartos);
        return sampled.map((c: { height?: number }) => (Number.isFinite(c.height) ? (c.height as number) : 0));
      } catch (e) {
        logger.swallow("osm-buildings:terrain", e, "debug");
        return null;
      }
    };

    const buildPrimitive = (t: TileXY, buildings: Building[], grid: number[] | null) => {
      const vertexFormat = Cesium.MaterialAppearance.MaterialSupport.BASIC.vertexFormat;
      const instances = [];
      for (const b of buildings) {
        let ground = 0;
        if (grid) {
          const { u, v } = tileFraction(t, b.center[0], b.center[1]);
          ground = interpolateGround(grid, GROUND_GRID, u, v);
        }
        const [outer, ...holes] = b.rings;
        try {
          instances.push(new Cesium.GeometryInstance({
            geometry: new Cesium.PolygonGeometry({
              polygonHierarchy: new Cesium.PolygonHierarchy(
                Cesium.Cartesian3.fromDegreesArray(outer.flat()),
                holes.map((h) => new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(h.flat()))),
              ),
              height: ground + (b.minHeight > 0 ? b.minHeight : -BASE_SINK_M),
              extrudedHeight: ground + b.height,
              vertexFormat,
              closeBottom: b.minHeight > 0,
            }),
          }));
        } catch (e) {
          logger.swallow("osm-buildings:geometry", e, "debug");
        }
      }
      if (instances.length === 0) return null;
      return new Cesium.Primitive({
        geometryInstances: instances,
        appearance: new Cesium.MaterialAppearance({
          material: Cesium.Material.fromType("Color", { color: colorFor(darkRef.current) }),
          materialSupport: Cesium.MaterialAppearance.MaterialSupport.BASIC,
          translucent: false,
          faceForward: true,
        }),
        asynchronous: true,
        allowPicking: false,
        releaseGeometryInstances: true,
        compressVertices: true,
        show: wanted.has(tileKey(t)) && visible,
      });
    };

    // Request frames until an async primitive has finished building (map may render on demand).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const renderUntilReady = (p: any) => {
      let ticks = 0;
      const id = setInterval(() => {
        ticks += 1;
        requestRender();
        if (disposed || p.isDestroyed?.() || p.ready || ticks > 100) { clearInterval(id); renderTimers.delete(id); }
      }, 200);
      renderTimers.add(id);
    };

    const evict = () => {
      const victims = tilesToEvict([...cache.entries()].map(([key, c]) => ({ key, lastUsed: c.lastUsed })), wanted, budget.maxTilesCached);
      for (const key of victims) {
        const c = cache.get(key);
        if (c?.primitive) collection.remove(c.primitive); // PrimitiveCollection destroys removed primitives
        cache.delete(key);
      }
    };

    const loadTile = async (t: TileXY) => {
      const key = tileKey(t);
      const ctrl = new AbortController();
      inflight.set(key, ctrl);
      try {
        const template = await getTileTemplate();
        const res = await fetch(tileUrl(template, t), { signal: ctrl.signal });
        if (res.status === 404 || res.status === 204) {
          cache.set(key, { primitive: null, count: 0, lastUsed: Date.now() });
          return;
        }
        if (!res.ok) throw new Error(`tile ${key}: ${res.status}`);
        const data = new Uint8Array(await res.arrayBuffer());
        if (disposed || ctrl.signal.aborted) return;
        const { buildings } = decodeBuildingsTile(data, t, budget.maxBuildingsPerTile);
        const grid = await groundGrid(t);
        if (disposed || ctrl.signal.aborted) return;
        const primitive = buildPrimitive(t, buildings, grid);
        if (primitive) {
          collection.add(primitive);
          renderUntilReady(primitive);
        }
        cache.set(key, { primitive, count: primitive ? buildings.length : 0, lastUsed: Date.now() });
        lastError = false;
        evict();
      } catch (e) {
        if (ctrl.signal.aborted || disposed) return;
        lastError = true;
        errorUntil = Date.now() + ERROR_BACKOFF_MS;
        logger.swallow("osm-buildings:tile", e, "debug");
      } finally {
        inflight.delete(key);
        if (!disposed) { pump(); publish(); }
      }
    };

    const pump = () => {
      while (!disposed && inflight.size < budget.maxConcurrentFetches && queue.length > 0) {
        const t = queue.shift()!;
        const key = tileKey(t);
        if (!wanted.has(key) || cache.has(key) || inflight.has(key)) continue;
        void loadTile(t);
      }
    };

    const refresh = () => {
      if (disposed) return;
      const scene = viewer.scene;
      const camCarto = viewer.camera.positionCartographic;
      const groundAtCam = scene.globe.getHeight(camCarto) ?? 0;
      const altitude = camCarto.height - (terrain ? groundAtCam : 0);
      visible = buildingsVisibleAt(altitude, budget, visible);
      collection.show = visible;
      if (!visible) {
        wanted = new Set();
        for (const [key, c] of inflight) { c.abort(); inflight.delete(key); }
        queue.length = 0;
        publish();
        requestRender();
        return;
      }
      // View centre: where the screen centre meets the ground (camera ground point if looking at the horizon).
      let lon = Cesium.Math.toDegrees(camCarto.longitude);
      let lat = Cesium.Math.toDegrees(camCarto.latitude);
      try {
        const canvas = scene.canvas;
        const ray = viewer.camera.getPickRay(new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2));
        const hit = ray ? scene.globe.pick(ray, scene) : undefined;
        if (hit && Cesium.Cartesian3.distance(hit, viewer.camera.positionWC) < budget.maxAltitudeM * 2.5) {
          const c = Cesium.Cartographic.fromCartesian(hit);
          lon = Cesium.Math.toDegrees(c.longitude);
          lat = Cesium.Math.toDegrees(c.latitude);
        }
      } catch (e) { logger.swallow("osm-buildings:centre", e, "debug"); }

      const tiles = tilesAround(lon, lat, budget.maxTilesInView);
      wanted = new Set(tiles.map(tileKey));
      const now = Date.now();
      for (const [key, c] of cache) {
        const on = wanted.has(key);
        if (on) c.lastUsed = now;
        if (c.primitive) c.primitive.show = on;
      }
      for (const [key, c] of inflight) if (!wanted.has(key)) { c.abort(); inflight.delete(key); }
      queue.length = 0;
      if (now >= errorUntil) {
        for (const t of tiles) if (!cache.has(tileKey(t)) && !inflight.has(tileKey(t))) queue.push(t);
      }
      pump();
      evict();
      publish();
      requestRender();
    };

    const onMoveEnd = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(refresh, MOVE_DEBOUNCE_MS);
    };
    const removeMoveEnd = viewer.camera.moveEnd.addEventListener(onMoveEnd);
    refresh();

    return () => {
      disposed = true;
      if (debounce) clearTimeout(debounce);
      for (const id of renderTimers) clearInterval(id);
      for (const c of inflight.values()) c.abort();
      removeMoveEnd?.();
      collectionRef.current = null;
      try {
        if (!viewer.isDestroyed?.()) {
          viewer.scene.primitives.remove(collection); // destroys the collection and its primitives
          if (ionBuildings && terrain) ionBuildings.show = true;
          viewer.scene.requestRender();
        }
      } catch (e) { logger.swallow("osm-buildings:cleanup", e, "debug"); }
    };
  }, [viewerRef, cesiumRef, entityGroupsRef, loading, enabled, terrain, constrained]);

  // Restyle in place when the basemap goes dark/light (no rebuild).
  useEffect(() => {
    darkRef.current = dark;
    const Cesium = cesiumRef.current;
    const collection = collectionRef.current;
    if (!Cesium || !collection || collection.isDestroyed?.()) return;
    const color = Cesium.Color.fromCssColorString(dark ? DARK_COLOR : LIGHT_COLOR);
    for (let i = 0; i < collection.length; i++) {
      const p = collection.get(i);
      const uniforms = p?.appearance?.material?.uniforms;
      if (uniforms) uniforms.color = color;
    }
    try { viewerRef.current?.scene.requestRender(); } catch { /* destroyed */ }
  }, [dark, cesiumRef, viewerRef, status.buildings]);

  return status;
}
