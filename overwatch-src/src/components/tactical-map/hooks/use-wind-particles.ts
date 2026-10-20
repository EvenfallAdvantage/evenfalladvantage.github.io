/**
 * Animated wind particles (global, NOAA GFS 10 m wind) drawn on a 2D canvas
 * laid over the Cesium canvas. Approach follows gods-eye-view's wind layer
 * (MIT): particles advect through a bilinear wind grid in lon/lat, are
 * projected to the screen each frame, and leave fading trails.
 *
 *  - Far side: every particle is tested against the globe's horizon
 *    (EllipsoidalOccluder) so nothing draws through the Earth.
 *  - Phones / constrained devices: fewer particles at a lower frame rate; the
 *    performance governor trims further, and the loop stops while the tab is
 *    hidden (requestAnimationFrame) or the Time Machine replays the past.
 *  - Looks: the canvas sits above the post-process stages, so it tints itself
 *    to match NVG, thermal, noir and CRT.
 *
 * Shares the existing "Wind" sub-option with the US barbs (no new toggle).
 */

import { useEffect } from "react";
import { logger } from "@/lib/logger";
import { isConstrainedDevice } from "@/lib/map/device-profile";
import { hasHeightRasters, occludedByBuildings } from "@/lib/map/building-heightfield";
import { WIND_RETRY_MS, loadWindField, sampleWind, windFrameMs, windParticleBudget, windStroke, WIND_FIELD_CREDIT, type WindField } from "@/lib/map/wind-field";
import type { LayerVisibility } from "../map-layers-panel";
import type { CesiumRef, EntityGroupsRef } from "./cesium-layer-types";

interface Particle { lon: number; lat: number; age: number; max: number; px: number; py: number; ok: boolean }

const BUILDING_OCCLUSION_MAX_M = 4000;
const MAX_AGE = 90;

export function useWindParticles(params: {
  viewerRef: CesiumRef; cesiumRef: CesiumRef; entityGroupsRef: EntityGroupsRef; loading: boolean;
  layers: LayerVisibility; debouncedReplayTime: number; timeMachineOpen: boolean;
}) {
  const { viewerRef, cesiumRef, entityGroupsRef, loading, layers, debouncedReplayTime, timeMachineOpen } = params;
  const isReplaying = timeMachineOpen && debouncedReplayTime < Date.now() - 5000;
  const look = { nvgGoggles: !!layers.nvgGoggles, flirThermal: !!layers.flirThermal, noir: !!layers.noir, crtMode: !!layers.crtMode };
  const lookKey = `${look.nvgGoggles}${look.flirThermal}${look.noir}${look.crtMode}`;

  useEffect(() => {
    const viewer = viewerRef.current;
    const C = cesiumRef.current;
    if (!viewer || !C || loading || !layers.wind || isReplaying) return;
    const constrained = isConstrainedDevice();
    const ctrl = new AbortController();
    let raf = 0, stopped = false, field: WindField | null = null, last = 0;
    const host: HTMLElement = viewer.container;
    const canvas = document.createElement("canvas");
    canvas.dataset.testid = "wind-particles";
    canvas.setAttribute("aria-hidden", "true");
    Object.assign(canvas.style, { position: "absolute", inset: "0", width: "100%", height: "100%", pointerEvents: "none", zIndex: "1" });
    host.appendChild(canvas);
    const ctx = canvas.getContext("2d");
    const credit = new C.Credit(WIND_FIELD_CREDIT, false);
    try { viewer.creditDisplay.addStaticCredit?.(credit); } catch (e) { logger.swallow("wind-particles:credit", e, "debug"); }
    const particles: Particle[] = [];
    const sample = { u: 0, v: 0 };
    const scratch = new C.Cartesian3();
    let lastView = "";
    let rect = { w: -180, s: -80, e: 180, n: 80 };

    const viewRect = () => {
      const r = viewer.camera.computeViewRectangle?.(viewer.scene.globe.ellipsoid);
      if (!r) return { w: -180, s: -80, e: 180, n: 80 };
      const w = C.Math.toDegrees(r.west);
      let e = C.Math.toDegrees(r.east);
      if (e < w) e += 360;
      return { w, s: Math.max(-85, C.Math.toDegrees(r.south)), e, n: Math.min(85, C.Math.toDegrees(r.north)) };
    };
    const spawn = (p: Particle) => {
      p.lon = rect.w + Math.random() * (rect.e - rect.w);
      // area-uniform in latitude
      const s0 = Math.sin(rect.s * Math.PI / 180), s1 = Math.sin(rect.n * Math.PI / 180);
      p.lat = Math.asin(s0 + Math.random() * (s1 - s0)) * 180 / Math.PI;
      p.age = 0; p.max = MAX_AGE * (0.5 + Math.random() * 0.5); p.ok = false;
    };
    // Below ~4 km with 3D buildings loaded, particles behind a building are hidden.
    let bCam: { lon: number; lat: number; heightAboveGround: number } | null = null;
    const project = (p: Particle, occluder: { isPointVisible: (c: unknown) => boolean }): { x: number; y: number } | null => {
      C.Cartesian3.fromDegrees(p.lon, p.lat, 0, undefined, scratch);
      if (!occluder.isPointVisible(scratch)) return null;
      if (bCam && occludedByBuildings(p.lon, p.lat, bCam)) return null;
      const w = C.SceneTransforms.worldToWindowCoordinates(viewer.scene, scratch);
      return w ? { x: w.x, y: w.y } : null;
    };

    const frame = (t: number) => {
      if (stopped) return;
      raf = requestAnimationFrame(frame);
      const perf = Number(entityGroupsRef.current.perfLevel ?? 0);
      if (!field || !ctx || t - last < windFrameMs(constrained, perf)) return;
      last = t;
      const dpr = Math.min(window.devicePixelRatio || 1, constrained ? 1.5 : 2);
      const cw = Math.round(host.clientWidth * dpr), ch = Math.round(host.clientHeight * dpr);
      if (canvas.width !== cw || canvas.height !== ch) { canvas.width = cw; canvas.height = ch; }
      const cam = viewer.camera;
      const view = `${cam.positionWC.x.toFixed(0)},${cam.positionWC.y.toFixed(0)},${cam.positionWC.z.toFixed(0)},${cam.heading.toFixed(3)},${cam.pitch.toFixed(3)},${cw},${ch}`;
      const moved = view !== lastView;
      if (moved) {
        lastView = view; rect = viewRect();
        ctx.clearRect(0, 0, cw, ch);
        for (const p of particles) p.ok = false;
      } else {
        // fade previous trails
        ctx.globalCompositeOperation = "destination-in";
        ctx.fillStyle = "rgba(0,0,0,0.9)";
        ctx.fillRect(0, 0, cw, ch);
        ctx.globalCompositeOperation = "source-over";
      }
      const budget = windParticleBudget(constrained, perf);
      while (particles.length < budget) { const p = { lon: 0, lat: 0, age: 0, max: MAX_AGE, px: 0, py: 0, ok: false }; spawn(p); p.age = Math.random() * p.max; particles.push(p); }
      if (particles.length > budget) particles.length = budget;
      const occluder = new C.EllipsoidalOccluder(viewer.scene.globe.ellipsoid, cam.positionWC);
      bCam = null;
      if (hasHeightRasters()) {
        const cc = cam.positionCartographic;
        const agl = cc.height - (viewer.scene.globe.getHeight(cc) ?? 0);
        if (agl < BUILDING_OCCLUSION_MAX_M) bCam = { lon: C.Math.toDegrees(cc.longitude), lat: C.Math.toDegrees(cc.latitude), heightAboveGround: Math.max(1, agl) };
      }
      // step in degrees scales with the view so motion reads at any zoom
      const span = Math.max(0.05, Math.min(360, rect.e - rect.w));
      const k = span * 0.00012;
      ctx.lineWidth = (constrained ? 1.2 : 1.4) * dpr;
      ctx.lineCap = "round";
      for (const p of particles) {
        p.age++;
        if (p.age > p.max) { spawn(p); continue; }
        sampleWind(field, p.lon, p.lat, sample);
        const speed = Math.hypot(sample.u, sample.v);
        const cos = Math.max(0.1, Math.cos(p.lat * Math.PI / 180));
        p.lon += (sample.u * k) / cos;
        p.lat += sample.v * k;
        if (p.lat > 85 || p.lat < -85 || speed < 0.2) { spawn(p); continue; }
        const s = project(p, occluder);
        if (!s) { p.ok = false; if (Math.random() < 0.2) spawn(p); continue; }
        const x = s.x * dpr, y = s.y * dpr;
        if (p.ok && Math.abs(x - p.px) < 60 * dpr && Math.abs(y - p.py) < 60 * dpr) {
          ctx.strokeStyle = windStroke(look, speed);
          ctx.beginPath(); ctx.moveTo(p.px, p.py); ctx.lineTo(x, y); ctx.stroke();
        }
        p.px = x; p.py = y; p.ok = true;
      }
    };

    // Quiet hint shown only while the wind source is unreachable.
    const hint = document.createElement("div");
    hint.dataset.testid = "wind-unavailable";
    hint.setAttribute("role", "status");
    Object.assign(hint.style, { position: "absolute", left: "50%", top: "12px", transform: "translateX(-50%)", padding: "2px 8px", borderRadius: "4px", font: "11px system-ui, sans-serif", color: "rgba(255,255,255,0.75)", background: "rgba(0,0,0,0.45)", pointerEvents: "none", zIndex: "2", display: "none" });
    host.appendChild(hint);
    const setHint = (text: string | null) => { hint.textContent = text ?? ""; hint.style.display = text ? "block" : "none"; };
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let attempt = 0;
    const load = () => {
      void loadWindField(constrained, ctrl.signal).then((f) => {
        if (stopped) return;
        if (!f || f.stale) {
          logger.swallow("wind-particles:load", new Error(f ? "wind source down, using saved field" : "wind field unavailable"), "warn");
          setHint(f ? `Wind data unavailable, showing saved ${f.time.slice(11, 16)} UTC field` : "Wind data unavailable, retrying");
          if (attempt < WIND_RETRY_MS.length) retryTimer = setTimeout(load, WIND_RETRY_MS[attempt++]);
          if (!f) return;
        } else setHint(null);
        const first = !field;
        field = f;
        canvas.dataset.fieldTime = f.time;
        canvas.dataset.stale = f.stale ? "true" : "false";
        if (first) raf = requestAnimationFrame(frame);
      });
    };
    load();

    return () => {
      stopped = true; ctrl.abort(); cancelAnimationFrame(raf); clearTimeout(retryTimer);
      canvas.remove(); hint.remove();
      try { viewer.creditDisplay.removeStaticCredit?.(credit); } catch (e) { logger.swallow("wind-particles:credit-remove", e, "debug"); }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- lookKey captures the look booleans
  }, [layers.wind, isReplaying, loading, lookKey, viewerRef, cesiumRef, entityGroupsRef]);
}
