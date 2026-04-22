/**
 * Incident Density Heatmap Layer
 *
 * Renders a canvas-based heatmap of incident locations as a
 * Cesium imagery overlay. Hot spots glow red, cool areas fade to transparent.
 */

import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";
import type { IncidentPin } from "../types";

interface UseHeatmapLayerParams {
  viewerRef: CesiumRef;
  cesiumRef: CesiumRef;
  entityGroupsRef: EntityGroupsRef;
  loading: boolean;
  layers: LayerVisibility;
  incidents: IncidentPin[];
}

/**
 * Generate a heatmap canvas from lat/lng points within a bounding box.
 */
function generateHeatmapCanvas(
  points: { lat: number; lng: number; weight?: number }[],
  bounds: { west: number; south: number; east: number; north: number },
  width = 512,
  height = 256,
  radius = 20,
): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d")!;

  const lngSpan = bounds.east - bounds.west;
  const latSpan = bounds.north - bounds.south;

  // Draw each point as a radial gradient
  for (const p of points) {
    const x = ((p.lng - bounds.west) / lngSpan) * width;
    const y = ((bounds.north - p.lat) / latSpan) * height;
    const weight = p.weight ?? 1;

    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius * weight);
    gradient.addColorStop(0, "rgba(255, 0, 0, 0.6)");
    gradient.addColorStop(0.4, "rgba(255, 100, 0, 0.3)");
    gradient.addColorStop(0.7, "rgba(255, 200, 0, 0.1)");
    gradient.addColorStop(1, "rgba(255, 255, 0, 0)");

    ctx.fillStyle = gradient;
    ctx.fillRect(x - radius * weight, y - radius * weight, radius * weight * 2, radius * weight * 2);
  }

  return canvas;
}

export function useHeatmapLayer(params: UseHeatmapLayerParams) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, incidents } = params;
  const layerRef = useRef<unknown>(null);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium || loading) return;

    // Remove existing heatmap layer
    if (layerRef.current) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        viewer.imageryLayers.remove(layerRef.current as any, true);
      } catch (e) { logger.swallow("heatmap:remove", e); }
      layerRef.current = null;
    }

    // Only render when incidents layer is on and there are incidents with coordinates
    if (!layers.incidents || incidents.length === 0) return;

    const pointsWithCoords = incidents.filter(i => i.lat && i.lng);
    if (pointsWithCoords.length < 3) return; // Need at least 3 points for a meaningful heatmap

    // Calculate bounding box with padding
    const lats = pointsWithCoords.map(i => i.lat);
    const lngs = pointsWithCoords.map(i => i.lng);
    const padding = 0.5; // degrees
    const bounds = {
      west: Math.min(...lngs) - padding,
      south: Math.min(...lats) - padding,
      east: Math.max(...lngs) + padding,
      north: Math.max(...lats) + padding,
    };

    // Weight by severity
    const severityWeight: Record<string, number> = {
      critical: 2.0,
      high: 1.5,
      medium: 1.0,
      low: 0.7,
    };

    const points = pointsWithCoords.map(i => ({
      lat: i.lat,
      lng: i.lng,
      weight: severityWeight[i.severity ?? "medium"] ?? 1.0,
    }));

    try {
      const canvas = generateHeatmapCanvas(points, bounds, 512, 256, 15);
      const dataUrl = canvas.toDataURL("image/png");

      const provider = new Cesium.SingleTileImageryProvider({
        url: dataUrl,
        rectangle: Cesium.Rectangle.fromDegrees(bounds.west, bounds.south, bounds.east, bounds.north),
      });

      const layer = viewer.imageryLayers.addImageryProvider(provider);
      layer.alpha = 0.5;
      layerRef.current = layer;
    } catch (e) {
      logger.swallow("heatmap:render", e, "warn");
    }

    return () => {
      if (layerRef.current) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          viewer.imageryLayers.remove(layerRef.current as any, true);
        } catch (e) { logger.swallow("heatmap:cleanup", e); }
        layerRef.current = null;
      }
    };
  }, [viewerRef, cesiumRef, entityGroupsRef, loading, layers.incidents, incidents]);
}
