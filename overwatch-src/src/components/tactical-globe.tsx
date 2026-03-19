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

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: cobeSize,
      height: cobeSize,
      phi: 0,
      theta: 0.25,
      dark: 1,
      diffuse: 1.2,
      mapSamples: 16000,
      mapBrightness: 4,
      baseColor: [0.12, 0.18, 0.28],
      markerColor: [0.87, 0.55, 0.2],
      glowColor: [0.08, 0.12, 0.2],
      markers: [
        { location: [34.0522, -118.2437], size: 0.03 },
        { location: [40.7128, -74.006], size: 0.03 },
        { location: [51.5074, -0.1278], size: 0.02 },
        { location: [25.7617, -80.1918], size: 0.02 },
        { location: [29.7604, -95.3698], size: 0.02 },
        { location: [33.749, -84.388], size: 0.02 },
        { location: [47.6062, -122.3321], size: 0.02 },
        { location: [41.8781, -87.6298], size: 0.02 },
      ],
    });

    function animate() {
      phi += 0.003;
      globe.update({ phi });
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
          transform: "translateX(-50%) translateY(76%)",
        }}
      />
      {/* Fade-out at bottom edge */}
      <div
        className="absolute bottom-0 left-0 right-0"
        style={{
          height: "30%",
          background: "linear-gradient(to bottom, transparent 0%, #0b1422 90%)",
        }}
      />
    </div>
  );
}
