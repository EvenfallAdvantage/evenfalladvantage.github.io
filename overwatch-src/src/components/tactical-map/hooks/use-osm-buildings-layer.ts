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
 *    downloads are capped and abandoned when the view moves on.
 *  - Bounded memory; the budget shrinks with the performance governor.
 *  - One batched, non-pickable Cesium Primitive per tile, drawn with a small
 *    shader: sun-tied wall/roof shading, darker at night with faint lit
 *    windows, mid-grey with bright roofs under NVG, warmth by height under
 *    thermal; roof-edge outlines under NVG/thermal.
 *  - Desktop: raw OSM heights (height, building:levels, roof, min_height)
 *    from the public Overpass API refine OpenMapTiles' rounded heights for the
 *    centre tiles, paced and cached (see lib/map/overpass-heights.ts).
 *  - A coarse rooftop heightfield is shared so wind particles can hide behind
 *    buildings (lib/map/building-heightfield.ts).
 *  - With 3D terrain on, buildings sit on sampled ground heights.
 *  - Attribution "© OpenMapTiles © OpenStreetMap contributors" is shown in the
 *    map footer whenever the layer is on (see MapLegalFooter).
 */

import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import {
  OSM_BUILDINGS_TILEJSON_URL, LOOK_COLOR, LOOK_MODE, buildingBudget, buildingsVisibleAt, decodeBuildingsTile, governedBudget,
  interpolateGround, lookWantsEdges, tileFraction, tileKey, tileTemplateFromTileJson, tileUrl, tilesAround, tilesToEvict,
  type Building, type BuildingLook, type TileXY,
} from "@/lib/map/osm-buildings";
import { buildHeightRaster, clearHeightRasters, removeHeightRaster, setHeightRaster } from "@/lib/map/building-heightfield";
import { applyHeightPoints, fetchOverpassHeights } from "@/lib/map/overpass-heights";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export type OsmBuildingsState = "off" | "zoomIn" | "loading" | "on" | "error";
export interface OsmBuildingsStatus { state: OsmBuildingsState; buildings: number; rawHeights?: number }

/** Sink ground-level bases so slopes and terrain error don't show gaps. */
const BASE_SINK_M = 3;
const GROUND_GRID = 8;
const ERROR_BACKOFF_MS = 60_000;
const MOVE_DEBOUNCE_MS = 250;
const GOVERNOR_POLL_MS = 3000;

/**
 * Building shader (MaterialAppearance, flat: the material does its own light).
 * `camOffset` = camera − tile origin (world, metres) so local coordinates stay
 * precise in float32; `up` = the tile's surface normal.
 */
const BUILDING_SOURCE = `
float owHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
czm_material czm_getMaterial(czm_materialInput materialInput) {
  czm_material m = czm_getDefaultMaterial(materialInput);
  vec3 nW = normalize(czm_inverseViewRotation * materialInput.normalEC);
  vec3 local = czm_inverseViewRotation * (-materialInput.positionToEyeEC) + camOffset;
  float h = dot(local, up) - groundLift;
  float roof = smoothstep(0.6, 0.85, dot(nW, up));
  vec3 c;
  if (mode > 1.5) {
    float w = 0.22 + 0.62 * smoothstep(0.0, 200.0, h);
    c = vec3(w * mix(0.8, 1.0, roof));
  } else if (mode > 0.5) {
    c = color.rgb * mix(0.5, 1.05, roof);
  } else {
    vec3 sun = normalize(czm_sunDirectionWC);
    float day = smoothstep(-0.10, 0.10, dot(sun, up));
    float lam = max(dot(nW, sun), 0.0);
    float sh = mix(0.48 + 0.52 * lam, 0.80 + 0.20 * lam, roof);
    c = mix(color.rgb * mix(0.09, 0.14, roof), color.rgb * sh, day);
    if (roof < 0.5 && day < 0.9) {
      vec3 t = normalize(cross(up, nW) + vec3(1e-6));
      vec2 cell = vec2(dot(local, t) / 3.4, h / 3.6);
      vec2 f = fract(cell);
      float win = step(0.25, f.x) * step(f.x, 0.75) * step(0.30, f.y) * step(f.y, 0.72);
      float lit = step(0.74, owHash(floor(cell)));
      c += vec3(1.0, 0.80, 0.48) * 0.30 * win * lit * (1.0 - day) * step(2.0, h);
    }
  }
  m.diffuse = vec3(0.0);
  m.emission = c;
  m.alpha = 1.0;
  return m;
}`;

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
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  edges: any | null;
  count: number;
  lastUsed: number;
  buildings: Building[];
  grid: number[] | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  origin: any;
  raw: "none" | "pending" | "done";
}

export function useOsmBuildingsLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  enabled: boolean;
  terrain: boolean;
  /** Visual mode: normal, dark basemap, NVG or thermal. */
  look: BuildingLook;
  constrained: boolean;
}): OsmBuildingsStatus {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, enabled, terrain, look, constrained } = params;
  const [status, setStatus] = useState<OsmBuildingsStatus>({ state: "off", buildings: 0 });
  const apiRef = useRef<{ setLook: (l: BuildingLook) => void } | null>(null);
  const lookRef = useRef(look);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading || !enabled) {
      setStatus((s) => (s.state === "off" ? s : { state: "off", buildings: 0 }));
      return;
    }
    const base = buildingBudget(constrained);
    const groups = entityGroupsRef.current;
    let perfSeen = Number(groups.perfLevel ?? 0);
    let budget = governedBudget(base, perfSeen);
    const collection = new Cesium.PrimitiveCollection();
    viewer.scene.primitives.add(collection);
    const cache = new Map<string, CachedTile>();
    const inflight = new Map<string, AbortController>();
    const queue: TileXY[] = [];
    let wanted = new Set<string>();
    let order: string[] = [];
    let visible = false;
    let disposed = false;
    let errorUntil = 0;
    let lastError = false;
    let rawCount = 0;
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const renderTimers = new Set<ReturnType<typeof setInterval>>();
    const rawCtrl = new AbortController();

    // The licensed ion OSM Buildings tileset (if any) would double up.
    const ionBuildings = groups.buildings?.[0];
    if (ionBuildings) ionBuildings.show = false;

    const requestRender = () => { try { viewer.scene.requestRender(); } catch { /* destroyed */ } };

    const publish = () => {
      if (disposed) return;
      let shown = 0;
      for (const k of wanted) shown += cache.get(k)?.count ?? 0;
      const pending = [...wanted].some((k) => !cache.has(k));
      const state: OsmBuildingsState = !visible ? "zoomIn" : lastError && shown === 0 ? "error" : pending && shown === 0 ? "loading" : "on";
      setStatus((s) => (s.state === state && s.buildings === shown && s.rawHeights === rawCount ? s : { state, buildings: shown, rawHeights: rawCount }));
    };

    const groundGrid = async (t: TileXY): Promise<number[] | null> => {
      if (!terrain) return null;
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

    const groundAt = (t: TileXY, b: Building, grid: number[] | null) => {
      if (!grid) return 0;
      const { u, v } = tileFraction(t, b.center[0], b.center[1]);
      return interpolateGround(grid, GROUND_GRID, u, v);
    };

    const tileOrigin = (t: TileXY, grid: number[] | null) => {
      const n = 2 ** t.z;
      const lon = ((t.x + 0.5) / n) * 360 - 180;
      const lat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * ((t.y + 0.5) / n)))) * 180) / Math.PI;
      const g = grid ? grid.reduce((a, b) => a + b, 0) / grid.length : 0;
      const pos = Cesium.Cartesian3.fromDegrees(lon, lat, g);
      return { pos, up: viewer.scene.globe.ellipsoid.geodeticSurfaceNormal(pos, new Cesium.Cartesian3()), off: new Cesium.Cartesian3() };
    };

    const makeMaterial = (origin: { up: unknown; off: unknown }) => new Cesium.Material({
      fabric: {
        type: "OwOsmBuilding",
        uniforms: {
          color: Cesium.Color.fromCssColorString(LOOK_COLOR[lookRef.current]),
          mode: LOOK_MODE[lookRef.current],
          camOffset: origin.off,
          up: origin.up,
          groundLift: 0,
        },
        source: BUILDING_SOURCE,
      },
      translucent: false,
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const buildPrimitive = (t: TileXY, buildings: Building[], grid: number[] | null, origin: any, show: boolean) => {
      const vertexFormat = Cesium.MaterialAppearance.MaterialSupport.BASIC.vertexFormat;
      const instances = [];
      for (const b of buildings) {
        const ground = groundAt(t, b, grid);
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
          material: makeMaterial(origin),
          materialSupport: Cesium.MaterialAppearance.MaterialSupport.BASIC,
          translucent: false,
          faceForward: true,
          flat: true,
        }),
        asynchronous: true,
        allowPicking: false,
        releaseGeometryInstances: true,
        compressVertices: true,
        show,
      });
    };

    /** Roof perimeters as lines (NVG/thermal only). */
    const buildEdges = (t: TileXY, c: CachedTile) => {
      const instances = [];
      const col = lookRef.current === "thermal" ? Cesium.Color.BLACK.withAlpha(0.8) : Cesium.Color.WHITE.withAlpha(0.85);
      const attr = Cesium.ColorGeometryInstanceAttribute.fromColor(col);
      for (const b of c.buildings) {
        if (b.height < 4) continue;
        const top = groundAt(t, b, c.grid) + b.height + 0.3;
        try {
          instances.push(new Cesium.GeometryInstance({
            geometry: new Cesium.PolygonOutlineGeometry({ polygonHierarchy: new Cesium.PolygonHierarchy(Cesium.Cartesian3.fromDegreesArray(b.rings[0].flat())), height: top }),
            attributes: { color: attr },
          }));
        } catch { /* degenerate */ }
      }
      if (!instances.length) return null;
      return new Cesium.Primitive({
        geometryInstances: instances,
        appearance: new Cesium.PerInstanceColorAppearance({ flat: true, translucent: true, renderState: { lineWidth: 1 } }),
        asynchronous: true, allowPicking: false, releaseGeometryInstances: true, show: c.primitive?.show ?? false,
      });
    };

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

    const dropPrims = (c: CachedTile) => {
      if (c.primitive) collection.remove(c.primitive);
      if (c.edges) collection.remove(c.edges);
      c.primitive = null; c.edges = null;
    };

    const placeTile = (t: TileXY, c: CachedTile) => {
      const key = tileKey(t);
      const show = wanted.has(key) && visible;
      const p = buildPrimitive(t, c.buildings, c.grid, c.origin, show);
      if (p) { collection.add(p); renderUntilReady(p); }
      c.primitive = p;
      if (p && lookWantsEdges(lookRef.current)) { c.edges = buildEdges(t, c); if (c.edges) { c.edges.show = show; collection.add(c.edges); renderUntilReady(c.edges); } }
      c.count = p ? c.buildings.length : 0;
      setHeightRaster(buildHeightRaster(t, c.buildings));
    };

    const evict = () => {
      const victims = tilesToEvict([...cache.entries()].map(([key, c]) => ({ key, lastUsed: c.lastUsed })), wanted, budget.maxTilesCached);
      for (const key of victims) {
        const c = cache.get(key);
        if (c) dropPrims(c);
        cache.delete(key);
        removeHeightRaster(key);
      }
    };

    /** Desktop: refine heights from raw OSM tags for the nearest tile still missing them. */
    const pumpRaw = () => {
      if (constrained || disposed || !visible) return;
      const key = order.find((k) => cache.get(k)?.raw === "none" && (cache.get(k)?.count ?? 0) > 0);
      if (!key) return;
      const c = cache.get(key)!;
      const [z, x, y] = key.split("/").map(Number);
      const t = { z, x, y };
      const n = 2 ** z;
      const w = (x / n) * 360 - 180, e = ((x + 1) / n) * 360 - 180;
      const nLat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * (y / n)))) * 180) / Math.PI;
      const sLat = (Math.atan(Math.sinh(Math.PI * (1 - 2 * ((y + 1) / n)))) * 180) / Math.PI;
      c.raw = "pending";
      void fetchOverpassHeights({ w, s: sLat, e, n: nLat }, rawCtrl.signal).then((pts) => {
        if (disposed || cache.get(key) !== c) return;
        if (!pts) { c.raw = "none"; setTimeout(pumpRaw, 11_000); return; }
        c.raw = "done";
        const changed = applyHeightPoints(c.buildings, pts);
        if (changed > 0) {
          rawCount += changed;
          dropPrims(c);
          placeTile(t, c);
          publish();
        }
        setTimeout(pumpRaw, 11_000);
      });
    };

    const loadTile = async (t: TileXY) => {
      const key = tileKey(t);
      const ctrl = new AbortController();
      inflight.set(key, ctrl);
      try {
        const template = await getTileTemplate();
        const res = await fetch(tileUrl(template, t), { signal: ctrl.signal });
        if (res.status === 404 || res.status === 204) {
          cache.set(key, { primitive: null, edges: null, count: 0, lastUsed: Date.now(), buildings: [], grid: null, origin: null, raw: "done" });
          return;
        }
        if (!res.ok) throw new Error(`tile ${key}: ${res.status}`);
        const data = new Uint8Array(await res.arrayBuffer());
        if (disposed || ctrl.signal.aborted) return;
        const { buildings } = decodeBuildingsTile(data, t, budget.maxBuildingsPerTile);
        const grid = await groundGrid(t);
        if (disposed || ctrl.signal.aborted) return;
        const c: CachedTile = { primitive: null, edges: null, count: 0, lastUsed: Date.now(), buildings, grid, origin: tileOrigin(t, grid), raw: "none" };
        placeTile(t, c);
        cache.set(key, c);
        lastError = false;
        evict();
        pumpRaw();
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
        wanted = new Set(); order = [];
        for (const [key, c] of inflight) { c.abort(); inflight.delete(key); }
        queue.length = 0;
        publish();
        requestRender();
        return;
      }
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
      order = tiles.map(tileKey);
      wanted = new Set(order);
      const now = Date.now();
      for (const [key, c] of cache) {
        const on = wanted.has(key);
        if (on) c.lastUsed = now;
        if (c.primitive) c.primitive.show = on;
        if (c.edges) c.edges.show = on;
      }
      for (const [key, c] of inflight) if (!wanted.has(key)) { c.abort(); inflight.delete(key); }
      queue.length = 0;
      if (now >= errorUntil) {
        for (const t of tiles) if (!cache.has(tileKey(t)) && !inflight.has(tileKey(t))) queue.push(t);
      }
      pump();
      evict();
      pumpRaw();
      publish();
      requestRender();
    };

    // Keep the shader's local frame current (camera − tile origin, in double precision).
    const onPreRender = () => {
      if (!visible) return;
      const cam = viewer.camera.positionWC;
      for (const c of cache.values()) {
        if (!c.primitive?.show || !c.origin) continue;
        Cesium.Cartesian3.subtract(cam, c.origin.pos, c.origin.off);
        const u = c.primitive.appearance?.material?.uniforms;
        if (u) u.camOffset = c.origin.off;
      }
    };
    const removePre = viewer.scene.preRender.addEventListener(onPreRender);

    // Governor: shrink/grow the budget when the level changes.
    const govTimer = setInterval(() => {
      const lvl = Number(groups.perfLevel ?? 0);
      if (lvl === perfSeen) return;
      perfSeen = lvl;
      budget = governedBudget(base, lvl);
      refresh();
    }, GOVERNOR_POLL_MS);

    apiRef.current = {
      setLook: (l: BuildingLook) => {
        const col = Cesium.Color.fromCssColorString(LOOK_COLOR[l]);
        for (const [key, c] of cache) {
          const u = c.primitive?.appearance?.material?.uniforms;
          if (u) { u.color = col; u.mode = LOOK_MODE[l]; }
          if (c.edges) { collection.remove(c.edges); c.edges = null; }
          if (c.primitive && lookWantsEdges(l)) {
            const [z, x, y] = key.split("/").map(Number);
            c.edges = buildEdges({ z, x, y }, c);
            if (c.edges) { c.edges.show = !!c.primitive.show; collection.add(c.edges); renderUntilReady(c.edges); }
          }
        }
        requestRender();
      },
    };

    const onMoveEnd = () => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(refresh, MOVE_DEBOUNCE_MS);
    };
    const removeMoveEnd = viewer.camera.moveEnd.addEventListener(onMoveEnd);
    refresh();

    return () => {
      disposed = true;
      apiRef.current = null;
      rawCtrl.abort();
      clearInterval(govTimer);
      if (debounce) clearTimeout(debounce);
      for (const id of renderTimers) clearInterval(id);
      for (const c of inflight.values()) c.abort();
      removeMoveEnd?.();
      removePre?.();
      clearHeightRasters();
      try {
        if (!viewer.isDestroyed?.()) {
          viewer.scene.primitives.remove(collection);
          if (ionBuildings && terrain) ionBuildings.show = true;
          viewer.scene.requestRender();
        }
      } catch (e) { logger.swallow("osm-buildings:cleanup", e, "debug"); }
    };
  }, [viewerRef, cesiumRef, entityGroupsRef, loading, enabled, terrain, constrained]);

  // Restyle in place when the look changes (no rebuild; edges added/removed).
  useEffect(() => {
    if (lookRef.current === look) return;
    lookRef.current = look;
    apiRef.current?.setLook(look);
  }, [look]);

  return status;
}
