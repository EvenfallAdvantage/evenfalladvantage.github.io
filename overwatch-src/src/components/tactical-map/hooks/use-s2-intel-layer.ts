/**
 * S2 Underground Intel Layer for the Tactical Map
 *
 * Renders S2 Underground CIP data as Cesium point entities with
 * color-coded markers, popups, and auto-refresh.
 */

import { useEffect, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";
import {
  S2_LAYERS, fetchS2LayerFeatures, buildS2Description,
} from "../s2-underground";

interface UseS2IntelLayerParams {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  enabled: boolean; // master toggle from layer panel
}

export function useS2IntelLayer({
  viewerRef, cesiumRef, entityGroupsRef, loading, enabled,
}: UseS2IntelLayerParams) {
  const [activeLayers, setActiveLayers] = useState<Set<string>>(() =>
    new Set(S2_LAYERS.filter(l => l.defaultOn).map(l => l.id))
  );
  const [featureCount, setFeatureCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  // Toggle a specific S2 sub-layer
  const toggleLayer = (layerId: string) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      return next;
    });
  };

  // Main effect: render features for active layers
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading || !enabled) return;

    // Clear previous S2 entities
    const prevEntities = entityGroupsRef.current.s2Intel ?? [];
    for (const e of prevEntities) {
      try { viewer.entities.removeById(e.id); } catch (err) { logger.swallow("s2-intel:remove", err); }
    }
    entityGroupsRef.current.s2Intel = [];

    let cancelled = false;

    if (activeLayers.size === 0) {
      // Defer setState to avoid synchronous setState in effect body
      Promise.resolve().then(() => { if (!cancelled) setFeatureCount(0); });
      return () => { cancelled = true; };
    }

    async function loadAllLayers() {
      const viewer = viewerRef.current;
      const Cesium = cesiumRef.current;
      if (!viewer || !Cesium || cancelled) return;

      const allEntities: { id: string }[] = [];
      let totalFeatures = 0;

      for (const layer of S2_LAYERS) {
        if (!activeLayers.has(layer.id)) continue;

        const features = await fetchS2LayerFeatures(layer);
        if (cancelled) return;

        for (const feature of features) {
          const entityId = `s2-${layer.id}-${feature.lat.toFixed(4)}-${feature.lng.toFixed(4)}-${totalFeatures}`;
          const desc = buildS2Description(feature, layer);

          try {
            viewer.entities.add({
              id: entityId,
              position: Cesium.Cartesian3.fromDegrees(feature.lng, feature.lat),
              point: {
                pixelSize: 8,
                color: Cesium.Color.fromCssColorString(layer.color).withAlpha(0.85),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 1,
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
              },
              label: {
                text: layer.icon,
                font: "bold 10px monospace",
                fillColor: Cesium.Color.fromCssColorString(layer.color),
                outlineColor: Cesium.Color.BLACK,
                outlineWidth: 2,
                style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                pixelOffset: new Cesium.Cartesian2(0, -14),
                heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
                disableDepthTestDistance: Number.POSITIVE_INFINITY,
                scale: 0.9,
              },
              description: desc,
            });
            allEntities.push({ id: entityId });
          } catch (err) {
            logger.swallow("s2-intel:add-entity", err);
          }
          totalFeatures++;
        }
      }

      if (!cancelled) {
        entityGroupsRef.current.s2Intel = allEntities;
        setFeatureCount(totalFeatures);
        setLastRefresh(new Date());
      }
    }

    loadAllLayers();

    // Auto-refresh based on the shortest interval of active layers
    const activeLayerDefs = S2_LAYERS.filter(l => activeLayers.has(l.id));
    const minRefresh = Math.min(...activeLayerDefs.map(l => l.refreshMinutes));
    if (minRefresh > 0 && minRefresh < Infinity) {
      const interval = setInterval(() => {
        if (!cancelled) loadAllLayers();
      }, minRefresh * 60 * 1000);
      intervalsRef.current.push(interval);
    }

    return () => {
      cancelled = true;
      for (const i of intervalsRef.current) clearInterval(i);
      intervalsRef.current = [];
    };
  }, [viewerRef, cesiumRef, entityGroupsRef, loading, enabled, activeLayers]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      for (const i of intervalsRef.current) clearInterval(i);
    };
  }, []);

  return {
    s2Layers: S2_LAYERS,
    activeLayers,
    toggleLayer,
    featureCount,
    lastRefresh,
  };
}
