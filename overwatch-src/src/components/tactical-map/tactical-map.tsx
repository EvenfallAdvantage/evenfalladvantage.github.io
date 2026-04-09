"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { configureCesium } from "./cesium-config";
import { MapLayersPanel, type LayerVisibility, DEFAULT_LAYERS } from "./map-layers-panel";
import type { EventRow } from "@/types";

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

// CONUS center (roughly Kansas)
const CONUS_CENTER = { lat: 39.8283, lng: -98.5795 };

export function TacticalMap({ operations, staff, incidents, companyId, onSelectOperation }: TacticalMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const viewerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [layers, setLayers] = useState<LayerVisibility>(DEFAULT_LAYERS);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const entityGroupsRef = useRef<Record<string, any[]>>({});
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weatherLayerRef = useRef<any>(null);

  // ─── Initialize Cesium Viewer ────────────────────────
  useEffect(() => {
    if (!containerRef.current) return;

    configureCesium();

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Cesium = require("cesium");
    require("cesium/Build/Cesium/Widgets/widgets.css");

    let viewer: InstanceType<typeof Cesium.Viewer>;

    (async () => {
      try {
        viewer = new Cesium.Viewer(containerRef.current, {
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
          creditContainer: document.createElement("div"), // hide credits
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any);

        viewerRef.current = viewer;

        // Add Cesium OSM Buildings (3D)
        const buildingsTileset = await Cesium.createOsmBuildingsAsync();
        viewer.scene.primitives.add(buildingsTileset);
        entityGroupsRef.current.buildings = [buildingsTileset];

        // Fly to CONUS
        viewer.camera.flyTo({
          destination: Cesium.Cartesian3.fromDegrees(CONUS_CENTER.lng, CONUS_CENTER.lat, 5000000),
          duration: 0,
        });

        // Enable depth testing against terrain
        viewer.scene.globe.depthTestAgainstTerrain = true;

        // Set the scene to be a bit darker for tactical feel
        viewer.scene.fog.enabled = true;
        viewer.scene.fog.density = 0.0002;

        setLoading(false);
      } catch (err) {
        console.error("[TacticalMap] Failed to initialize Cesium:", err);
        setLoading(false);
      }
    })();

    return () => {
      if (viewer && !viewer.isDestroyed()) {
        viewer.destroy();
      }
      viewerRef.current = null;
    };
  }, []);

  // ─── Plot Operations ─────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Cesium = require("cesium");

    // Clear old operation entities
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

      // Geofence ring
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
    if (!viewer || loading) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Cesium = require("cesium");

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
          <strong>${s.name}</strong><br/>
          Role: ${s.role}<br/>
          Updated: ${new Date(s.updatedAt).toLocaleTimeString()}<br/>
          ${s.speed ? `Speed: ${(s.speed * 2.237).toFixed(1)} mph` : ""}
          ${s.heading ? `<br/>Heading: ${s.heading.toFixed(0)}&deg;` : ""}
        </div>`,
      });
      entityGroupsRef.current.staff.push(entity);
    });
  }, [staff, layers.staff, loading]);

  // ─── Plot Incidents ──────────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Cesium = require("cesium");

    (entityGroupsRef.current.incidents ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch {}
    });
    entityGroupsRef.current.incidents = [];

    if (!layers.incidents) return;

    incidents.forEach((inc) => {
      const color = inc.severity === "critical" ? "#ef4444"
        : inc.severity === "high" ? "#f97316"
        : inc.severity === "medium" ? "#eab308"
        : "#6b7280";

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
          Status: ${inc.status}<br/>
          Reported: ${new Date(inc.createdAt).toLocaleString()}
        </div>`,
      });
      entityGroupsRef.current.incidents.push(entity);
    });
  }, [incidents, layers.incidents, loading]);

  // ─── Weather Radar Layer ─────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Cesium = require("cesium");

    // Remove existing weather layer
    if (weatherLayerRef.current) {
      viewer.imageryLayers.remove(weatherLayerRef.current, false);
      weatherLayerRef.current = null;
    }

    if (!layers.weather) return;

    // NWS radar base reflectivity (free, no API key)
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
    if (buildings?.[0]) {
      buildings[0].show = layers.buildings;
    }
  }, [layers.buildings]);

  // ─── Night Vision Mode ───────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading) return;

    if (layers.nightVision) {
      // Green tint post-process
      viewer.scene.postProcessStages.ambientOcclusion.enabled = false;
      viewer.scene.globe.baseColor = { red: 0.0, green: 0.15, blue: 0.0, alpha: 1.0 };
    } else {
      viewer.scene.globe.baseColor = undefined;
    }
  }, [layers.nightVision, loading]);

  // ─── Fly to operation on click ───────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    if (!viewer || loading) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Cesium = require("cesium");

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
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
  }, [loading, onSelectOperation]);

  const handleFlyToAll = useCallback(() => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Cesium = require("cesium");

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
      <div ref={containerRef} className="w-full h-full" />
      <MapLayersPanel layers={layers} onChange={setLayers} onFlyToAll={handleFlyToAll} operations={operations} />
    </div>
  );
}

// ─── Pin canvas generator ────────────────────────────
function createPinCanvas(color: string, type: "flag" | "person" | "alert"): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 48;
  canvas.height = 48;
  const ctx = canvas.getContext("2d")!;

  // Drop shadow
  ctx.shadowColor = "rgba(0,0,0,0.5)";
  ctx.shadowBlur = 4;
  ctx.shadowOffsetY = 2;

  // Outer circle
  ctx.beginPath();
  ctx.arc(24, 20, 14, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Pin point
  ctx.shadowColor = "transparent";
  ctx.beginPath();
  ctx.moveTo(16, 30);
  ctx.lineTo(24, 44);
  ctx.lineTo(32, 30);
  ctx.fillStyle = color;
  ctx.fill();

  // Icon inside
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 14px sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const icon = type === "flag" ? "\u2691" : type === "person" ? "\u2022" : "\u26A0";
  ctx.fillText(icon, 24, 20);

  return canvas;
}
