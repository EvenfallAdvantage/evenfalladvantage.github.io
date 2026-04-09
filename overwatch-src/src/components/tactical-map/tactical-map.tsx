"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { loadCesium } from "./cesium-config";
import { MapLayersPanel, type LayerVisibility, DEFAULT_LAYERS } from "./map-layers-panel";
import { MapToolsBar, type ActiveTool, haversineDistance, initialBearing, RANGE_RING_RADII_M, RANGE_RING_LABELS } from "./map-tools";
import { SiteMapAligner } from "./site-map-aligner";

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
  onSelectOperation?: (id: string) => void;
}

const CONUS_CENTER = { lat: 39.8283, lng: -98.5795 };

export function TacticalMap({ operations, staff, incidents, companyId, onSelectOperation }: TacticalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cesiumRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  const [activeTool, setActiveTool] = useState<ActiveTool>("none");
  const [measureResult, setMeasureResult] = useState<{ distanceM: number; distanceMi: number; bearing: number } | null>(null);
  const [measurePoint1, setMeasurePoint1] = useState<{ lat: number; lng: number } | null>(null);
  const [rangeCenter, setRangeCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [aligningOp, setAligningOp] = useState<OperationPin | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entityGroupsRef = useRef<Record<string, any[]>>({});
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
          selectionIndicator: true,
          timeline: false,
          animation: false,
          fullscreenButton: false,
          vrButton: false,
          navigationHelpButton: false,
          infoBox: true,
          creditContainer: document.createElement("div"),
        });

        if (destroyed) { viewer.destroy(); return; }
        viewerRef.current = viewer;

        // Add 3D buildings
        const buildingsTileset = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildingsTileset);
        entityGroupsRef.current.buildings = [buildingsTileset];

        // Fly to CONUS
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(CONUS_CENTER.lng, CONUS_CENTER.lat, 5000000),
          duration: 0,
        });

        viewer.scene.globe.depthTestAgainstTerrain = true;
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0002;

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

    const weatherProvider = new Cesium.WebMapServiceImageryProvider({
      url: "https://mapservices.weather.noaa.gov/eventdriven/services/radar/radar_base_reflectivity_time/MapServer/WMSServer",
      layers: "0",
      parameters: { transparent: true, format: "image/png" },
      credit: "NOAA/NWS",
    });
    const layer = viewer.imageryLayers.addImageryProvider(weatherProvider);
    layer.alpha = 0.5;
    weatherLayerRef.current = layer;
  }, [layers.weather, loading]);

  // ─── 3D Buildings Toggle ─────────────────────────────
  useEffect(() => {
    const buildings = entityGroupsRef.current.buildings;
    if (buildings?.[0]) buildings[0].show = layers.buildings;
  }, [layers.buildings]);

  // ─── Site Map Overlays ──────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Remove old site overlay layers
    (entityGroupsRef.current.siteOverlays ?? []).forEach((layer: { layerRef: unknown; eventId: string }) => {
      try { viewer.imageryLayers.remove(layer.layerRef, false); } catch {}
    });
    entityGroupsRef.current.siteOverlays = [];

    // Add active site overlays
    operations.forEach((op) => {
      if (!layers.siteOverlays[op.id] || !op.siteMapUrl || !op.lat || !op.lng) return;

      try {
        // Drape the site map image as a ground overlay centered on the operation
        // Default extent: ~200m in each direction (adjustable per operation)
        const extent = 0.002; // ~200m in degrees
        const provider = new Cesium.SingleTileImageryProvider({
          url: op.siteMapUrl,
          rectangle: Cesium.Rectangle.fromDegrees(
            op.lng - extent, op.lat - extent,
            op.lng + extent, op.lat + extent
          ),
        });
        const layer = viewer.imageryLayers.addImageryProvider(provider);
        layer.alpha = 0.7;
        entityGroupsRef.current.siteOverlays.push({ layerRef: layer, eventId: op.id });
      } catch (err) {
        console.warn("[TacticalMap] Failed to load site overlay for", op.name, err);
      }
    });
  }, [operations, layers.siteOverlays, loading]);

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
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // Double click — entity selection
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
  }, [loading, onSelectOperation, activeTool, measurePoint1, aligningOp]);

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
    <div className="relative w-full rounded-xl overflow-hidden border border-border/50" style={{ height: "calc(100vh - 180px)", minHeight: 500 }}>
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
      {!error && <MapLayersPanel layers={layers} onChange={setLayers} onFlyToAll={handleFlyToAll} operations={operations} />}
      {!error && !loading && (
        <MapToolsBar
          activeTool={activeTool}
          onToolChange={setActiveTool}
          measureResult={measureResult}
          rangeCenter={rangeCenter}
        />
      )}
      {aligningOp && aligningOp.siteMapUrl && (
        <SiteMapAligner
          imageUrl={aligningOp.siteMapUrl}
          operationName={aligningOp.name}
          onAlign={(bounds) => {
            // Apply the aligned overlay
            const viewer = viewerRef.current;
            const Cesium = cesiumRef.current;
            if (viewer && Cesium && aligningOp.siteMapUrl) {
              try {
                const provider = new Cesium.SingleTileImageryProvider({
                  url: aligningOp.siteMapUrl,
                  rectangle: Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north),
                });
                const layer = viewer.imageryLayers.addImageryProvider(provider);
                layer.alpha = 0.75;
              } catch (err) {
                console.error("[TacticalMap] Failed to apply aligned overlay:", err);
              }
            }
            setAligningOp(null);
          }}
          onCancel={() => setAligningOp(null)}
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
