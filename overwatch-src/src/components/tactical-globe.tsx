"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import createGlobe from "cobe";

const MQ = "(max-width: 768px)";

/* ── Types ── */
interface SatData {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  altitude: number;
  velocity: number;
  visibility: string;
}

const ISS_ID = 25544;

/* ── NOAA polar-orbit satellites — computed from real orbital elements ── */
const NOAA_SATS = [
  { id: 25338, name: "NOAA-15", alt: 807, incl: 98.7, period: 101.1, phase: 0 },
  { id: 28654, name: "NOAA-18", alt: 854, incl: 99.0, period: 102.1, phase: 72 },
  { id: 33591, name: "NOAA-19", alt: 870, incl: 99.1, period: 102.1, phase: 144 },
  { id: 43013, name: "NOAA-20", alt: 824, incl: 98.7, period: 101.4, phase: 216 },
  { id: 54234, name: "NOAA-21", alt: 833, incl: 98.7, period: 101.5, phase: 288 },
];

/* ── Real-time sun position: phi that places the subsolar point facing the camera ── */
function getSunPhi(): number {
  const now = new Date();
  const utcSec = now.getUTCHours() * 3600 + now.getUTCMinutes() * 60 + now.getUTCSeconds() + now.getUTCMilliseconds() / 1000;
  // At UTC noon (43200s) phi=0 → prime meridian faces camera (sun over Greenwich)
  return ((utcSec - 43200) / 86400) * 2 * Math.PI;
}

function computeNOAA(now: number): SatData[] {
  const EARTH_ROT = 360 / 86400; // deg/sec
  return NOAA_SATS.map((s) => {
    const periodSec = s.period * 60;
    const phaseRad = (s.phase * Math.PI) / 180;
    const t = (now / 1000) % periodSec;
    const frac = t / periodSec;
    const angle = 2 * Math.PI * frac + phaseRad;
    const lat = s.incl * Math.sin(angle) * (90 / s.incl);
    const lng = ((s.phase + (-360 * frac) - EARTH_ROT * (now / 1000)) % 360 + 540) % 360 - 180;
    const vel = (2 * Math.PI * (6371 + s.alt)) / periodSec * 3.6; // km/h
    return { id: s.id, name: s.name, latitude: Math.max(-90, Math.min(90, lat)), longitude: lng, altitude: s.alt, velocity: vel, visibility: "computed" };
  });
}

/* ── ISS orbital elements for orbit path computation ── */
const ISS_ORBIT = { id: ISS_ID, name: "ISS", alt: 408, incl: 51.6, period: 92.68, phase: 0 };
const ALL_ORBITS = [...NOAA_SATS, ISS_ORBIT];

function computeOrbitalPos(orb: { incl: number; period: number; phase: number }, timestamp: number): { lat: number; lng: number } {
  const EARTH_ROT = 360 / 86400;
  const periodSec = orb.period * 60;
  const frac = ((timestamp / 1000) % periodSec) / periodSec;
  const angle = 2 * Math.PI * frac + (orb.phase * Math.PI) / 180;
  const lat = Math.min(90, Math.max(-90, orb.incl * Math.sin(angle)));
  const lng = ((orb.phase + -360 * frac - EARTH_ROT * (timestamp / 1000)) % 360 + 540) % 360 - 180;
  return { lat, lng };
}

function computeOrbitArc(orb: typeof ALL_ORBITS[number], now: number, steps = 120): { lat: number; lng: number }[] {
  const periodMs = orb.period * 60 * 1000;
  const points: { lat: number; lng: number }[] = [];
  for (let i = 0; i < steps; i++) {
    points.push(computeOrbitalPos(orb, now + (periodMs * i) / steps));
  }
  return points;
}

/* ── Major cities for pulsating markers ── */
interface CityData { name: string; lat: number; lng: number; }
const CITIES: CityData[] = [
  { name: "New York", lat: 40.71, lng: -74.01 },
  { name: "London", lat: 51.51, lng: -0.13 },
  { name: "Tokyo", lat: 35.68, lng: 139.69 },
  { name: "Paris", lat: 48.86, lng: 2.35 },
  { name: "Sydney", lat: -33.87, lng: 151.21 },
  { name: "Moscow", lat: 55.76, lng: 37.62 },
  { name: "Beijing", lat: 39.91, lng: 116.39 },
  { name: "New Delhi", lat: 28.61, lng: 77.21 },
  { name: "São Paulo", lat: -23.55, lng: -46.63 },
  { name: "Cairo", lat: 30.04, lng: 31.24 },
  { name: "San Francisco", lat: 37.77, lng: -122.42 },
  { name: "Singapore", lat: 1.35, lng: 103.82 },
  { name: "Mexico City", lat: 19.43, lng: -99.13 },
  { name: "Nairobi", lat: -1.29, lng: 36.82 },
  { name: "Dubai", lat: 25.20, lng: 55.27 },
  { name: "Istanbul", lat: 41.01, lng: 28.98 },
  { name: "Los Angeles", lat: 34.05, lng: -118.24 },
  { name: "Hong Kong", lat: 22.32, lng: 114.17 },
  { name: "Berlin", lat: 52.52, lng: 13.41 },
  { name: "Buenos Aires", lat: -34.60, lng: -58.38 },
];

async function fetchISS(): Promise<SatData | null> {
  try {
    const r = await fetch(`https://api.wheretheiss.at/v1/satellites/${ISS_ID}`);
    if (!r.ok) return null;
    const d = await r.json();
    return { id: ISS_ID, name: "ISS", latitude: d.latitude, longitude: d.longitude, altitude: d.altitude, velocity: d.velocity, visibility: d.visibility ?? "unknown" };
  } catch { return null; }
}


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

/* ── CSS-drawn ISS: central truss + 4 solar array pairs + habitat modules ── */
function CssISS({ scale = 2, rotate = 0 }: { scale?: number; rotate?: number }) {
  const s = scale;
  const trussW = 40 * s;
  const trussH = 1.5 * s;
  const panelW = 10 * s;
  const panelH = 6 * s;
  const modW = 8 * s;
  const modH = 4 * s;
  const panelBorder = `${Math.max(0.5, s * 0.25)}px solid rgba(255,255,255,0.15)`;
  const panelBg = "linear-gradient(135deg, #4a75a0 0%, #2e5478 50%, #4a75a0 100%)";
  const gridBg = (sz: number) =>
    `repeating-linear-gradient(90deg, transparent, transparent ${sz}px, rgba(255,255,255,0.08) ${sz}px, rgba(255,255,255,0.08) ${sz + 0.5 * s}px)`;

  return (
    <div
      style={{
        position: "relative",
        width: trussW,
        height: modH * 2.5,
        transform: `rotate(${rotate}deg)`,
        filter: `drop-shadow(0 0 ${6 * s}px rgba(255,255,255,0.4))`,
      }}
    >
      {/* Central truss */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 0,
          width: trussW,
          height: trussH,
          transform: "translateY(-50%)",
          background: "linear-gradient(90deg, rgba(200,200,200,0.3), rgba(220,220,220,0.6), rgba(200,200,200,0.3))",
          borderRadius: s * 0.5,
        }}
      />
      {/* Habitat modules (center cluster) */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: modW,
          height: modH,
          background: "linear-gradient(180deg, #e0e0e0 0%, #a8a8a8 50%, #c8c8c8 100%)",
          borderRadius: s * 1.2,
          boxShadow: `0 0 ${4 * s}px rgba(255,255,255,0.5)`,
        }}
      />
      {/* Small module above */}
      <div
        style={{
          position: "absolute",
          top: `calc(50% - ${modH * 0.9}px)`,
          left: "50%",
          transform: "translateX(-50%)",
          width: modW * 0.6,
          height: modH * 0.5,
          background: "linear-gradient(180deg, #d5d5d5, #b0b0b0)",
          borderRadius: s,
        }}
      />
      {/* Solar arrays — 4 pairs, 2 on each side of truss */}
      {[-1, 1].map((side) =>
        [0.18, 0.42].map((frac, i) => (
          <div
            key={`${side}-${i}`}
            style={{
              position: "absolute",
              left: `${(side === -1 ? frac * 0.5 : 0.5 + frac * 0.5) * 100}%`,
              top: "50%",
              transform: "translate(-50%, -50%)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: trussH + s,
            }}
          >
            {/* Top panel */}
            <div
              style={{
                width: panelW,
                height: panelH,
                background: panelBg,
                borderRadius: s * 0.6,
                border: panelBorder,
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: gridBg(2.5 * s) }} />
            </div>
            {/* Bottom panel */}
            <div
              style={{
                width: panelW,
                height: panelH,
                background: panelBg,
                borderRadius: s * 0.6,
                border: panelBorder,
                overflow: "hidden",
              }}
            >
              <div style={{ position: "absolute", inset: 0, background: gridBg(2.5 * s) }} />
            </div>
          </div>
        ))
      )}
    </div>
  );
}

/* ── Satellite info popup ── */
function SatPopup({ sat, onClose, flipBelow }: { sat: SatData; onClose: () => void; flipBelow?: boolean }) {
  const isISS = sat.id === ISS_ID;
  const border = "rgba(221,140,51,0.5)";
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{
        position: "absolute",
        left: "50%",
        ...(flipBelow
          ? { top: "calc(100% + 8px)" }
          : { bottom: "calc(100% + 8px)" }),
        transform: "translateX(-50%)",
        background: "rgba(11, 20, 34, 0.92)",
        border: `1px solid ${border}`,
        borderRadius: 8,
        padding: "8px 12px",
        minWidth: 180,
        backdropFilter: "blur(8px)",
        pointerEvents: "auto",
        cursor: "default",
        zIndex: 50,
        boxShadow: "0 0 20px rgba(221,140,51,0.15)",
      }}
    >
      <div style={{ fontFamily: "monospace", fontSize: 11, color: "#dd8c33", fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>
        {sat.name}
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
        <div>ALT {sat.altitude.toFixed(1)} km</div>
        <div>VEL {sat.velocity.toFixed(0)} km/h</div>
        <div>LAT {sat.latitude.toFixed(2)}  LNG {sat.longitude.toFixed(2)}</div>
        {isISS && <div>VIS {sat.visibility.toUpperCase()}</div>}
      </div>
      {/* Arrow */}
      <div style={{ position: "absolute", ...(flipBelow ? { top: -5 } : { bottom: -5 }), left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 8, height: 8, background: "rgba(11,20,34,0.92)", ...(flipBelow ? { borderLeft: `1px solid ${border}`, borderTop: `1px solid ${border}` } : { borderRight: `1px solid ${border}`, borderBottom: `1px solid ${border}` }) }} />
    </div>
  );
}

/* ── Helper: project lat/lng to screen position relative to globe center ── */
function latLngToScreen(
  lat: number, lng: number, phi: number, theta: number,
  cx: number, cy: number, radius: number, hideZ = 0, cameraD = 0
): { x: number; y: number; visible: boolean; opacity: number } {
  const latR = (lat * Math.PI) / 180;
  const lngR = (lng * Math.PI) / 180;
  const x3 = Math.cos(latR) * Math.sin(lngR + phi);
  const y3 = Math.sin(latR);
  const z3 = Math.cos(latR) * Math.cos(lngR + phi);
  // Apply theta (tilt)
  const cosT = Math.cos(theta);
  const sinT = Math.sin(theta);
  const y3r = y3 * cosT - z3 * sinT;
  const z3r = y3 * sinT + z3 * cosT;
  // Perspective correction when cameraD > 0 (matches cobe's perspective camera)
  const pScale = cameraD > 0 ? cameraD / (cameraD - z3r) : 1;
  // Smooth fade near edge instead of hard cutoff
  const fadeStart = hideZ + 0.15;
  const edgeFade = z3r < fadeStart ? Math.max(0, (z3r - hideZ) / (fadeStart - hideZ)) : 1;
  return {
    x: cx + x3 * radius * pScale,
    y: cy - y3r * radius * pScale,
    visible: z3r > hideZ,
    opacity: edgeFade,
  };
}

export function TacticalGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const issRef = useRef<SatData | null>(null);
  const [selectedSat, setSelectedSat] = useState<number | null>(null);
  const phiRef = useRef(0);
  const isDraggingRef = useRef(false);
  const lastXRef = useRef(0);
  const dragOffsetRef = useRef(0);

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

  // Fetch ISS position from API every 5s
  useEffect(() => {
    if (isMobile) return;
    let cancelled = false;
    async function load() {
      const iss = await fetchISS();
      if (!cancelled && iss) issRef.current = iss;
    }
    load();
    const interval = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(interval); };
  }, [isMobile]);

  // Cobe globe
  useEffect(() => {
    if (isMobile) return;
    let rafId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const cssWidth = canvas.offsetWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cobeSize = Math.min(cssWidth, Math.floor(4096 / dpr));

    const globe = createGlobe(canvas, {
      devicePixelRatio: dpr,
      width: cobeSize,
      height: cobeSize,
      phi: 0,
      theta: 0.45,
      dark: 1,
      diffuse: 0.4,
      mapSamples: 16000,
      mapBrightness: 8,
      baseColor: [0.05, 0.08, 0.15],
      markerColor: [0.94, 0.59, 0.12],
      glowColor: [0.04, 0.06, 0.12],
      markerElevation: 0,
      markers: [],
    });

    const cityMarkers = CITIES.map((c) => ({ location: [c.lat, c.lng] as [number, number], size: 0.018 }));

    function animate() {
      const sunPhi = getSunPhi();
      if (!isDraggingRef.current) {
        dragOffsetRef.current *= 0.93;
        if (Math.abs(dragOffsetRef.current) < 0.001) dragOffsetRef.current = 0;
      }
      const phi = sunPhi + dragOffsetRef.current;
      phiRef.current = phi;
      globe.update({ phi, markers: cityMarkers });
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      globe.destroy();
    };
  }, [isMobile]);

  if (isMobile) return null;

  // Compute screen positions for clickable markers
  const globePos = "calc(50% + 40px)";
  const globeStyle = {
    width: "min(750px, 92vw)",
    height: "min(750px, 92vw)",
  };

  return (
    <>
    <div ref={containerRef} className="absolute inset-0 pointer-events-none" style={{ zIndex: 10 }} aria-hidden="true">
      <canvas
        ref={canvasRef}
        style={{
          ...globeStyle,
          position: "absolute",
          left: "50%",
          top: globePos,
          transform: "translate(-50%, -50%)",
          pointerEvents: "none",
        }}
      />

      {/* ── Digital Radar ── */}
      <div
        style={{
          ...globeStyle,
          position: "absolute",
          left: "50%",
          top: globePos,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {/* Concentric range rings */}
        {[0.2, 0.4, 0.6, 0.8].map((r) => (
          <div
            key={r}
            style={{
              position: "absolute",
              top: `${(1 - r) * 50}%`,
              left: `${(1 - r) * 50}%`,
              width: `${r * 100}%`,
              height: `${r * 100}%`,
              borderRadius: "50%",
              border: "1px solid rgba(221,140,51,0.08)",
            }}
          />
        ))}
        {/* Crosshair lines */}
        <div style={{ position: "absolute", top: "50%", left: 0, width: "100%", height: 1, background: "rgba(221,140,51,0.06)" }} />
        <div style={{ position: "absolute", left: "50%", top: 0, height: "100%", width: 1, background: "rgba(221,140,51,0.06)" }} />
        {/* Sweep arm */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            animation: "radarSweep 6s linear infinite",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(221,140,51,0.18) 5deg, rgba(221,140,51,0.08) 30deg, transparent 55deg)",
          }}
        />
        {/* Bright leading edge */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            animation: "radarSweep 6s linear infinite",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(221,140,51,0.5) 0.5deg, rgba(221,140,51,0.15) 2deg, transparent 4deg)",
          }}
        />
      </div>

      {/* Vignette fade around edges */}
      <div
        className="absolute inset-0"
        style={{
          background: "radial-gradient(ellipse at center, transparent 30%, #0b1422 75%)",
          pointerEvents: "none",
        }}
      />

      <style>{`
        @keyframes radarSweep {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
      `}</style>
    </div>

    {/* Drag-to-rotate overlay at z-25 (above hero text z-20, below satellite popups z-30) */}
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 25 }}>
      <div
        style={{
          ...globeStyle,
          position: "absolute",
          left: "50%",
          top: globePos,
          transform: "translate(-50%, -50%)",
          borderRadius: "50%",
          pointerEvents: "auto",
          cursor: "grab",
          touchAction: "none",
        }}
        onPointerDown={(e) => {
          isDraggingRef.current = true;
          lastXRef.current = e.clientX;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!isDraggingRef.current) return;
          const dx = e.clientX - lastXRef.current;
          dragOffsetRef.current += dx * 0.005;
          lastXRef.current = e.clientX;
        }}
        onPointerUp={() => { isDraggingRef.current = false; }}
        onPointerCancel={() => { isDraggingRef.current = false; }}
      />
    </div>

    {/* Satellite overlay at z-30 so popups render above hero text (z-20) */}
    <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 30 }}>
      <div style={{ pointerEvents: "auto" }}>
        <SatelliteOverlay
          issRef={issRef}
          phi={phiRef}
          selectedSat={selectedSat}
          onSelect={setSelectedSat}
          globeStyle={globeStyle}
          globeTop={globePos}
        />
      </div>
    </div>
    </>
  );
}

/* ── Satellite overlay with per-frame orbital mechanics, orbit arcs, and clickable markers ── */
function SatelliteOverlay({
  issRef,
  phi,
  selectedSat,
  onSelect,
  globeStyle,
  globeTop,
}: {
  issRef: React.RefObject<SatData | null>;
  phi: React.RefObject<number>;
  selectedSat: number | null;
  onSelect: (id: number | null) => void;
  globeStyle: Record<string, string>;
  globeTop: string;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [renderState, setRenderState] = useState<{
    positions: Record<number, { x: number; y: number; visible: boolean; opacity: number }>;
    arcs: { id: number; d: string }[];
    satellites: SatData[];
  }>({ positions: {}, arcs: [], satellites: [] });

  useEffect(() => {
    let rafId: number;

    function update() {
      const el = overlayRef.current;
      if (!el) { rafId = requestAnimationFrame(update); return; }
      const w = el.offsetWidth;
      const cx = w / 2;
      const cy = w / 2;
      const satRadius = w * 0.47;
      const arcRadius = w * 0.47;
      const currentPhi = phi.current ?? 0;
      const now = Date.now();

      // Compute fresh NOAA positions every frame from orbital mechanics
      const noaa = computeNOAA(now);
      const iss = issRef.current;
      const allSats: SatData[] = iss ? [iss, ...noaa] : [...noaa];

      // Project satellite positions
      const positions: Record<number, { x: number; y: number; visible: boolean; opacity: number }> = {};
      for (const s of allSats) {
        positions[s.id] = latLngToScreen(s.latitude, s.longitude, currentPhi, 0.45, cx, cy, satRadius, -0.52);
      }

      // Compute orbit arc SVG paths
      const arcs: { id: number; d: string }[] = [];
      for (const orb of ALL_ORBITS) {
        const points = computeOrbitArc(orb, now);
        let d = "";
        let wasVisible = false;
        for (const p of points) {
          const proj = latLngToScreen(p.lat, p.lng, currentPhi, 0.45, cx, cy, arcRadius, -0.52);
          if (proj.visible && proj.opacity > 0.05) {
            d += wasVisible ? `L${proj.x.toFixed(1)},${proj.y.toFixed(1)}` : `M${proj.x.toFixed(1)},${proj.y.toFixed(1)}`;
            wasVisible = true;
          } else {
            wasVisible = false;
          }
        }
        if (d) arcs.push({ id: orb.id, d });
      }

      setRenderState({ positions, arcs, satellites: allSats });
      rafId = requestAnimationFrame(update);
    }
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [issRef, phi]);

  const { positions, arcs, satellites } = renderState;

  return (
    <div
      ref={overlayRef}
      onClick={() => onSelect(null)}
      style={{
        ...globeStyle,
        position: "absolute",
        left: "50%",
        top: globeTop,
        transform: "translate(-50%, -50%)",
        pointerEvents: "none",
      }}
    >
      {/* Orbit arc paths */}
      <svg style={{ position: "absolute", inset: 0, overflow: "visible", pointerEvents: "none" }}>
        {arcs.map((arc) => (
          <path
            key={arc.id}
            d={arc.d}
            fill="none"
            stroke="rgba(221,140,51,0.15)"
            strokeWidth="1"
            strokeDasharray="4 3"
          />
        ))}
      </svg>

      {/* Satellite markers */}
      {satellites.map((sat) => {
        const pos = positions[sat.id];
        if (!pos || !pos.visible) return null;
        const isISS = sat.id === ISS_ID;
        const isSelected = selectedSat === sat.id;

        return (
          <div
            key={sat.id}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
              zIndex: isSelected ? 40 : 20,
              pointerEvents: pos.opacity > 0.3 ? "auto" : "none",
              cursor: "pointer",
              opacity: pos.opacity,
              transition: "opacity 0.3s ease",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(isSelected ? null : sat.id);
            }}
          >
            {isISS ? <CssISS scale={1.0} rotate={5} /> : <CssSatellite scale={0.8} rotate={-8} />}
            {isSelected && <SatPopup sat={sat} onClose={() => onSelect(null)} flipBelow={pos.y < 120} />}
          </div>
        );
      })}
    </div>
  );
}

