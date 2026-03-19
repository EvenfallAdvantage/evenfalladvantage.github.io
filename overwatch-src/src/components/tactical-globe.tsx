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
  }, []);

  return (
    <div className="absolute inset-0 pointer-events-none" style={{ clipPath: "inset(-999px 0px -999px 0px)" }} aria-hidden="true">
      <canvas
        ref={canvasRef}
        style={{
          width: "min(1800px, 160vw)",
          height: "min(1800px, 160vw)",
          position: "absolute",
          left: "50%",
          bottom: 0,
          transform: "translateX(-40%) translateY(72%)",
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
