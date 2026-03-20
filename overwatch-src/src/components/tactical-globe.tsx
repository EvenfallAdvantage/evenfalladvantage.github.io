"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import createGlobe from "cobe";

const MQ = "(max-width: 768px)";

export function TacticalGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const subscribe = useCallback((cb: () => void) => {
    const mq = window.matchMedia(MQ);
    mq.addEventListener("change", cb);
    return () => mq.removeEventListener("change", cb);
  }, []);
  const isMobile = useSyncExternalStore(
    subscribe,
    () => window.matchMedia(MQ).matches,
    () => false,
  );

  useEffect(() => {
    if (isMobile) return;
    let phi = 0;
    let rafId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const cssWidth = canvas.offsetWidth;
    // Cap internal resolution so buffer (cobeSize * dpr) stays under GPU max texture size (4096)
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cobeSize = Math.min(cssWidth, Math.floor(4096 / dpr));

    const markerLocations: [number, number][] = [
      [34.0522, -118.2437],
      [40.7128, -74.006],
      [51.5074, -0.1278],
      [25.7617, -80.1918],
      [29.7604, -95.3698],
      [33.749, -84.388],
      [47.6062, -122.3321],
      [41.8781, -87.6298],
    ];

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: cobeSize,
      height: cobeSize,
      phi: 0,
      theta: 0.45,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 4,
      baseColor: [0.12, 0.18, 0.28],
      markerColor: [0.87, 0.55, 0.2],
      glowColor: [0.08, 0.12, 0.2],
      markers: markerLocations.map((location) => ({ location, size: 0.01 })),
    });

    let t = 0;
    function animate() {
      phi += 0.003;
      t += 0.04;
      // Pulse markers between 0.008 and 0.018
      const pulse = 0.008 + 0.01 * (0.5 + 0.5 * Math.sin(t));
      globe.update({
        phi,
        markers: markerLocations.map((location) => ({ location, size: pulse })),
      });
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      globe.destroy();
    };
  }, [isMobile]);

  if (isMobile) return null;

  return (
    <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <canvas
        ref={canvasRef}
        style={{
          width: "min(3200px, 280vw)",
          height: "min(3200px, 280vw)",
          position: "absolute",
          left: "50%",
          bottom: 0,
          transform: "translateX(-50%) translateY(72%)",
        }}
      />
      {/* Orbiting Satellites */}
      <div
        className="absolute"
        style={{
          width: "min(3200px, 280vw)",
          height: "min(3200px, 280vw)",
          left: "50%",
          bottom: 0,
          transform: "translateX(-50%) translateY(72%)",
          pointerEvents: "none",
        }}
      >
        {/* Satellite 1 — wide elliptical orbit */}
        <div className="absolute inset-0" style={{ animation: "orbit1 18s linear infinite" }}>
          <div
            className="absolute"
            style={{
              width: 4,
              height: 4,
              borderRadius: "50%",
              background: "#dd8c33",
              boxShadow: "0 0 8px 2px rgba(221,140,51,0.6), 0 0 20px 4px rgba(221,140,51,0.2)",
              top: "12%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
        {/* Satellite 2 — tilted orbit, slower */}
        <div className="absolute inset-0" style={{ animation: "orbit2 26s linear infinite" }}>
          <div
            className="absolute"
            style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: "#8ab4f8",
              boxShadow: "0 0 6px 2px rgba(138,180,248,0.5), 0 0 16px 4px rgba(138,180,248,0.15)",
              top: "18%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
        {/* Satellite 3 — tight fast orbit */}
        <div className="absolute inset-0" style={{ animation: "orbit3 12s linear infinite" }}>
          <div
            className="absolute"
            style={{
              width: 3,
              height: 3,
              borderRadius: "50%",
              background: "#fff",
              boxShadow: "0 0 6px 1px rgba(255,255,255,0.6), 0 0 14px 3px rgba(255,255,255,0.15)",
              top: "22%",
              left: "50%",
              transform: "translate(-50%, -50%)",
            }}
          />
        </div>
      </div>

      {/* Fade-out at bottom edge */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: "30%",
          background: "linear-gradient(to bottom, transparent 0%, #0b1422 90%)",
        }}
      />

      {/* Satellite orbit keyframes */}
      <style>{`
        @keyframes orbit1 {
          0%   { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes orbit2 {
          0%   { transform: rotate(120deg) rotateX(55deg); }
          100% { transform: rotate(480deg) rotateX(55deg); }
        }
        @keyframes orbit3 {
          0%   { transform: rotate(240deg) rotateX(-35deg); }
          100% { transform: rotate(600deg) rotateX(-35deg); }
        }
      `}</style>
    </div>
  );
}
