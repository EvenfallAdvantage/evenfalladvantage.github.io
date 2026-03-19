"use client";

import { useEffect, useRef } from "react";
import createGlobe from "cobe";

export function TacticalGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let phi = 0;
    let rafId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const width = canvas.offsetWidth;

    const globe = createGlobe(canvas, {
      devicePixelRatio: 2,
      width: width * 2,
      height: width * 2,
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
        { location: [34.0522, -118.2437], size: 0.05 },
        { location: [40.7128, -74.006], size: 0.05 },
        { location: [51.5074, -0.1278], size: 0.04 },
        { location: [25.7617, -80.1918], size: 0.04 },
        { location: [29.7604, -95.3698], size: 0.04 },
        { location: [33.749, -84.388], size: 0.03 },
        { location: [47.6062, -122.3321], size: 0.03 },
        { location: [41.8781, -87.6298], size: 0.04 },
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
  }, []);

  return (
    <div className="relative w-full max-w-2xl mx-auto overflow-hidden" style={{ height: "clamp(160px, 22vw, 280px)" }}>
      <canvas
        ref={canvasRef}
        className="w-full aspect-square"
        style={{
          width: "100%",
          maxWidth: 600,
          margin: "0 auto",
          display: "block",
          position: "absolute",
          left: "50%",
          top: 0,
          transform: "translateX(-50%)",
        }}
      />
      {/* Fade-out at bottom edge */}
      <div
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: "60%",
          background: "linear-gradient(to bottom, transparent 0%, #0b1422 85%)",
        }}
      />
    </div>
  );
}
