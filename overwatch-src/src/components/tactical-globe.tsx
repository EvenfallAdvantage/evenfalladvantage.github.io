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
const NOAA_IDS = [25338, 28654, 33591, 43013, 54234];
const NOAA_NAMES: Record<number, string> = {
  25338: "NOAA-15", 28654: "NOAA-18", 33591: "NOAA-19",
  43013: "NOAA-20", 54234: "NOAA-21",
};

async function fetchSat(id: number): Promise<SatData | null> {
  try {
    const r = await fetch(`https://api.wheretheiss.at/v1/satellites/${id}`);
    if (!r.ok) return null;
    const d = await r.json();
    return { id, name: id === ISS_ID ? "ISS" : (NOAA_NAMES[id] ?? d.name), latitude: d.latitude, longitude: d.longitude, altitude: d.altitude, velocity: d.velocity, visibility: d.visibility ?? "unknown" };
  } catch { return null; }
}

async function fetchISSTrack(): Promise<[number, number][]> {
  try {
    const now = Math.floor(Date.now() / 1000);
    const timestamps = Array.from({ length: 10 }, (_, i) => now + i * 270).join(",");
    const r = await fetch(`https://api.wheretheiss.at/v1/satellites/${ISS_ID}/positions?timestamps=${timestamps}`);
    if (!r.ok) return [];
    const data = await r.json();
    return data.map((p: { latitude: number; longitude: number }) => [p.latitude, p.longitude] as [number, number]);
  } catch { return []; }
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
function SatPopup({ sat, onClose }: { sat: SatData; onClose: () => void }) {
  const isISS = sat.id === ISS_ID;
  return (
    <div
      onClick={(e) => { e.stopPropagation(); onClose(); }}
      style={{
        position: "absolute",
        left: "50%",
        bottom: "calc(100% + 8px)",
        transform: "translateX(-50%)",
        background: "rgba(11, 20, 34, 0.92)",
        border: `1px solid ${isISS ? "rgba(221,140,51,0.5)" : "rgba(100,160,255,0.4)"}`,
        borderRadius: 8,
        padding: "8px 12px",
        minWidth: 180,
        backdropFilter: "blur(8px)",
        pointerEvents: "auto",
        cursor: "default",
        zIndex: 50,
        boxShadow: `0 0 20px ${isISS ? "rgba(221,140,51,0.15)" : "rgba(100,160,255,0.1)"}`,
      }}
    >
      <div style={{ fontFamily: "monospace", fontSize: 11, color: isISS ? "#dd8c33" : "#7db4ff", fontWeight: 700, marginBottom: 4, letterSpacing: 1 }}>
        {sat.name}
      </div>
      <div style={{ fontFamily: "monospace", fontSize: 10, color: "rgba(255,255,255,0.7)", lineHeight: 1.6 }}>
        <div>ALT {sat.altitude.toFixed(1)} km</div>
        <div>VEL {sat.velocity.toFixed(0)} km/h</div>
        <div>LAT {sat.latitude.toFixed(2)}  LNG {sat.longitude.toFixed(2)}</div>
        {isISS && <div>VIS {sat.visibility.toUpperCase()}</div>}
      </div>
      <div style={{ position: "absolute", bottom: -5, left: "50%", transform: "translateX(-50%) rotate(45deg)", width: 8, height: 8, background: "rgba(11,20,34,0.92)", borderRight: `1px solid ${isISS ? "rgba(221,140,51,0.5)" : "rgba(100,160,255,0.4)"}`, borderBottom: `1px solid ${isISS ? "rgba(221,140,51,0.5)" : "rgba(100,160,255,0.4)"}` }} />
    </div>
  );
}

/* ── Helper: project lat/lng to screen position relative to globe center ── */
function latLngToScreen(
  lat: number, lng: number, phi: number, theta: number,
  cx: number, cy: number, radius: number
): { x: number; y: number; visible: boolean } {
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
  return {
    x: cx + x3 * radius,
    y: cy - y3r * radius,
    visible: z3r > 0.05,
  };
}

export function TacticalGlobe() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [satellites, setSatellites] = useState<SatData[]>([]);
  const [issTrack, setIssTrack] = useState<[number, number][]>([]);
  const [selectedSat, setSelectedSat] = useState<number | null>(null);
  const phiRef = useRef(0);

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

  // Fetch satellite data
  useEffect(() => {
    if (isMobile) return;
    let cancelled = false;

    async function load() {
      const allIds = [ISS_ID, ...NOAA_IDS];
      const results = await Promise.all(allIds.map(fetchSat));
      if (!cancelled) setSatellites(results.filter((s): s is SatData => s !== null));
      const track = await fetchISSTrack();
      if (!cancelled) setIssTrack(track);
    }
    load();

    const interval = setInterval(async () => {
      const allIds = [ISS_ID, ...NOAA_IDS];
      const results = await Promise.all(allIds.map(fetchSat));
      if (!cancelled) setSatellites(results.filter((s): s is SatData => s !== null));
    }, 5000);

    const trackInterval = setInterval(async () => {
      const track = await fetchISSTrack();
      if (!cancelled) setIssTrack(track);
    }, 60000);

    return () => { cancelled = true; clearInterval(interval); clearInterval(trackInterval); };
  }, [isMobile]);

  // Cobe globe
  useEffect(() => {
    if (isMobile) return;
    let phi = 0;
    let rafId: number;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const cssWidth = canvas.offsetWidth;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cobeSize = Math.min(cssWidth, Math.floor(4096 / dpr));

    const GOLD: [number, number, number] = [0.94, 0.59, 0.12];
    const BLUE: [number, number, number] = [0.49, 0.7, 1.0];

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
      markerColor: [0.94, 0.59, 0.12],
      glowColor: [0.08, 0.12, 0.2],
      markerElevation: 0,
      markers: [],
    });

    function animate() {
      phi += 0.003;
      phiRef.current = phi;

      // Build markers from live satellite data
      const sats = satellites;
      const track = issTrack;
      const markers: { location: [number, number]; size: number; color: [number, number, number] }[] = [];

      for (const s of sats) {
        const isISS = s.id === ISS_ID;
        markers.push({
          location: [s.latitude, s.longitude],
          size: isISS ? 0.06 : 0.03,
          color: isISS ? GOLD : BLUE,
        });
      }

      // ISS ground track as small trail dots
      for (const pt of track) {
        markers.push({
          location: pt,
          size: 0.008,
          color: [0.6, 0.4, 0.15],
        });
      }

      globe.update({ phi, markers });
      rafId = requestAnimationFrame(animate);
    }
    rafId = requestAnimationFrame(animate);

    return () => {
      cancelAnimationFrame(rafId);
      globe.destroy();
    };
  }, [isMobile, satellites, issTrack]);

  if (isMobile) return null;

  // Compute screen positions for clickable markers
  const globeStyle = {
    width: "min(3200px, 280vw)",
    height: "min(3200px, 280vw)",
  };

  return (
    <div ref={containerRef} className="absolute inset-0 pointer-events-none" aria-hidden="true">
      <canvas
        ref={canvasRef}
        style={{
          ...globeStyle,
          position: "absolute",
          left: "50%",
          bottom: 0,
          transform: "translateX(-50%) translateY(72%)",
        }}
      />

      {/* ── Radar Sweep ── */}
      <div
        style={{
          ...globeStyle,
          position: "absolute",
          left: "50%",
          bottom: 0,
          transform: "translateX(-50%) translateY(72%)",
          borderRadius: "50%",
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            animation: "radarSweep 8s linear infinite",
            background: "conic-gradient(from 0deg, transparent 0deg, rgba(221,140,51,0.06) 20deg, transparent 60deg)",
          }}
        />
      </div>

      {/* ── Clickable satellite overlay ── */}
      <SatelliteOverlay
        satellites={satellites}
        phi={phiRef}
        selectedSat={selectedSat}
        onSelect={setSelectedSat}
        globeStyle={globeStyle}
      />

      {/* ── Orbiting CSS Satellites ── */}
      <div
        style={{
          ...globeStyle,
          position: "absolute",
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
        {/* Orbit 3 — ISS model, tilted forward, clockwise, 38s */}
        <div style={{ position: "absolute", inset: 0, transform: "rotateX(10deg) rotateY(6deg)", transformStyle: "preserve-3d" }}>
          <div style={{ position: "absolute", inset: 0, animation: "orbitCW 38s linear infinite", transformStyle: "preserve-3d" }}>
            <div style={{ position: "absolute", top: "5%", left: "50%", transform: "translate(-50%, -50%)" }}>
              <CssISS scale={1.4} rotate={12} />
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

      <style>{`
        @keyframes orbitCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes orbitCCW {
          from { transform: rotate(0deg); }
          to   { transform: rotate(-360deg); }
        }
        @keyframes radarSweep {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

/* ── Satellite overlay with clickable markers + popups ── */
function SatelliteOverlay({
  satellites,
  phi,
  selectedSat,
  onSelect,
  globeStyle,
}: {
  satellites: SatData[];
  phi: React.RefObject<number>;
  selectedSat: number | null;
  onSelect: (id: number | null) => void;
  globeStyle: Record<string, string>;
}) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const [positions, setPositions] = useState<Record<number, { x: number; y: number; visible: boolean }>>({});

  useEffect(() => {
    if (!satellites.length) return;
    let rafId: number;

    function update() {
      const el = overlayRef.current;
      if (!el) { rafId = requestAnimationFrame(update); return; }
      const w = el.offsetWidth;
      const h = el.offsetHeight;
      const cx = w / 2;
      const cy = h / 2;
      const radius = w * 0.5;
      const currentPhi = phi.current ?? 0;

      const next: Record<number, { x: number; y: number; visible: boolean }> = {};
      for (const s of satellites) {
        next[s.id] = latLngToScreen(s.latitude, s.longitude, currentPhi, 0.45, cx, cy, radius);
      }
      setPositions(next);
      rafId = requestAnimationFrame(update);
    }
    rafId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(rafId);
  }, [satellites, phi]);

  return (
    <div
      ref={overlayRef}
      onClick={() => onSelect(null)}
      style={{
        ...globeStyle,
        position: "absolute",
        left: "50%",
        bottom: 0,
        transform: "translateX(-50%) translateY(72%)",
        pointerEvents: "none",
      }}
    >
      {satellites.map((sat) => {
        const pos = positions[sat.id];
        if (!pos || !pos.visible) return null;
        const isISS = sat.id === ISS_ID;
        const isSelected = selectedSat === sat.id;
        const dotSize = isISS ? 14 : 8;

        return (
          <div
            key={sat.id}
            style={{
              position: "absolute",
              left: pos.x,
              top: pos.y,
              transform: "translate(-50%, -50%)",
              zIndex: isSelected ? 40 : 20,
              pointerEvents: "auto",
              cursor: "pointer",
            }}
            onClick={(e) => {
              e.stopPropagation();
              onSelect(isSelected ? null : sat.id);
            }}
          >
            {/* Clickable hit area */}
            <div
              style={{
                width: dotSize + 16,
                height: dotSize + 16,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {/* Glow ring */}
              <div
                style={{
                  position: "absolute",
                  width: dotSize + 10,
                  height: dotSize + 10,
                  borderRadius: "50%",
                  background: isISS ? "rgba(221,140,51,0.15)" : "rgba(100,160,255,0.12)",
                  animation: "markerPulse 2s ease-in-out infinite",
                }}
              />
              {/* Dot */}
              <div
                style={{
                  width: dotSize,
                  height: dotSize,
                  borderRadius: "50%",
                  background: isISS
                    ? "radial-gradient(circle, #f0a84a, #dd8c33)"
                    : "radial-gradient(circle, #a0c8ff, #5a90d0)",
                  boxShadow: isISS
                    ? "0 0 8px rgba(221,140,51,0.6)"
                    : "0 0 6px rgba(100,160,255,0.5)",
                  position: "relative",
                  zIndex: 2,
                }}
              />
            </div>
            {isSelected && <SatPopup sat={sat} onClose={() => onSelect(null)} />}
          </div>
        );
      })}

      <style>{`
        @keyframes markerPulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.5); opacity: 0.2; }
        }
      `}</style>
    </div>
  );
}
