import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { getSiteMapBounds, loadStoryboard, type SiteMapBounds } from "@/lib/supabase/db-operations";
import { getRecentGeofenceAlerts, type GeofenceAlert } from "../env-intel";
import { addSentinel1Layer, addSentinel2Layer } from "../sentinel-layer";
import { FLIR_SHADER, CRT_SHADER, applyShader, removeShader } from "../shaders";
import { escapeHtml } from "@/lib/security";
import type { OperationDocument } from "@/types/operations";
import { createPinCanvas, parseIncidentNarrative } from "../pin-canvas";
import type { StaffPin, OperationPin, IncidentPin } from "../types";
import type { MapAnnotation } from "@/lib/supabase/db-annotations";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";
import { useOperationsLayer } from "./use-operations-layer";
import { useStaffLayer } from "./use-staff-layer";
import { useIncidentsLayer } from "./use-incidents-layer";
import { useWeatherLayer } from "./use-weather-layer";
import { useNightVision } from "./use-night-vision";
import { useAircraftLayer } from "./use-aircraft-layer";
import { useOrbitLayer } from "./use-orbit-layer";
import { useTrailsLayer } from "./use-trails-layer";
import { useAnnotationsLayer } from "./use-annotations-layer";
import { usePoiLayer } from "./use-poi-layer";
import { useS2IntelLayer } from "./use-s2-intel-layer";
import { useHeatmapLayer } from "./use-heatmap-layer";

export type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

export function useCesiumLayers(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  operations: OperationPin[];
  staff: StaffPin[];
  incidents: IncidentPin[];
  companyId: string;
  isAdmin?: boolean;
  eventDocs: Record<string, OperationDocument[]>;
  annotations: MapAnnotation[];
  debouncedReplayTime: number;
  timeMachineOpen: boolean;
}) {
  const {
    viewerRef,
    cesiumRef,
    entityGroupsRef,
    loading,
    layers,
    operations,
    staff,
    incidents,
    companyId,
    isAdmin,
    eventDocs,
    annotations,
    debouncedReplayTime,
    timeMachineOpen,
  } = params;

  // Site overlay / storyboard state remains here — shared between the
  // site overlay and storyboard pin effects and surfaced to callers so
  // the aligner UI can drive savedBounds updates.
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlert[]>([]);
  const [savedBounds, setSavedBounds] = useState<Record<string, SiteMapBounds>>({});
  const [boundsLoaded, setBoundsLoaded] = useState<Set<string>>(new Set());
  const [boundsLoading, setBoundsLoading] = useState<Set<string>>(new Set());
  const [aligningOp, setAligningOp] = useState<OperationPin | null>(null);

  // ─── Sub-hook: Operations pin entities ───────────────
  useOperationsLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations, eventDocs });

  // ─── Sub-hook: Staff pins ────────────────────────────
  useStaffLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, staff });

  // ─── Sub-hook: Incident pins ─────────────────────────
  useIncidentsLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, incidents });

  // ─── Sub-hook: Weather radar ─────────────────────────
  useWeatherLayer({ viewerRef, cesiumRef, loading, layers });

  // ─── Sub-hook: Night vision ──────────────────────────
  useNightVision({ viewerRef, cesiumRef, entityGroupsRef, loading, layers });

  // ─── Sub-hook: Live aircraft ─────────────────────────
  useAircraftLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations });

  // ─── Sub-hook: Satellite orbits ──────────────────────
  useOrbitLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers });

  // ─── Sub-hook: Breadcrumb trails ─────────────────────
  useTrailsLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, staff, companyId, debouncedReplayTime, timeMachineOpen });

  // ─── Sub-hook: Annotations ───────────────────────────
  useAnnotationsLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, annotations });

  // ─── Sub-hook: Nearby POIs ───────────────────────────
  const { nearbyPOIs } = usePoiLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations });

  // ─── Sub-hook: S2 Underground Intel ─────────────────
  const s2Intel = useS2IntelLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, enabled: layers.s2Intel });

  // ─── Sub-hook: Incident Heatmap ────────────────────
  useHeatmapLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, incidents });

  // ─── 3D Terrain & Buildings Toggle (combined) ────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;
    const buildings = entityGroupsRef.current.buildings?.[0];
    if (layers.terrain) {
      // Enable world terrain with normals + water mask
      viewer.scene.setTerrain(Cesium.Terrain.fromWorldTerrain({
        requestVertexNormals: true,
        requestWaterMask: true,
      }));
      viewer.scene.globe.depthTestAgainstTerrain = true;
      // Show buildings — they require terrain to render at correct elevation
      if (buildings) buildings.show = true;
    } else {
      // Flat ellipsoid (no terrain)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      viewer.terrainProvider = new (Cesium as any).EllipsoidTerrainProvider();
      viewer.scene.globe.depthTestAgainstTerrain = false;
      // Hide buildings — they float without terrain
      if (buildings) buildings.show = false;
    }
  }, [layers.terrain, loading, viewerRef, cesiumRef, entityGroupsRef]);

  // ─── Load saved bounds from DB when site maps are toggled ────
  useEffect(() => {
    operations.forEach((op) => {
      if (layers.siteOverlays[op.id] && !savedBounds[op.id] && !boundsLoaded.has(op.id) && !boundsLoading.has(op.id)) {
        setBoundsLoading(prev => new Set(prev).add(op.id));
        getSiteMapBounds(op.id).then(bounds => {
          if (bounds) {
            setSavedBounds(prev => ({ ...prev, [op.id]: bounds }));
          }
          setBoundsLoaded(prev => new Set(prev).add(op.id));
          setBoundsLoading(prev => { const next = new Set(prev); next.delete(op.id); return next; });
        }).catch(() => {
          setBoundsLoaded(prev => new Set(prev).add(op.id));
          setBoundsLoading(prev => { const next = new Set(prev); next.delete(op.id); return next; });
        });
      }
    });
  }, [operations, layers.siteOverlays, savedBounds, boundsLoaded, boundsLoading]);

  // ─── Site Map Overlays (rubber-sheet aligned) ────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Remove old site overlay layers
    (entityGroupsRef.current.siteOverlays ?? []).forEach((layer: { layerRef: unknown; eventId: string }) => {
      try { viewer.imageryLayers.remove(layer.layerRef, false); } catch (e) { logger.swallow("cesium-layers:remove-site-overlay", e); }
    });
    entityGroupsRef.current.siteOverlays = [];

    // Check each toggled-on site map
    operations.forEach((op) => {
      if (!layers.siteOverlays[op.id] || !op.siteMapUrl || !op.lat || !op.lng) return;

      // If we have saved bounds (local or from DB), drape immediately
      const bounds = savedBounds[op.id];
      if (bounds) {
        try {
          const provider = new Cesium.SingleTileImageryProvider({
            url: op.siteMapUrl,
            rectangle: Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north),
          });
          const layer = viewer.imageryLayers.addImageryProvider(provider);
          layer.alpha = layers.siteOverlayOpacity;
          entityGroupsRef.current.siteOverlays.push({ layerRef: layer, eventId: op.id });
        } catch (err) {
          console.warn("[TacticalMap] Failed to load aligned site overlay for", op.name, err);
        }
        return;
      }

      // No saved bounds — but only open aligner if we've finished loading
      // (prevents the aligner from opening while the async bounds fetch is in progress)
      if (!aligningOp && isAdmin && boundsLoaded.has(op.id) && !boundsLoading.has(op.id)) {
        setAligningOp(op);
      }
    });
  }, [operations, layers.siteOverlays, layers.siteOverlayOpacity, loading, savedBounds, aligningOp, isAdmin, boundsLoaded, boundsLoading, viewerRef, cesiumRef, entityGroupsRef]);

  // ─── Storyboard Pins on Site Map Overlays ────────────
  // When a site map is active with saved bounds, load its storyboard pins
  // and convert image-relative x/y (0-1) to lat/lng using the bounds.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Clear old storyboard pin entities
    (entityGroupsRef.current.storyboardPins ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch (e_) { logger.swallow("cesium-layers:remove-entity", e_); }
    });
    entityGroupsRef.current.storyboardPins = [];

    // For each active overlay with saved bounds, load pins
    const activeOps = operations.filter(op =>
      layers.siteOverlays[op.id] && savedBounds[op.id] && op.siteMapUrl
    );

    if (activeOps.length === 0) return;

    activeOps.forEach(op => {
      const bounds = savedBounds[op.id];
      if (!bounds) return;

      // Load storyboard AND incidents for this operation in parallel
      Promise.all([
        loadStoryboard(op.id),
        import("@/lib/supabase/db-operations").then(m => m.getIncidents(companyId, "all")),
      ]).then(([storyboard, allIncidents]) => {
        if (!storyboard?.pins || !Array.isArray(storyboard.pins)) return;

        // Build a lookup of incidents by storyboard_pin_id for enrichment
        const incidentByPinId: Record<string, typeof allIncidents[0]> = {};
        (allIncidents ?? []).forEach((inc: Record<string, unknown>) => {
          if (inc.storyboard_pin_id && inc.storyboard_id === storyboard.id) {
            incidentByPinId[inc.storyboard_pin_id as string] = inc;
          }
        });

        const lngSpan = bounds.east - bounds.west;
        const latSpan = bounds.north - bounds.south;

        storyboard.pins.forEach((pin: { id: string; x: number; y: number; label: string; description?: string; icon?: string; color?: string }, idx: number) => {
          const lng = bounds.west + pin.x * lngSpan;
          const lat = bounds.north - pin.y * latSpan;

          const pinColor = pin.color || "#22c55e";

          // Check if this pin is linked to an incident for enriched data
          const linkedIncident = incidentByPinId[pin.id];
          let desc: string;
          if (linkedIncident) {
            const sevColor = linkedIncident.severity === "critical" ? "#ef4444"
              : linkedIncident.severity === "high" ? "#f97316"
              : linkedIncident.severity === "medium" ? "#eab308" : "#6b7280";
            const reporter = linkedIncident.reported_user as { first_name?: string; last_name?: string } | undefined;
            const assignee = linkedIncident.assigned_user as { first_name?: string; last_name?: string } | undefined;
            const narrative = parseIncidentNarrative(String(linkedIncident.description ?? ""));
            const reporterName = reporter ? `${reporter.first_name ?? ""} ${reporter.last_name ?? ""}`.trim() : "";
            const assigneeName = assignee ? `${assignee.first_name ?? ""} ${assignee.last_name ?? ""}`.trim() : "";
            const ts = linkedIncident.created_at ? new Date(linkedIncident.created_at as string).toLocaleString() : "";
            desc = `<div style="font-family:monospace;font-size:11px;line-height:1.7">
              <b>${escapeHtml(String(linkedIncident.title || pin.label))}</b>
              <div style="margin:4px 0"><span style="color:${sevColor};font-weight:bold;padding:1px 6px;border-radius:3px;background:${sevColor}22">${escapeHtml(String(linkedIncident.severity ?? "").toUpperCase())}</span> <span style="opacity:0.6">${escapeHtml(String(linkedIncident.status ?? "").toUpperCase())}</span></div>
              ${narrative ? `<div style="opacity:0.85;margin:4px 0">${escapeHtml(narrative)}</div>` : ""}
              ${linkedIncident.location ? `<div style="opacity:0.5;font-size:10px">📍 ${escapeHtml(String(linkedIncident.location))}</div>` : ""}
              ${reporterName ? `<div style="opacity:0.5;font-size:10px">👤 ${escapeHtml(reporterName)}${assigneeName ? ` → ${escapeHtml(assigneeName)}` : ""}</div>` : ""}
              <div style="opacity:0.3;font-size:9px;margin-top:4px">${ts}</div>
            </div>`;
          } else {
            desc = `<b>${escapeHtml(pin.label || "Pin")}</b>${pin.description ? `<br/>${escapeHtml(pin.description)}` : ""}`;
          }

          const entity = viewer.entities.add({
            id: `sboard-${op.id}-${pin.id || idx}`,
            name: pin.label || `Pin ${idx + 1}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            billboard: {
              image: createPinCanvas(pinColor, linkedIncident ? "alert" : "flag"),
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              scale: linkedIncident ? 0.55 : 0.5,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
            label: {
              text: pin.label || "",
              font: "10px monospace",
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              outlineWidth: 2,
              outlineColor: Cesium.Color.BLACK,
              fillColor: Cesium.Color.fromCssColorString(pinColor),
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              pixelOffset: new Cesium.Cartesian2(0, -32),
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              distanceDisplayCondition: new Cesium.DistanceDisplayCondition(0, 100000),
            },
            description: desc,
          });
          entityGroupsRef.current.storyboardPins.push(entity);
        });
      }).catch(() => {});

      // Incidents with their own lat/lng are already plotted by the incidents layer.
      // Here we could plot incidents that only have site-map-relative positions.
      // For now, the incident layer handles this.
    });
  }, [operations, layers.siteOverlays, savedBounds, loading, incidents, viewerRef, cesiumRef, entityGroupsRef, companyId]);

  // ─── Satellite Imagery Toggle ───────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // The base imagery layer (index 0) is the default Cesium ion imagery
    const baseLayer = viewer.imageryLayers.get(0);
    if (baseLayer) {
      // When satellite is on, show full opacity; when off, keep default
      baseLayer.alpha = layers.satellite ? 1.0 : 1.0;
    }

    // Toggle between Cesium default (satellite) and OSM streets
    if (!layers.satellite) {
      // Add OSM street tiles on top with full opacity
      if (!entityGroupsRef.current.osmLayerRef) {
        // Use UrlTemplateImageryProvider instead of OpenStreetMapImageryProvider
        // OSM blocks CORS XHR requests; UrlTemplate uses <img> tags which bypass CORS
        const osm = new Cesium.UrlTemplateImageryProvider({
          url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
          credit: "OpenStreetMap contributors",
          maximumLevel: 19,
        });
        const osmLayer = viewer.imageryLayers.addImageryProvider(osm, 1);
        entityGroupsRef.current.osmLayerRef = [osmLayer];
      }
      const osmRef = entityGroupsRef.current.osmLayerRef;
      if (osmRef?.[0]) osmRef[0].show = true;
    } else {
      // Hide OSM layer to reveal satellite
      const osmRef = entityGroupsRef.current.osmLayerRef;
      if (osmRef?.[0]) osmRef[0].show = false;
    }
  }, [layers.satellite, loading, viewerRef, cesiumRef, entityGroupsRef]);

  // ─── Sentinel-1 SAR Layer ────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    if (entityGroupsRef.current.sentinel1Layer) {
      try { viewer.imageryLayers.remove(entityGroupsRef.current.sentinel1Layer, false); } catch (e) { logger.swallow("cesium-layers:remove-sentinel1", e); }
      entityGroupsRef.current.sentinel1Layer = null;
    }
    if (layers.sentinel1) {
      entityGroupsRef.current.sentinel1Layer = addSentinel1Layer(viewer, Cesium);
    }
  }, [layers.sentinel1, loading, viewerRef, cesiumRef, entityGroupsRef]);

  // ─── Sentinel-2 Optical Layer ──────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    if (entityGroupsRef.current.sentinel2Layer) {
      try { viewer.imageryLayers.remove(entityGroupsRef.current.sentinel2Layer, false); } catch (e) { logger.swallow("cesium-layers:remove-sentinel2", e); }
      entityGroupsRef.current.sentinel2Layer = null;
    }
    if (layers.sentinel2) {
      entityGroupsRef.current.sentinel2Layer = addSentinel2Layer(viewer, Cesium);
    }
  }, [layers.sentinel2, loading, viewerRef, cesiumRef, entityGroupsRef]);

  // ─── FLIR Thermal Shader ───────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    if (entityGroupsRef.current.flirStage) {
      removeShader(viewer, entityGroupsRef.current.flirStage);
      entityGroupsRef.current.flirStage = null;
    }
    if (layers.flirThermal) {
      entityGroupsRef.current.flirStage = applyShader(viewer, Cesium, FLIR_SHADER);
    }
  }, [layers.flirThermal, loading, viewerRef, cesiumRef, entityGroupsRef]);

  // ─── CRT Mode Shader ──────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    if (entityGroupsRef.current.crtStage) {
      removeShader(viewer, entityGroupsRef.current.crtStage);
      entityGroupsRef.current.crtStage = null;
    }
    if (layers.crtMode) {
      entityGroupsRef.current.crtStage = applyShader(viewer, Cesium, CRT_SHADER);
    }
  }, [layers.crtMode, loading, viewerRef, cesiumRef, entityGroupsRef]);

  // ─── Geofence Alert Feed ────────────────────────────
  useEffect(() => {
    if (!companyId || loading) return;

    // Initial fetch
    getRecentGeofenceAlerts(companyId, 10).then(setGeofenceAlerts).catch(() => {});

    // Refresh every 60 seconds
    const interval = setInterval(() => {
      getRecentGeofenceAlerts(companyId, 10).then(setGeofenceAlerts).catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [companyId, loading]);

  return {
    nearbyPOIs,
    geofenceAlerts,
    aligningOp, setAligningOp,
    savedBounds, setSavedBounds,
    s2Intel,
  };
}
