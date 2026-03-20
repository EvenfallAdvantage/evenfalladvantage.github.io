"use client";

import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import createGlobe from "cobe";

const MQ = "(max-width: 768px)";

/* ── CSS-drawn satellite: body + two solar-panel wings ── */
function CssSatellite({ scale = 1.5, rotate = 0 }: { scale?: number; rotate?: number }) {
  const s = scale;
  const panelW = 14 * s;
  const panelH = 5 * s;
  const bodyW = 6 * s;
  const bodyH = 8 * s;
  const gap = s;
  const r = s * 0.8;

  return (
    <div
      style={{
        position: "relative",
        width: bodyW,
        height: bodyH,
        transform: `rotate(${rotate}deg)`,
        filter: `drop-shadow(0 0 ${4 * s}px rgba(255,255,255,0.35))`,
      }}
    >
      {/* Left solar panel */}
      <div
        style={{
          position: "absolute",
          right: `calc(100% + ${gap}px)`,
          top: "50%",
          transform: "translateY(-50%)",
          width: panelW,
          height: panelH,
          background: "linear-gradient(135deg, #5a80b0 0%, #3a5a85 50%, #5a80b0 100%)",
          borderRadius: r,
          border: `${Math.max(0.5, s * 0.3)}px solid rgba(255,255,255,0.2)`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(90deg, transparent, transparent ${3 * s}px, rgba(255,255,255,0.1) ${3 * s}px, rgba(255,255,255,0.1) ${3.5 * s}px)`,
          }}
        />
      </div>
      {/* Body */}
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "linear-gradient(180deg, #e8e8e8 0%, #b0b0b0 40%, #d0d0d0 100%)",
          borderRadius: s * 1.5,
          boxShadow: `0 0 ${6 * s}px rgba(255,255,255,0.5), 0 0 ${14 * s}px rgba(255,255,255,0.12)`,
        }}
      />
      {/* Right solar panel */}
      <div
        style={{
          position: "absolute",
          left: `calc(100% + ${gap}px)`,
          top: "50%",
          transform: "translateY(-50%)",
          width: panelW,
          height: panelH,
          background: "linear-gradient(135deg, #5a80b0 0%, #3a5a85 50%, #5a80b0 100%)",
          borderRadius: r,
          border: `${Math.max(0.5, s * 0.3)}px solid rgba(255,255,255,0.2)`,
          overflow: "hidden",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `repeating-linear-gradient(90deg, transparent, transparent ${3 * s}px, rgba(255,255,255,0.1) ${3 * s}px, rgba(255,255,255,0.1) ${3.5 * s}px)`,
          }}
        />
      </div>
      {/* Antenna mast + dish (below body, pointing toward globe) */}
      <div
        style={{
          position: "absolute",
          top: "100%",
          left: "50%",
          transform: "translateX(-50%)",
          width: Math.max(0.8, s * 0.6),
          height: 4 * s,
          background: "rgba(255,255,255,0.45)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: `calc(100% + ${3.5 * s}px)`,
          left: "50%",
          transform: "translateX(-50%)",
          width: 4 * s,
          height: 2 * s,
          borderRadius: "0 0 50% 50%",
          background: "radial-gradient(ellipse at center, rgba(255,255,255,0.45), rgba(200,200,200,0.25))",
          border: `${Math.max(0.5, s * 0.3)}px solid rgba(255,255,255,0.25)`,
        }}
      />
    </div>
  );
}

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
      markers: markerLocations.map((location) => ({ location, size: 0.003 })),
    });

    let t = 0;
    function animate() {
      phi += 0.003;
      t += 0.04;
      // Pulse markers between 0.002 and 0.004 — small surface-hugging dots
      const pulse = 0.002 + 0.002 * (0.5 + 0.5 * Math.sin(t));
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

      {/* ── Orbiting Satellites ──
           Each orbit = a container centered on the globe that rotates 360°.
           The satellite sits at a fixed radius (top %) from center.
           Different rotateY tilts on the plane wrapper create crisscrossing orbits.
           The hero's overflow-hidden clips satellites when they rotate below the viewport. */}
      <div
        style={{
          position: "absolute",
          width: "min(3200px, 280vw)",
          height: "min(3200px, 280vw)",
          left: "50%",
          bottom: 0,
          transform: "translateX(-50%) translateY(72%)",
          pointerEvents: "none",
          perspective: 4000,
          transformStyle: "preserve-3d",
        }}
      >
        {/* Orbit 1 — tilted right, clockwise, 30s */}
        <div style={{ position: "absolute", inset: 0, transform: "rotateY(14deg)", transformStyle: "preserve-3d" }}>
          <div style={{ position: "absolute", inset: 0, animation: "orbitCW 30s linear infinite", transformStyle: "preserve-3d" }}>
            <div style={{ position: "absolute", top: "7%", left: "50%", transform: "translate(-50%, -50%)" }}>
              <CssSatellite scale={1.8} rotate={15} />
            </div>
          </div>
        </div>
        {/* Orbit 2 — tilted left, counter-clockwise, 24s */}
        <div style={{ position: "absolute", inset: 0, transform: "rotateY(-18deg)", transformStyle: "preserve-3d" }}>
          <div style={{ position: "absolute", inset: 0, animation: "orbitCCW 24s linear infinite", transformStyle: "preserve-3d" }}>
            <div style={{ position: "absolute", top: "9%", left: "50%", transform: "translate(-50%, -50%)" }}>
              <CssSatellite scale={1.5} rotate={-10} />
            </div>
          </div>
        </div>
        {/* Orbit 3 — tilted forward + slight right, clockwise, 38s */}
        <div style={{ position: "absolute", inset: 0, transform: "rotateX(10deg) rotateY(6deg)", transformStyle: "preserve-3d" }}>
          <div style={{ position: "absolute", inset: 0, animation: "orbitCW 38s linear infinite", transformStyle: "preserve-3d" }}>
            <div style={{ position: "absolute", top: "5%", left: "50%", transform: "translate(-50%, -50%)" }}>
              <CssSatellite scale={1.6} rotate={22} />
            </div>
          </div>
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

      {/* Orbit keyframes — pure rotation, perfectly smooth */}
      <style>{`
        @keyframes orbitCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes orbitCCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
      `}</style>
    </div>
  );
}
