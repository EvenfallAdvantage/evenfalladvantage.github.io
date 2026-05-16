"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";
import { loadCesium } from "./cesium-config";
import { MapLayersPanel, type LayerVisibility, DEFAULT_LAYERS } from "./map-layers-panel";
import { MapToolsBar } from "./map-tools";
import { SiteMapAligner } from "./site-map-aligner";
import { saveSiteMapBounds } from "@/lib/supabase/db-operations";
import { deleteAnnotation } from "@/lib/supabase/db-annotations";
import { TimeMachine } from "./time-machine";
import { DronePlanner } from "./drone-planner";
import { DocViewerModal } from "@/components/ops/staff-doc-viewer";
import type { OperationDocument } from "@/types/operations";
import { EntityPopup } from "./entity-popup";
import { MapControlButtons } from "./map-control-buttons";
import { toast } from "sonner";
import { GeofenceAlertTicker } from "./geofence-alert-ticker";
import { SiteMapAdjuster } from "./site-map-adjuster";
import type { TacticalMapProps } from "./types";
import { useTimeMachine } from "./hooks/use-time-machine";
import { useDronePlanner } from "./hooks/use-drone-planner";
import { useDirectMessage } from "./hooks/use-direct-message";
import { useEventDocuments } from "./hooks/use-event-documents";
import { useMapTools } from "./hooks/use-map-tools";
import { useAnnotations } from "./hooks/use-annotations";
import { useCesiumLayers } from "./hooks/use-cesium-layers";
import { useCesiumClickHandler } from "./hooks/use-click-handler";
import { QuickDMModal } from "./quick-dm-modal";

export type { StaffPin, OperationPin, IncidentPin } from "./types";

const CONUS_CENTER = { lat: 39.8283, lng: -98.5795 };

export function TacticalMap({ operations, staff, incidents, companyId, isAdmin, onSelectOperation, onMessageStaff: _onMessageStaff }: TacticalMapProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cesiumRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Persist layer visibility to localStorage per company
  const storageKey = `tactical-map-${companyId}`;
  const [layers, setLayersRaw] = useState<LayerVisibility>(() => {
    if (typeof window === "undefined") return DEFAULT_LAYERS;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return { ...DEFAULT_LAYERS, ...JSON.parse(saved) };
    } catch (e) { logger.swallow("tactical-map:layers-read", e, "debug"); }
    return DEFAULT_LAYERS;
  });
  const setLayers = useCallback((update: LayerVisibility | ((prev: LayerVisibility) => LayerVisibility)) => {
    setLayersRaw(prev => {
      const next = typeof update === "function" ? update(prev) : update;
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch (e) { logger.swallow("tactical-map:layers-write", e, "debug"); }
      return next;
    });
  }, [storageKey]);
  // Map tools (measure, range rings, LOS, elevation)
  const {
    activeTool, setActiveTool,
    measureResult, setMeasureResult,
    measurePoint1, setMeasurePoint1,
    rangeCenter, setRangeCenter,
    losPoint1, setLosPoint1,
    losResult, setLosResult,
    elevPoint1, setElevPoint1,
    elevationStatus, setElevationStatus,
    losEntityIdsRef,
  } = useMapTools(viewerRef, cesiumRef);
  const [cameraHeading, setCameraHeading] = useState(0); // radians
  const [_cameraPitch, setCameraPitch] = useState(-0.5);
  const [containerWidth, setContainerWidth] = useState(800);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [adjustingOp, setAdjustingOp] = useState<{ id: string; name: string; imageUrl: string; bounds: import("@/lib/supabase/db-operations").SiteMapBounds } | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entityGroupsRef = useRef<Record<string, any>>({});
  // Annotations (tactical drawings)
  const {
    drawMode, setDrawMode,
    drawColor, setDrawColor,
    drawPoints, setDrawPoints,
    annotations,
    handleDrawFinish,
    handleDrawCancel,
    handleClearAnnotations,
  } = useAnnotations(companyId, viewerRef, cesiumRef, entityGroupsRef);

  // Time Machine
  const { timeMachineOpen, setTimeMachineOpen, replayTime: _replayTime, setReplayTime, debouncedReplayTime, effectiveStaff, effectiveIncidents, effectiveAnnotations } = useTimeMachine(staff, companyId, incidents, annotations);

  // Drone Planner
  const { dronePlannerOpen, setDronePlannerOpen, droneWaypoints, setDroneWaypoints } = useDronePlanner();

  // Operation documents for pin popups
  const { eventDocs, eventDocsRef, viewingDoc, setViewingDoc } = useEventDocuments(operations);

  // Quick DM modal (opens on map instead of navigating away)
  const { dmTarget, setDmTarget, dmText, setDmText, dmSending, sendMessage: sendDmMessage } = useDirectMessage(companyId);

  // Cesium layer plotting/toggling effects
  const { nearbyPOIs: _nearbyPOIs, geofenceAlerts, aligningOp, setAligningOp, savedBounds, setSavedBounds, s2Intel } = useCesiumLayers({
    viewerRef,
    cesiumRef,
    entityGroupsRef,
    loading,
    layers,
    operations,
    staff: effectiveStaff,
    incidents: effectiveIncidents,
    companyId,
    isAdmin,
    eventDocs,
    annotations: effectiveAnnotations,
    debouncedReplayTime,
    timeMachineOpen,
    // While the adjuster is active for an op, suppress the main overlay
    // for that op so the adjuster's own preview primitive can take over
    // without visual conflict (double overlay or flicker).
    adjustingOpId: adjustingOp?.id ?? null,
  });

  // Ref to hold setSelectedEntity — declared before the init effect but
  // assigned after useCesiumClickHandler, so the init effect can reference it
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const setSelectedEntityRef = useRef<any>(null);

  // ─── Initialize Cesium Viewer ────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;
    let destroyed = false;

    (async () => {
      try {
        const Cesium = await loadCesium();
        if (destroyed) return;
        cesiumRef.current = Cesium;

        const viewer = new Cesium.Viewer(containerRef.current!, {
          terrain: Cesium.Terrain.fromWorldTerrain({ requestVertexNormals: true, requestWaterMask: true }),
          baseLayerPicker: false,
          geocoder: false,
          homeButton: false,
          sceneModePicker: false,
          selectionIndicator: false,
          timeline: false,
          animation: false,
          fullscreenButton: false,
          vrButton: false,
          navigationHelpButton: false,
          infoBox: false,
          creditContainer: document.createElement("div"),
        });

        if (destroyed) { viewer.destroy(); return; }
        viewerRef.current = viewer;
        // Expose viewer for site-map-aligner globe markers
        window.__tacticalMapViewer = viewer;

        // Expose annotation delete handler for popup onclick
        window.__deleteAnnotation = (annId: string) => {
          deleteAnnotation(annId).then(() => {
            setSelectedEntityRef.current?.(null);
          });
        };

        // Expose doc viewer handler for operation pin popups
        // Uses ref to always access latest docs (closure would capture stale state)
        window.__openOpDoc = (eventId: string, docType: string) => {
          const docs = eventDocsRef.current[eventId] ?? [];
          const doc = docs.find((d: OperationDocument) => d.doc_type === docType);
          if (doc) {
            setViewingDoc(doc);
            setSelectedEntityRef.current?.(null);
          }
        };

        // Expose DM handler for staff pin popups — opens inline modal
        window.__openStaffDM = (userId: string, name: string) => {
          setDmTarget({ userId, name: name || "Staff" });
          setDmText("");
          setSelectedEntityRef.current?.(null);
        };

        // Add 3D buildings
        const buildingsTileset = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildingsTileset);
        entityGroupsRef.current.buildings = [buildingsTileset];

        // Restore saved camera position or fly to CONUS
        const cameraKey = `tactical-cam-${companyId}`;
        let cameraRestored = false;
        try {
          const savedCam = localStorage.getItem(cameraKey);
          if (savedCam) {
            const cam = JSON.parse(savedCam);
            viewer.camera.setView({
              destination: Cesium.Cartesian3.fromDegrees(cam.lng, cam.lat, cam.height),
              orientation: { heading: cam.heading ?? 0, pitch: cam.pitch ?? -0.5, roll: 0 },
            });
            cameraRestored = true;
          }
        } catch (e) { logger.swallow("tactical-map:camera-restore", e, "debug"); }
        if (!cameraRestored) {
          viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(CONUS_CENTER.lng, CONUS_CENTER.lat, 5000000),
            duration: 0,
          });
        }

        // Save camera position on move end (debounced)
        let camSaveTimer: ReturnType<typeof setTimeout>;
        viewer.camera.moveEnd.addEventListener(() => {
          clearTimeout(camSaveTimer);
          camSaveTimer = setTimeout(() => {
            try {
              const carto = Cesium.Cartographic.fromCartesian(viewer.camera.position);
              const cam = {
                lat: Cesium.Math.toDegrees(carto.latitude),
                lng: Cesium.Math.toDegrees(carto.longitude),
                height: carto.height,
                heading: viewer.camera.heading,
                pitch: viewer.camera.pitch,
              };
              localStorage.setItem(cameraKey, JSON.stringify(cam));
            } catch (e) { logger.swallow("tactical-map:camera-save", e, "debug"); }
          }, 500);
        });

        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0002;

        // Track camera heading/pitch for the compass
        viewer.camera.changed.addEventListener(() => {
          setCameraHeading(viewer.camera.heading);
          setCameraPitch(viewer.camera.pitch);
        });

        setLoading(false);
      } catch (err) {
        console.error("[TacticalMap] Init failed:", err);
        setError(err instanceof Error ? err.message : "Failed to initialize map");
        setLoading(false);
      }
    })();

    return () => {
      destroyed = true;
      if (viewerRef.current && !viewerRef.current.isDestroyed()) {
        viewerRef.current.destroy();
      }
      viewerRef.current = null;
      cesiumRef.current = null;
      // Clean up global references on unmount
      delete window.__tacticalMapViewer;
      delete window.__deleteAnnotation;
      delete window.__siteMapAlignerAddPoint;
      delete window.__openStaffDM;
      delete window.__openOpDoc;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: Cesium viewer init must run once
  }, []);

  // Click handler + entity popup
  const { selectedEntity, setSelectedEntity } = useCesiumClickHandler({
    viewerRef, cesiumRef, entityGroupsRef, loading,
    activeTool, measurePoint1, setMeasurePoint1, setMeasureResult,
    rangeCenter, setRangeCenter,
    losPoint1, setLosPoint1, setLosResult, losEntityIdsRef,
    elevPoint1, setElevPoint1, setElevationStatus,
    drawMode, drawColor, drawPoints, setDrawPoints,
    dronePlannerOpen, droneWaypoints, setDroneWaypoints,
    aligningOp,
    companyId, isAdmin, onSelectOperation,
  });
  useEffect(() => { setSelectedEntityRef.current = setSelectedEntity; });

  // Track container width for popup positioning (avoids ref access during render)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    setContainerWidth(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Reset to north-up top-down view
  const handleResetNorth = useCallback(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    const carto = Cesium.Cartographic.fromCartesian(viewer.camera.position);
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(
        Cesium.Math.toDegrees(carto.longitude),
        Cesium.Math.toDegrees(carto.latitude),
        carto.height
      ),
      orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
      duration: 0.8,
    });
  }, []);

  // Fullscreen toggle — fullscreens the WRAPPER (which contains all overlays)
  const handleFullscreen = useCallback(() => {
    const el = wrapperRef.current;
    if (!el) return;
    if (!document.fullscreenElement) {
      el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  }, []);

  // Listen for fullscreen changes (e.g. user presses Escape)
  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const handleFlyToAll = useCallback(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;

    if (operations.length > 0) {
      viewer.flyTo(viewer.entities, { duration: 1.5 });
    } else {
      viewer.camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(CONUS_CENTER.lng, CONUS_CENTER.lat, 5000000),
        duration: 1.5,
      });
    }
  }, [operations]);

  return (
    <div ref={wrapperRef} className="relative w-full rounded-xl overflow-hidden border border-border/50 bg-[#0b1422]" style={{ height: isFullscreen ? "100vh" : "calc(100vh - 180px)", minHeight: 500 }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0b1422]">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-2" />
          <span className="text-xs text-muted-foreground font-mono">Initializing tactical map...</span>
        </div>
      )}
      {error && (
        <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-[#0b1422]">
          <span className="text-xs text-red-500 font-mono mb-2">Map failed to load: {error}</span>
          <button onClick={() => window.location.reload()} className="text-xs text-amber-500 underline">Retry</button>
        </div>
      )}
      <div ref={containerRef} className="w-full h-full" />

      {/* Compass + Fullscreen + Time Machine + Drone — top left */}
      {!loading && !error && (
        <MapControlButtons
          cameraHeading={cameraHeading}
          isFullscreen={isFullscreen}
          timeMachineOpen={timeMachineOpen}
          dronePlannerOpen={dronePlannerOpen}
          isAdmin={isAdmin}
          onResetNorth={handleResetNorth}
          onToggleFullscreen={handleFullscreen}
          onToggleTimeMachine={() => setTimeMachineOpen(!timeMachineOpen)}
          onToggleDronePlanner={() => setDronePlannerOpen(!dronePlannerOpen)}
        />
      )}

      {/* Custom entity popup — floating near selected point */}
      {selectedEntity && (
        <EntityPopup
          entity={selectedEntity}
          containerWidth={containerWidth}
          onClose={() => setSelectedEntity(null)}
        />
      )}

      {/* Quick DM Modal */}
      {dmTarget && (
        <QuickDMModal
          dmTarget={dmTarget}
          dmText={dmText}
          dmSending={dmSending}
          onTextChange={setDmText}
          onSend={sendDmMessage}
          onClose={() => setDmTarget(null)}
        />
      )}

      {/* Document Viewer Modal */}
      {viewingDoc && (
        <DocViewerModal doc={viewingDoc} onClose={() => setViewingDoc(null)} />
      )}

      {!error && <MapLayersPanel layers={layers} onChange={setLayers} onFlyToAll={handleFlyToAll} operations={operations} isAdmin={isAdmin} s2ActiveLayers={s2Intel.activeLayers} onToggleS2Layer={s2Intel.toggleLayer} s2FeatureCount={s2Intel.featureCount} isReplaying={timeMachineOpen} onRealignSiteMap={(op) => {
        // Clear saved bounds to force re-alignment
        setSavedBounds((prev) => { const next = { ...prev }; delete next[op.id]; return next; });
        setAligningOp(op);
      }} onAdjustSiteMap={(op) => {
        // Open the fine-tune adjuster with current saved bounds
        const currentBounds = savedBounds[op.id];
        if (currentBounds && op.siteMapUrl) {
          setAdjustingOp({ id: op.id, name: op.name, imageUrl: op.siteMapUrl, bounds: currentBounds });
        } else {
          toast("No saved bounds to adjust. Use the ↻ button to align first.");
        }
      }} savedBounds={savedBounds} />}
      {!error && !loading && (
        <MapToolsBar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          measureResult={measureResult}
          rangeCenter={rangeCenter}
          losResult={losResult}
          elevationStatus={elevationStatus}
          drawMode={drawMode}
          onDrawModeChange={setDrawMode}
          drawColor={drawColor}
          onDrawColorChange={setDrawColor}
          drawPointCount={drawPoints.length}
          onDrawFinish={handleDrawFinish}
          onDrawCancel={handleDrawCancel}
          onDrawClearAll={handleClearAnnotations}
          isAdmin={isAdmin ?? false}
        />
      )}
      {/* Time Machine */}
      <TimeMachine
        open={timeMachineOpen}
        onClose={() => { setTimeMachineOpen(false); setReplayTime(Date.now()); }}
        onTimeChange={setReplayTime}
      />

      {/* Drone Flight Planner */}
      <DronePlanner
        open={dronePlannerOpen}
        onClose={() => { setDronePlannerOpen(false); setDroneWaypoints([]); }}
        waypoints={droneWaypoints}
        onWaypointsChange={setDroneWaypoints}
        isAdmin={isAdmin ?? false}
      />

      {/* Geofence Alert Ticker */}
      <GeofenceAlertTicker alerts={geofenceAlerts} />
      {aligningOp && aligningOp.siteMapUrl && (
        <SiteMapAligner
          imageUrl={aligningOp.siteMapUrl}
          operationName={aligningOp.name}
          onAlign={(bounds) => {
            // Save locally for immediate use
            setSavedBounds((prev) => ({ ...prev, [aligningOp.id]: bounds }));
            // Persist to DB (company-wide — every member of `companyId`
            // will now see this overlay on their tactical map).
            saveSiteMapBounds(aligningOp.id, bounds, companyId);
            setAligningOp(null);
          }}
          onCancel={() => {
            // Turn off the site map layer since user cancelled alignment
            setLayers((prev) => ({
              ...prev,
              siteOverlays: { ...prev.siteOverlays, [aligningOp.id]: false },
            }));
            setAligningOp(null);
          }}
        />
      )}

      {/* Site Map Fine-Tune Adjuster */}
      {adjustingOp && (
        <SiteMapAdjuster
          bounds={adjustingOp.bounds}
          imageUrl={adjustingOp.imageUrl}
          opacity={layers.siteOverlayOpacity}
          onSave={(newBounds) => {
            setSavedBounds((prev) => ({ ...prev, [adjustingOp.id]: newBounds }));
            saveSiteMapBounds(adjustingOp.id, newBounds, companyId);
            setAdjustingOp(null);
            toast.success("Site map position updated");
          }}
          onCancel={() => setAdjustingOp(null)}
        />
      )}
    </div>
  );
}


