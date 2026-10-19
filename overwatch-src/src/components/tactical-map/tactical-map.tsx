"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { logger } from "@/lib/logger";
import { Loader2 } from "lucide-react";
import { loadCesium } from "./cesium-config";
import { MapLayersPanel, type LayerVisibility, defaultLayersFor } from "./map-layers-panel";
import { MapLayersPanelV2 } from "./map-layers-panel-v2";
import { allGroups, applyPreset, classicLayers, defaultPresetFor, effectiveLayers, expandSharedLayers, flattenForClassic, matchingPreset, migrateLayers } from "@/lib/map/layer-registry";
import { readPanelV2Choice, resolvePanelV2, writePanelV2Choice } from "@/lib/map/panel-flag";
import { buildScopeFilters, resolveRadii, sitesFrom, type ViewRect } from "@/lib/map/site-proximity";
import { DEFAULT_COMPANY_MAP_DEFAULTS, getCompanyMapDefaults, getUserMapPrefs, saveUserMapPrefs, saveUserPanelChoice, type CompanyMapDefaults } from "@/lib/supabase/db-map-prefs";
import { useSiteWatch } from "./hooks/use-site-watch";
import { useOsmBuildingsLayer } from "./hooks/use-osm-buildings-layer";
import { SiteWatchStrip } from "./site-watch-strip";
import { CompanyMapDefaultsEditor } from "./company-map-defaults";
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
import { MapSearch } from "./map-search";
import { usePerfGovernor } from "./hooks/use-perf-governor";
import { useContactModels } from "./hooks/use-contact-models";
import { useShipsLayer } from "./hooks/use-ships-layer";
import { isHighContrastLook } from "@/lib/map/contact-models";
import { escapeHtml } from "@/lib/security";
import { nearSideDepthProperty } from "@/lib/map/near-side-depth";
import { SatPassesPanel } from "./sat-passes-panel";
import { GibsDateChip } from "./gibs-date-chip";
import { SiteImageryPanel, type SiteImagerySelection } from "./site-imagery-panel";
import { useSiteImagery } from "./hooks/use-site-imagery";
import { useInfraLayer } from "./hooks/use-infra-layer";
import type { PlaceResult } from "@/lib/map/geocode";
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
  /** NASA daily imagery day (null = latest); session only, not saved to prefs. */
  const [gibsDay, setGibsDay] = useState<string | null>(null);

  // Persist layer visibility to localStorage per company
  // Phones keep their own saved layer prefs so desktop choices (e.g. 3D
  // terrain on) don't follow the user onto a phone.
  const constrained = typeof window !== "undefined" && isConstrainedDevice();
  const storageKey = `tactical-map-${companyId}${constrained ? "-mobile" : ""}`;
  // True until this user has any saved layer state (local or synced).
  const freshRef = useRef(true);
  const [layers, setLayersRaw] = useState<LayerVisibility>(() => {
    const defaults = defaultLayersFor(constrained);
    if (typeof window === "undefined") return defaults;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) { freshRef.current = false; return migrateLayers(defaults, JSON.parse(saved)); }
    } catch (e) { logger.swallow("tactical-map:layers-read", e, "debug"); }
    // First visit: desktop starts on Security Ops, phones on Clean.
    return applyPreset(defaults, defaultPresetFor(constrained), { constrained, cctvAcked: false });
  });
  const initialTerrainRef = useRef(layers.terrain);
  const renderPumpRef = useRef<(() => void) | null>(null);
  // One-time CCTV acknowledgement (per user, localStorage). Every path that
  // turns the CCTV layer on goes through setLayers, so gate it there.
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const userIdRef = useRef(userId);
  userIdRef.current = userId;
  // Grouped layers panel (v2) is on by default; users can switch back to the classic panel.
  const [panelV2Choice, setPanelV2Choice] = useState<boolean | null>(() => typeof window === "undefined" ? null : readPanelV2Choice(window.localStorage, userId));
  useEffect(() => { setPanelV2Choice(readPanelV2Choice(window.localStorage, userId)); }, [userId]);
  // Company defaults (company_map_defaults) and cross-device prefs (user_map_prefs).
  const [companyDefaults, setCompanyDefaults] = useState<CompanyMapDefaults>(DEFAULT_COMPANY_MAP_DEFAULTS);
  const panelV2 = resolvePanelV2(panelV2Choice, companyDefaults.panelV2);
  const dirtyRef = useRef(false);
  const [cctvAckOpen, setCctvAckOpen] = useState(false);
  // Click-to-track (aircraft): entity id + display label.
  const [tracked, setTracked] = useState<{ id: string; label: string } | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchPin, setSearchPin] = useState<PlaceResult | null>(null);
  const [passesTarget, setPassesTarget] = useState<{ label: string; lat: number; lng: number } | null>(null);
  /** "Imagery by date" site and the day drawn for it (session only). */
  const [imageryTarget, setImageryTarget] = useState<{ label: string; lat: number; lng: number } | null>(null);
  const [siteImagery, setSiteImagery] = useState<SiteImagerySelection | null>(null);
  const setLayers = useCallback((update: LayerVisibility | ((prev: LayerVisibility) => LayerVisibility)) => {
    setLayersRaw(prev => {
      const requested = typeof update === "function" ? update(prev) : update;
      const acked = typeof window !== "undefined" && hasCctvAck(window.localStorage, userIdRef.current);
      const { next, needsAck } = gateCctvEnable(prev, requested, acked);
      if (needsAck) queueMicrotask(() => setCctvAckOpen(true));
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
        localStorage.setItem(`${storageKey}:at`, new Date().toISOString());
      } catch (e) { logger.swallow("tactical-map:layers-write", e, "debug"); }
      freshRef.current = false;
      dirtyRef.current = true;
      return next;
    });
  }, [storageKey]);
  // What the map actually draws: v2 applies group master switches and retired keys.
  const activeLayers = useMemo(
    () => (panelV2 ? effectiveLayers(layers, { constrained, hiddenGroups: companyDefaults.hiddenGroups }) : classicLayers(layers)),
    [panelV2, layers, constrained, companyDefaults.hiddenGroups],
  );
  const deviceClass = constrained ? "mobile" : "desktop";
  // Load company defaults + this user's synced prefs once per company/user.
  useEffect(() => {
    if (!companyId || !userId) return;
    let cancelled = false;
    void (async () => {
      const [defaults, remote] = await Promise.all([getCompanyMapDefaults(companyId), getUserMapPrefs(companyId, deviceClass)]);
      if (cancelled) return;
      if (defaults) setCompanyDefaults(defaults);
      if (remote && remote.view?.panelV2 != null && readPanelV2Choice(window.localStorage, userId) === null) {
        writePanelV2Choice(window.localStorage, userId, remote.view.panelV2);
        setPanelV2Choice(remote.view.panelV2);
      }
      let localAt = "";
      try { localAt = localStorage.getItem(`${storageKey}:at`) ?? ""; } catch { /* ignore */ }
      if (remote && Object.keys(remote.layers).length && (freshRef.current || remote.updatedAt > localAt)) {
        // Newer settings from another device win; site overlays stay per device.
        setLayersRaw((prev) => ({ ...migrateLayers(defaultLayersFor(constrained), remote.layers as Partial<LayerVisibility>), siteOverlays: prev.siteOverlays }));
        freshRef.current = false;
      } else if (freshRef.current && defaults) {
        const preset = constrained ? defaults.defaultPresetMobile : defaults.defaultPreset;
        setLayersRaw((prev) => applyPreset(prev, preset, { constrained, cctvAcked: hasCctvAck(window.localStorage, userId) }));
      }
    })();
    return () => { cancelled = true; };
  }, [companyId, userId, deviceClass, storageKey, constrained]);
  // Save to user_map_prefs a few seconds after the user changes something.
  useEffect(() => {
    if (!companyId || !userId || !dirtyRef.current) return;
    const t = setTimeout(() => {
      dirtyRef.current = false;
      void saveUserMapPrefs(companyId, deviceClass, { preset: matchingPreset(layers, { constrained, cctvAcked: hasCctvAck(window.localStorage, userId) }), layers, view: { panelV2: panelV2Choice } });
    }, 3000);
    return () => clearTimeout(t);
  }, [layers, companyId, userId, deviceClass, panelV2Choice, constrained]);
  const choosePanel = useCallback((v2: boolean) => {
    writePanelV2Choice(window.localStorage, userIdRef.current, v2);
    setPanelV2Choice(v2);
    void saveUserPanelChoice(companyId, v2);
    // Going back to classic: keep exactly what was on screen visible there.
    if (!v2) setLayers((prev) => flattenForClassic(prev));
    else setLayers((prev) => migrateLayers(defaultLayersFor(constrained), { ...prev, news: prev.news || prev.gdelt || prev.sigintNews, lightning: prev.lightning }));
  }, [setLayers, constrained, companyId]);
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

  // Near my sites: sites = active operations + active geofences (geofences
  // arrive from the layer hook below, so the previous render's list is used).
  const [siteGeofences, setSiteGeofences] = useState<import("@/lib/supabase/db-geofences").Geofence[]>([]);
  const sites = useMemo(() => sitesFrom(operations, siteGeofences), [operations, siteGeofences]);
  const radii = useMemo(() => resolveRadii(companyDefaults.nearRadiiKm), [companyDefaults.nearRadiiKm]);
  const [viewRect, setViewRect] = useState<ViewRect | null>(null);
  const scopeFilters = useMemo(() => {
    if (!panelV2) return undefined;
    const f = buildScopeFilters(layers.scope ?? "sites", sites, viewRect, radii);
    return { hazard: f.hazard, point: f.point };
  }, [panelV2, layers.scope, sites, viewRect, radii]);

  // Cesium layer plotting/toggling effects
  const { nearbyPOIs: _nearbyPOIs, geofenceAlerts, aligningOp, setAligningOp, savedBounds, setSavedBounds, s2Intel, geofences: layerGeofences } = useCesiumLayers({
    viewerRef,
    cesiumRef,
    entityGroupsRef,
    loading,
    layers: activeLayers,
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
    gibsDay: gibsDay ?? undefined,
    scopeFilters,
  });
  const [lastLayerGeofences, setLastLayerGeofences] = useState(layerGeofences);
  if (layerGeofences !== lastLayerGeofences) {
    setLastLayerGeofences(layerGeofences);
    setSiteGeofences(layerGeofences ?? []);
  }
  // Auto performance governor (all devices) + 3D contact models (desktop only).
  const { perfLevel, resetPerf } = usePerfGovernor({ viewerRef, entityGroupsRef, loading, bloom: !!activeLayers.bloom });
  const highContrastLook = isHighContrastLook(activeLayers);
  // Shared with layers that restyle under NVG/thermal (camera cones read it live).
  useEffect(() => { entityGroupsRef.current.highContrastLook = highContrastLook; }, [highContrastLook]);
  const modelsShown = useContactModels({ viewerRef, cesiumRef, entityGroupsRef, loading, enabled: !!activeLayers.aircraft, highContrast: highContrastLook });
  // Live AIS ships (Air & Sea), desktop 3D models near the camera.
  const shipsLayer = useShipsLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, enabled: !!activeLayers.ships, highContrast: highContrastLook });
  useInfraLayer({ viewerRef, cesiumRef, entityGroupsRef, loading, enabled: !!activeLayers.osmInfrastructure });
  useSiteImagery({ viewerRef, cesiumRef, loading, selection: siteImagery });
  const osmBuildingsStatus = useOsmBuildingsLayer({
    viewerRef, cesiumRef, entityGroupsRef, loading,
    enabled: !!activeLayers.osmBuildings,
    terrain: !!activeLayers.terrain,
    // Dark basemap, or NVG (its gain blows light buildings out to flat green).
    dark: !!activeLayers.nightVision || !!activeLayers.nvgGoggles,
    constrained,
  });
  const siteWatch = useSiteWatch({ viewerRef, cesiumRef, entityGroupsRef, loading, enabled: panelV2 && layers.siteWatch !== false, sites, radii });
  const [sitePillOpen, setSitePillOpen] = useState(false);

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
              setLayers((prev) => ({ ...applySharedLayers(prev, expandSharedLayers(list)), groups: allGroups(true), preset: "custom" }));
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

  // "Map view" scope: track the visible rectangle (debounced on camera stop).
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading || !panelV2 || layers.scope !== "view") return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const update = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        const r = viewer.camera.computeViewRectangle(viewer.scene.globe.ellipsoid);
        if (!r) { setViewRect(null); return; }
        const d = Cesium.Math.toDegrees;
        setViewRect({ west: d(r.west), south: d(r.south), east: d(r.east), north: d(r.north) });
      }, 400);
    };
    update();
    const remove = viewer.camera.moveEnd.addEventListener(update);
    return () => { if (t) clearTimeout(t); remove(); };
  }, [loading, panelV2, layers.scope]);

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
      layers: activeBooleanLayers(activeLayers),
    });
    const url = `${window.location.origin}${window.location.pathname}${window.location.search}${hash}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Map view link copied (recipients must be signed in)");
    } catch {
      window.prompt("Copy this map view link:", url);
    }
  }, [activeLayers]);

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

  const flyToSite = useCallback((lat: number, lng: number) => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;
    viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(lng, lat, 25_000), duration: 1.2 });
  }, []);

  // Search result: fly there and drop a temporary pin (removed on close / next search).
  const handleSearchPick = useCallback((p: PlaceResult) => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;
    setSearchPin(p);
    const b = p.bbox;
    if (b && (b[2] - b[0]) > 0.005 && (b[2] - b[0]) < 20 && (b[3] - b[1]) < 20) {
      viewer.camera.flyTo({ destination: Cesium.Rectangle.fromDegrees(b[1], b[0], b[3], b[2]), duration: 1.4 });
    } else {
      viewer.camera.flyTo({ destination: Cesium.Cartesian3.fromDegrees(p.lng, p.lat, 6_000), duration: 1.4 });
    }
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || !searchPin) return;
    const entity = viewer.entities.add({
      id: "search-pin",
      name: searchPin.label,
      position: Cesium.Cartesian3.fromDegrees(searchPin.lng, searchPin.lat),
      point: { pixelSize: 11, color: Cesium.Color.fromCssColorString("#fbbf24"), outlineColor: Cesium.Color.BLACK, outlineWidth: 2, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: nearSideDepthProperty(viewer, Cesium) },
      label: { text: searchPin.label.slice(0, 40), font: "12px monospace", fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, style: Cesium.LabelStyle.FILL_AND_OUTLINE, pixelOffset: new Cesium.Cartesian2(0, -18), heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: nearSideDepthProperty(viewer, Cesium) },
      description: `${escapeHtml(searchPin.detail || "")}<br/><span style="opacity:.6">${searchPin.lat.toFixed(5)}, ${searchPin.lng.toFixed(5)}${searchPin.source === "coordinates" ? "" : " · © OpenStreetMap contributors"}</span>`,
    });
    viewer.scene.requestRender();
    return () => { if (!viewer.isDestroyed?.()) { viewer.entities.remove(entity); viewer.scene.requestRender(); } };
  }, [searchPin]);

  const handleRealignSiteMap = useCallback((op: import("./types").OperationPin) => {
    // Clear saved bounds to force re-alignment
    setSavedBounds((prev) => { const next = { ...prev }; delete next[op.id]; return next; });
    setAligningOp(op);
  }, [setSavedBounds, setAligningOp]);
  const handleAdjustSiteMap = useCallback((op: import("./types").OperationPin) => {
    // Open the fine-tune adjuster with current saved bounds
    const currentBounds = savedBounds[op.id];
    if (currentBounds && op.siteMapUrl) {
      setAdjustingOp({ id: op.id, name: op.name, imageUrl: op.siteMapUrl, bounds: currentBounds });
    } else {
      toast("No saved bounds to adjust. Use the ↻ button to align first.");
    }
  }, [savedBounds]);

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
      <MapLegalFooter creditRef={creditRef} onOpenSources={() => setAttributionOpen(true)} osmBuildings={osmBuildingsStatus.state !== "off"} models={modelsShown || shipsLayer.modelsShown} ais={!!activeLayers.ships} />

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
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen((o) => { if (o) setSearchPin(null); return !o; })}
        />
      )}

      {/* Search box + satellite passes — beside the control column */}
      {!loading && !error && !opsMode && (searchOpen || passesTarget || imageryTarget) && (
        <div className="absolute top-3 left-16 z-20 flex flex-col gap-2 max-w-[calc(100%-5rem)] pointer-events-none">
          {searchOpen && (
            <MapSearch
              onPick={handleSearchPick}
              onPasses={setPassesTarget}
              onClose={() => { setSearchOpen(false); setSearchPin(null); }}
            />
          )}
          {passesTarget && <SatPassesPanel key={`${passesTarget.lat},${passesTarget.lng}`} target={passesTarget} onClose={() => setPassesTarget(null)} />}
          {imageryTarget && (
            <SiteImageryPanel
              key={`${imageryTarget.lat},${imageryTarget.lng}`}
              target={imageryTarget}
              selected={siteImagery}
              onSelect={setSiteImagery}
              onClose={() => { setImageryTarget(null); setSiteImagery(null); }}
            />
          )}
        </div>
      )}

      {/* Intel drawer (RECON + alerts + sources) */}
      <IntelDrawer
        open={intelDrawerOpen}
        onClose={() => setIntelDrawerOpen(false)}
        onLocate={handleFlyToCoords}
        forceTab={forcedIntelTab}
        onOpenLiveFeed={panelV2 ? setActiveLiveFeed : undefined}
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



      {activeLayers.hud && !loading && !error && (
        <TacticalHud viewerRef={viewerRef} cesiumRef={cesiumRef} mode={hudModeLabel(activeLayers)} />
      )}

      {/* Custom entity popup — floating near selected point */}
      {selectedEntity && (
        <EntityPopup
          entity={selectedEntity}
          containerWidth={containerWidth}
          onClose={() => setSelectedEntity(null)}
          actions={(() => {
            const sid = selectedEntity.id;
            const op = sid.startsWith("op-") ? operations.find((o) => `op-${o.id}` === sid) : undefined;
            const site = op ? { label: op.name, lat: op.lat, lng: op.lng }
              : sid === "search-pin" && searchPin ? { label: searchPin.label, lat: searchPin.lat, lng: searchPin.lng } : null;
            if (!site) return undefined;
            return (
              <span className="flex flex-wrap gap-1">
                <button
                  onClick={() => { setPassesTarget(site); setSelectedEntity(null); }}
                  className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
                >
                  🛰 Satellite passes
                </button>
                <button
                  onClick={() => { setSiteImagery(null); setImageryTarget(site); setSelectedEntity(null); }}
                  className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-emerald-500/20 text-emerald-200 hover:bg-emerald-500/30"
                >
                  📅 Imagery by date
                </button>
              </span>
            );
          })() ?? (selectedEntity.id.startsWith("plane-") ? (
            <button
              onClick={() => { setTracked({ id: selectedEntity.id, label: selectedEntity.name || selectedEntity.id.slice(6) }); setSelectedEntity(null); }}
              className="text-[10px] font-mono uppercase tracking-wider px-2 py-1 rounded bg-cyan-500/20 text-cyan-200 hover:bg-cyan-500/30"
            >
              ⌖ Track
            </button>
          ) : undefined)}
        />
      )}

      {activeLayers.sentinel2 && !loading && !error && <GibsDateChip day={gibsDay} onChange={setGibsDay} />}

      {perfLevel > 0 && !loading && !error && (
        <button
          onClick={resetPerf}
          data-testid="perf-indicator"
          title="The map dropped resolution and effects because it was drawing under 30 frames per second. Click to restore full quality."
          className="absolute bottom-16 left-3 z-20 rounded-full px-2.5 py-1 text-[10px] font-mono text-amber-200/90 bg-black/60 backdrop-blur-sm border border-amber-300/30 hover:bg-black/75"
        >
          ⚡ Reduced quality{perfLevel > 1 ? " (low)" : ""} · restore
        </button>
      )}

      {tracked && activeLayers.aircraft && (
        <TrackingChip
          key={tracked.id}
          viewerRef={viewerRef}
          cesiumRef={cesiumRef}
          entityGroupsRef={entityGroupsRef}
          trackedId={tracked.id}
          label={tracked.label}
          onStop={() => setTracked(null)}
          onOpenCamera={setActiveCctvCamera}
          onJump={setTracked}
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

      {!error && !opsMode && (panelV2 ? (
        <MapLayersPanelV2
          osmBuildingsStatus={osmBuildingsStatus}
          layers={layers}
          onChange={setLayers}
          onFlyToAll={handleFlyToAll}
          operations={operations}
          isAdmin={isAdmin}
          s2ActiveLayers={s2Intel.activeLayers}
          onToggleS2Layer={s2Intel.toggleLayer}
          s2FeatureCount={s2Intel.featureCount}
          isReplaying={timeMachineOpen}
          onRealignSiteMap={handleRealignSiteMap}
          onAdjustSiteMap={handleAdjustSiteMap}
          savedBounds={savedBounds}
          constrained={constrained}
          cctvAcked={typeof window !== "undefined" && hasCctvAck(window.localStorage, userId)}
          onUseClassic={() => choosePanel(false)}
          hiddenGroups={companyDefaults.hiddenGroups}
          showScope
          topSlot={
            <SiteWatchStrip
              alerts={siteWatch.alerts}
              enabled={layers.siteWatch !== false}
              siteCount={sites.length}
              onToggle={() => setLayers((prev) => ({ ...prev, siteWatch: prev.siteWatch === false }))}
              onLocate={(lat, lng) => flyToSite(lat, lng)}
            />
          }
          bottomSlot={isAdmin ? <CompanyMapDefaultsEditor companyId={companyId} value={companyDefaults} onSaved={setCompanyDefaults} /> : undefined}
        />
      ) : (
        <MapLayersPanel layers={layers} onChange={setLayers} onFlyToAll={handleFlyToAll} operations={operations} isAdmin={isAdmin} s2ActiveLayers={s2Intel.activeLayers} onToggleS2Layer={s2Intel.toggleLayer} s2FeatureCount={s2Intel.featureCount} isReplaying={timeMachineOpen} onRealignSiteMap={handleRealignSiteMap} onAdjustSiteMap={handleAdjustSiteMap} savedBounds={savedBounds} onUseNewPanel={() => choosePanel(true)} />
      ))}
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

      {/* Site Watch pill on phones (the panel is a closed bottom sheet there) */}
      {constrained && panelV2 && !opsMode && !error && siteWatch.alerts.length > 0 && (
        <div className="absolute top-14 right-3 z-10 flex flex-col items-end gap-1">
          <button
            onClick={() => setSitePillOpen((o) => !o)}
            className={`rounded-full px-2.5 py-1 text-[11px] font-bold font-mono text-white shadow ${siteWatch.alerts.some((a) => a.level === "warning") ? "bg-red-600" : "bg-amber-600"}`}
            aria-label={`Site Watch: ${siteWatch.alerts.length} alerts`}
          >
            ⚠ {siteWatch.alerts.length}
          </button>
          {sitePillOpen && (
            <div className="w-72 max-w-[calc(100vw-1.5rem)] rounded-xl backdrop-blur-md border border-white/10 p-2" style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 92%, transparent)" }}>
              <SiteWatchStrip alerts={siteWatch.alerts} enabled siteCount={sites.length} onToggle={() => { setLayers((prev) => ({ ...prev, siteWatch: false })); setSitePillOpen(false); }} onLocate={(lat, lng) => { flyToSite(lat, lng); setSitePillOpen(false); }} max={8} />
            </div>
          )}
        </div>
      )}

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


