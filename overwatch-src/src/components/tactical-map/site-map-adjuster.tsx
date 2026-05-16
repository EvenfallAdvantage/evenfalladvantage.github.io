"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Move, Check, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteMapBounds, GeoPoint } from "@/lib/supabase/db-operations";

interface SiteMapAdjusterProps {
  bounds: SiteMapBounds;
  onSave: (bounds: SiteMapBounds) => void;
  onCancel: () => void;
}

/**
 * Interactive site map overlay adjuster.
 *
 * Renders 4 draggable corner handles over the Cesium viewer that let
 * the user stretch, skew, rotate, and reposition the site map overlay
 * by dragging corners on the globe. Changes are saved as a full
 * `SiteMapQuad` so rotation/shear are preserved (not axis-aligned).
 *
 * Corners are named in IMAGE space (matching SiteMapQuad):
 *   c00 = image (0, 0) top-left
 *   c10 = image (1, 0) top-right
 *   c11 = image (1, 1) bottom-right
 *   c01 = image (0, 1) bottom-left
 *
 * Legacy axis-aligned bounds passed in are seeded as a north-up
 * rectangle so existing site maps keep their initial placement.
 */
type CornerKey = "c00" | "c10" | "c11" | "c01";

export function SiteMapAdjuster({ bounds, onSave, onCancel }: SiteMapAdjusterProps) {
  // Seed the four image-space corners from the incoming bounds. If a
  // quad is present, use it directly. Otherwise build a north-up quad
  // from the legacy w/s/e/n rectangle: image top-left = NW = (north, west).
  const seed = bounds.quad ?? {
    c00: { lat: bounds.north, lng: bounds.west }, // top-left = NW
    c10: { lat: bounds.north, lng: bounds.east }, // top-right = NE
    c11: { lat: bounds.south, lng: bounds.east }, // bottom-right = SE
    c01: { lat: bounds.south, lng: bounds.west }, // bottom-left = SW
  };
  const [corners, setCorners] = useState<Record<CornerKey, GeoPoint>>(seed);
  const [dragging, setDragging] = useState<CornerKey | "center" | null>(null);
  const [dragStart, setDragStart] = useState<GeoPoint | null>(null);
  const originalCorners = useRef(corners);

  // Convert the four corners back to a SiteMapBounds. The bbox is
  // re-derived from the quad so it stays consistent.
  const toBounds = useCallback((): SiteMapBounds => {
    const lats = [corners.c00.lat, corners.c10.lat, corners.c11.lat, corners.c01.lat];
    const lngs = [corners.c00.lng, corners.c10.lng, corners.c11.lng, corners.c01.lng];
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs),
      quad: { c00: corners.c00, c10: corners.c10, c11: corners.c11, c01: corners.c01 },
    };
  }, [corners]);

  // Handle globe clicks to move dragged corner
  useEffect(() => {
    if (!dragging) return;

    function handleMouseMove(e: MouseEvent) {
      // Access Cesium viewer via window global
      const viewer = window.__tacticalMapViewer;
      const Cesium = window.Cesium;
      if (!viewer || !Cesium) return;

      const cartesian = viewer.scene.pickPosition({ x: e.clientX, y: e.clientY });
      if (!cartesian) {
        // Fallback: ray-pick the globe
        const ray = viewer.camera.getPickRay({ x: e.clientX, y: e.clientY });
        if (!ray) return;
        const globePos = viewer.scene.globe.pick(ray, viewer.scene);
        if (!globePos) return;
        const carto = Cesium.Cartographic.fromCartesian(globePos);
        updateCorner(
          Cesium.Math.toDegrees(carto.latitude),
          Cesium.Math.toDegrees(carto.longitude)
        );
        return;
      }

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      updateCorner(
        Cesium.Math.toDegrees(carto.latitude),
        Cesium.Math.toDegrees(carto.longitude)
      );
    }

    function updateCorner(lat: number, lng: number) {
      if (dragging === "center" && dragStart) {
        // Move all corners by the delta
        const dlat = lat - dragStart.lat;
        const dlng = lng - dragStart.lng;
        setCorners(prev => ({
          c00: { lat: prev.c00.lat + dlat, lng: prev.c00.lng + dlng },
          c10: { lat: prev.c10.lat + dlat, lng: prev.c10.lng + dlng },
          c11: { lat: prev.c11.lat + dlat, lng: prev.c11.lng + dlng },
          c01: { lat: prev.c01.lat + dlat, lng: prev.c01.lng + dlng },
        }));
        setDragStart({ lat, lng });
      } else if (dragging && dragging !== "center") {
        setCorners(prev => ({ ...prev, [dragging]: { lat, lng } }));
      }
    }

    function handleMouseUp() {
      setDragging(null);
      setDragStart(null);
    }

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, dragStart]);

  function handleReset() {
    setCorners(originalCorners.current);
  }

  // Calculate center position for the move handle (centroid of the quad)
  const center: GeoPoint = {
    lat: (corners.c00.lat + corners.c10.lat + corners.c11.lat + corners.c01.lat) / 4,
    lng: (corners.c00.lng + corners.c10.lng + corners.c11.lng + corners.c01.lng) / 4,
  };

  // Human-readable corner labels — image-space names paired with a
  // compass hint for the north-up case. Order shown matches reading
  // order on a paper plan (top-left, top-right, bottom-left, bottom-right).
  const CORNER_LABELS: Array<{ key: CornerKey; label: string; hint: string }> = [
    { key: "c00", label: "TL", hint: "top-left" },
    { key: "c10", label: "TR", hint: "top-right" },
    { key: "c01", label: "BL", hint: "bottom-left" },
    { key: "c11", label: "BR", hint: "bottom-right" },
  ];

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <div
        className="flex items-center gap-2 rounded-xl backdrop-blur-md border border-white/10 px-4 py-2.5"
        style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 92%, transparent)" }}
      >
        <Move className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-mono text-white/70">Drag corners to adjust site map</span>

        <div className="flex gap-1.5 ml-3">
          {/* Corner drag buttons (image-space; TL/TR/BL/BR = image corners) */}
          {CORNER_LABELS.map(({ key, label, hint }) => (
            <button
              key={key}
              title={`Drag ${hint} image corner`}
              onMouseDown={(e) => {
                e.preventDefault();
                setDragging(key);
              }}
              className={`px-2 py-1 rounded text-[9px] font-mono font-bold border transition-colors cursor-grab active:cursor-grabbing ${
                dragging === key
                  ? "border-amber-400 bg-amber-400/20 text-amber-400"
                  : "border-white/20 text-white/50 hover:text-white hover:border-white/40"
              }`}
            >
              {label}
            </button>
          ))}
          <button
            onMouseDown={(e) => {
              e.preventDefault();
              setDragging("center");
              setDragStart(center);
            }}
            className={`px-2 py-1 rounded text-[9px] font-mono font-bold border transition-colors cursor-grab active:cursor-grabbing ${
              dragging === "center"
                ? "border-blue-400 bg-blue-400/20 text-blue-400"
                : "border-white/20 text-white/50 hover:text-white hover:border-white/40"
            }`}
          >
            MOVE
          </button>
        </div>

        <div className="flex gap-1 ml-2">
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-white/50" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs text-red-400" onClick={onCancel}>
            <X className="h-3 w-3" /> Cancel
          </Button>
          <Button size="sm" className="h-7 gap-1 text-xs" onClick={() => onSave(toBounds())}>
            <Check className="h-3 w-3" /> Save
          </Button>
        </div>
      </div>

      {/* Info: current bounds (axis-aligned bbox of the quad) */}
      <div className="text-center mt-1">
        <span className="text-[8px] font-mono text-white/30">
          N:{Math.max(corners.c00.lat, corners.c10.lat, corners.c11.lat, corners.c01.lat).toFixed(4)}
          {" "}S:{Math.min(corners.c00.lat, corners.c10.lat, corners.c11.lat, corners.c01.lat).toFixed(4)}
          {" "}E:{Math.max(corners.c00.lng, corners.c10.lng, corners.c11.lng, corners.c01.lng).toFixed(4)}
          {" "}W:{Math.min(corners.c00.lng, corners.c10.lng, corners.c11.lng, corners.c01.lng).toFixed(4)}
        </span>
      </div>
    </div>
  );
}
