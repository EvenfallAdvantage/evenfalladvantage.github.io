"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2, Maximize2, Minimize2 } from "lucide-react";
import { loadCesium } from "./cesium-config";
import { MapLayersPanel, type LayerVisibility, DEFAULT_LAYERS } from "./map-layers-panel";
import { MapToolsBar, type ActiveTool, type DrawMode, haversineDistance, initialBearing, RANGE_RING_RADII_M, RANGE_RING_LABELS } from "./map-tools";
import { SiteMapAligner } from "./site-map-aligner";
import { getSiteMapBounds, saveSiteMapBounds, loadStoryboard, type SiteMapBounds } from "@/lib/supabase/db-operations";
import { getLocationHistory } from "@/lib/supabase/db-location";
import { getAnnotations, createAnnotation, deleteAnnotation, subscribeAnnotations, type MapAnnotation } from "@/lib/supabase/db-annotations";
import { getNearbyPOIs, getSunPosition, getRecentGeofenceAlerts, type NearbyPOI, type GeofenceAlert } from "./env-intel";

// Types for entities we plot on the map
export interface StaffPin {
  userId: string;
  name: string;
  role: string;
  lat: number;
  lng: number;
  heading?: number;
  speed?: number;
  updatedAt: string;
}

export interface OperationPin {
  id: string;
  name: string;
  location: string;
  lat: number;
  lng: number;
  status: string;
  startDate: string;
  shiftCount?: number;
  geofenceRadius?: number;
  siteMapUrl?: string | null;
}

export interface IncidentPin {
  id: string;
  title: string;
  lat: number;
  lng: number;
  severity: string;
  status: string;
  createdAt: string;
}

interface TacticalMapProps {
  operations: OperationPin[];
  staff: StaffPin[];
  incidents: IncidentPin[];
  companyId: string;
  isAdmin?: boolean;
  onSelectOperation?: (id: string) => void;
}

const CONUS_CENTER = { lat: 39.8283, lng: -98.5795 };

export function TacticalMap({ operations, staff, incidents, companyId, isAdmin, onSelectOperation }: TacticalMapProps) {
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
    } catch {}
    return DEFAULT_LAYERS;
  });
  const setLayers = useCallback((update: LayerVisibility | ((prev: LayerVisibility) => LayerVisibility)) => {
    setLayersRaw(prev => {
      const next = typeof update === "function" ? update(prev) : update;
      try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch {}
      return next;
    });
  }, [storageKey]);
  const [activeTool, setActiveTool] = useState<ActiveTool>("none");
  const [measureResult, setMeasureResult] = useState<{ distanceM: number; distanceMi: number; bearing: number } | null>(null);
  const [measurePoint1, setMeasurePoint1] = useState<{ lat: number; lng: number } | null>(null);
  const [rangeCenter, setRangeCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [aligningOp, setAligningOp] = useState<OperationPin | null>(null);
  const [savedBounds, setSavedBounds] = useState<Record<string, SiteMapBounds>>({});
  const [boundsLoaded, setBoundsLoaded] = useState<Set<string>>(new Set());
  const [selectedEntity, setSelectedEntity] = useState<{ id: string; name: string; description: string; screenX: number; screenY: number } | null>(null);
  const popupAnimFrame = useRef<number>(0);
  const [cameraHeading, setCameraHeading] = useState(0); // radians
  const [cameraPitch, setCameraPitch] = useState(-0.5);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Drawing state
  const [drawMode, setDrawMode] = useState<DrawMode>("none");
  const [drawColor, setDrawColor] = useState("#ef4444");
  const [drawPoints, setDrawPoints] = useState<[number, number][]>([]); // [lng, lat]
  const [annotations, setAnnotations] = useState<MapAnnotation[]>([]);

  // Environmental intel state
  const [nearbyPOIs, setNearbyPOIs] = useState<NearbyPOI[]>([]);
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlert[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entityGroupsRef = useRef<Record<string, any>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weatherLayerRef = useRef<any>(null);

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__tacticalMapViewer = viewer;

        // Expose annotation delete handler for popup onclick
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (window as any).__deleteAnnotation = (annId: string) => {
          deleteAnnotation(annId).then(() => {
            setSelectedEntity(null);
          });
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
        } catch {}
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
            } catch {}
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
    };
  }, []);

  // ─── Plot Operations ─────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.operations ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch {}
    });
    entityGroupsRef.current.operations = [];

    if (!layers.operations) return;

    operations.forEach((op) => {
      const color = op.status === "active" ? Cesium.Color.LIME
        : op.status === "upcoming" || op.status === "draft" ? Cesium.Color.DODGERBLUE
        : Cesium.Color.GRAY;

      const entity = viewer.entities.add({
        id: `op-${op.id}`,
        name: op.name,
        position: Cesium.Cartesian3.fromDegrees(op.lng, op.lat),
        billboard: {
          image: createPinCanvas(color.toCssColorString(), "flag"),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scale: 0.7,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: op.name,
          font: "12px monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          fillColor: Cesium.Color.WHITE,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -40),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `<div style="font-family:monospace;font-size:12px;padding:8px">
          <strong>${op.name}</strong><br/>
          <span style="color:${color.toCssColorString()}">${op.status.toUpperCase()}</span><br/>
          ${op.location}<br/>
          ${op.startDate ? `Starts: ${new Date(op.startDate).toLocaleDateString()}` : ""}
          ${op.shiftCount ? `<br/>Shifts: ${op.shiftCount}` : ""}
        </div>`,
      });
      entityGroupsRef.current.operations.push(entity);

      if (op.geofenceRadius && op.geofenceRadius > 0 && layers.geofences) {
        const gfEntity = viewer.entities.add({
          id: `gf-${op.id}`,
          position: Cesium.Cartesian3.fromDegrees(op.lng, op.lat),
          ellipse: {
            semiMajorAxis: op.geofenceRadius,
            semiMinorAxis: op.geofenceRadius,
            material: color.withAlpha(0.12),
            outline: true,
            outlineColor: color.withAlpha(0.5),
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        entityGroupsRef.current.operations.push(gfEntity);
      }
    });
  }, [operations, layers.operations, layers.geofences, loading]);

  // ─── Plot Staff Pins ──────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.staff ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch {}
    });
    entityGroupsRef.current.staff = [];
    if (!layers.staff) return;

    staff.forEach((s) => {
      const entity = viewer.entities.add({
        id: `staff-${s.userId}`,
        name: s.name,
        position: Cesium.Cartesian3.fromDegrees(s.lng, s.lat),
        billboard: {
          image: createPinCanvas("#22d3ee", "person"),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scale: 0.6,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        label: {
          text: s.name,
          font: "11px monospace",
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          outlineWidth: 2,
          outlineColor: Cesium.Color.BLACK,
          fillColor: Cesium.Color.CYAN,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          pixelOffset: new Cesium.Cartesian2(0, -36),
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        description: `<div style="font-family:monospace;font-size:12px;padding:8px">
          <strong>${s.name}</strong><br/>Role: ${s.role}<br/>
          Updated: ${new Date(s.updatedAt).toLocaleTimeString()}
          ${s.speed ? `<br/>Speed: ${(s.speed * 2.237).toFixed(1)} mph` : ""}
          ${s.heading ? `<br/>Heading: ${s.heading.toFixed(0)}&deg;` : ""}
        </div>`,
      });
      entityGroupsRef.current.staff.push(entity);
    });
  }, [staff, layers.staff, loading]);

  // ─── Plot Incidents ──────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.incidents ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch {}
    });
    entityGroupsRef.current.incidents = [];
    if (!layers.incidents) return;

    incidents.forEach((inc) => {
      const color = inc.severity === "critical" ? "#ef4444"
        : inc.severity === "high" ? "#f97316"
        : inc.severity === "medium" ? "#eab308" : "#6b7280";

      const entity = viewer.entities.add({
        id: `inc-${inc.id}`,
        name: inc.title,
        position: Cesium.Cartesian3.fromDegrees(inc.lng, inc.lat),
        billboard: {
          image: createPinCanvas(color, "alert"),
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          scale: 0.55,
          heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
        },
        description: `<div style="font-family:monospace;font-size:12px;padding:8px">
          <strong>${inc.title}</strong><br/>
          Severity: <span style="color:${color}">${inc.severity.toUpperCase()}</span><br/>
          Status: ${inc.status}<br/>Reported: ${new Date(inc.createdAt).toLocaleString()}
        </div>`,
      });
      entityGroupsRef.current.incidents.push(entity);
    });
  }, [incidents, layers.incidents, loading]);

  // ─── Weather Radar Layer ─────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    if (weatherLayerRef.current) {
      viewer.imageryLayers.remove(weatherLayerRef.current, false);
      weatherLayerRef.current = null;
    }
    if (!layers.weather) return;

    // Use Iowa State Mesonet NEXRAD radar tiles (reliable, free, no API key)
    // Falls back to NWS WMS if Mesonet is unavailable
    try {
      const radarProvider = new Cesium.UrlTemplateImageryProvider({
        url: "https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png",
        credit: "Iowa State Mesonet / NOAA NEXRAD",
        minimumLevel: 0,
        maximumLevel: 12,
      });
      const layer = viewer.imageryLayers.addImageryProvider(radarProvider);
      layer.alpha = 0.6;
      weatherLayerRef.current = layer;
    } catch {
      // Fallback to NWS WMS
      const weatherProvider = new Cesium.WebMapServiceImageryProvider({
        url: "https://mapservices.weather.noaa.gov/eventdriven/services/radar/radar_base_reflectivity_time/MapServer/WMSServer",
        layers: "0",
        parameters: { transparent: true, format: "image/png" },
        credit: "NOAA/NWS",
      });
      const layer = viewer.imageryLayers.addImageryProvider(weatherProvider);
      layer.alpha = 0.5;
      weatherLayerRef.current = layer;
    }
  }, [layers.weather, loading]);

  // ─── 3D Buildings Toggle ─────────────────────────────
  useEffect(() => {
    const buildings = entityGroupsRef.current.buildings;
    if (buildings?.[0]) buildings[0].show = layers.buildings;
  }, [layers.buildings]);

  // ─── Load saved bounds from DB when site maps are toggled ────
  useEffect(() => {
    operations.forEach((op) => {
      if (layers.siteOverlays[op.id] && !savedBounds[op.id] && !boundsLoaded.has(op.id)) {
        setBoundsLoaded(prev => new Set(prev).add(op.id));
        getSiteMapBounds(op.id).then(bounds => {
          if (bounds) {
            setSavedBounds(prev => ({ ...prev, [op.id]: bounds }));
          }
        });
      }
    });
  }, [operations, layers.siteOverlays, savedBounds, boundsLoaded]);

  // ─── Site Map Overlays (rubber-sheet aligned) ────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Remove old site overlay layers
    (entityGroupsRef.current.siteOverlays ?? []).forEach((layer: { layerRef: unknown; eventId: string }) => {
      try { viewer.imageryLayers.remove(layer.layerRef, false); } catch {}
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

      // No saved bounds — if admin, open 3-point alignment tool; otherwise skip
      if (!aligningOp && isAdmin) {
        setAligningOp(op);
      }
    });
  }, [operations, layers.siteOverlays, layers.siteOverlayOpacity, loading, savedBounds, aligningOp, isAdmin]);

  // ─── Storyboard Pins on Site Map Overlays ────────────
  // When a site map is active with saved bounds, load its storyboard pins
  // and convert image-relative x/y (0-1) to lat/lng using the bounds.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Clear old storyboard pin entities
    (entityGroupsRef.current.storyboardPins ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch {}
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

      loadStoryboard(op.id).then(storyboard => {
        if (!storyboard?.pins || !Array.isArray(storyboard.pins)) return;

        const lngSpan = bounds.east - bounds.west;
        const latSpan = bounds.north - bounds.south;

        storyboard.pins.forEach((pin: { id: string; x: number; y: number; label: string; description?: string; icon?: string; color?: string }, idx: number) => {
          // Convert image x/y (0-1) to geo coordinates
          // x=0 is west edge, x=1 is east edge
          // y=0 is north edge (top of image), y=1 is south edge (bottom)
          const lng = bounds.west + pin.x * lngSpan;
          const lat = bounds.north - pin.y * latSpan; // y is inverted

          const pinColor = pin.color || "#22c55e";

          const entity = viewer.entities.add({
            id: `sboard-${op.id}-${pin.id || idx}`,
            name: pin.label || `Pin ${idx + 1}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            billboard: {
              image: createPinCanvas(pinColor, "flag"),
              verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
              scale: 0.5,
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
            },
            description: `<b>${pin.label || "Pin"}</b>${pin.description ? `<br/>${pin.description}` : ""}<br/><span style="opacity:0.4">${pin.icon || ""}</span>`,
          });
          entityGroupsRef.current.storyboardPins.push(entity);
        });
      }).catch(() => {});

      // Also load incidents linked to this operation
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const opIncidents = incidents.filter((inc: any) => inc.eventId === op.id || inc.operationId === op.id);
      // Note: incidents with their own lat/lng are already plotted by the incidents layer.
      // Here we could plot incidents that only have site-map-relative positions.
      // For now, the incident layer handles this.
    });
  }, [operations, layers.siteOverlays, savedBounds, loading, incidents]);

  // ─── Night Vision Mode ───────────────────────────────
  // Swaps to a dark basemap (CartoDB Dark Matter) and styles 3D buildings
  // with green outlines for a tactical night-ops aesthetic.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Remove existing dark basemap layer
    if (entityGroupsRef.current.nvDarkLayer) {
      try { viewer.imageryLayers.remove(entityGroupsRef.current.nvDarkLayer, false); } catch {}
      entityGroupsRef.current.nvDarkLayer = null;
    }

    // Restore default building style
    const buildings = entityGroupsRef.current.buildings?.[0];

    if (!layers.nightVision) {
      // Restore: show base imagery, reset building style
      const baseLayer = viewer.imageryLayers.get(0);
      if (baseLayer) baseLayer.show = true;
      if (buildings) {
        buildings.style = undefined;
      }
      viewer.scene.globe.enableLighting = false;
      return;
    }

    // Hide the default satellite/street base imagery
    const baseLayer = viewer.imageryLayers.get(0);
    if (baseLayer) baseLayer.show = false;
    // Also hide OSM layer if active
    const osmRef = entityGroupsRef.current.osmLayerRef;
    if (osmRef?.[0]) osmRef[0].show = false;

    // Add CartoDB Dark Matter tiles as the base
    const darkProvider = new Cesium.UrlTemplateImageryProvider({
      url: "https://basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png",
      credit: "CartoDB Dark Matter",
      minimumLevel: 0,
      maximumLevel: 18,
    });
    const darkLayer = viewer.imageryLayers.addImageryProvider(darkProvider, 0);
    darkLayer.alpha = 1.0;
    entityGroupsRef.current.nvDarkLayer = darkLayer;

    // Style 3D buildings: dark fill with neon green edges
    // Using a very low-alpha bright green — the building faces render
    // semi-transparent while edges (where multiple faces overlap at
    // geometry seams) accumulate to a brighter neon green outline effect.
    if (buildings) {
      buildings.style = new Cesium.Cesium3DTileStyle({
        color: "color('rgba(0, 255, 65, 0.15)')",
        show: true,
      });
    }

    // Enable silhouette-like effect via scene lighting
    viewer.scene.globe.enableLighting = true;
  }, [layers.nightVision, loading]);

  // ─── Weather Radar Auto-Refresh (every 5 min) ──────
  useEffect(() => {
    if (!layers.weather) return;
    const interval = setInterval(() => {
      const viewer = viewerRef.current;
      const Cesium = cesiumRef.current;
      if (!viewer || !Cesium) return;

      // Remove and re-add to force tile refresh with cache buster
      if (weatherLayerRef.current) {
        viewer.imageryLayers.remove(weatherLayerRef.current, false);
      }
      try {
        const radarProvider = new Cesium.UrlTemplateImageryProvider({
          url: `https://mesonet.agron.iastate.edu/cache/tile.py/1.0.0/nexrad-n0q-900913/{z}/{x}/{y}.png?_t=${Date.now()}`,
          credit: "Iowa State Mesonet / NOAA NEXRAD",
          minimumLevel: 0,
          maximumLevel: 12,
        });
        const layer = viewer.imageryLayers.addImageryProvider(radarProvider);
        layer.alpha = 0.6;
        weatherLayerRef.current = layer;
      } catch {}
    }, 300000); // 5 minutes
    return () => clearInterval(interval);
  }, [layers.weather]);

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
        const osm = new Cesium.OpenStreetMapImageryProvider({ url: "https://a.tile.openstreetmap.org/" });
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
  }, [layers.satellite, loading]);

  // ─── Breadcrumb Trails (patrol history) ──────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Clear old breadcrumb entities
    (entityGroupsRef.current.breadcrumbs ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch {}
    });
    entityGroupsRef.current.breadcrumbs = [];

    if (!layers.breadcrumbs || staff.length === 0) return;

    // Load trail for each active staff member
    staff.forEach(s => {
      getLocationHistory(s.userId, companyId, 4).then(trail => {
        if (trail.length < 2) return;
        const positions = trail.flatMap(p => [p.lng, p.lat]);
        const entity = viewer.entities.add({
          id: `trail-${s.userId}`,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(positions),
            width: 2,
            material: new Cesium.PolylineGlowMaterialProperty({
              glowPower: 0.2,
              color: Cesium.Color.CYAN.withAlpha(0.6),
            }),
            clampToGround: true,
          },
        });
        entityGroupsRef.current.breadcrumbs.push(entity);
      }).catch(() => {});
    });
  }, [staff, layers.breadcrumbs, loading, companyId]);

  // ─── Tactical Annotations (drawings) ───────────────
  useEffect(() => {
    if (!companyId || loading) return;
    if (!layers.annotations) { setAnnotations([]); return; }

    getAnnotations(companyId).then(setAnnotations).catch(() => {});
    const unsub = subscribeAnnotations(companyId, () => {
      getAnnotations(companyId).then(setAnnotations).catch(() => {});
    });
    return unsub;
  }, [companyId, layers.annotations, loading]);

  // Render annotations on the globe
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.annotations ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch {}
    });
    entityGroupsRef.current.annotations = [];

    if (!layers.annotations) return;

    annotations.forEach(ann => {
      const color = Cesium.Color.fromCssColorString(ann.color).withAlpha(0.8);
      if ((ann.type === "line" || ann.type === "arrow" || ann.type === "freehand") && ann.geometry.positions.length >= 2) {
        const positions = ann.geometry.positions.flatMap(([lng, lat]: [number, number]) => [lng, lat]);
        const entity = viewer.entities.add({
          id: `ann-${ann.id}`,
          polyline: {
            positions: Cesium.Cartesian3.fromDegreesArray(positions),
            width: 3,
            material: color,
            clampToGround: true,
          },
        });
        entityGroupsRef.current.annotations.push(entity);
      } else if (ann.type === "polygon" && ann.geometry.positions.length >= 3) {
        const hierarchy = Cesium.Cartesian3.fromDegreesArray(
          ann.geometry.positions.flatMap(([lng, lat]: [number, number]) => [lng, lat])
        );
        const entity = viewer.entities.add({
          id: `ann-${ann.id}`,
          polygon: {
            hierarchy,
            material: color.withAlpha(0.2),
            outline: true,
            outlineColor: color,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        entityGroupsRef.current.annotations.push(entity);
      } else if (ann.type === "circle" && ann.geometry.positions.length >= 1 && ann.geometry.radius) {
        const [lng, lat] = ann.geometry.positions[0];
        const entity = viewer.entities.add({
          id: `ann-${ann.id}`,
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          ellipse: {
            semiMajorAxis: ann.geometry.radius,
            semiMinorAxis: ann.geometry.radius,
            material: color.withAlpha(0.15),
            outline: true,
            outlineColor: color,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
          },
        });
        entityGroupsRef.current.annotations.push(entity);
      } else if (ann.type === "text" && ann.geometry.positions.length >= 1 && ann.label) {
        const [lng, lat] = ann.geometry.positions[0];
        const entity = viewer.entities.add({
          id: `ann-${ann.id}`,
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          label: {
            text: ann.label,
            font: "bold 14px monospace",
            fillColor: color,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 3,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        entityGroupsRef.current.annotations.push(entity);
      }
    });
  }, [annotations, layers.annotations, loading]);

  // ─── Nearby POIs (hospitals, police, fire stations) ─
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.pois ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch {}
    });
    entityGroupsRef.current.pois = [];

    if (!layers.nearbyPOIs || operations.length === 0) return;

    // Fetch POIs near the first operation with coordinates
    const op = operations.find(o => o.lat && o.lng);
    if (!op) return;

    getNearbyPOIs(op.lat, op.lng, 5000).then(pois => {
      setNearbyPOIs(pois);
      const poiColors: Record<string, string> = {
        hospital: "#ef4444",
        police: "#3b82f6",
        fire_station: "#f97316",
        pharmacy: "#22c55e",
      };
      const poiIcons: Record<string, string> = {
        hospital: "\u2695",
        police: "\u2605",
        fire_station: "\u2622",
        pharmacy: "\u271A",
      };
      pois.forEach((poi, i) => {
        const color = poiColors[poi.type] || "#6b7280";
        const entity = viewer.entities.add({
          id: `poi-${poi.id || i}`,
          name: poi.name,
          position: Cesium.Cartesian3.fromDegrees(poi.lng, poi.lat),
          billboard: {
            image: createPinCanvas(color, "alert"),
            verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
            scale: 0.45,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
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
          },
          description: `<b>${poi.name}</b><br/>Type: ${poi.type.replace("_", " ")}`,
        });
        entityGroupsRef.current.pois.push(entity);
      });
    }).catch(() => {});
  }, [operations, layers.nearbyPOIs, loading]);

  // ─── Geofence Alert Feed ────────────────────────────
  useEffect(() => {
    if (!companyId || loading) return;
    getRecentGeofenceAlerts(companyId, 10).then(setGeofenceAlerts).catch(() => {});
  }, [companyId, loading]);

  // ─── Click handler (tools + entity selection) ────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // Single click — tools
    handler.setInputAction((click: { position: { x: number; y: number } }) => {
      // Get globe position from click
      const ray = viewer.camera.getPickRay(click.position);
      const cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null;
      if (!cartesian) return;
      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lng = Cesium.Math.toDegrees(carto.longitude);

      // Site map aligner — feed globe points
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const alignerFn = (window as any).__siteMapAlignerAddPoint;
      if (alignerFn && aligningOp) {
        alignerFn(lat, lng);
        return;
      }

      // Drawing mode — collect points
      if (drawMode !== "none") {
        if (drawMode === "text") {
          const label = prompt("Enter label text:");
          if (label) {
            createAnnotation(companyId, {
              eventId: null,
              type: "text",
              geometry: { positions: [[lng, lat]] },
              label,
              color: drawColor,
              style: "solid",
            });
          }
          return;
        }
        setDrawPoints(prev => [...prev, [lng, lat]]);

        // Place temporary point marker
        viewer.entities.add({
          id: `draw-pt-${drawPoints.length}`,
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          point: {
            pixelSize: 6,
            color: Cesium.Color.fromCssColorString(drawColor),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
        return;
      }

      // Measurement tool
      if (activeTool === "measure") {
        if (!measurePoint1) {
          setMeasurePoint1({ lat, lng });
          setMeasureResult(null);
          // Place point 1 marker
          viewer.entities.removeById("measure-p1");
          viewer.entities.removeById("measure-p2");
          viewer.entities.removeById("measure-line");
          viewer.entities.add({
            id: "measure-p1",
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            point: { pixelSize: 8, color: Cesium.Color.LIME, outlineColor: Cesium.Color.BLACK, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          });
        } else {
          // Point 2 — compute distance
          const dist = haversineDistance(measurePoint1.lat, measurePoint1.lng, lat, lng);
          const bear = initialBearing(measurePoint1.lat, measurePoint1.lng, lat, lng);
          setMeasureResult({ distanceM: dist, distanceMi: dist / 1609.34, bearing: bear });

          viewer.entities.removeById("measure-p2");
          viewer.entities.removeById("measure-line");
          viewer.entities.add({
            id: "measure-p2",
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            point: { pixelSize: 8, color: Cesium.Color.LIME, outlineColor: Cesium.Color.BLACK, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
          });
          viewer.entities.add({
            id: "measure-line",
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArray([measurePoint1.lng, measurePoint1.lat, lng, lat]),
              width: 2,
              material: Cesium.Color.LIME.withAlpha(0.8),
              clampToGround: true,
            },
          });
          setMeasurePoint1(null); // Reset for next measurement
        }
        return;
      }

      // Range rings tool
      if (activeTool === "range-rings") {
        // Clear old rings
        RANGE_RING_RADII_M.forEach((_, i) => { viewer.entities.removeById(`ring-${i}`); viewer.entities.removeById(`ring-label-${i}`); });
        viewer.entities.removeById("ring-center");

        setRangeCenter({ lat, lng });

        // Place center point
        viewer.entities.add({
          id: "ring-center",
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          point: { pixelSize: 8, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.BLACK, outlineWidth: 1, heightReference: Cesium.HeightReference.CLAMP_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
        });

        // Draw concentric rings
        RANGE_RING_RADII_M.forEach((radius, i) => {
          viewer.entities.add({
            id: `ring-${i}`,
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            ellipse: {
              semiMajorAxis: radius,
              semiMinorAxis: radius,
              material: Cesium.Color.CYAN.withAlpha(0.05),
              outline: true,
              outlineColor: Cesium.Color.CYAN.withAlpha(0.4),
              outlineWidth: 1,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            },
          });
          // Label at the north edge of each ring
          const labelLat = lat + (radius / 111320); // rough degrees per meter
          viewer.entities.add({
            id: `ring-label-${i}`,
            position: Cesium.Cartesian3.fromDegrees(lng, labelLat),
            label: {
              text: RANGE_RING_LABELS[i],
              font: "10px monospace",
              fillColor: Cesium.Color.CYAN,
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
        });
        return;
      }

      // No tool active — check for entity or 3D tile pick to show popup
      if (activeTool === "none" && drawMode === "none") {
        const picked = viewer.scene.pick(click.position);
        if (Cesium.defined(picked)) {
          // Entity pick (our operations/staff/incident pins + annotations)
          if (picked.id?.id && picked.id?.name) {
            const entity = picked.id;
            const entityId = entity.id as string;

            // Check if it's an annotation — add delete button to description
            const isAnnotation = entityId.startsWith("ann-");
            const annId = isAnnotation ? entityId.replace("ann-", "") : null;
            const deleteBtn = isAnnotation && isAdmin
              ? `<br/><br/><span style="cursor:pointer;color:#ef4444" onclick="window.__deleteAnnotation&&window.__deleteAnnotation('${annId}')">🗑 Delete this drawing</span>`
              : "";

            setSelectedEntity({
              id: entityId,
              name: entity.name ?? "",
              description: (entity.description?.getValue?.() ?? entity.description ?? "") + deleteBtn,
              screenX: click.position.x,
              screenY: click.position.y,
            });
          }
          // 3D Tile feature pick (OSM buildings)
          else if (picked.getProperty) {
            const name = picked.getProperty("name") || picked.getProperty("building") || "Building";
            const height = picked.getProperty("cesium#estimatedHeight") || picked.getProperty("height");
            const type = picked.getProperty("building") || picked.getProperty("type") || "";
            const addr = picked.getProperty("addr:street") || "";
            const houseNum = picked.getProperty("addr:housenumber") || "";

            let desc = `<strong>${name}</strong>`;
            if (addr) desc += `<br/>${houseNum ? houseNum + " " : ""}${addr}`;
            if (type && type !== name) desc += `<br/>Type: ${type}`;
            if (height) desc += `<br/>Height: ~${Math.round(Number(height))}m`;
            desc += `<br/><span style="opacity:0.4">Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}</span>`;

            setSelectedEntity({
              id: `bldg-${click.position.x}-${click.position.y}`,
              name: String(name),
              description: desc,
              screenX: click.position.x,
              screenY: click.position.y,
            });
          }
          else {
            setSelectedEntity(null);
          }
        } else {
          setSelectedEntity(null);
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Double click — fly to entity / operation callback
    handler.setInputAction((click: { position: { x: number; y: number } }) => {
      const picked = viewer.scene.pick(click.position);
      if (Cesium.defined(picked) && picked.id?.id) {
        const id = picked.id.id as string;
        if (id.startsWith("op-") && onSelectOperation) {
          onSelectOperation(id.replace("op-", ""));
        }
      }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    return () => handler.destroy();
  }, [loading, onSelectOperation, activeTool, measurePoint1, aligningOp, drawMode, drawColor, drawPoints, companyId]);

  // Track selected entity screen position as camera moves
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || !selectedEntity) {
      cancelAnimationFrame(popupAnimFrame.current);
      return;
    }

    const entity = viewer.entities.getById(selectedEntity.id);
    if (!entity?.position) return;

    function updatePosition() {
      if (!viewer || !Cesium || !entity?.position) return;
      try {
        const pos = entity.position.getValue(viewer.clock.currentTime);
        if (pos) {
          const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, pos);
          if (screenPos) {
            setSelectedEntity((prev) =>
              prev ? { ...prev, screenX: screenPos.x, screenY: screenPos.y } : null
            );
          }
        }
      } catch {}
      popupAnimFrame.current = requestAnimationFrame(updatePosition);
    }
    popupAnimFrame.current = requestAnimationFrame(updatePosition);
    return () => cancelAnimationFrame(popupAnimFrame.current);
  }, [selectedEntity?.id, loading]);

  // Clean up tool entities when tool changes
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading) return;

    if (activeTool !== "measure") {
      ["measure-p1", "measure-p2", "measure-line"].forEach(id => { try { viewer.entities.removeById(id); } catch {} });
      setMeasurePoint1(null);
      setMeasureResult(null);
    }
    if (activeTool !== "range-rings") {
      RANGE_RING_RADII_M.forEach((_, i) => { try { viewer.entities.removeById(`ring-${i}`); viewer.entities.removeById(`ring-label-${i}`); } catch {} });
      try { viewer.entities.removeById("ring-center"); } catch {}
      setRangeCenter(null);
    }
  }, [activeTool, loading]);

  // Draw finish handler — save annotation to DB
  const handleDrawFinish = useCallback(() => {
    if (drawPoints.length < 2 && drawMode !== "text") return;
    const type = drawMode === "none" ? "line" : drawMode;

    // For circles, compute radius from first to last point
    let geometry: MapAnnotation["geometry"];
    if (type === "circle" && drawPoints.length >= 2) {
      const [cLng, cLat] = drawPoints[0];
      const [eLng, eLat] = drawPoints[drawPoints.length - 1];
      const toRad = (d: number) => (d * Math.PI) / 180;
      const R = 6371000;
      const dLat = toRad(eLat - cLat);
      const dLng = toRad(eLng - cLng);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(cLat)) * Math.cos(toRad(eLat)) * Math.sin(dLng / 2) ** 2;
      const radius = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      geometry = { positions: [drawPoints[0]], radius };
    } else {
      geometry = { positions: drawPoints };
    }

    createAnnotation(companyId, {
      eventId: null,
      type: type as MapAnnotation["type"],
      geometry,
      label: null,
      color: drawColor,
      style: "solid",
    });

    // Clean up temp markers
    const viewer = viewerRef.current;
    drawPoints.forEach((_, i) => { try { viewer?.entities.removeById(`draw-pt-${i}`); } catch {} });
    setDrawPoints([]);
    setDrawMode("none");
  }, [drawPoints, drawMode, drawColor, companyId]);

  const handleDrawCancel = useCallback(() => {
    const viewer = viewerRef.current;
    drawPoints.forEach((_, i) => { try { viewer?.entities.removeById(`draw-pt-${i}`); } catch {} });
    setDrawPoints([]);
    setDrawMode("none");
  }, [drawPoints]);

  const handleClearAnnotations = useCallback(async () => {
    for (const ann of annotations) {
      await deleteAnnotation(ann.id);
    }
  }, [annotations]);

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

      {/* Compass + Fullscreen — top left */}
      {!loading && !error && (
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1.5">
          {/* Compass */}
          <button
            onClick={handleResetNorth}
            title="Reset to north (top-down view)"
            className="w-10 h-10 rounded-full backdrop-blur-sm border border-white/10 flex items-center justify-center hover:border-white/30 transition-colors"
            style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 85%, transparent)" }}
          >
            <svg
              width="28" height="28" viewBox="0 0 28 28"
              style={{ transform: `rotate(${-cameraHeading}rad)`, transition: "transform 0.15s ease-out" }}
            >
              {/* North pointer (red) */}
              <polygon points="14,2 17,14 14,12 11,14" fill="#ef4444" />
              {/* South pointer (white) */}
              <polygon points="14,26 11,14 14,16 17,14" fill="rgba(255,255,255,0.5)" />
              {/* Center dot */}
              <circle cx="14" cy="14" r="2" fill="rgba(255,255,255,0.7)" />
              {/* N label */}
              <text x="14" y="9" textAnchor="middle" fontSize="6" fontWeight="bold" fontFamily="monospace" fill="#ef4444">N</text>
            </svg>
          </button>

          {/* Fullscreen */}
          <button
            onClick={handleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            className="w-10 h-10 rounded-full backdrop-blur-sm border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-white/30 transition-colors"
            style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 85%, transparent)" }}
          >
            {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
          </button>
        </div>
      )}

      {/* Custom entity popup — floating near selected point */}
      {selectedEntity && (
        <div
          className="absolute z-20 pointer-events-auto"
          style={{
            left: Math.min(Math.max(selectedEntity.screenX - 140, 8), (containerRef.current?.clientWidth ?? 800) - 296),
            top: Math.max(selectedEntity.screenY - 10, 8),
            transform: "translateY(-100%)",
          }}
        >
          {/* Connector line */}
          <div className="absolute left-1/2 bottom-0 w-px h-2" style={{ backgroundColor: "var(--brand-accent, #d59b3c)", transform: "translateX(-50%) translateY(100%)" }} />
          {/* Popup card */}
          <div className="w-72 rounded-xl backdrop-blur-md shadow-xl shadow-black/40 overflow-hidden" style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 95%, transparent)", borderWidth: 1, borderStyle: "solid", borderColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)" }}>
            {/* Close button */}
            <button onClick={() => setSelectedEntity(null)} className="absolute top-1.5 right-2 text-white/30 hover:text-white text-xs z-10">✕</button>
            {/* Body */}
            <div
              className="px-3 py-2.5 text-[11px] text-white/80 font-mono leading-relaxed max-h-48 overflow-y-auto [&_strong]:text-accent [&_b]:text-accent"
              dangerouslySetInnerHTML={{ __html: selectedEntity.description || `<b>${selectedEntity.name}</b>` }}
            />
          </div>
        </div>
      )}

      {!error && <MapLayersPanel layers={layers} onChange={setLayers} onFlyToAll={handleFlyToAll} operations={operations} isAdmin={isAdmin} onRealignSiteMap={(op) => {
        // Clear saved bounds to force re-alignment
        setSavedBounds((prev) => { const next = { ...prev }; delete next[op.id]; return next; });
        setAligningOp(op);
      }} />}
      {!error && !loading && (
        <MapToolsBar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          measureResult={measureResult}
          rangeCenter={rangeCenter}
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
      {/* Geofence Alert Ticker */}
      {geofenceAlerts.length > 0 && (
        <div className="absolute bottom-14 left-3 right-64 z-10 rounded-lg backdrop-blur-sm border border-red-500/20 px-3 py-1.5 overflow-hidden"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)" }}>
          <div className="flex items-center gap-2 text-[10px] font-mono animate-marquee">
            <span className="text-red-500 font-bold shrink-0">GEOFENCE</span>
            {geofenceAlerts.slice(0, 5).map(a => (
              <span key={a.id} className="text-white/60 shrink-0">
                {a.alertType === "breach" ? "⚠" : "✓"} {a.userName} — {a.eventName} ({Math.round(a.distanceM)}m) {new Date(a.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            ))}
          </div>
        </div>
      )}
      {aligningOp && aligningOp.siteMapUrl && (
        <SiteMapAligner
          imageUrl={aligningOp.siteMapUrl}
          operationName={aligningOp.name}
          onAlign={(bounds) => {
            // Save locally for immediate use
            setSavedBounds((prev) => ({ ...prev, [aligningOp.id]: bounds }));
            // Persist to DB (company-wide)
            saveSiteMapBounds(aligningOp.id, bounds);
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
    </div>
  );
}

function createPinCanvas(color: string, type: "flag" | "person" | "alert"): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;
  ctx.beginPath();
  ctx.arc(24, 20, 14, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.shadowColor = "transparent";
  ctx.beginPath();
  ctx.moveTo(16, 30);
  ctx.lineTo(24, 44);
  ctx.lineTo(32, 30);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(type === "flag" ? "\u2691" : type === "person" ? "\u2022" : "\u26A0", 24, 20);
  return canvas;
}
