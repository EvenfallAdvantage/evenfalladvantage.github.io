import { useEffect, useRef, useState } from "react";
import type { LayerVisibility } from "../map-layers-panel";
import { getSiteMapBounds, loadStoryboard, type SiteMapBounds } from "@/lib/supabase/db-operations";
import { getLocationHistory, getLocationHistoryAt } from "@/lib/supabase/db-location";
import { getNearbyPOIs, getRecentGeofenceAlerts, type NearbyPOI, type GeofenceAlert } from "../env-intel";
import { addSentinel1Layer, addSentinel2Layer } from "../sentinel-layer";
import { FLIR_SHADER, CRT_SHADER, applyShader, removeShader } from "../shaders";
import { getAircraft, getBoundingBox, formatAltitude, formatSpeed } from "../flight-tracker";
import { getSatellitePositions, computeGroundTrack } from "../orbit-tracker";
import { escapeHtml } from "@/lib/security";
import type { OperationDocument } from "@/types/operations";
import { createPinCanvas, parseIncidentNarrative } from "../pin-canvas";
import type { StaffPin, OperationPin, IncidentPin } from "../types";
import type { MapAnnotation } from "@/lib/supabase/db-annotations";

export function useCesiumLayers(params: {
  viewerRef: React.MutableRefObject<any>;
  cesiumRef: React.MutableRefObject<any>;
  entityGroupsRef: React.MutableRefObject<Record<string, any>>;
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

  // State only consumed by layer effects
  const [nearbyPOIs, setNearbyPOIs] = useState<NearbyPOI[]>([]);
  const [geofenceAlerts, setGeofenceAlerts] = useState<GeofenceAlert[]>([]);
  const [savedBounds, setSavedBounds] = useState<Record<string, SiteMapBounds>>({});
  const [boundsLoaded, setBoundsLoaded] = useState<Set<string>>(new Set());
  const [boundsLoading, setBoundsLoading] = useState<Set<string>>(new Set());
  const [aligningOp, setAligningOp] = useState<OperationPin | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const weatherLayerRef = useRef<any>(null);

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
        description: `<div style="font-family:monospace;font-size:11px;line-height:1.7">
          <b>${escapeHtml(op.name)}</b>
          <div style="margin:4px 0"><span style="color:${color.toCssColorString()};font-weight:bold;padding:1px 6px;border-radius:3px;background:${color.toCssColorString()}22">${escapeHtml(op.status.toUpperCase())}</span></div>
          ${op.location ? `<div style="opacity:0.7;font-size:10px">📍 ${escapeHtml(op.location)}</div>` : ""}
          ${op.startDate ? `<div style="opacity:0.6;font-size:10px">📅 ${new Date(op.startDate).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}</div>` : ""}
          ${op.shiftCount ? `<div style="opacity:0.6;font-size:10px">👥 ${op.shiftCount} shift${op.shiftCount !== 1 ? "s" : ""}</div>` : ""}
          ${op.geofenceRadius ? `<div style="opacity:0.5;font-size:10px">⊙ ${op.geofenceRadius}m geofence</div>` : ""}
          ${op.siteMapUrl ? `<div style="opacity:0.5;font-size:10px">🗺 Site map available</div>` : ""}
          ${(() => {
            const docs = eventDocs[op.id] ?? [];
            if (docs.length === 0) return `<div style="opacity:0.3;font-size:9px;margin-top:6px">No documents yet</div>`;
            const docLabels: Record<string, string> = { intake: "📋 Intake", warno: "⚠️ WARNO", opord: "📑 OPORD", frago: "🔄 FRAGO", gotwa: "🎯 GOTWA" };
            return `<div style="margin-top:6px;display:flex;flex-wrap:wrap;gap:4px">${docs.map(d =>
              `<span style="cursor:pointer;display:inline-block;padding:2px 8px;background:${d.status === "issued" ? "#22c55e22" : "#f59e0b22"};border:1px solid ${d.status === "issued" ? "#22c55e44" : "#f59e0b44"};border-radius:5px;color:${d.status === "issued" ? "#4ade80" : "#fbbf24"};font-size:9px;font-weight:600" onclick="window.__openOpDoc&&window.__openOpDoc('${op.id}','${d.doc_type}')">${docLabels[d.doc_type] || d.doc_type.toUpperCase()}</span>`
            ).join("")}</div>`;
          })()}
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
  }, [operations, layers.operations, layers.geofences, loading, eventDocs]);

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
          <strong>${escapeHtml(s.name)}</strong><br/>Role: ${escapeHtml(s.role)}<br/>
          Updated: ${new Date(s.updatedAt).toLocaleTimeString()}
          ${s.speed ? `<br/>Speed: ${(s.speed * 2.237).toFixed(1)} mph` : ""}
          ${s.heading ? `<br/>Heading: ${s.heading.toFixed(0)}&deg;` : ""}
          <br/><span style="cursor:pointer;display:inline-block;margin-top:6px;padding:3px 10px;background:#22d3ee22;border:1px solid #22d3ee44;border-radius:6px;color:#22d3ee;font-size:10px;font-weight:600" onclick="window.__openStaffDM&&window.__openStaffDM('${s.userId}','${escapeHtml(s.name)}')">💬 Message ${escapeHtml(s.name.split(" ")[0])}</span>
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
        description: (() => {
          const narrative = parseIncidentNarrative(inc.description ?? "");
          return `<div style="font-family:monospace;font-size:11px;line-height:1.7">
            <b>${escapeHtml(inc.title)}</b>
            <div style="margin:4px 0"><span style="color:${color};font-weight:bold;padding:1px 6px;border-radius:3px;background:${color}22">${escapeHtml(inc.severity.toUpperCase())}</span> <span style="opacity:0.6">${escapeHtml(inc.status.toUpperCase())}</span></div>
            ${narrative ? `<div style="opacity:0.85;margin:4px 0">${escapeHtml(narrative)}</div>` : ""}
            ${inc.location ? `<div style="opacity:0.5;font-size:10px">📍 ${escapeHtml(inc.location)}</div>` : ""}
            ${inc.reportedBy ? `<div style="opacity:0.5;font-size:10px">👤 ${escapeHtml(inc.reportedBy)}${inc.assignedTo ? ` → ${escapeHtml(inc.assignedTo)}` : ""}</div>` : ""}
            <div style="opacity:0.3;font-size:9px;margin-top:4px">${new Date(inc.createdAt).toLocaleString()}</div>
          </div>`;
        })(),
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

      // No saved bounds — but only open aligner if we've finished loading
      // (prevents the aligner from opening while the async bounds fetch is in progress)
      if (!aligningOp && isAdmin && boundsLoaded.has(op.id) && !boundsLoading.has(op.id)) {
        setAligningOp(op);
      }
    });
  }, [operations, layers.siteOverlays, layers.siteOverlayOpacity, loading, savedBounds, aligningOp, isAdmin, boundsLoaded, boundsLoading]);

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
            },
            description: desc,
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
  }, [layers.satellite, loading]);

  // ─── Sentinel-1 SAR Layer ────────────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    if (entityGroupsRef.current.sentinel1Layer) {
      try { viewer.imageryLayers.remove(entityGroupsRef.current.sentinel1Layer, false); } catch {}
      entityGroupsRef.current.sentinel1Layer = null;
    }
    if (layers.sentinel1) {
      entityGroupsRef.current.sentinel1Layer = addSentinel1Layer(viewer, Cesium);
    }
  }, [layers.sentinel1, loading]);

  // ─── Sentinel-2 Optical Layer ──────────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    if (entityGroupsRef.current.sentinel2Layer) {
      try { viewer.imageryLayers.remove(entityGroupsRef.current.sentinel2Layer, false); } catch {}
      entityGroupsRef.current.sentinel2Layer = null;
    }
    if (layers.sentinel2) {
      entityGroupsRef.current.sentinel2Layer = addSentinel2Layer(viewer, Cesium);
    }
  }, [layers.sentinel2, loading]);

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
  }, [layers.flirThermal, loading]);

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
  }, [layers.crtMode, loading]);

  // ─── Live Aircraft (OpenSky Network) ───────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Clear old aircraft entities
    (entityGroupsRef.current.aircraft ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch {}
    });
    entityGroupsRef.current.aircraft = [];

    if (!layers.aircraft) return;

    // Get bounding box from operations or use CONUS
    const op = operations.find(o => o.lat && o.lng);
    const center = op ? { lat: op.lat, lng: op.lng } : { lat: 39.83, lng: -98.58 };
    const bbox = getBoundingBox(center.lat, center.lng, 200); // 200km radius

    function fetchAndRender() {
      getAircraft(bbox.south, bbox.north, bbox.west, bbox.east).then(planes => {
        // Clear old
        (entityGroupsRef.current.aircraft ?? []).forEach((e: { id: string }) => {
          try { viewer.entities.removeById(e.id); } catch {}
        });
        entityGroupsRef.current.aircraft = [];

        planes.slice(0, 100).forEach(plane => {
          if (plane.onGround) return;
          const entity = viewer.entities.add({
            id: `plane-${plane.icao24}`,
            name: plane.callsign || plane.icao24,
            position: Cesium.Cartesian3.fromDegrees(plane.lng, plane.lat, plane.altitude),
            billboard: {
              image: createPinCanvas("#38bdf8", "flag"),
              scale: 0.4,
              rotation: -plane.heading * (Math.PI / 180),
            },
            label: {
              text: `${plane.callsign || plane.icao24}\n${formatAltitude(plane.altitude)}`,
              font: "9px monospace",
              fillColor: Cesium.Color.fromCssColorString("#38bdf8"),
              outlineColor: Cesium.Color.BLACK,
              outlineWidth: 2,
              style: Cesium.LabelStyle.FILL_AND_OUTLINE,
              pixelOffset: new Cesium.Cartesian2(0, -18),
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
              scale: 0.8,
            },
            description: `<div style="font-family:monospace;font-size:11px;line-height:1.7">
              <b>${plane.callsign || plane.icao24}</b>
              <div>ICAO: ${plane.icao24}</div>
              <div>Alt: ${formatAltitude(plane.altitude)}</div>
              <div>Speed: ${formatSpeed(plane.velocity)}</div>
              <div>Heading: ${plane.heading.toFixed(0)}&deg;</div>
              <div>V/S: ${plane.verticalRate > 0 ? "+" : ""}${(plane.verticalRate * 196.85).toFixed(0)} fpm</div>
            </div>`,
          });
          entityGroupsRef.current.aircraft.push(entity);
        });
      }).catch(() => {});
    }

    fetchAndRender();
    const interval = setInterval(fetchAndRender, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, [layers.aircraft, loading, operations]);

  // ─── Satellite Orbits (CelesTrak) ──────────────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    (entityGroupsRef.current.orbits ?? []).forEach((e: { id: string }) => {
      try { viewer.entities.removeById(e.id); } catch {}
    });
    entityGroupsRef.current.orbits = [];

    if (!layers.satelliteOrbits) return;

    getSatellitePositions(30).then(sats => {
      sats.forEach((sat, i) => {
        const satColor = sat.name.includes("SENTINEL-1") ? "#ef4444"
          : sat.name.includes("SENTINEL-2") ? "#22c55e"
          : sat.name.includes("WORLDVIEW") || sat.name.includes("GEOEYE") ? "#f97316"
          : "#6b7280";

        // Current position marker
        const entity = viewer.entities.add({
          id: `sat-${i}`,
          name: sat.name,
          position: Cesium.Cartesian3.fromDegrees(sat.lng, sat.lat, sat.altitude * 1000),
          point: {
            pixelSize: 6,
            color: Cesium.Color.fromCssColorString(satColor),
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 1,
          },
          label: {
            text: sat.name,
            font: "8px monospace",
            fillColor: Cesium.Color.fromCssColorString(satColor),
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(8, 0),
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
            scale: 0.8,
          },
          description: `<div style="font-family:monospace;font-size:11px;line-height:1.7">
            <b>${sat.name}</b>
            <div>Alt: ${sat.altitude.toFixed(0)} km</div>
            <div>Speed: ${sat.velocity.toFixed(1)} km/s</div>
            <div>Lat: ${sat.lat.toFixed(3)}&deg; Lng: ${sat.lng.toFixed(3)}&deg;</div>
          </div>`,
        });
        entityGroupsRef.current.orbits.push(entity);

        // Ground track polyline (async)
        computeGroundTrack(sat.tle1, sat.tle2, 90, 1).then(track => {
          if (track.length > 2) {
            const trackEntity = viewer.entities.add({
              id: `sat-track-${i}`,
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(track.flatMap(([lng, lat]: [number, number]) => [lng, lat])),
                width: 1,
                material: Cesium.Color.fromCssColorString(satColor).withAlpha(0.3),
              },
            });
            entityGroupsRef.current.orbits.push(trackEntity);
          }
        }).catch(() => {});
      });
    }).catch(() => {});

    // Refresh satellite positions every 60s
    const interval = setInterval(() => {
      // Just re-trigger the effect by toggling a counter
    }, 60000);
    return () => clearInterval(interval);
  }, [layers.satelliteOrbits, loading]);

  // ─── Breadcrumb Trails (patrol history) ──────────────
  // Renders + refreshes every 60s while enabled
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    function renderTrails() {
      if (!viewer || !Cesium) return;
      // Clear old breadcrumb entities
      (entityGroupsRef.current.breadcrumbs ?? []).forEach((e: { id: string }) => {
        try { viewer.entities.removeById(e.id); } catch {}
      });
      entityGroupsRef.current.breadcrumbs = [];

      if (!layers.breadcrumbs || staff.length === 0) return;

      const isTimeMachine = timeMachineOpen && debouncedReplayTime < Date.now() - 5000;
      staff.forEach(s => {
        const trailPromise = isTimeMachine
          ? getLocationHistoryAt(s.userId, companyId, 4, debouncedReplayTime)
          : getLocationHistory(s.userId, companyId, 4);
        trailPromise.then(trail => {
          if (trail.length < 2) return;
          // Remove existing trail for this user first
          try { viewer.entities.removeById(`trail-${s.userId}`); } catch {}
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
    }

    // Render immediately
    renderTrails();

    // Refresh trails every 60s
    const interval = setInterval(renderTrails, 60000);
    return () => clearInterval(interval);
  }, [staff, layers.breadcrumbs, loading, companyId, timeMachineOpen, debouncedReplayTime]);

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

  return {
    nearbyPOIs,
    geofenceAlerts,
    aligningOp, setAligningOp,
    savedBounds, setSavedBounds,
  };
}
