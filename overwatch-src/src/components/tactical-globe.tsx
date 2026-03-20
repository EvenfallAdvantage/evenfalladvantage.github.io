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
      {/* Antenna mast + dish */}
      <div
        style={{
          position: "absolute",
          bottom: "100%",
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
          bottom: `calc(100% + ${3.5 * s}px)`,
          left: "50%",
          transform: "translateX(-50%)",
          width: 4 * s,
          height: 2 * s,
          borderRadius: "50% 50% 0 0",
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

      {/* ── Orbiting Satellites ── */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Satellite 1 — left-to-right wide arc, 24s */}
        <div className="sat-wrapper" style={{ animation: "satArc1 24s linear infinite" }}>
          <CssSatellite scale={1.8} rotate={12} />
        </div>
        {/* Satellite 2 — right-to-left higher arc, 32s */}
        <div className="sat-wrapper" style={{ animation: "satArc2 32s linear infinite" }}>
          <CssSatellite scale={1.4} rotate={-8} />
        </div>
        {/* Satellite 3 — fast diagonal pass, 18s */}
        <div className="sat-wrapper" style={{ animation: "satArc3 18s linear infinite" }}>
          <CssSatellite scale={1.6} rotate={20} />
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
        .sat-wrapper {
          position: absolute;
          will-change: left, top, opacity;
        }
        @keyframes satArc1 {
          0%   { left: -4%; top: 68%; opacity: 0; }
          4%   { opacity: 1; }
          20%  { left: 18%; top: 38%; }
          50%  { left: 50%; top: 18%; }
          80%  { left: 82%; top: 38%; }
          96%  { opacity: 1; }
          100% { left: 104%; top: 68%; opacity: 0; }
        }
        @keyframes satArc2 {
          0%   { left: 104%; top: 58%; opacity: 0; }
          4%   { opacity: 1; }
          20%  { left: 82%; top: 28%; }
          50%  { left: 48%; top: 12%; }
          80%  { left: 16%; top: 28%; }
          96%  { opacity: 1; }
          100% { left: -4%; top: 58%; opacity: 0; }
        }
        @keyframes satArc3 {
          0%   { left: -4%; top: 15%; opacity: 0; }
          4%   { opacity: 1; }
          25%  { left: 22%; top: 35%; }
          50%  { left: 50%; top: 48%; }
          75%  { left: 78%; top: 35%; }
          96%  { opacity: 1; }
          100% { left: 104%; top: 15%; opacity: 0; }
        }
      `}</style>
    </div>
  );
}
