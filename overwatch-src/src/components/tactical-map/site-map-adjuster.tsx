"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Move, Check, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteMapBounds } from "@/lib/supabase/db-operations";

interface SiteMapAdjusterProps {
  bounds: SiteMapBounds;
  onSave: (bounds: SiteMapBounds) => void;
  onCancel: () => void;
}

/**
 * Interactive site map overlay adjuster.
 *
 * Renders 4 draggable corner handles over the Cesium viewer that let
 * the user stretch, skew, and reposition the site map overlay by
 * dragging corners on the globe. Changes are applied live to the
 * imagery layer bounds.
 *
 * The corners map to: NW (north-west), NE, SE, SW of the rectangle.
 */
export function SiteMapAdjuster({ bounds, onSave, onCancel }: SiteMapAdjusterProps) {
  const [corners, setCorners] = useState({
    nw: { lat: bounds.north, lng: bounds.west },
    ne: { lat: bounds.north, lng: bounds.east },
    se: { lat: bounds.south, lng: bounds.east },
    sw: { lat: bounds.south, lng: bounds.west },
  });
  const [dragging, setDragging] = useState<"nw" | "ne" | "se" | "sw" | "center" | null>(null);
  const [dragStart, setDragStart] = useState<{ lat: number; lng: number } | null>(null);
  const originalCorners = useRef(corners);

  // Convert current corners back to bounds format
  const toBounds = useCallback((): SiteMapBounds => {
    const lats = [corners.nw.lat, corners.ne.lat, corners.se.lat, corners.sw.lat];
    const lngs = [corners.nw.lng, corners.ne.lng, corners.se.lng, corners.sw.lng];
    return {
      north: Math.max(...lats),
      south: Math.min(...lats),
      east: Math.max(...lngs),
      west: Math.min(...lngs),
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
          nw: { lat: prev.nw.lat + dlat, lng: prev.nw.lng + dlng },
          ne: { lat: prev.ne.lat + dlat, lng: prev.ne.lng + dlng },
          se: { lat: prev.se.lat + dlat, lng: prev.se.lng + dlng },
          sw: { lat: prev.sw.lat + dlat, lng: prev.sw.lng + dlng },
        }));
        setDragStart({ lat, lng });
      } else if (dragging) {
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

  // Calculate center position for the move handle
  const center = {
    lat: (corners.nw.lat + corners.se.lat) / 2,
    lng: (corners.nw.lng + corners.se.lng) / 2,
  };

  return (
    <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <div
        className="flex items-center gap-2 rounded-xl backdrop-blur-md border border-white/10 px-4 py-2.5"
        style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 92%, transparent)" }}
      >
        <Move className="h-4 w-4 text-amber-400" />
        <span className="text-xs font-mono text-white/70">Drag corners to adjust site map</span>

        <div className="flex gap-1.5 ml-3">
          {/* Corner drag buttons */}
          {(["nw", "ne", "sw", "se"] as const).map((corner) => (
            <button
              key={corner}
              onMouseDown={(e) => {
                e.preventDefault();
                setDragging(corner);
              }}
              className={`px-2 py-1 rounded text-[9px] font-mono font-bold border transition-colors cursor-grab active:cursor-grabbing ${
                dragging === corner
                  ? "border-amber-400 bg-amber-400/20 text-amber-400"
                  : "border-white/20 text-white/50 hover:text-white hover:border-white/40"
              }`}
            >
              {corner.toUpperCase()}
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

      {/* Info: current bounds */}
      <div className="text-center mt-1">
        <span className="text-[8px] font-mono text-white/30">
          N:{corners.nw.lat.toFixed(4)} S:{corners.se.lat.toFixed(4)} E:{corners.ne.lng.toFixed(4)} W:{corners.nw.lng.toFixed(4)}
        </span>
      </div>
    </div>
  );
}
