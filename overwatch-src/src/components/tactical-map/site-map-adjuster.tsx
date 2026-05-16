"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Move, Check, X, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { logger } from "@/lib/logger";
import type { SiteMapBounds, GeoPoint } from "@/lib/supabase/db-operations";

interface SiteMapAdjusterProps {
  bounds: SiteMapBounds;
  /** Site map image URL — used to texture the live preview primitive. */
  imageUrl: string;
  /** Current site-overlay opacity (0..1) — matches the main render. */
  opacity: number;
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

export function SiteMapAdjuster({ bounds, imageUrl, opacity, onSave, onCancel }: SiteMapAdjusterProps) {
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

  // ─── Live preview primitive ──────────────────────────────────
  //
  // The main overlay primitive (rendered by useCesiumLayers) is hidden
  // while this adjuster is mounted (see adjustingOpId in the hook). The
  // adjuster owns its own preview primitive: a textured Cesium polygon
  // that gets rebuilt as the user drags corners. Rebuild is coalesced
  // via requestAnimationFrame so 60 mousemove events become at most one
  // primitive rebuild per frame.
  //
  // Terrain heights are sampled ONCE at mount (using the original
  // corner positions) and cached. Small adjustments stay flush to the
  // ground; larger moves accept some height drift in the preview, which
  // the post-Save main render fixes by re-sampling. This avoids racing
  // terrain samples against drag updates.
  const previewPrimitiveRef = useRef<unknown>(null);
  const sampledHeightsRef = useRef<[number, number, number, number] | null>(null);
  const cornersRef = useRef(corners);
  useEffect(() => { cornersRef.current = corners; }, [corners]);

  // Step 1: sample terrain once on mount.
  useEffect(() => {
    const viewer = window.__tacticalMapViewer;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium) return;
    let cancelled = false;

    const c = corners; // closure over the seed (we run once)
    const cornerCartos = [
      Cesium.Cartographic.fromDegrees(c.c00.lng, c.c00.lat),
      Cesium.Cartographic.fromDegrees(c.c01.lng, c.c01.lat),
      Cesium.Cartographic.fromDegrees(c.c11.lng, c.c11.lat),
      Cesium.Cartographic.fromDegrees(c.c10.lng, c.c10.lat),
    ];

    const setHeights = (h: [number, number, number, number]) => {
      if (cancelled) return;
      sampledHeightsRef.current = h;
    };

    const terrainProvider = viewer.terrainProvider;
    const isEllipsoid = terrainProvider instanceof Cesium.EllipsoidTerrainProvider;
    if (isEllipsoid) {
      setHeights([0, 0, 0, 0]);
    } else {
      Cesium.sampleTerrainMostDetailed(terrainProvider, cornerCartos)
        .then((sampled: Array<{ height: number }>) => {
          setHeights([
            sampled[0]?.height ?? 0,
            sampled[1]?.height ?? 0,
            sampled[2]?.height ?? 0,
            sampled[3]?.height ?? 0,
          ]);
        })
        .catch((err: unknown) => {
          logger.swallow("site-map-adjuster:terrain-sample", err, "warn");
          setHeights([0, 0, 0, 0]);
        });
    }

    return () => { cancelled = true; };
    // Intentionally [] — sample only at mount. Subsequent corner moves
    // reuse the cached heights to avoid restarting the terrain fetch
    // on every drag tick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Step 2: rebuild the preview primitive when corners change.
  // Coalesced via requestAnimationFrame so rapid setCorners during a
  // drag batch into one rebuild per frame.
  useEffect(() => {
    const viewer = window.__tacticalMapViewer;
    const Cesium = window.Cesium;
    if (!viewer || !Cesium) return;

    let rafId: number | null = null;
    let cancelled = false;

    const rebuild = () => {
      rafId = null;
      if (cancelled) return;
      // Viewer torn down between scheduling and running — bail.
      if (viewer.isDestroyed?.()) return;
      const heights = sampledHeightsRef.current;
      if (!heights) {
        // Terrain sample hasn't resolved yet — try again next frame.
        rafId = requestAnimationFrame(rebuild);
        return;
      }
      const c = cornersRef.current;
      try {
        const positions = [
          Cesium.Cartesian3.fromDegrees(c.c00.lng, c.c00.lat, heights[0] + 0.5),
          Cesium.Cartesian3.fromDegrees(c.c01.lng, c.c01.lat, heights[1] + 0.5),
          Cesium.Cartesian3.fromDegrees(c.c11.lng, c.c11.lat, heights[2] + 0.5),
          Cesium.Cartesian3.fromDegrees(c.c10.lng, c.c10.lat, heights[3] + 0.5),
        ];
        const stCoords = new Cesium.PolygonHierarchy([
          new Cesium.Cartesian2(0, 1), // c00
          new Cesium.Cartesian2(0, 0), // c01
          new Cesium.Cartesian2(1, 0), // c11
          new Cesium.Cartesian2(1, 1), // c10
        ]);
        const geom = new Cesium.PolygonGeometry({
          polygonHierarchy: new Cesium.PolygonHierarchy(positions),
          textureCoordinates: stCoords,
          perPositionHeight: true,
          vertexFormat: Cesium.MaterialAppearance.MaterialSupport.TEXTURED.vertexFormat,
        });
        const instance = new Cesium.GeometryInstance({ geometry: geom });
        const primitive = new Cesium.Primitive({
          geometryInstances: instance,
          appearance: new Cesium.MaterialAppearance({
            materialSupport: Cesium.MaterialAppearance.MaterialSupport.TEXTURED,
            material: Cesium.Material.fromType("Image", {
              image: imageUrl,
              color: new Cesium.Color(1, 1, 1, opacity),
              transparent: true,
            }),
            translucent: true,
          }),
          asynchronous: false,
        });

        // Add the new primitive BEFORE removing the old one — minimizes
        // the visible gap (no flicker). Then drop the stale ref.
        viewer.scene.primitives.add(primitive);
        const oldPrim = previewPrimitiveRef.current;
        previewPrimitiveRef.current = primitive;
        if (oldPrim) {
          try { viewer.scene.primitives.remove(oldPrim); }
          catch (e) { logger.swallow("site-map-adjuster:remove-old-preview", e); }
        }
      } catch (e) {
        logger.swallow("site-map-adjuster:rebuild-preview", e, "warn");
      }
    };

    rafId = requestAnimationFrame(rebuild);

    return () => {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [corners, imageUrl, opacity]);

  // Step 3: dispose the preview primitive on unmount (Save/Cancel).
  useEffect(() => {
    return () => {
      const viewer = window.__tacticalMapViewer;
      const prim = previewPrimitiveRef.current;
      if (viewer && prim && !viewer.isDestroyed?.()) {
        try { viewer.scene.primitives.remove(prim); }
        catch (e) { logger.swallow("site-map-adjuster:dispose-preview", e); }
      }
      previewPrimitiveRef.current = null;
    };
  }, []);

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

  // Corner handles use a single, neutral style — white circle with a
  // dark border. Industry-standard for map editors (Google Maps, Leaflet,
  // Mapbox all use this convention). Lets the colorful site map underneath
  // be the visual focus instead of the controls.
  const CORNER_KEYS: CornerKey[] = ["c00", "c10", "c01", "c11"];

  return (
    <>
      {/* Direct-drag handles, projected onto the canvas every frame */}
      {CORNER_KEYS.map((key) => {
        const pos = screenPositions[key];
        const isActive = dragging === key;
        return (
          <div
            key={key}
            title="Drag corner to fine-tune"
            onMouseDown={(e) => startCornerDrag(e, key)}
            className={`fixed z-40 -ml-2.5 -mt-2.5 h-5 w-5 rounded-full bg-white border-2 border-[#0f1a2e] shadow-lg cursor-grab active:cursor-grabbing transition-transform ${isActive ? "scale-150 ring-4 ring-white/40" : "hover:scale-125"}`}
            style={{
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              display: pos.visible ? "block" : "none",
              pointerEvents: pos.visible ? "auto" : "none",
            }}
          />
        );
      })}

      {/* Center MOVE handle — same visual language as corners but
          larger and carries a move icon so its purpose is unambiguous. */}
      {(() => {
        const pos = screenPositions.center;
        const isActive = dragging === "center";
        return (
          <div
            title="Drag to move the whole overlay"
            onMouseDown={startCenterDrag}
            className={`fixed z-40 -ml-4 -mt-4 h-8 w-8 rounded-full bg-white border-2 border-[#0f1a2e] shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing transition-transform ${isActive ? "scale-125 ring-4 ring-white/40" : "hover:scale-110"}`}
            style={{
              left: `${pos.x}px`,
              top: `${pos.y}px`,
              display: pos.visible ? "flex" : "none",
              pointerEvents: pos.visible ? "auto" : "none",
            }}
          >
            <Move className="h-4 w-4 text-[#0f1a2e]" />
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
