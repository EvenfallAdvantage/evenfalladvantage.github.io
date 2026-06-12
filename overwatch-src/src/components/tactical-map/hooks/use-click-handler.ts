import { useEffect, useRef, useState } from "react";
import type { ActiveTool, DrawMode } from "../map-tools";
import { haversineDistance, initialBearing, RANGE_RING_RADII_M, RANGE_RING_LABELS } from "../map-tools";
import type { Waypoint } from "../drone-planner";
import type { OperationPin } from "../types";
import { checkLineOfSight, renderLineOfSight, clearLineOfSight, getElevationProfile } from "../terrain-tools";
import { escapeHtml } from "@/lib/security";
import { createAnnotation } from "@/lib/supabase/db-annotations";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cesium viewer/module refs have no published TS types
type CesiumRef = React.MutableRefObject<any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Cesium entity collections keyed by layer name
type EntityGroupsRef = React.MutableRefObject<Record<string, any>>;

export function useCesiumClickHandler(params: {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  // Tool state from useMapTools
  activeTool: ActiveTool;
  measurePoint1: { lat: number; lng: number } | null;
  setMeasurePoint1: (v: { lat: number; lng: number } | null) => void;
  setMeasureResult: (v: { distanceM: number; distanceMi: number; bearing: number } | null) => void;
  rangeCenter: { lat: number; lng: number } | null;
  setRangeCenter: (v: { lat: number; lng: number } | null) => void;
  losPoint1: { lat: number; lng: number } | null;
  setLosPoint1: (v: { lat: number; lng: number } | null) => void;
  setLosResult: (v: { visible: boolean; distance?: number } | null) => void;
  losEntityIdsRef: React.MutableRefObject<string[]>;
  elevPoint1: { lat: number; lng: number } | null;
  setElevPoint1: (v: { lat: number; lng: number } | null) => void;
  setElevationStatus: (v: string | null) => void;
  // Drawing state from useAnnotations
  drawMode: DrawMode;
  drawColor: string;
  drawPoints: [number, number][];
  setDrawPoints: (v: [number, number][] | ((prev: [number, number][]) => [number, number][])) => void;
  // Drone state from useDronePlanner
  dronePlannerOpen: boolean;
  droneWaypoints: Waypoint[];
  setDroneWaypoints: (v: Waypoint[] | ((prev: Waypoint[]) => Waypoint[])) => void;
  // Aligner state from useCesiumLayers
  aligningOp: OperationPin | null;
  // Callbacks
  companyId: string;
  isAdmin?: boolean;
  onSelectOperation?: (id: string) => void;
}) {
  const {
    viewerRef, cesiumRef, entityGroupsRef: _entityGroupsRef, loading,
    activeTool, measurePoint1, setMeasurePoint1, setMeasureResult,
    rangeCenter: _rangeCenter, setRangeCenter,
    losPoint1, setLosPoint1, setLosResult, losEntityIdsRef,
    elevPoint1, setElevPoint1, setElevationStatus,
    drawMode, drawColor, drawPoints, setDrawPoints,
    dronePlannerOpen, droneWaypoints, setDroneWaypoints,
    aligningOp,
    companyId, isAdmin, onSelectOperation,
  } = params;

  const [selectedEntity, setSelectedEntity] = useState<{
    id: string; name: string; description: string; screenX: number; screenY: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    worldPosition?: any; // Cesium.Cartesian3 for follow-camera re-projection
  } | null>(null);
  const _popupAnimFrame = useRef<number>(0);

  // ─── Click handler (tools + entity selection) ────────
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

    // Single click — tools + entity picking
    handler.setInputAction((click: { position: { x: number; y: number } }) => {
      // Always try entity pick first (before globe.pick which may fail for billboards)
      const picked = viewer.scene.pick(click.position);

      // If we picked an entity and no tool is active, show popup
      if (activeTool === "none" && drawMode === "none" && !dronePlannerOpen && !aligningOp) {
        if (Cesium.defined(picked)) {
          if (picked.id?.id && (picked.id?.name || picked.id?.description)) {
            const entity = picked.id;
            const entityId = entity.id as string;

            const isAnnotation = entityId.startsWith("ann-");
            const annId = isAnnotation ? entityId.replace("ann-", "") : null;
            const deleteBtn = isAnnotation && isAdmin
              ? `<br/><br/><span style="cursor:pointer;color:#ef4444" onclick="window.__deleteAnnotation&&window.__deleteAnnotation('${annId}')">🗑 Delete this drawing</span>`
              : "";
            // Get world position for follow-camera re-projection
            const worldPos = entity.position?.getValue?.(viewer.clock.currentTime) ?? null;
            setSelectedEntity({
              id: entityId,
              name: entity.name ?? "",
              description: (entity.description?.getValue?.() ?? entity.description ?? "") + deleteBtn,
              screenX: click.position.x,
              screenY: click.position.y,
              worldPosition: worldPos,
            });
            return;
          }
          if (picked.getProperty) {
            const name = picked.getProperty("name") || picked.getProperty("building") || "Building";

            const height = picked.getProperty("cesium#estimatedHeight") || picked.getProperty("height");
            const type = picked.getProperty("building") || picked.getProperty("type") || "";
            const addr = picked.getProperty("addr:street") || "";
            const houseNum = picked.getProperty("addr:housenumber") || "";
            let desc = `<strong>${escapeHtml(String(name))}</strong>`;
            if (addr) desc += `<br/>${houseNum ? escapeHtml(String(houseNum)) + " " : ""}${escapeHtml(String(addr))}`;
            if (type && type !== name) desc += `<br/>Type: ${escapeHtml(String(type))}`;
            if (height) desc += `<br/>Height: ~${Math.round(Number(height))}m`;
            setSelectedEntity({
              id: `bldg-${click.position.x}-${click.position.y}`,
              name: String(name),
              description: desc,
              screenX: click.position.x,
              screenY: click.position.y,
            });
            return;
          }
        }
        // Clicked empty space — dismiss popup
        setSelectedEntity(null);
        return;
      }

      // Get globe position from click (needed for tools)
      const ray = viewer.camera.getPickRay(click.position);
      const cartesian = ray ? viewer.scene.globe.pick(ray, viewer.scene) : null;
      if (!cartesian) return;
      const lat = Cesium.Math.toDegrees(Cesium.Cartographic.fromCartesian(cartesian).latitude);
      const lng = Cesium.Math.toDegrees(Cesium.Cartographic.fromCartesian(cartesian).longitude);

      // Site map aligner — feed globe points
      const alignerFn = window.__siteMapAlignerAddPoint;
      if (alignerFn && aligningOp) {
        alignerFn(lat, lng);
        return;
      }

      // Drone planner — add waypoints
      if (dronePlannerOpen) {
        setDroneWaypoints(prev => [...prev, { lat, lng, altitude: 120, speed: 10 }]);
        // Place waypoint marker
        const wpIdx = droneWaypoints.length;
        viewer.entities.add({
          id: `drone-wp-${wpIdx}`,
          position: Cesium.Cartesian3.fromDegrees(lng, lat, 120),
          point: { pixelSize: 8, color: Cesium.Color.fromCssColorString("#8b5cf6"), outlineColor: Cesium.Color.WHITE, outlineWidth: 2 },
          label: { text: `WP${wpIdx + 1}`, font: "bold 9px monospace", fillColor: Cesium.Color.fromCssColorString("#8b5cf6"), pixelOffset: new Cesium.Cartesian2(0, -14), disableDepthTestDistance: Number.POSITIVE_INFINITY },
        });
        // Draw path line
        if (wpIdx > 0) {
          const prev = droneWaypoints[wpIdx - 1];
          viewer.entities.add({
            id: `drone-path-${wpIdx}`,
            polyline: {
              positions: Cesium.Cartesian3.fromDegreesArrayHeights([prev.lng, prev.lat, prev.altitude, lng, lat, 120]),
              width: 2,
              material: Cesium.Color.fromCssColorString("#8b5cf6").withAlpha(0.6),
            },
          });
        }
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
            heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
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
            point: { pixelSize: 8, color: Cesium.Color.LIME, outlineColor: Cesium.Color.BLACK, outlineWidth: 1, heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
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
            point: { pixelSize: 8, color: Cesium.Color.LIME, outlineColor: Cesium.Color.BLACK, outlineWidth: 1, heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
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
          point: { pixelSize: 8, color: Cesium.Color.CYAN, outlineColor: Cesium.Color.BLACK, outlineWidth: 1, heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND, disableDepthTestDistance: Number.POSITIVE_INFINITY },
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
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
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
              heightReference: Cesium.HeightReference.RELATIVE_TO_GROUND,
              disableDepthTestDistance: Number.POSITIVE_INFINITY,
            },
          });
        });
        return;
      }

      // Line of Sight tool
      if (activeTool === "los") {
        if (!losPoint1) {
          setLosPoint1({ lat, lng });
          setLosResult(null);
          // Clean up old LOS entities
          clearLineOfSight(viewer, losEntityIdsRef.current);
          losEntityIdsRef.current = [];
          viewer.entities.removeById("los-click-1");
          viewer.entities.add({
            id: "los-click-1",
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            point: { pixelSize: 8, color: Cesium.Color.LIME, outlineColor: Cesium.Color.BLACK, outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY },
            label: { text: "A", font: "bold 10px monospace", fillColor: Cesium.Color.LIME, pixelOffset: new Cesium.Cartesian2(0, -14), disableDepthTestDistance: Number.POSITIVE_INFINITY },
          });
        } else {
          viewer.entities.removeById("los-click-1");
          // Compute LOS
          const dist = haversineDistance(losPoint1.lat, losPoint1.lng, lat, lng);
          checkLineOfSight(Cesium, viewer, losPoint1.lat, losPoint1.lng, 2, lat, lng, 2).then(result => {
            clearLineOfSight(viewer, losEntityIdsRef.current);
            const ids = renderLineOfSight(Cesium, viewer, losPoint1.lat, losPoint1.lng, 2, lat, lng, 2, result.visible, result.obstructionIndex, result.profile);
            losEntityIdsRef.current = ids;
            setLosResult({ visible: result.visible, distance: dist });
          }).catch(() => {
            setLosResult({ visible: false });
          });
          setLosPoint1(null);
        }
        return;
      }

      // Elevation Profile tool
      if (activeTool === "elevation") {
        if (!elevPoint1) {
          setElevPoint1({ lat, lng });
          setElevationStatus(null);
          viewer.entities.removeById("elev-click-1");
          viewer.entities.add({
            id: "elev-click-1",
            position: Cesium.Cartesian3.fromDegrees(lng, lat),
            point: { pixelSize: 8, color: Cesium.Color.YELLOW, outlineColor: Cesium.Color.BLACK, outlineWidth: 1, disableDepthTestDistance: Number.POSITIVE_INFINITY },
            label: { text: "START", font: "bold 9px monospace", fillColor: Cesium.Color.YELLOW, pixelOffset: new Cesium.Cartesian2(0, -14), disableDepthTestDistance: Number.POSITIVE_INFINITY },
          });
        } else {
          viewer.entities.removeById("elev-click-1");
          setElevationStatus("Sampling terrain...");
          const dist = haversineDistance(elevPoint1.lat, elevPoint1.lng, lat, lng);
          getElevationProfile(Cesium, viewer, elevPoint1.lat, elevPoint1.lng, lat, lng, 80).then(profile => {
            if (profile.length < 2) { setElevationStatus("Not enough data"); return; }
            const maxElev = Math.max(...profile.map(p => p.elevation));
            const minElev = Math.min(...profile.map(p => p.elevation));
            const gain = profile[profile.length - 1].elevation - profile[0].elevation;
            setElevationStatus(
              `${(dist / 1000).toFixed(2)} km | Min: ${Math.round(minElev)}m | Max: ${Math.round(maxElev)}m | Gain: ${gain > 0 ? "+" : ""}${Math.round(gain)}m`
            );
            // Draw the profile as a polyline on the map
            viewer.entities.removeById("elev-line");
            const positions = profile.flatMap(p => [p.lng, p.lat]);
            viewer.entities.add({
              id: "elev-line",
              polyline: {
                positions: Cesium.Cartesian3.fromDegreesArray(positions),
                width: 3,
                material: new Cesium.PolylineGlowMaterialProperty({ glowPower: 0.2, color: Cesium.Color.YELLOW.withAlpha(0.8) }),
                clampToGround: true,
              },
            });
          }).catch(() => {
            setElevationStatus("Terrain sampling failed");
          });
          setElevPoint1(null);
        }
        return;
      }

      // Entity picking is handled at the top of this handler (before tools).
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
  }, [loading, onSelectOperation, activeTool, measurePoint1, losPoint1, elevPoint1, aligningOp, drawMode, drawColor, drawPoints, companyId, dronePlannerOpen, droneWaypoints, viewerRef, cesiumRef, isAdmin, losEntityIdsRef, setDrawPoints, setDroneWaypoints, setElevPoint1, setElevationStatus, setLosPoint1, setLosResult, setMeasurePoint1, setMeasureResult, setRangeCenter]);

  // Dismiss popup when camera moves (user is navigating away)
  // Use a short delay to avoid dismissing immediately on click (which can
  // Follow-camera: re-project popup position on every render frame
  // so it stays attached to its entity during pan/zoom/tilt.
  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || !selectedEntity?.worldPosition) return;

    let frameId: ReturnType<typeof requestAnimationFrame>;
    const update = () => {
      if (!viewerRef.current || !selectedEntity?.worldPosition) return;
      const screenPos = Cesium.SceneTransforms.worldToWindowCoordinates(
        viewer.scene, selectedEntity.worldPosition
      );
      if (screenPos) {
        setSelectedEntity(prev => prev ? { ...prev, screenX: screenPos.x, screenY: screenPos.y } : null);
      }
      frameId = requestAnimationFrame(update);
    };
    // Start tracking after a short delay to avoid initial jitter
    const timer = setTimeout(() => { frameId = requestAnimationFrame(update); }, 500);

    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frameId);
    };
  }, [selectedEntity?.id, selectedEntity?.worldPosition, viewerRef, cesiumRef]);

  return { selectedEntity, setSelectedEntity };
}
