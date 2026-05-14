import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { createPinCanvas } from "../pin-canvas";
import { getPOIsInBbox, getNearbyPOIs, type NearbyPOI, type PoiType } from "../env-intel";
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
 * Don't query Overpass at continental zoom — the bounding box would be
 * huge, the query would time out, and the result wouldn't be useful
 * (too many POIs to read at that zoom anyway).
 * 8° ≈ 880 km per side, roughly "metro area + suburbs" view.
 */
const MAX_VIEWPORT_DEG_PER_SIDE = 8;
/** Debounce window after camera.moveEnd before we fetch viewport POIs. */
const CAMERA_DEBOUNCE_MS = 400;
/** Radius (m) of the always-on halo fetched around each operation. */
const OPERATION_HALO_M = 5000;

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
    const opsWithCoords = operations.filter(o => o.lat && o.lng);
    if (opsWithCoords.length === 0) {
      operationPoisRef.current.clear();
      renderPOIs();
      return;
    }

    (async () => {
      const fresh = new Map<number, NearbyPOI>();
      // Fetch halos sequentially to avoid blasting Overpass with N parallel
      // requests for an org with many operations. Tile cache will turn most
      // of these into instant returns after the first hit.
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
        // Skip when zoomed too far out (avoids huge Overpass queries)
        if (widthDeg > MAX_VIEWPORT_DEG_PER_SIDE || heightDeg > MAX_VIEWPORT_DEG_PER_SIDE) {
          // Clear viewport-source POIs but keep the operation halo
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
