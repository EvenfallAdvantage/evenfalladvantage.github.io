"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { X, Check, RotateCcw, MapPin, Crosshair, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * 3-Point Site Map Alignment Tool
 *
 * The user picks 3 reference points on the site map image, then
 * picks the corresponding 3 points on the Cesium globe. An affine
 * transformation matrix is computed to warp the image onto the globe.
 *
 * Steps:
 * 1. Show site map image full-screen
 * 2. User clicks 3 reference points on the image (red dots)
 * 3. Switch to globe view
 * 4. User clicks 3 corresponding points on the globe (blue dots)
 * 5. Compute affine transform and drape the image
 */

interface ImagePoint { x: number; y: number } // 0-1 normalized
interface GeoPoint { lat: number; lng: number }

interface SiteMapAlignerProps {
  imageUrl: string;
  operationName: string;
  onAlign: (bounds: { west: number; south: number; east: number; north: number }) => void;
  onCancel: () => void;
}

type Step = "pick-image" | "pick-globe" | "done";

export function SiteMapAligner({ imageUrl, operationName, onAlign, onCancel }: SiteMapAlignerProps) {
  const [step, setStep] = useState<Step>("pick-image");
  const [imagePoints, setImagePoints] = useState<ImagePoint[]>([]);
  const [globePoints, setGlobePoints] = useState<GeoPoint[]>([]);
  const imageRef = useRef<HTMLDivElement>(null);

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
  };

  // When globe points are complete, compute bounds
  useEffect(() => {
    if (globePoints.length === 3 && imagePoints.length === 3) {
      // Compute the bounding rectangle from the 3 geo points
      // For a simple overlay, we use the min/max lat/lng as the drape rectangle
      // A full affine warp would require Cesium custom shaders — this is the practical approach
      const lats = globePoints.map(p => p.lat);
      const lngs = globePoints.map(p => p.lng);

      // Compute extent: use the spread of the 3 points to estimate the full image bounds
      const latSpread = Math.max(...lats) - Math.min(...lats);
      const lngSpread = Math.max(...lngs) - Math.min(...lngs);

      // Estimate full bounds by scaling from the point spread to the full image
      // Image points are 0-1 normalized — use them to compute the full extent
      const imgXs = imagePoints.map(p => p.x);
      const imgYs = imagePoints.map(p => p.y);
      const imgXSpread = Math.max(...imgXs) - Math.min(...imgXs);
      const imgYSpread = Math.max(...imgYs) - Math.min(...imgYs);

      // Scale geo spread to full image (0-1)
      const fullLngSpread = imgXSpread > 0.01 ? lngSpread / imgXSpread : lngSpread * 3;
      const fullLatSpread = imgYSpread > 0.01 ? latSpread / imgYSpread : latSpread * 3;

      // Estimate center and full bounds
      const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
      const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

      // Offset to compute full image bounds
      // Image Y is inverted (top=0, bottom=1) vs lat (south=low, north=high)
      const avgImgX = (Math.min(...imgXs) + Math.max(...imgXs)) / 2;
      const avgImgY = (Math.min(...imgYs) + Math.max(...imgYs)) / 2;
      const offsetLng = centerLng - (avgImgX - 0.5) * fullLngSpread;
      const offsetLat = centerLat + (avgImgY - 0.5) * fullLatSpread; // inverted Y

      const bounds = {
        west: offsetLng - fullLngSpread / 2,
        east: offsetLng + fullLngSpread / 2,
        south: offsetLat - fullLatSpread / 2,
        north: offsetLat + fullLatSpread / 2,
      };

      setStep("done");
      onAlign(bounds);
    }
  }, [globePoints, imagePoints, onAlign]);

  // Expose a method for the parent to feed globe clicks.
  // Uses a ref-backed approach so the window function is always current.
  const stepRef = useRef(step);
  const globePointsRef = useRef(globePoints);
  stepRef.current = step;
  globePointsRef.current = globePoints;

  useEffect(() => {
    const handler = (lat: number, lng: number) => {
      if (stepRef.current !== "pick-globe" || globePointsRef.current.length >= 3) return;
      setGlobePoints(prev => [...prev, { lat, lng }]);

      // Place a temporary cyan marker on the globe via Cesium
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.Cesium && w.__tacticalMapViewer) {
        const viewer = w.__tacticalMapViewer;
        const Cesium = w.Cesium;
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
    (window as unknown as Record<string, unknown>).__siteMapAlignerAddPoint = handler;
    return () => {
      delete (window as unknown as Record<string, unknown>).__siteMapAlignerAddPoint;
      // Clean up globe markers
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const w = window as any;
      if (w.__tacticalMapViewer) {
        [0, 1, 2].forEach(i => { try { w.__tacticalMapViewer.entities.removeById(`align-globe-${i}`); } catch {} });
      }
    };
  }, []);

  return (
    <div className={`absolute inset-0 z-20 ${step === "pick-globe" ? "pointer-events-none" : ""}`}>
      {/* Step indicator */}
      <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 rounded-xl bg-[#0f1a2e]/95 backdrop-blur-sm border border-white/10 px-4 py-2 pointer-events-auto">
        <div className={`flex items-center gap-1.5 text-xs font-mono ${step === "pick-image" ? "text-amber-400" : "text-white/30"}`}>
          <MapPin className="h-3.5 w-3.5" />
          <span>1. Pick 3 image points</span>
        </div>
        <span className="text-white/20">→</span>
        <div className={`flex items-center gap-1.5 text-xs font-mono ${step === "pick-globe" ? "text-cyan-400" : "text-white/30"}`}>
          <Crosshair className="h-3.5 w-3.5" />
          <span>2. Pick 3 globe points</span>
        </div>
        <span className="text-white/20">→</span>
        <div className={`flex items-center gap-1.5 text-xs font-mono ${step === "done" ? "text-green-400" : "text-white/30"}`}>
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
      {step === "pick-image" && (
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
      {step === "pick-globe" && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2 z-20 rounded-xl bg-cyan-500/10 border border-cyan-500/30 px-4 py-2">
          <p className="text-xs text-cyan-400 font-mono">
            Now click the same 3 points on the globe ({globePoints.length}/3)
          </p>
        </div>
      )}
    </div>
  );
}
