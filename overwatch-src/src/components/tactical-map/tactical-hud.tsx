"use client";

/**
 * Tactical HUD overlay: corner brackets, centre reticle, UTC clock, camera
 * readouts (centre lat/lng, altitude, heading, pitch) and the active visual
 * mode. DOM overlay (no extra GPU passes). Layout inspired by
 * gods-eye-view's src/hud.js (MIT, see docs/THIRD-PARTY-NOTICES.md).
 */
import { useEffect, useState } from "react";
import type { CesiumRef } from "./hooks/cesium-layer-types";

interface Readout { lat: number | null; lng: number | null; altM: number; hdg: number; pitch: number }

export function formatLatLng(lat: number, lng: number): string {
  const ns = lat >= 0 ? "N" : "S";
  const ew = lng >= 0 ? "E" : "W";
  return `${Math.abs(lat).toFixed(4)}°${ns} ${Math.abs(lng).toFixed(4)}°${ew}`;
}

export function formatAlt(m: number): string {
  if (m >= 100_000) return `${Math.round(m / 1000).toLocaleString("en-US")} km`;
  if (m >= 10_000) return `${(m / 1000).toFixed(1)} km`;
  return `${Math.round(m).toLocaleString("en-US")} m`;
}

function utcClock(): string {
  return new Date().toISOString().slice(11, 19) + "Z";
}

export function TacticalHud({ viewerRef, cesiumRef, mode }: { viewerRef: CesiumRef; cesiumRef: CesiumRef; mode: string }) {
  const [r, setR] = useState<Readout>({ lat: null, lng: null, altM: 0, hdg: 0, pitch: 0 });
  const [clock, setClock] = useState(utcClock);

  useEffect(() => {
    const id = setInterval(() => setClock(utcClock()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const viewer = viewerRef.current;
    const Cesium = cesiumRef.current;
    if (!viewer || !Cesium) return;
    const update = () => {
      if (viewer.isDestroyed?.()) return;
      const cam = viewer.camera;
      const canvas = viewer.scene.canvas;
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const ray = cam.getPickRay(new Cesium.Cartesian2(canvas.clientWidth / 2, canvas.clientHeight / 2));
        const hit = ray ? viewer.scene.globe.pick(ray, viewer.scene) : undefined;
        if (hit) {
          const c = Cesium.Cartographic.fromCartesian(hit);
          lat = Cesium.Math.toDegrees(c.latitude);
          lng = Cesium.Math.toDegrees(c.longitude);
        }
      } catch { /* centre not on globe */ }
      setR({
        lat, lng,
        altM: cam.positionCartographic?.height ?? 0,
        hdg: Cesium.Math.toDegrees(cam.heading ?? 0),
        pitch: Cesium.Math.toDegrees(cam.pitch ?? 0),
      });
    };
    update();
    const prev = viewer.camera.percentageChanged;
    viewer.camera.percentageChanged = 0.01;
    const off = viewer.camera.changed.addEventListener(update);
    return () => {
      off?.();
      if (!viewer.isDestroyed?.()) viewer.camera.percentageChanged = prev;
    };
  }, [viewerRef, cesiumRef]);

  const corner = "absolute w-8 h-8 border-cyan-300/70";
  return (
    <div className="absolute inset-0 z-10 pointer-events-none select-none font-mono text-[10px] text-cyan-200/90 [text-shadow:0_0_4px_rgba(0,0,0,0.9)]">
      <div className={`${corner} top-3 left-3 border-t-2 border-l-2`} />
      <div className={`${corner} top-3 right-3 border-t-2 border-r-2`} />
      <div className={`${corner} bottom-3 left-3 border-b-2 border-l-2`} />
      <div className={`${corner} bottom-3 right-3 border-b-2 border-r-2`} />

      {/* Centre reticle */}
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
        <div className="w-10 h-10 rounded-full border border-cyan-300/50" />
        <div className="absolute left-1/2 -top-3 w-px h-3 bg-cyan-300/70" />
        <div className="absolute left-1/2 -bottom-3 w-px h-3 bg-cyan-300/70" />
        <div className="absolute top-1/2 -left-3 h-px w-3 bg-cyan-300/70" />
        <div className="absolute top-1/2 -right-3 h-px w-3 bg-cyan-300/70" />
      </div>

      <div className="absolute top-14 left-6 space-y-0.5">
        <div className="tracking-[0.25em] text-cyan-100">OVERWATCH</div>
        <div className="text-cyan-300/70">MODE {mode}</div>
      </div>
      <div className="absolute top-14 right-6 text-right space-y-0.5">
        <div className="text-cyan-100">{clock}</div>
        <div><span className="text-red-400 animate-pulse">●</span> LIVE</div>
      </div>
      <div className="absolute bottom-10 left-6 space-y-0.5">
        <div>CTR {r.lat != null && r.lng != null ? formatLatLng(r.lat, r.lng) : "— SPACE —"}</div>
        <div>ALT {formatAlt(r.altM)}</div>
      </div>
      <div className="absolute bottom-10 right-6 text-right space-y-0.5">
        <div>HDG {String(Math.round(((r.hdg % 360) + 360) % 360)).padStart(3, "0")}°</div>
        <div>PITCH {Math.round(r.pitch)}°</div>
      </div>
    </div>
  );
}

/** Label for the HUD's MODE line from the active effect toggles. */
export function hudModeLabel(l: { nvgGoggles?: boolean; flirThermal?: boolean; crtMode?: boolean; noir?: boolean; nightVision?: boolean }): string {
  if (l.nvgGoggles) return "NVG";
  if (l.flirThermal) return "FLIR";
  if (l.crtMode) return "CRT";
  if (l.noir) return "NOIR";
  if (l.nightVision) return "NIGHT";
  return "EO";
}
