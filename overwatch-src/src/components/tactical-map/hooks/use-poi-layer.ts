import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { createPinCanvas } from "../pin-canvas";
import { getPOIsInBbox, getNearbyPOIs, countTilesForBbox, type NearbyPOI, type PoiType } from "../env-intel";
import type { OperationPin } from "../types";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

/**
 * POI ("Nearby Services") layer.
 *
 * Renders OpenStreetMap amenities — hospitals, police, fire stations,
 * pharmacies, schools, fuel, helipads, shelters — on the tactical map.
 *
 * Two simultaneous data sources keep the layer useful at every zoom:
 *
 * 1. **Operations halo** (always-on baseline)
 *    A 5 km halo of POIs is fetched around every operation that has
 *    coordinates. These are operationally relevant — they show up even
 *    when the camera is zoomed out or pointed somewhere else.
 *
 * 2. **Camera viewport** (zoom-gated)
 *    When the camera is zoomed in past a minimum threshold (viewport less
 *    than `MAX_VIEWPORT_DEG_PER_SIDE`), POIs in the visible bounding box
 *    are fetched. Lets operators scope brand-new sites without an op pin.
 *    Fetching is debounced 400 ms after `camera.moveEnd`, and tiles are
 *    cached so panning back to a previously-visited area is instant.
 *
 * Both sources merge by POI id before rendering, so a POI within both an
 * operation halo and the viewport renders only once.
 */

const POI_COLORS: Record<PoiType, string> = {
  hospital: "#ef4444",
  police: "#3b82f6",
  fire_station: "#f97316",
  pharmacy: "#22c55e",
  school: "#a855f7",
  fuel: "#eab308",
  helipad: "#06b6d4",
  shelter: "#14b8a6",
};

/**
 * Don't query Overpass at low zoom — POI pins are invisible specks at
 * that scale and the tile fan-out would blast Overpass with hundreds
 * of requests. 1° ≈ 110 km per side, roughly "city + outskirts" view.
 *
 * History: was 8° (~880 km, metro+region) which produced up to 6,561
 * tiles per camera move and caused `ERR_INSUFFICIENT_RESOURCES` storms
 * on map mount.
 */
const MAX_VIEWPORT_DEG_PER_SIDE = 1;
/**
 * Hard cap on tiles per viewport fetch. Defense in depth — even within
 * the viewport gate, an unusual viewport (e.g. very long+thin) could
 * exceed this. At 0.1° per tile, 50 tiles = ~5° of total area covered.
 */
const MAX_TILES_PER_VIEWPORT = 50;
/** Debounce window after camera.moveEnd before we fetch viewport POIs. */
const CAMERA_DEBOUNCE_MS = 500;
/** Radius (m) of the always-on halo fetched around each operation. */
const OPERATION_HALO_M = 5000;
/**
 * Cap on operations queried per page-load. Each operation halo crosses
 * ~4 tiles (0.09° × 0.11° bbox vs 0.1° grid). A company with 50 ops
 * could blast 200 cold cache fetches — limit the baseline halo to the
 * first N ops, biasing toward most-recent activity.
 */
const MAX_OPS_FOR_HALO = 20;

interface ViewportRect {
  south: number;
  north: number;
  west: number;
  east: number;
}

/**
 * Compute the current camera viewport in lat/lng degrees, or null if
 * the camera is pointing at sky / off the globe.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function readViewport(viewer: any, _Cesium: any): ViewportRect | null {
  try {
    const rect = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
    if (!rect) return null;
    const toDeg = 180 / Math.PI;
    return {
      south: rect.south * toDeg,
      north: rect.north * toDeg,
      west: rect.west * toDeg,
      east: rect.east * toDeg,
    };
  } catch (e) {
    logger.swallow("poi-layer:read-viewport", e, "debug");
    return null;
  }
}

export function usePoiLayer(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  operations: OperationPin[];
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations } = params;

  /** Currently-rendered POIs (merged from both sources, deduped by id). */
  const [nearbyPOIs, setNearbyPOIs] = useState<NearbyPOI[]>([]);
  /** POIs from the always-on operation halo source. Keyed source so we
   * can recompute viewport POIs independently. */
  const operationPoisRef = useRef<Map<number, NearbyPOI>>(new Map());
  /** POIs from the camera viewport source. */
  const viewportPoisRef = useRef<Map<number, NearbyPOI>>(new Map());
  /** Tracks which entity IDs are currently in the Cesium scene for differential updates. */
  const renderedIdsRef = useRef<Set<string>>(new Set());

  /**
   * Render the merged POI set to Cesium entities, doing a differential
   * add/remove rather than full clear/recreate. This keeps the scene
   * stable as the user pans and avoids stutter.
   */
  function renderPOIs() {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    // Merge both sources (viewport wins on dupes, but the data is identical anyway).
    const merged = new Map<number, NearbyPOI>();
    for (const [id, p] of operationPoisRef.current) merged.set(id, p);
    for (const [id, p] of viewportPoisRef.current) merged.set(id, p);

    const wantedIds = new Set<string>();
    const pois = Array.from(merged.values());

    for (const poi of pois) {
      const entityId = `poi-${poi.id}`;
      wantedIds.add(entityId);
      if (renderedIdsRef.current.has(entityId)) continue;

      const color = POI_COLORS[poi.type] ?? "#6b7280";
      try {
        const entity = viewer.entities.add({
          id: entityId,
          name: poi.name,
          position: Cesium.Cartesian3.fromDegrees(poi.lng, poi.lat),
          billboard: {
            image: createPinCanvas(color, "alert"),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 0.45,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: poi.name,
            font: "9px monospace",
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            outlineWidth: 2,
            outlineColor: Cesium.Color.BLACK,
            fillColor: Cesium.Color.fromCssColorString(color),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            pixelOffset: new Cesium.Cartesian2(0, -28),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scale: 0.8,
            distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 500000),
          },
          description: `<b>${poi.name}</b><br/>Type: ${poi.type.replace("_", " ")}`,
        });
        renderedIdsRef.current.add(entityId);
        entityGroupsRef.current.pois.push(entity);
      } catch (e) {
        logger.swallow("poi-layer:add-entity", e, "debug");
      }
    }

    // Remove entities no longer in the merged set.
    for (const renderedId of Array.from(renderedIdsRef.current)) {
      if (!wantedIds.has(renderedId)) {
        try { viewer.entities.removeById(renderedId); } catch (e) { logger.swallow("poi-layer:remove-entity", e, "debug"); }
        renderedIdsRef.current.delete(renderedId);
      }
    }
    entityGroupsRef.current.pois = Array.from(wantedIds).map(id => ({ id }));

    setNearbyPOIs(pois);
  }

  // ─── Always-on baseline: a halo around every operation ─────────
  useEffect(() => {
    if (loading) return;

    if (!layers.nearbyPOIs) {
      // Layer disabled — purge everything
      const viewer = viewerRef.current;
      if (viewer) {
        for (const id of Array.from(renderedIdsRef.current)) {
          try { viewer.entities.removeById(id); } catch (e) { logger.swallow("poi-layer:remove-entity", e, "debug"); }
        }
      }
      renderedIdsRef.current.clear();
      operationPoisRef.current.clear();
      viewportPoisRef.current.clear();
      entityGroupsRef.current.pois = [];
      setNearbyPOIs([]);
      return;
    }

    let cancelled = false;
    // Only fetch halos for the first N operations to bound Overpass load.
    // Most orgs have <20 active ops; large orgs would otherwise pay a cold-
    // cache cost of ~4 Overpass tiles per op = potentially hundreds of
    // requests on first load.
    const opsWithCoords = operations.filter(o => o.lat && o.lng).slice(0, MAX_OPS_FOR_HALO);
    if (opsWithCoords.length === 0) {
      operationPoisRef.current.clear();
      renderPOIs();
      return;
    }

    (async () => {
      const fresh = new Map<number, NearbyPOI>();
      // Fetch halos sequentially to avoid blasting Overpass with N parallel
      // requests for an org with many operations. The env-intel tile cache
      // (in-memory + localStorage, 7-day TTL) makes repeat ops near each
      // other near-instant after the first hit.
      for (const op of opsWithCoords) {
        if (cancelled) return;
        try {
          const pois = await getNearbyPOIs(op.lat, op.lng, OPERATION_HALO_M);
          for (const p of pois) fresh.set(p.id, p);
        } catch (e) {
          logger.swallow("poi-layer:halo-fetch", e, "debug");
        }
      }
      if (cancelled) return;
      operationPoisRef.current = fresh;
      renderPOIs();
    })();

    return () => { cancelled = true; };
    // renderPOIs / refs are stable
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [operations, layers.nearbyPOIs, loading]);

  // ─── Camera-driven: refetch when the user pans / zooms ─────────
  useEffect(() => {
    if (loading || !layers.nearbyPOIs) return;
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    function scheduleFetch() {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        if (cancelled) return;
        const v = viewerRef.current;
        const C = cesiumRef.current;
        if (!v || !C) return;
        const rect = readViewport(v, C);
        if (!rect) return;
        const widthDeg = rect.east - rect.west;
        const heightDeg = rect.north - rect.south;
        const tileCount = countTilesForBbox(rect.south, rect.north, rect.west, rect.east);
        // Skip when zoomed too far out OR when the tile count would
        // exceed the per-fetch cap. Either condition clears any stale
        // viewport-source POIs but leaves the operation halo intact.
        if (
          widthDeg > MAX_VIEWPORT_DEG_PER_SIDE
          || heightDeg > MAX_VIEWPORT_DEG_PER_SIDE
          || tileCount > MAX_TILES_PER_VIEWPORT
        ) {
          if (viewportPoisRef.current.size > 0) {
            viewportPoisRef.current.clear();
            renderPOIs();
          }
          return;
        }
        getPOIsInBbox(rect.south, rect.north, rect.west, rect.east).then(pois => {
          if (cancelled) return;
          const next = new Map<number, NearbyPOI>();
          for (const p of pois) next.set(p.id, p);
          viewportPoisRef.current = next;
          renderPOIs();
        }).catch(e => logger.swallow("poi-layer:viewport-fetch", e, "debug"));
      }, CAMERA_DEBOUNCE_MS);
    }

    // Initial fetch on layer enable
    scheduleFetch();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const handler = scheduleFetch as any;
    viewer.camera.moveEnd.addEventListener(handler);

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      try { viewer.camera.moveEnd.removeEventListener(handler); } catch (e) { logger.swallow("poi-layer:remove-listener", e, "debug"); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layers.nearbyPOIs, loading]);

  return { nearbyPOIs };
}
