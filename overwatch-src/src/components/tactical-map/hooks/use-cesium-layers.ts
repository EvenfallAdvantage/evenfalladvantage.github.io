import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import { getSiteMapBounds, getSiteMapBoundsByCompany, migrateLegacyLocalStorageBounds, loadStoryboard, type SiteMapBounds } from "@/lib/supabase/db-operations";
import { imageToGeo } from "@/lib/supabase/db-site-bounds";
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
import { useEarthquakesLayer } from "./use-earthquakes-layer";
import { useConflictZonesLayer } from "./use-conflict-zones-layer";
import { useFiresLayer } from "./use-fires-layer";
import { useEonetWeatherLayer } from "./use-eonet-weather-layer";
import { useNuclearInfrastructureLayer } from "./use-nuclear-infrastructure-layer";
import { useGdeltLayer } from "./use-gdelt-layer";

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
  /** Op currently being adjusted via the SiteMapAdjuster. Its overlay
   *  is suppressed here so the adjuster's preview primitive can take
   *  over without visual conflict. */
  adjustingOpId?: string | null;
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
    adjustingOpId,
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
  // NEXRAD MRMS only serves current radar; layer hides itself during replay.
  useWeatherLayer({ viewerRef, cesiumRef, loading, layers, debouncedReplayTime, timeMachineOpen });

  // ─── Sub-hook: Night vision ──────────────────────────
  useNightVision({ viewerRef, cesiumRef, entityGroupsRef, loading, layers });

  // ─── Sub-hook: Live aircraft ─────────────────────────
  // OpenSky has no free historical commercial API; aircraft are hidden in-hook
  // when the user is replaying past time.
  useAircraftLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations, debouncedReplayTime, timeMachineOpen });

  // ─── Sub-hook: Satellite orbits ──────────────────────
  // Orbits are deterministic from TLE — propagation honors the replay time.
  useOrbitLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, debouncedReplayTime, timeMachineOpen });

  // ─── Sub-hook: Breadcrumb trails ─────────────────────
  useTrailsLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, staff, companyId, debouncedReplayTime, timeMachineOpen });

  // ─── Sub-hook: Annotations ───────────────────────────
  useAnnotationsLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, annotations });

  // ─── Sub-hook: Nearby POIs ───────────────────────────
  const { nearbyPOIs } = usePoiLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, operations });

  // ─── Sub-hook: S2 Underground Intel ─────────────────
  const s2Intel = useS2IntelLayer({
    viewerRef, cesiumRef, entityGroupsRef, loading,
    enabled: layers.s2Intel,
    companyId,
    debouncedReplayTime,
    timeMachineOpen,
  });

  // ─── Sub-hook: Incident Heatmap ────────────────────
  useHeatmapLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers, incidents });

  // ─── Sub-hook: Earthquakes (USGS, M2.5+, last 24h) ─────
  // Live-only; hidden during Time Machine replay (no historical data).
  useEarthquakesLayer({
    viewerRef, cesiumRef, entityGroupsRef, loading, layers,
    debouncedReplayTime, timeMachineOpen,
  });

  // ─── Sub-hook: Conflict zones (curated static, 13 regions) ─────
  useConflictZonesLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers });

  // ─── Sub-hook: Active fires (NASA FIRMS + EONET volcanoes) ─────
  // Live-only; FIRMS provides 24h rolling window.
  useFiresLayer({
    viewerRef, cesiumRef, entityGroupsRef, loading, layers,
    debouncedReplayTime, timeMachineOpen,
  });

  // ─── Sub-hook: EONET severe weather (storms / volcanoes / sea ice) ─────
  useEonetWeatherLayer({
    viewerRef, cesiumRef, entityGroupsRef, loading, layers,
    debouncedReplayTime, timeMachineOpen,
  });

  // ─── Sub-hook: Nuclear infrastructure (curated static, ~56 NPPs) ─────
  useNuclearInfrastructureLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, layers });

  // ─── Sub-hook: GDELT global incidents (RSS keyword-geomap) ─────
  useGdeltLayer({
    viewerRef, cesiumRef, entityGroupsRef, loading, layers,
    debouncedReplayTime, timeMachineOpen,
  });

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

  // ─── Bulk-load all saved bounds for the company on mount ────
  // Loaded once per (companyId × operation set). Every op with bounds is
  // marked "loaded" so the renderer below can drape immediately without
  // requiring the user to toggle the layer first.
  useEffect(() => {
    if (!companyId || operations.length === 0) return;
    let cancelled = false;

    // First, opportunistic migration of any legacy localStorage bounds
    // from before the DB table existed. Idempotent — safe to re-run.
    migrateLegacyLocalStorageBounds(
      operations.map(op => ({ id: op.id, companyId })),
    ).catch(e => logger.swallow("cesium-layers:bounds-migrate", e, "debug"));

    getSiteMapBoundsByCompany(companyId).then(boundsMap => {
      if (cancelled) return;
      setSavedBounds(boundsMap);
      // Mark every op as "bounds-loaded" so the renderer doesn't open the
      // aligner prematurely. Ops without bounds also count as loaded (their
      // bounds are confirmed empty).
      setBoundsLoaded(new Set(operations.map(op => op.id)));
      setBoundsLoading(new Set());
    }).catch(e => {
      logger.swallow("cesium-layers:bounds-bulk-read", e, "debug");
      if (!cancelled) setBoundsLoaded(new Set(operations.map(op => op.id)));
    });

    return () => { cancelled = true; };
  }, [companyId, operations]);

  // ─── Fallback: per-op load when an op is added after mount ───
  // (E.g. an admin creates a new op via the wizard while the map is open.)
  useEffect(() => {
    operations.forEach((op) => {
      if (!boundsLoaded.has(op.id) && !boundsLoading.has(op.id) && !savedBounds[op.id]) {
        setBoundsLoading(prev => new Set(prev).add(op.id));
        getSiteMapBounds(op.id).then(bounds => {
          if (bounds) setSavedBounds(prev => ({ ...prev, [op.id]: bounds }));
          setBoundsLoaded(prev => new Set(prev).add(op.id));
          setBoundsLoading(prev => { const next = new Set(prev); next.delete(op.id); return next; });
        }).catch(() => {
          setBoundsLoaded(prev => new Set(prev).add(op.id));
          setBoundsLoading(prev => { const next = new Set(prev); next.delete(op.id); return next; });
        });
      }
    });
  }, [operations, savedBounds, boundsLoaded, boundsLoading]);

  // ─── Site Map Overlays (rubber-sheet aligned) ────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Remove old site overlay layers. Each entry is either an axis-aligned
    // imagery layer (legacy north-up bounds) or a textured quad primitive
    // (new affine path). We dispatch on the `kind` discriminator.
    (entityGroupsRef.current.siteOverlays ?? []).forEach((entry: {
      kind?: "imagery" | "primitive";
      layerRef: unknown;
      eventId: string;
    }) => {
      try {
        if (entry.kind === "primitive") {
          viewer.scene.primitives.remove(entry.layerRef);
        } else {
          viewer.imageryLayers.remove(entry.layerRef, false);
        }
      } catch (e) { logger.swallow("cesium-layers:remove-site-overlay", e); }
    });
    entityGroupsRef.current.siteOverlays = [];
    // Invalidate any in-flight terrain samples — their primitives will
    // detect the missing/changed token and skip the add().
    if (entityGroupsRef.current.siteOverlaysSampleTokens) {
      (entityGroupsRef.current.siteOverlaysSampleTokens as Map<string, symbol>).clear();
    }

    // Check each toggled-on site map. We treat the visibility as:
    //   - `false` (user explicitly hid it)   → hide
    //   - `true`  (user explicitly showed it) → show
    //   - `undefined` (user never set it)    → show iff we have saved bounds
    // This means: when an admin lays down a site map, every other company
    // member sees it automatically, without having to toggle anything.
    operations.forEach((op) => {
      if (!op.siteMapUrl || !op.lat || !op.lng) return;
      // While the SiteMapAdjuster is open for this op, it owns the
      // preview primitive. Suppress the main overlay so we don't render
      // two stacked overlays during fine-tune.
      if (adjustingOpId === op.id) return;
      const userPref = layers.siteOverlays[op.id];
      const bounds = savedBounds[op.id];
      const effectiveOn = userPref === undefined ? !!bounds : userPref;
      if (!effectiveOn) return;

      // If we have saved bounds (local or from DB), drape immediately
      if (bounds) {
        try {
          if (bounds.quad) {
            // Affine path: render as a textured polygon. Per-vertex UV
            // coordinates map each image corner to the matching texture
            // texel.
            //
            // Cesium's Texture loader uses `flipY = true` by default
            // (see Renderer/Texture.js loadImageSource: it calls
            // `gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true)`). With Y
            // flip, image row 0 (the top of the HTML image) is uploaded
            // to the TOP of texture-st space, which corresponds to
            // `t = 1`. So:
            //   c00 → (s=0, t=1)   image top-left  ← texture (s=0, t=1)
            //   c10 → (s=1, t=1)   image top-right
            //   c11 → (s=1, t=0)   image bottom-right
            //   c01 → (s=0, t=0)   image bottom-left
            //
            // Vertex order is c00, c01, c11, c10 which traces CCW when
            // viewed from above the globe (image top-left → bottom-left
            // → bottom-right → top-right). Matches Cesium's expected
            // polygon winding for an upward-facing surface, so the
            // auto-winding detector doesn't reverse anything and break
            // correspondence between positions and texcoords.
            //
            // Terrain handling: regular Primitive renders at ellipsoid
            // height by default — with 3D terrain enabled the overlay
            // floats hundreds of meters above the ground. GroundPrimitive
            // would clamp, but it ignores textureCoordinates so we'd lose
            // the affine UV mapping. The solution is to sample terrain
            // height at each of the four corners and build the polygon
            // with `perPositionHeight: true`, putting the overlay flat
            // on the ground. A small (+0.5 m) lift prevents z-fighting
            // with the ground texture.
            const q = bounds.quad;
            const cornerCartos = [
              Cesium.Cartographic.fromDegrees(q.c00.lng, q.c00.lat),
              Cesium.Cartographic.fromDegrees(q.c01.lng, q.c01.lat),
              Cesium.Cartographic.fromDegrees(q.c11.lng, q.c11.lat),
              Cesium.Cartographic.fromDegrees(q.c10.lng, q.c10.lat),
            ];
            const stCoords = new Cesium.PolygonHierarchy([
              new Cesium.Cartesian2(0, 1), // c00 → image top-left
              new Cesium.Cartesian2(0, 0), // c01 → image bottom-left
              new Cesium.Cartesian2(1, 0), // c11 → image bottom-right
              new Cesium.Cartesian2(1, 1), // c10 → image top-right
            ]);

            // Track this terrain-sample request via a token stamped on
            // the entityGroupsRef. If a later effect run clears the
            // siteOverlays array, the token won't match anymore and we
            // skip the late-arriving primitive add (avoids zombie
            // overlays from stale async samples).
            const sampleToken = Symbol(`site-overlay-sample-${op.id}`);
            entityGroupsRef.current.siteOverlaysSampleTokens =
              entityGroupsRef.current.siteOverlaysSampleTokens ?? new Map<string, symbol>();
            (entityGroupsRef.current.siteOverlaysSampleTokens as Map<string, symbol>).set(op.id, sampleToken);

            const buildPrimitive = (heights: [number, number, number, number]) => {
              const tokens = entityGroupsRef.current.siteOverlaysSampleTokens as Map<string, symbol> | undefined;
              if (tokens?.get(op.id) !== sampleToken) return; // superseded
              // Viewer can be destroyed (component unmount, page navigation)
              // between the async terrain sample starting and resolving.
              // Guard against `viewer.scene.primitives.add()` on a torn-down
              // viewer, which throws `Cannot read 'scene' of undefined`.
              if (!viewerRef.current || viewerRef.current.isDestroyed?.()) return;

              const positions = [
                Cesium.Cartesian3.fromDegrees(q.c00.lng, q.c00.lat, heights[0] + 0.5),
                Cesium.Cartesian3.fromDegrees(q.c01.lng, q.c01.lat, heights[1] + 0.5),
                Cesium.Cartesian3.fromDegrees(q.c11.lng, q.c11.lat, heights[2] + 0.5),
                Cesium.Cartesian3.fromDegrees(q.c10.lng, q.c10.lat, heights[3] + 0.5),
              ];
              const geom = new Cesium.PolygonGeometry({
                polygonHierarchy: new Cesium.PolygonHierarchy(positions),
                textureCoordinates: stCoords,
                perPositionHeight: true,
                vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
              });
              const instance = new Cesium.GeometryInstance({ geometry: geom });
              const primitive = new Cesium.Primitive({
                geometryInstances: instance,
                appearance: new Cesium.MaterialAppearance({
                  materialSupport: Cesium.MaterialAppearance.MaterialSupport.TEXTURED,
                  material: Cesium.Material.fromType("Image", {
                    image: op.siteMapUrl,
                    color: new Cesium.Color(1, 1, 1, layers.siteOverlayOpacity),
                    transparent: true,
                  }),
                  translucent: true,
                }),
                asynchronous: false,
              });
              viewer.scene.primitives.add(primitive);
              entityGroupsRef.current.siteOverlays.push({ kind: "primitive", layerRef: primitive, eventId: op.id });
            };

            const terrainProvider = viewer.terrainProvider;
            const isEllipsoid = terrainProvider instanceof Cesium.EllipsoidTerrainProvider;
            if (isEllipsoid) {
              // No real terrain — height is 0 everywhere. Skip the async
              // sample entirely.
              buildPrimitive([0, 0, 0, 0]);
            } else {
              Cesium.sampleTerrainMostDetailed(terrainProvider, cornerCartos)
                .then((sampled: Array<{ height: number }>) => {
                  const heights: [number, number, number, number] = [
                    sampled[0]?.height ?? 0,
                    sampled[1]?.height ?? 0,
                    sampled[2]?.height ?? 0,
                    sampled[3]?.height ?? 0,
                  ];
                  buildPrimitive(heights);
                })
                .catch((err: unknown) => {
                  // Fall back to ellipsoid height — better to show the
                  // overlay floating than not at all.
                  logger.swallow("cesium-layers:terrain-sample", err, "warn");
                  buildPrimitive([0, 0, 0, 0]);
                });
            }
          } else {
            // Legacy axis-aligned path (north-up bounds only).
            const provider = new Cesium.SingleTileImageryProvider({
              url: op.siteMapUrl,
              rectangle: Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north),
            });
            const layer = viewer.imageryLayers.addImageryProvider(provider);
            layer.alpha = layers.siteOverlayOpacity;
            entityGroupsRef.current.siteOverlays.push({ kind: "imagery", layerRef: layer, eventId: op.id });
          }
        } catch (err) {
          console.warn("[TacticalMap] Failed to load aligned site overlay for", op.name, err);
        }
        return;
      }

      // No saved bounds, layer is on, user is admin → open the aligner.
      // Only fires when the admin explicitly toggled the layer on for an
      // un-aligned op; we don't auto-open for the "undefined" case so a
      // member just loading the page doesn't get hit with the aligner UI.
      if (!aligningOp && isAdmin && userPref === true
          && boundsLoaded.has(op.id) && !boundsLoading.has(op.id)) {
        setAligningOp(op);
      }
    });
  }, [operations, layers.siteOverlays, layers.siteOverlayOpacity, loading, savedBounds, aligningOp, isAdmin, boundsLoaded, boundsLoading, viewerRef, cesiumRef, entityGroupsRef, adjustingOpId]);

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

    // For each active overlay with saved bounds, load pins. We mirror the
    // effective-on logic from the renderer above: undefined toggle counts
    // as "on" when bounds exist (admin-laid-down imagery is visible by
    // default for every company member).
    const activeOps = operations.filter(op => {
      if (!savedBounds[op.id] || !op.siteMapUrl) return false;
      // Skip the op currently being adjusted — its pins would point at
      // stale positions while the user drags. They'll re-render with
      // the new bounds after Save.
      if (adjustingOpId === op.id) return false;
      const pref = layers.siteOverlays[op.id];
      return pref === undefined ? true : pref;
    });

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

        storyboard.pins.forEach((pin: { id: string; x: number; y: number; label: string; description?: string; icon?: string; color?: string }, idx: number) => {
          // Use imageToGeo so the pin position respects the full quad
          // (including rotation/shear). Falls back to axis-aligned bbox
          // math for legacy bounds rows without a quad.
          const { lat, lng } = imageToGeo(bounds, pin.x, pin.y);

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
  }, [operations, layers.siteOverlays, savedBounds, loading, incidents, viewerRef, cesiumRef, entityGroupsRef, companyId, adjustingOpId]);

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
