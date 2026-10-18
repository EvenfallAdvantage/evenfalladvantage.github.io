"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";
import { loadCesium } from "./cesium-config";
import { MapLayersPanel, type LayerVisibility, defaultLayersFor } from "./map-layers-panel";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import { addFreeBaseImagery, createTerrainProvider, ionAssetsEnabled } from "@/lib/map/basemap-sources";
import { setVisibleInterval } from "@/lib/visible-interval";
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
import { IntelDrawer } from "@/components/intel/intel-drawer";
import { LiveFeedViewer } from "@/components/intel/live-feed-viewer";
import { CctvViewer } from "@/components/intel/cctv-viewer";
import { RegionDossierModal } from "@/components/intel/region-dossier-modal";
import { GlobalStatusBar } from "@/components/intel/global-status-bar";
import { KeyboardShortcutsModal } from "@/components/intel/keyboard-shortcuts-modal";
import { AttributionModal } from "@/components/intel/attribution-modal";
import { CctvAckModal } from "@/components/intel/cctv-ack-modal";
import { MapLegalFooter } from "./map-legal-footer";
import { gateCctvEnable, hasCctvAck, recordCctvAck } from "@/lib/map/cctv-ack";
import { useAuthStore } from "@/stores/auth-store";
import { TrackingChip } from "./tracking-chip";
import { TacticalHud, hudModeLabel } from "./tactical-hud";
import { activeBooleanLayers, applySharedLayers, decodeShareHash, encodeShareHash } from "@/lib/map/share-link";

export type { StaffPin, OperationPin, IncidentPin } from "./types";

const CONUS_CENTER = { lat: 39.8283, lng: -98.5795 };
/** Idle render cadence under requestRenderMode (camera moves and tile loads render immediately). */
const RENDER_PUMP_MS = 1000;

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
  // Phones keep their own saved layer prefs so desktop choices (e.g. 3D
  // terrain on) don't follow the user onto a phone.
  const constrained = typeof window !== "undefined" && isConstrainedDevice();
  const storageKey = `tactical-map-${companyId}${constrained ? "-mobile" : ""}`;
  const [layers, setLayersRaw] = useState<LayerVisibility>(() => {
    const defaults = defaultLayersFor(constrained);
    if (typeof window === "undefined") return defaults;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) return { ...defaults, ...JSON.parse(saved) };
    } catch (e) { logger.swallow("tactical-map:layers-read", e, "debug"); }
    return defaults;
  });
  const initialTerrainRef = useRef(layers.terrain);
  const renderPumpRef = useRef<(() => void) | null>(null);
  // One-time CCTV acknowledgement (per user, localStorage). Every path that
  // turns the CCTV layer on goes through setLayers, so gate it there.
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  const [cctvAckOpen, setCctvAckOpen] = useState(false);
  // Click-to-track (aircraft): entity id + display label.
  const [tracked, setTracked] = useState<{ id: string; label: string } | null>(null);
  const setLayers = useCallback((update: LayerVisibility | ((prev: LayerVisibility) => LayerVisibility)) => {
    setLayersRaw(prev => {
      const requested = typeof update === "function" ? update(prev) : update;
      const acked = typeof window !== "undefined" && hasCctvAck(window.localStorage, userIdRef.current);
      const { next, needsAck } = gateCctvEnable(prev, requested, acked);
      if (needsAck) queueMicrotask(() => setCctvAckOpen(true));
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch (e) { logger.swallow("tactical-map:layers-write", e, "debug"); }
      return next;
    });
  }, [storageKey]);
  // Layer prefs saved before the acknowledgement existed may already have CCTV
  // on: switch it off and ask once.
  useEffect(() => {
    if (layers.cctv && !hasCctvAck(window.localStorage, userId)) {
      setLayersRaw((prev) => ({ ...prev, cctv: false }));
      setCctvAckOpen(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per user
  }, [userId]);
  const acceptCctvAck = useCallback(() => {
    recordCctvAck(window.localStorage, userIdRef.current);
    setCctvAckOpen(false);
    setLayers((prev) => ({ ...prev, cctv: true }));
  }, [setLayers]);
  const creditRef = useRef<HTMLDivElement>(null);
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
  // Ops Mode: full-screen, chrome-free map (exit with Esc / the pill).
  const [opsMode, setOpsMode] = useState(false);
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

  // Intel drawer (RECON + alerts + sources) — Osiris integration
  const [intelDrawerOpen, setIntelDrawerOpen] = useState(false);

  // Modals launched from Intel map layers
  const [activeLiveFeed, setActiveLiveFeed] = useState<import("@/lib/intel-types").IntelLiveNewsFeed | null>(null);
  const [activeCctvCamera, setActiveCctvCamera] = useState<import("@/lib/intel-types").CctvCamera | null>(null);

  // Region dossier — opened on right-click anywhere on the globe.
  const [regionDossier, setRegionDossier] = useState<{ lat: number; lng: number } | null>(null);

  // Keyboard shortcuts overlay (toggle with ?)
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  // Attribution modal launched from the global status bar Info button.
  const [attributionOpen, setAttributionOpen] = useState(false);

  // One-shot tab switch for the Intel drawer driven by keyboard shortcuts.
  const [forcedIntelTab, setForcedIntelTab] = useState<"recon" | "alerts" | "sources" | null>(null);

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
    onOpenLiveFeed: setActiveLiveFeed,
    onOpenCctvCamera: setActiveCctvCamera,
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
          creditContainer: creditRef.current ?? document.createElement("div"),
          // No default ion/Bing base layer: free, commercially-usable imagery
          // is added below (basemap-sources.ts).
          baseLayer: false,
          // Explicit rendering: only draw a frame when something changed
          // (camera, tiles, entities). Saves GPU/battery when the map is idle.
          requestRenderMode: true,
          maximumRenderTimeChange: Infinity,
        });
        entityGroupsRef.current.baseImagery = addFreeBaseImagery(viewer, Cesium);

        // Set terrain after construction: Terrain.fromWorldTerrain() returns a
        // Promise in Cesium 1.104+, so it cannot be passed inline to the Viewer
        // constructor.  We apply it asynchronously here.
        if (isConstrainedDevice()) {
          // Coarser globe tiles on phones (default 2): fewer requests + less GPU.
          viewer.scene.globe.maximumScreenSpaceError = 4;
        }
        // Skip the world-terrain fetch when the terrain layer starts off; the
        // terrain layer effect loads it if the user turns it on later.
        if (initialTerrainRef.current) try {
          const terrainProvider = await createTerrainProvider(Cesium);
          if (!destroyed) viewer.terrainProvider = terrainProvider;
        } catch (terrainErr) {
          logger.swallow("tactical-map:terrain", terrainErr, "debug");
        }

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

        // Add 3D buildings (only when terrain starts on; otherwise the terrain
        // layer effect loads them lazily the first time terrain is enabled).
        // OSM Buildings is a Cesium ion asset: only when ion is licensed.
        if (initialTerrainRef.current && ionAssetsEnabled()) {
          const buildingsTileset = await Cesium.createOsmBuildingsAsync();
          viewer.scene.primitives.add(buildingsTileset);
          entityGroupsRef.current.buildings = [buildingsTileset];
        }

        // Restore saved camera position or fly to CONUS
        const cameraKey = `tactical-cam-${companyId}`;
        let cameraRestored = false;
        // A share link (#lat=…&lon=…&alt=…) wins over the saved camera.
        try {
          const shared = decodeShareHash(window.location.hash, new Set(Object.keys(defaultLayersFor(false))));
          if (shared) {
            viewer.camera.setView({
              destination: Cesium.Cartesian3.fromDegrees(shared.lng, shared.lat, shared.altM),
              orientation: { heading: Cesium.Math.toRadians(shared.headingDeg), pitch: Cesium.Math.toRadians(shared.pitchDeg), roll: 0 },
            });
            cameraRestored = true;
            if (shared.layers) {
              const list = shared.layers;
              setLayers((prev) => applySharedLayers(prev, list));
            }
            history.replaceState(null, "", window.location.pathname + window.location.search);
          }
        } catch (e) { logger.swallow("tactical-map:share-restore", e, "debug"); }
        if (!cameraRestored) try {
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

        // Data layers update on their own timers (≥15 s). A 1 Hz render pump
        // keeps entity/property changes visible without continuous 60 fps.
        renderPumpRef.current = setVisibleInterval(() => {
          if (!viewer.isDestroyed()) viewer.scene.requestRender();
        }, RENDER_PUMP_MS);

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
      renderPumpRef.current?.();
      renderPumpRef.current = null;
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

  // Right-click → open Region Dossier modal at the picked coordinates.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    handler.setInputAction((click: { position: { x: number; y: number } }) => {
      // Pick the surface coordinate under the cursor.
      const ray = viewer.camera.getPickRay(click.position);
      if (!ray) return;
      const cartesian = viewer.scene.globe.pick(ray, viewer.scene);
      if (!cartesian) return;
      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lng = Cesium.Math.toDegrees(carto.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      setRegionDossier({ lat, lng });
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    return () => {
      try { handler.destroy(); }
      catch (err) { logger.swallow("tactical-map:right-click-handler", err); }
    };
  }, [loading]);

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
  const handleFlyToCoords = useCallback((lat: number, lng: number) => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(lng, lat, 1_500_000),
      orientation: { heading: 0, pitch: -Math.PI / 2, roll: 0 },
      duration: 1.2,
    });
  }, []);

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

  // Copy a link to the current view (camera + visible layers).
  const handleShare = useCallback(async () => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;
    const carto = Cesium.Cartographic.fromCartesian(viewer.camera.position);
    const hash = encodeShareHash({
      lat: Cesium.Math.toDegrees(carto.latitude),
      lng: Cesium.Math.toDegrees(carto.longitude),
      altM: carto.height,
      headingDeg: Cesium.Math.toDegrees(viewer.camera.heading),
      pitchDeg: Cesium.Math.toDegrees(viewer.camera.pitch),
      layers: activeBooleanLayers(layers),
    });
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Map view link copied (recipients must be signed in)");
    } catch {
      window.prompt("Copy this map view link:", url);
    }
  }, [layers]);

  // Ops Mode: full screen + hide panels; leaving full screen leaves Ops Mode.
  const handleOpsMode = useCallback(() => {
    const el = wrapperRef.current;
    if (opsMode) {
      setOpsMode(false);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      return;
    }
    setOpsMode(true);
    if (el && !document.fullscreenElement) el.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
  }, [opsMode]);

  // Listen for fullscreen changes (e.g. user presses Escape)
  useEffect(() => {
    const handler = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      if (!fs) setOpsMode(false);
    };
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Global keyboard shortcuts. Ignores keys when focus is in an input.
  useEffect(() => {
    function isEditable(target: EventTarget | null): boolean {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return true;
      return target.isContentEditable;
    }
    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (isEditable(e.target)) return;

      // `?` opens the keyboard shortcuts help. `Shift+/` on US keyboards.
      if (e.key === "?") {
        e.preventDefault();
        setShortcutsOpen((o) => !o);
        return;
      }
      if (e.key === "Escape") {
        // Top-down close priority: shortcuts → attribution → dossier → cctv → live feed → drawer.
        if (cctvAckOpen) { setCctvAckOpen(false); return; }
        if (shortcutsOpen) { setShortcutsOpen(false); return; }
        if (attributionOpen) { setAttributionOpen(false); return; }
        if (regionDossier) { setRegionDossier(null); return; }
        if (activeCctvCamera) { setActiveCctvCamera(null); return; }
        if (activeLiveFeed) { setActiveLiveFeed(null); return; }
        if (intelDrawerOpen) { setIntelDrawerOpen(false); return; }
        return;
      }

      const k = e.key.toLowerCase();
      switch (k) {
        case "i":
          setIntelDrawerOpen((o) => !o);
          break;
        case "a":
          setIntelDrawerOpen(true);
          setForcedIntelTab("alerts");
          // Reset the one-shot so subsequent presses re-trigger the effect.
          setTimeout(() => setForcedIntelTab(null), 0);
          break;
        case "r":
          setIntelDrawerOpen(true);
          setForcedIntelTab("recon");
          setTimeout(() => setForcedIntelTab(null), 0);
          break;
        case "s":
          setIntelDrawerOpen(true);
          setForcedIntelTab("sources");
          setTimeout(() => setForcedIntelTab(null), 0);
          break;
        case "f":
          handleFullscreen();
          break;
        case "o":
          handleOpsMode();
          break;
        case "n":
          handleResetNorth();
          break;
        case "t":
          setTimeMachineOpen(!timeMachineOpen);
          break;
        default:
          return;
      }
      e.preventDefault();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    shortcutsOpen,
    attributionOpen,
    cctvAckOpen,
    regionDossier,
    activeCctvCamera,
    activeLiveFeed,
    intelDrawerOpen,
    timeMachineOpen,
    handleOpsMode,
    handleFullscreen,
    handleResetNorth,
    setTimeMachineOpen,
  ]);

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

      {/* Persistent legal footer + Cesium provider credits */}
      <MapLegalFooter creditRef={creditRef} onOpenSources={() => setAttributionOpen(true)} />

      {/* Ops Mode bar — top right, above other overlays, so the top-centre
          tracking chip (Phase 1A) can never cover Share / Exit. */}
      {!loading && !error && opsMode && (
        <div className="absolute top-3 right-3 z-40 flex items-center gap-2 rounded-full px-3 py-1.5 text-[11px] font-mono text-white/80 bg-black/50 backdrop-blur-md border border-white/10">
          <span className="tracking-[0.2em]">OPS MODE</span>
          <button onClick={() => void handleShare()} className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20">Share view</button>
          <button onClick={handleOpsMode} className="px-2 py-0.5 rounded-full bg-white/10 hover:bg-white/20">Exit (Esc)</button>
        </div>
      )}
      {!loading && !error && !opsMode && (
        <MapControlButtons
          cameraHeading={cameraHeading}
          isFullscreen={isFullscreen}
          timeMachineOpen={timeMachineOpen}
          dronePlannerOpen={dronePlannerOpen}
          intelDrawerOpen={intelDrawerOpen}
          isAdmin={isAdmin}
          onResetNorth={handleResetNorth}
          onToggleFullscreen={handleFullscreen}
          onToggleTimeMachine={() => setTimeMachineOpen(!timeMachineOpen)}
          onToggleDronePlanner={() => setDronePlannerOpen(!dronePlannerOpen)}
          onToggleIntelDrawer={() => setIntelDrawerOpen((o) => !o)}
          onShare={() => void handleShare()}
          onOpsMode={handleOpsMode}
        />
      )}

      {/* Intel drawer (RECON + alerts + sources) */}
      <IntelDrawer
        open={intelDrawerOpen}
        onClose={() => setIntelDrawerOpen(false)}
        onLocate={handleFlyToCoords}
        forceTab={forcedIntelTab}
      />

      {/* Global status bar — bottom-center; admin-only by convention */}
      {isAdmin && !opsMode && (
        <GlobalStatusBar
          enabled={!loading && !error}
          onOpenAttribution={() => setAttributionOpen(true)}
        />
      )}

      {/* Attribution modal — launched from the status bar's info button */}
      {attributionOpen && (
        <AttributionModal onClose={() => setAttributionOpen(false)} />
      )}

      {/* One-time acknowledgement before the CCTV layer is first enabled */}
      {cctvAckOpen && (
        <CctvAckModal onAccept={acceptCctvAck} onCancel={() => setCctvAckOpen(false)} />
      )}

      {/* Keyboard shortcuts modal — `?` to open */}
      {shortcutsOpen && (
        <KeyboardShortcutsModal onClose={() => setShortcutsOpen(false)} />
      )}

      {/* Live broadcaster feed viewer — opens from live-news map pins */}
      {activeLiveFeed && (
        <LiveFeedViewer
          feed={activeLiveFeed}
          onClose={() => setActiveLiveFeed(null)}
        />
      )}

      {/* CCTV camera viewer — opens from CCTV map pins */}
      {activeCctvCamera && (
        <CctvViewer
          camera={activeCctvCamera}
          onClose={() => setActiveCctvCamera(null)}
        />
      )}

      {/* Region dossier — opens on right-click anywhere on the globe */}
      {regionDossier && (
        <RegionDossierModal
          lat={regionDossier.lat}
          lng={regionDossier.lng}
          onClose={() => setRegionDossier(null)}
        />
      )}



      {layers.hud && !loading && !error && (
        <TacticalHud viewerRef={viewerRef} cesiumRef={cesiumRef} mode={hudModeLabel(layers)} />
      )}

      {/* Custom entity popup — floating near selected point */}
      {selectedEntity && (
        <EntityPopup
          entity={selectedEntity}
          containerWidth={containerWidth}
          onClose={() => setSelectedEntity(null)}
          actions={selectedEntity.id.startsWith("plane-") ? (
            <button
              onClick={() => { setTracked({ id: selectedEntity.id, label: selectedEntity.name || selectedEntity.id.slice(6) }); setSelectedEntity(null); }}
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
            >
              ⌖ Track
            </button>
          ) : undefined}
        />
      )}

      {tracked && layers.aircraft && (
        <TrackingChip
          key={tracked.id}
          viewerRef={viewerRef}
          entityGroupsRef={entityGroupsRef}
          trackedId={tracked.id}
          label={tracked.label}
          onStop={() => setTracked(null)}
          onOpenCamera={setActiveCctvCamera}
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

      {!error && !opsMode && <MapLayersPanel layers={layers} onChange={setLayers} onFlyToAll={handleFlyToAll} operations={operations} isAdmin={isAdmin} s2ActiveLayers={s2Intel.activeLayers} onToggleS2Layer={s2Intel.toggleLayer} s2FeatureCount={s2Intel.featureCount} isReplaying={timeMachineOpen} onRealignSiteMap={(op) => {
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


