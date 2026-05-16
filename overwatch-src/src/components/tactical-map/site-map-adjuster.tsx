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
 * Renders 4 direct-drag corner handles + a center MOVE handle directly
 * over the Cesium viewer. The user grabs a handle and drags it across
 * the globe to reposition that corner; corners support full rotation,
 * shear, and non-uniform scale (the result is a SiteMapQuad).
 *
 * Corners are named in IMAGE space (matching SiteMapQuad):
 *   c00 = image (0, 0) top-left
 *   c10 = image (1, 0) top-right
 *   c11 = image (1, 1) bottom-right
 *   c01 = image (0, 1) bottom-left
 *
 * Legacy axis-aligned bounds passed in are seeded as a north-up
 * rectangle so existing site maps keep their initial placement.
 *
 * The handles are HTML elements positioned via
 * `Cesium.SceneTransforms.worldToWindowCoordinates`, refreshed every
 * animation frame so they stay glued to the overlay as the camera
 * moves, rotates, or zooms.
 */
type CornerKey = "c00" | "c10" | "c11" | "c01";
type HandleKey = CornerKey | "center";

interface ScreenPos { x: number; y: number; visible: boolean }
type ScreenPositions = Record<HandleKey, ScreenPos>;

const HIDDEN_POS: ScreenPos = { x: 0, y: 0, visible: false };
const INITIAL_SCREEN_POSITIONS: ScreenPositions = {
  c00: HIDDEN_POS, c10: HIDDEN_POS, c11: HIDDEN_POS, c01: HIDDEN_POS,
  center: HIDDEN_POS,
};

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
  const [dragging, setDragging] = useState<HandleKey | null>(null);
  const [dragStart, setDragStart] = useState<GeoPoint | null>(null);
  const [screenPositions, setScreenPositions] = useState<ScreenPositions>(INITIAL_SCREEN_POSITIONS);
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

  // Centroid of the quad — used for the MOVE handle's anchor lat/lng.
  const center: GeoPoint = {
    lat: (corners.c00.lat + corners.c10.lat + corners.c11.lat + corners.c01.lat) / 4,
    lng: (corners.c00.lng + corners.c10.lng + corners.c11.lng + corners.c01.lng) / 4,
  };

  // ─── Drive screen-space handle positions ────────────────────
  // Project the 4 corner lat/lngs + the centroid to canvas pixels every
  // animation frame so handles stay glued to the overlay as the camera
  // moves/zooms/rotates. We use requestAnimationFrame instead of
  // Cesium's preRender event so the React tree drives the loop.
  useEffect(() => {
    const viewer = window.__tacticalMapViewer;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium) return;

    let frameId: number;
    let cancelled = false;

    const project = (lat: number, lng: number): ScreenPos => {
      try {
        const cartesian = Cesium.Cartesian3.fromDegrees(lng, lat);
        const win = Cesium.SceneTransforms.worldToWindowCoordinates(viewer.scene, cartesian);
        if (!win || !Number.isFinite(win.x) || !Number.isFinite(win.y)) return HIDDEN_POS;
        // Convert canvas-relative pixels to viewport-relative (for fixed positioning)
        const rect = (viewer.scene.canvas as HTMLCanvasElement).getBoundingClientRect();
        return { x: win.x + rect.left, y: win.y + rect.top, visible: true };
      } catch {
        return HIDDEN_POS;
      }
    };

    const tick = () => {
      if (cancelled) return;
      setScreenPositions({
        c00: project(corners.c00.lat, corners.c00.lng),
        c10: project(corners.c10.lat, corners.c10.lng),
        c11: project(corners.c11.lat, corners.c11.lng),
        c01: project(corners.c01.lat, corners.c01.lng),
        center: project(center.lat, center.lng),
      });
      frameId = requestAnimationFrame(tick);
    };
    frameId = requestAnimationFrame(tick);

    return () => {
      cancelled = true;
      cancelAnimationFrame(frameId);
    };
  }, [corners, center.lat, center.lng]);

  // ─── Drag handler ───────────────────────────────────────────
  useEffect(() => {
    if (!dragging) return;
    // Capture the dragged handle into a local — narrows the type for
    // the closure and protects against `dragging` becoming null
    // mid-flight (the effect cleanup re-runs in that case anyway).
    const activeHandle: HandleKey = dragging;

    function handleMouseMove(e: MouseEvent) {
      const viewer = window.__tacticalMapViewer;
      const Cesium = window.Cesium;
      if (!viewer || !Cesium) return;

      // Convert viewport → canvas-relative for Cesium picking
      const rect = (viewer.scene.canvas as HTMLCanvasElement).getBoundingClientRect();
      const canvasX = e.clientX - rect.left;
      const canvasY = e.clientY - rect.top;

      // Prefer pickPosition (uses depth buffer — accurate over terrain
      // and 3D buildings). Fall back to globe ray-pick if depth pick
      // misses (e.g. mouse over sky).
      let cartesian = viewer.scene.pickPosition({ x: canvasX, y: canvasY });
      if (!cartesian) {
        const ray = viewer.camera.getPickRay({ x: canvasX, y: canvasY });
        if (!ray) return;
        cartesian = viewer.scene.globe.pick(ray, viewer.scene);
        if (!cartesian) return;
      }

      const carto = Cesium.Cartographic.fromCartesian(cartesian);
      const lat = Cesium.Math.toDegrees(carto.latitude);
      const lng = Cesium.Math.toDegrees(carto.longitude);

      if (activeHandle === "center" && dragStart) {
        const dlat = lat - dragStart.lat;
        const dlng = lng - dragStart.lng;
        setCorners(prev => ({
          c00: { lat: prev.c00.lat + dlat, lng: prev.c00.lng + dlng },
          c10: { lat: prev.c10.lat + dlat, lng: prev.c10.lng + dlng },
          c11: { lat: prev.c11.lat + dlat, lng: prev.c11.lng + dlng },
          c01: { lat: prev.c01.lat + dlat, lng: prev.c01.lng + dlng },
        }));
        setDragStart({ lat, lng });
      } else if (activeHandle !== "center") {
        setCorners(prev => ({ ...prev, [activeHandle]: { lat, lng } }));
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

  function startCornerDrag(e: React.MouseEvent, key: CornerKey) {
    e.preventDefault();
    e.stopPropagation();
    setDragging(key);
  }

  function startCenterDrag(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragging("center");
    setDragStart(center);
  }

  // Corner handle visual config. Slightly bigger, color-coded by
  // image-space corner so the user can match handle ↔ source-image edge.
  const CORNER_STYLE: Record<CornerKey, { color: string; ring: string; hint: string }> = {
    c00: { color: "bg-amber-400",   ring: "ring-amber-300",   hint: "Top-left (image origin)" },
    c10: { color: "bg-cyan-400",    ring: "ring-cyan-300",    hint: "Top-right" },
    c01: { color: "bg-emerald-400", ring: "ring-emerald-300", hint: "Bottom-left" },
    c11: { color: "bg-fuchsia-400", ring: "ring-fuchsia-300", hint: "Bottom-right" },
  };

  return (
    <>
      {/* Direct-drag handles, projected onto the canvas every frame */}
      {(Object.keys(CORNER_STYLE) as CornerKey[]).map((key) => {
        const pos = screenPositions[key];
        const cfg = CORNER_STYLE[key];
        const isActive = dragging === key;
        return (
          <div
            key={key}
            title={cfg.hint}
            onMouseDown={(e) => startCornerDrag(e, key)}
            className={`fixed z-40 -ml-3 -mt-3 h-6 w-6 rounded-full border-2 border-white shadow-lg cursor-grab active:cursor-grabbing transition-transform ${cfg.color} ${isActive ? `scale-125 ring-4 ${cfg.ring}/60` : "hover:scale-110"}`}
            style={{
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              display: pos.visible ? "block" : "none",
              pointerEvents: pos.visible ? "auto" : "none",
            }}
          />
        );
      })}

      {/* Center MOVE handle */}
      {(() => {
        const pos = screenPositions.center;
        const isActive = dragging === "center";
        return (
          <div
            title="Drag to move the whole overlay"
            onMouseDown={startCenterDrag}
            className={`fixed z-40 -ml-4 -mt-4 h-8 w-8 rounded-full bg-white/90 border-2 border-blue-500 shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform ${isActive ? "scale-125 ring-4 ring-blue-400/60" : "hover:scale-110"}`}
            style={{
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              display: pos.visible ? "flex" : "none",
              pointerEvents: pos.visible ? "auto" : "none",
            }}
          >
            <Move className="h-4 w-4 text-blue-600" />
          </div>
        );
      })()}

      {/* Toolbar — just Reset / Cancel / Save now */}
      <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
        <div
          className="flex items-center gap-2 rounded-xl backdrop-blur-md border border-white/10 px-4 py-2.5"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 92%, transparent)" }}
        >
          <Move className="h-4 w-4 text-amber-400" />
          <span className="text-xs font-mono text-white/70">Drag the colored handles to fine-tune</span>

          <div className="flex gap-1 ml-3">
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

        {/* Info: axis-aligned bbox of the quad */}
        <div className="text-center mt-1">
          <span className="text-[8px] font-mono text-white/30">
            N:{Math.max(corners.c00.lat, corners.c10.lat, corners.c11.lat, corners.c01.lat).toFixed(4)}
            {" "}S:{Math.min(corners.c00.lat, corners.c10.lat, corners.c11.lat, corners.c01.lat).toFixed(4)}
            {" "}E:{Math.max(corners.c00.lng, corners.c10.lng, corners.c11.lng, corners.c01.lng).toFixed(4)}
            {" "}W:{Math.min(corners.c00.lng, corners.c10.lng, corners.c11.lng, corners.c01.lng).toFixed(4)}
          </span>
        </div>
      </div>
    </>
  );
}
