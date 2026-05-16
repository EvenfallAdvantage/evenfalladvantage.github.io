"use client";

import { useState, useRef, useCallback, useEffect, useMemo } from "react";
import { logger } from "@/lib/logger";
import { X, Check, RotateCcw, MapPin, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SiteMapBounds, SiteMapQuad } from "@/lib/supabase/db-site-bounds";

/**
 * 3-Point Site Map Alignment Tool
 *
 * The user picks 3 reference points on the site map image, then
 * picks the corresponding 3 points on the Cesium globe. A full 2D
 * affine transformation is solved from the 3 point pairs and used
 * to extrapolate the four image corners onto the globe. The result
 * is a quadrilateral that correctly handles rotation, non-uniform
 * scale, and shear — fixing the prior north-up-only assumption.
 *
 * Steps:
 * 1. Show site map image full-screen
 * 2. User clicks 3 reference points on the image (red dots)
 * 3. Switch to globe view
 * 4. User clicks 3 corresponding points on the globe (blue dots)
 * 5. Solve affine and drape the image as a quad
 */

interface ImagePoint { x: number; y: number } // 0-1 normalized
interface GeoPoint { lat: number; lng: number }

interface SiteMapAlignerProps {
  imageUrl: string;
  operationName: string;
  onAlign: (bounds: SiteMapBounds) => void;
  onCancel: () => void;
}

/**
 * Solve a 3x3 linear system `M · x = b` by Cramer's rule. Returns
 * null if the matrix is (near-)singular — typically when the 3 image
 * points are collinear, in which case the affine transform is
 * under-determined.
 */
function solve3x3(
  m: [[number, number, number], [number, number, number], [number, number, number]],
  b: [number, number, number],
): [number, number, number] | null {
  const det = (
    m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1])
    - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0])
    + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0])
  );
  if (Math.abs(det) < 1e-12) return null;

  function detReplaceCol(col: number): number {
    const a: number[][] = m.map(row => [...row]);
    for (let i = 0; i < 3; i++) a[i][col] = b[i];
    return (
      a[0][0] * (a[1][1] * a[2][2] - a[1][2] * a[2][1])
      - a[0][1] * (a[1][0] * a[2][2] - a[1][2] * a[2][0])
      + a[0][2] * (a[1][0] * a[2][1] - a[1][1] * a[2][0])
    );
  }

  return [detReplaceCol(0) / det, detReplaceCol(1) / det, detReplaceCol(2) / det];
}

/**
 * Solve the 2D affine transform `geo = A · image + t` from 3 (image, geo)
 * pairs. Returns the 6 coefficients (a, b, c, d, e, f) such that:
 *   lng = a*x + b*y + c
 *   lat = d*x + e*y + f
 * Returns null if the image points are collinear.
 */
function solveAffine(
  imagePoints: ImagePoint[],
  geoPoints: GeoPoint[],
): { a: number; b: number; c: number; d: number; e: number; f: number } | null {
  const M: [[number, number, number], [number, number, number], [number, number, number]] = [
    [imagePoints[0].x, imagePoints[0].y, 1],
    [imagePoints[1].x, imagePoints[1].y, 1],
    [imagePoints[2].x, imagePoints[2].y, 1],
  ];
  const lng: [number, number, number] = [geoPoints[0].lng, geoPoints[1].lng, geoPoints[2].lng];
  const lat: [number, number, number] = [geoPoints[0].lat, geoPoints[1].lat, geoPoints[2].lat];

  const lngCoef = solve3x3(M, lng);
  const latCoef = solve3x3(M, lat);
  if (!lngCoef || !latCoef) return null;

  return { a: lngCoef[0], b: lngCoef[1], c: lngCoef[2], d: latCoef[0], e: latCoef[1], f: latCoef[2] };
}

/**
 * Apply the affine transform to image (0..1) coordinates to produce a
 * full quadrilateral covering the source image. Corners are named in
 * image space (c00 = top-left, c10 = top-right, c11 = bottom-right,
 * c01 = bottom-left). For a north-up image these correspond to NW/NE/
 * SE/SW respectively; for a rotated image the same image-space corners
 * may land at arbitrary compass positions.
 */
function buildQuadFromAffine(t: { a: number; b: number; c: number; d: number; e: number; f: number }): SiteMapQuad {
  const at = (x: number, y: number): GeoPoint => ({
    lng: t.a * x + t.b * y + t.c,
    lat: t.d * x + t.e * y + t.f,
  });
  return {
    c00: at(0, 0),
    c10: at(1, 0),
    c11: at(1, 1),
    c01: at(0, 1),
  };
}

type Step = "pick-image" | "pick-globe" | "done";

export function SiteMapAligner({ imageUrl, operationName, onAlign, onCancel }: SiteMapAlignerProps) {
  const [step, setStep] = useState<Step>("pick-image");
  const [imagePoints, setImagePoints] = useState<ImagePoint[]>([]);
  const [globePoints, setGlobePoints] = useState<GeoPoint[]>([]);
  const imageRef = useRef<HTMLDivElement>(null);
  const alignedRef = useRef(false);

  const handleImageClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (imagePoints.length >= 3) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width;
    const y = (e.clientY - rect.top) / rect.height;
    const newPoints = [...imagePoints, { x, y }];
    setImagePoints(newPoints);
    if (newPoints.length === 3) {
      // Auto-advance to globe picking after a brief delay
      setTimeout(() => setStep("pick-globe"), 500);
    }
  }, [imagePoints]);

  const handleReset = () => {
    setImagePoints([]);
    setGlobePoints([]);
    setStep("pick-image");
    alignedRef.current = false;
  };

  // Derive "done" status from point counts (avoid setState in effect)
  const isDone = globePoints.length === 3 && imagePoints.length === 3;
  const effectiveStep: Step = isDone ? "done" : step;

  // Solve the affine transform from the 3 (image, geo) pairs at render
  // time. Result is null until we have 3 of each, or if the points are
  // collinear (under-determined system). The error message is derived,
  // not stored — no setState-in-effect needed.
  const alignResult = useMemo<
    | { kind: "incomplete" }
    | { kind: "collinear" }
    | { kind: "ok"; bounds: SiteMapBounds }
  >(() => {
    if (!isDone) return { kind: "incomplete" };
    const affine = solveAffine(imagePoints, globePoints);
    if (!affine) return { kind: "collinear" };
    const quad = buildQuadFromAffine(affine);
    const lats = [quad.c00.lat, quad.c10.lat, quad.c11.lat, quad.c01.lat];
    const lngs = [quad.c00.lng, quad.c10.lng, quad.c11.lng, quad.c01.lng];
    return {
      kind: "ok",
      bounds: {
        west: Math.min(...lngs),
        east: Math.max(...lngs),
        south: Math.min(...lats),
        north: Math.max(...lats),
        quad,
      },
    };
  }, [isDone, imagePoints, globePoints]);

  const solveError = alignResult.kind === "collinear"
    ? "The 3 image points are collinear. Pick 3 points that form a triangle (not on a line) and try again."
    : null;

  // Notify the parent exactly once when a valid alignment becomes
  // available. The ref guards against React 19 strict-mode double-effect.
  useEffect(() => {
    if (alignResult.kind === "ok" && !alignedRef.current) {
      alignedRef.current = true;
      onAlign(alignResult.bounds);
    }
  }, [alignResult, onAlign]);

  // Expose a method for the parent to feed globe clicks.
  // Uses a ref-backed approach so the window function is always current.
  const stepRef = useRef(effectiveStep);
  const globePointsRef = useRef(globePoints);
  useEffect(() => { stepRef.current = effectiveStep; });
  useEffect(() => { globePointsRef.current = globePoints; });

  useEffect(() => {
    const handler = (lat: number, lng: number) => {
      if (stepRef.current !== "pick-globe" || globePointsRef.current.length >= 3) return;
      setGlobePoints(prev => [...prev, { lat, lng }]);

      // Place a temporary cyan marker on the globe via Cesium
      if (window.Cesium && window.__tacticalMapViewer) {
        const viewer = window.__tacticalMapViewer;
        const Cesium = window.Cesium;
        const idx = globePointsRef.current.length; // 0-based index of the point just added
        viewer.entities.add({
          id: `align-globe-${idx}`,
          position: Cesium.Cartesian3.fromDegrees(lng, lat),
          point: {
            pixelSize: 10,
            color: Cesium.Color.CYAN,
            outlineColor: Cesium.Color.WHITE,
            outlineWidth: 2,
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
          label: {
            text: String(idx + 1),
            font: "bold 12px monospace",
            fillColor: Cesium.Color.WHITE,
            outlineColor: Cesium.Color.BLACK,
            outlineWidth: 2,
            style: Cesium.LabelStyle.FILL_AND_OUTLINE,
            pixelOffset: new Cesium.Cartesian2(0, -16),
            heightReference: Cesium.HeightReference.CLAMP_TO_GROUND,
            disableDepthTestDistance: Number.POSITIVE_INFINITY,
          },
        });
      }
    };
    window.__siteMapAlignerAddPoint = handler;
    return () => {
      delete window.__siteMapAlignerAddPoint;
      // Clean up globe markers
      if (window.__tacticalMapViewer) {
        [0, 1, 2].forEach(i => { try { window.__tacticalMapViewer!.entities.removeById(`align-globe-${i}`); } catch (e) { logger.swallow("site-map-aligner:cleanup", e); } });
      }
    };
  }, []);

  return (
    <div className={`absolute inset-0 z-20 ${effectiveStep === "pick-globe" ? "pointer-events-none" : ""}`}>
      {/* Step indicator */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl bg-[#0f1a2e]/95 backdrop-blur-sm border border-white/10 px-4 py-2 pointer-events-auto">
        <div className={`flex items-center gap-1.5 text-xs font-mono ${effectiveStep === "pick-image" ? "text-amber-400" : "text-white/30"}`}>
          <MapPin className="h-3.5 w-3.5" />
          <span>1. Pick 3 image points</span>
        </div>
        <span className="text-white/20">→</span>
        <div className={`flex items-center gap-1.5 text-xs font-mono ${effectiveStep === "pick-globe" ? "text-cyan-400" : "text-white/30"}`}>
          <Crosshair className="h-3.5 w-3.5" />
          <span>2. Pick 3 globe points</span>
        </div>
        <span className="text-white/20">→</span>
        <div className={`flex items-center gap-1.5 text-xs font-mono ${effectiveStep === "done" ? "text-green-400" : "text-white/30"}`}>
          <Check className="h-3.5 w-3.5" />
          <span>3. Aligned</span>
        </div>

        <div className="ml-4 flex gap-1">
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-[10px]" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" /> Reset
          </Button>
          <Button size="sm" variant="ghost" className="h-7 gap-1 text-[10px] text-red-400" onClick={onCancel}>
            <X className="h-3 w-3" /> Cancel
          </Button>
        </div>
      </div>

      {/* Image picking overlay */}
      {effectiveStep === "pick-image" && (
        <div className="absolute inset-0 z-20 bg-black/80 flex items-center justify-center">
          <div className="relative max-w-[80vw] max-h-[80vh]">
            <p className="text-center text-xs text-amber-400 font-mono mb-2">
              Click 3 reference points on the site map ({imagePoints.length}/3)
            </p>
            <div
              ref={imageRef}
              className="relative cursor-crosshair select-none"
              onClick={handleImageClick}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={imageUrl} alt={operationName} className="max-w-[80vw] max-h-[70vh] object-contain rounded-lg" draggable={false} />
              {/* Placed points */}
              {imagePoints.map((p, i) => (
                <div
                  key={i}
                  className="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-red-500 bg-red-500/30 flex items-center justify-center"
                  style={{ left: `${p.x * 100}%`, top: `${p.y * 100}%` }}
                >
                  <span className="text-[8px] font-bold text-white">{i + 1}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Globe picking overlay (just the instruction banner — globe is visible underneath) */}
      {effectiveStep === "pick-globe" && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-4 py-2 pointer-events-auto">
          <p className="text-xs text-cyan-400 font-mono">
            Now click the same 3 points on the globe ({globePoints.length}/3)
          </p>
        </div>
      )}

      {/* Solve error (e.g. collinear image points) */}
      {solveError && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-30 max-w-md rounded-xl bg-red-500/15 border border-red-500/40 px-4 py-2 pointer-events-auto">
          <p className="text-xs text-red-300 font-mono leading-snug">{solveError}</p>
          <Button size="sm" variant="ghost" className="mt-1 h-6 gap-1 text-[10px]" onClick={handleReset}>
            <RotateCcw className="h-3 w-3" /> Reset and try again
          </Button>
        </div>
      )}
    </div>
  );
}
