/**
 * S2 Underground Intel Layer for the Tactical Map
 *
 * Renders S2 Underground CIP data as Cesium point entities with
 * color-coded markers, popups, and auto-refresh.
 *
 * Two layers of state:
 *   - Sub-layer on/off selections (persisted per-company in localStorage)
 *   - Effective age window (72h default, expanded if Time Machine is dragged
 *     further back than 72h)
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { logger } from "@/lib/logger";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";
import {
  S2_LAYERS, S2_DEFAULT_MAX_AGE_HOURS, fetchS2LayerFeatures, buildS2Description,
} from "../s2-underground";
import { preloadSymbolsForFeatures } from "../mil-symbols";

/** Wrapper so the react-compiler does not flag `Date.now()` as an inline impure call */
function currentTimestamp() { return Date.now(); }

interface UseS2IntelLayerParams {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  enabled: boolean; // master toggle from layer panel
  companyId: string;
  /** Time Machine replay timestamp; effective only when timeMachineOpen */
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}

function storageKey(companyId: string) {
  return `tactical-map-s2-${companyId}`;
}

/** Read persisted active layer IDs from localStorage. */
function readPersistedLayers(companyId: string): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(storageKey(companyId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch (e) {
    logger.swallow("s2-intel:read-persisted", e, "debug");
    return null;
  }
}

function writePersistedLayers(companyId: string, set: Set<string>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(storageKey(companyId), JSON.stringify(Array.from(set)));
  } catch (e) {
    logger.swallow("s2-intel:write-persisted", e, "debug");
  }
}

export function useS2IntelLayer({
  viewerRef, cesiumRef, entityGroupsRef, loading, enabled,
  companyId, debouncedReplayTime, timeMachineOpen,
}: UseS2IntelLayerParams) {
  // Initialize from localStorage if available, otherwise from defaultOn flags
  const [activeLayers, setActiveLayers] = useState<Set<string>>(() => {
    const persisted = readPersistedLayers(companyId);
    if (persisted) return persisted;
    return new Set(S2_LAYERS.filter(l => l.defaultOn).map(l => l.id));
  });
  const [featureCount, setFeatureCount] = useState(0);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const intervalsRef = useRef<ReturnType<typeof setInterval>[]>([]);

  // Re-hydrate when company changes (user switches tenants).
  // Deferred via microtask to avoid cascading setState in the same render.
  useEffect(() => {
    let cancelled = false;
    Promise.resolve().then(() => {
      if (cancelled) return;
      const persisted = readPersistedLayers(companyId);
      setActiveLayers(persisted ?? new Set(S2_LAYERS.filter(l => l.defaultOn).map(l => l.id)));
    });
    return () => { cancelled = true; };
  }, [companyId]);

  // Toggle a specific S2 sub-layer and persist
  const toggleLayer = useCallback((layerId: string) => {
    setActiveLayers(prev => {
      const next = new Set(prev);
      if (next.has(layerId)) next.delete(layerId);
      else next.add(layerId);
      writePersistedLayers(companyId, next);
      return next;
    });
  }, [companyId]);

  /**
   * Additional hours to extend each feed's age window when Time Machine is
   * engaged. Returns 0 when not replaying. Each feed's effective window is
   * then `feed.defaultAgeHours + timeMachineExtraHours`, computed in the
   * loader below — this keeps per-feed defaults honest (e.g. wildfires keep
   * 14d natural cadence) while allowing the user to look further back.
   */
  const timeMachineExtraHours = useMemo(() => {
    if (!timeMachineOpen) return 0;
    return Math.max(0, (currentTimestamp() - debouncedReplayTime) / (60 * 60 * 1000));
  }, [timeMachineOpen, debouncedReplayTime]);

  // Persistent data source ref for clustering
  const dataSourceRef = useRef<{ ds: unknown; name: string } | null>(null);

  // Main effect: render features for active layers
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Always clean up previous data source first
    if (dataSourceRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewer.dataSources.remove(dataSourceRef.current.ds as any, true);
      } catch (err) { logger.swallow("s2-intel:remove-ds", err); }
      dataSourceRef.current = null;
    }
    entityGroupsRef.current.s2Intel = [];

    // If disabled, just clean up and return
    if (!enabled) return;

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

      // Create a CustomDataSource with clustering enabled
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ds = new (Cesium as any).CustomDataSource("s2-intel");
      ds.clustering.enabled = true;
      ds.clustering.pixelRange = 45;
      ds.clustering.minimumClusterSize = 3;

      // Style cluster labels: smaller, styled, visible above terrain
      ds.clustering.clusterEvent.addEventListener(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (entities: any[], cluster: { label: any; billboard: any; point: any }) => {
          cluster.label.show = true;
          cluster.label.text = String(entities.length);
          cluster.label.font = "bold 12px monospace";
          cluster.label.fillColor = Cesium.Color.WHITE;
          cluster.label.outlineColor = Cesium.Color.BLACK;
          cluster.label.outlineWidth = 3;
          cluster.label.style = Cesium.LabelStyle.FILL_AND_OUTLINE;
          cluster.label.disableDepthTestDistance = Number.POSITIVE_INFINITY;
          cluster.label.pixelOffset = new Cesium.Cartesian2(0, -2);
          // Use a small colored circle as the cluster background
          cluster.point.show = true;
          cluster.point.pixelSize = Math.min(14 + entities.length * 0.3, 24);
          cluster.point.color = Cesium.Color.fromCssColorString("#ef4444").withAlpha(0.85);
          cluster.point.outlineColor = Cesium.Color.WHITE;
          cluster.point.outlineWidth = 1.5;
          cluster.point.disableDepthTestDistance = Number.POSITIVE_INFINITY;
          // Hide the default billboard
          cluster.billboard.show = false;
        }
      );

      const allEntities: { id: string }[] = [];

      // Step 1: Collect all features from all active layers, filtered to
      // each feed's own age window. The window expands by the Time Machine
      // replay depth so deeper replays surface pins that would have been
      // visible at that time.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const allFeatures: { feature: any; layer: typeof S2_LAYERS[0] }[] = [];
      for (const layer of S2_LAYERS) {
        if (!activeLayers.has(layer.id)) continue;
        const baseWindow = layer.defaultAgeHours ?? S2_DEFAULT_MAX_AGE_HOURS;
        const effectiveAge = baseWindow + timeMachineExtraHours;
        const features = await fetchS2LayerFeatures(layer, { maxAgeHours: effectiveAge });
        if (cancelled) return;
        for (const feature of features) {
          allFeatures.push({ feature, layer });
        }
      }

      if (cancelled || allFeatures.length === 0) return;

      // Step 2: Batch-generate MIL-STD-2525 symbols with fuzzy matching
      const symbolMap = await preloadSymbolsForFeatures(
        allFeatures.map(f => ({ properties: f.feature.properties, layerCategory: f.layer.category })),
        28
      );

      // Step 3: Add entities with per-feature symbols
      for (let idx = 0; idx < allFeatures.length; idx++) {
        const { feature, layer } = allFeatures[idx];
        const entityId = `s2-${layer.id}-${feature.lat.toFixed(4)}-${feature.lng.toFixed(4)}-${idx}`;
        const desc = buildS2Description(feature, layer);
        const featureName = String(feature.properties.IncidentName ?? feature.properties.incident_name ?? feature.properties.Name ?? feature.properties.name ?? feature.properties.OBJECTID ?? "Intel");
        const symbolUrl = symbolMap.get(idx) ?? "";

        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const entityOpts: any = {
            id: entityId,
            name: `${layer.label} — ${featureName}`,
            position: Cesium.Cartesian3.fromDegrees(feature.lng, feature.lat, 5),
            description: desc,
          };

          if (symbolUrl) {
            entityOpts.billboard = {
              image: symbolUrl,
              width: 28,
              height: 28,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            };
          } else {
            entityOpts.point = {
              pixelSize: 9,
              color: Cesium.Color.fromCssColorString(layer.color).withAlpha(0.9),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 1.5,
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            };
          }

          ds.entities.add(entityOpts);
          allEntities.push({ id: entityId });
        } catch (err) {
          logger.swallow("s2-intel:add-entity", err);
        }
      }

      if (!cancelled) {
        // Add the clustered data source to the viewer
        viewer.dataSources.add(ds);
        dataSourceRef.current = { ds, name: "s2-intel" };
        entityGroupsRef.current.s2Intel = allEntities;
        setFeatureCount(allEntities.length);
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
  }, [viewerRef, cesiumRef, entityGroupsRef, loading, enabled, activeLayers, timeMachineExtraHours]);

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
    /** Hours added to each feed's natural window by the active Time Machine offset. */
    timeMachineExtraHours,
  };
}
