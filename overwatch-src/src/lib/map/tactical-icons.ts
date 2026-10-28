/**
 * Shared HiDPI (devicePixelRatio = 2) tactical symbology sprite generator.
 *
 * Replaces generic colored dots (`PointGraphics`) and placeholder glyphs with
 * distinct, memoized vector silhouettes with dark tactical halos (`#090d16`)
 * that remain legible over satellite imagery, dark basemaps, and NVG/FLIR looks.
 */

import type { AircraftCategory } from "@/lib/map/aircraft-category";
import type { PoiType } from "@/components/tactical-map/env-intel";

export type TacticalHazardIconKind = "quake" | "fire" | "volcano" | "cyclone";
export type TacticalInfraIconKind = "s" | "d" | "w" | "m" | "p";
export type TacticalMiscIconKind =
  | "cctv"
  | "street-photo"
  | "satellite"
  | "rocket"
  | "news"
  | "raws-calm"
  | "wind-arrow"
  | "conflict"
  | "nuclear"
  | "port"
  | "chokepoint";

export interface TacticalIconOptions {
  size?: number;
  highContrast?: boolean;
  emergency?: boolean;
  severity?: number;
  magnitude?: number;
}

const DPRI = 2;
const HALO_DARK = "#090d16";
const HALO_LIGHT = "#f8fafc";
const MAX_CACHE_ENTRIES = 512;

const iconCache = new Map<string, HTMLCanvasElement>();

export function clearTacticalIconCache(): void {
  iconCache.clear();
}

export function getTacticalIconCacheSize(): number {
  return iconCache.size;
}

function getOrCreateCanvas(
  cacheKey: string,
  logicalSize: number,
  draw: (ctx: CanvasRenderingContext2D, s: number) => void,
): HTMLCanvasElement {
  const hit = iconCache.get(cacheKey);
  if (hit) return hit;

  if (iconCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = iconCache.keys().next().value;
    if (firstKey !== undefined) iconCache.delete(firstKey);
  }

  const canvas = document.createElement("canvas");
  const px = Math.max(8, Math.round(logicalSize));
  canvas.width = px * DPRI;
  canvas.height = px * DPRI;
  canvas.style.width = `${px}px`;
  canvas.style.height = `${px}px`;
  canvas.setAttribute("data-tactical-icon", cacheKey);

  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.save();
    ctx.scale(DPRI, DPRI);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    draw(ctx, px);
    ctx.restore();
  }

  iconCache.set(cacheKey, canvas);
  return canvas;
}

function drawBadgeBackdrop(
  ctx: CanvasRenderingContext2D,
  s: number,
  color: string,
  highContrast: boolean,
  shape: "circle" | "diamond" | "square" | "shield" = "circle",
) {
  const c = s / 2;
  const r = s / 2 - 2;
  const bgFill = highContrast ? HALO_DARK : "rgba(9, 13, 22, 0.9)";
  const ringStroke = highContrast ? HALO_LIGHT : color;

  ctx.beginPath();
  if (shape === "diamond") {
    ctx.moveTo(c, 1.5);
    ctx.lineTo(s - 1.5, c);
    ctx.lineTo(c, s - 1.5);
    ctx.lineTo(1.5, c);
    ctx.closePath();
  } else if (shape === "square") {
    const pad = 2.5;
    ctx.rect(pad, pad, s - pad * 2, s - pad * 2);
  } else if (shape === "shield") {
    ctx.moveTo(c, 2);
    ctx.lineTo(s - 2.5, 4.5);
    ctx.lineTo(s - 3.5, c + 2);
    ctx.quadraticCurveTo(s - 4, s - 4, c, s - 1.5);
    ctx.quadraticCurveTo(4, s - 4, 3.5, c + 2);
    ctx.lineTo(2.5, 4.5);
    ctx.closePath();
  } else {
    ctx.arc(c, c, r, 0, Math.PI * 2);
  }

  ctx.fillStyle = bgFill;
  ctx.fill();
  ctx.lineWidth = 1.8;
  ctx.strokeStyle = ringStroke;
  ctx.stroke();
}

/**
 * 1. Top-down directional aircraft silhouette pointing North (`0°`).
 * Rotating the Cesium billboard by `-Cesium.Math.toRadians(heading)` aligns
 * the nose with true track.
 */
export function getAircraftIcon(
  category: AircraftCategory,
  color: string,
  options?: TacticalIconOptions,
): HTMLCanvasElement {
  const size = options?.size ?? 26;
  const hc = Boolean(options?.highContrast);
  const emergency = Boolean(options?.emergency);
  const key = `aircraft:${category}:${color}:${size}:${hc ? 1 : 0}:${emergency ? 1 : 0}`;

  return getOrCreateCanvas(key, size, (ctx, s) => {
    const c = s / 2;
    const fill = hc ? HALO_DARK : color;
    const stroke = hc ? HALO_LIGHT : HALO_DARK;

    if (emergency) {
      ctx.beginPath();
      ctx.moveTo(c, 1);
      ctx.lineTo(s - 1, c);
      ctx.lineTo(c, s - 1);
      ctx.lineTo(1, c);
      ctx.closePath();
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.8;
      ctx.stroke();
    }

    ctx.fillStyle = fill;
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.6;

    if (category === "helicopter") {
      // Fuselage + tail boom pointing North
      ctx.beginPath();
      ctx.ellipse(c, c - 1.5, 3.2, 5.2, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(c - 1.1, c + 3);
      ctx.lineTo(c + 1.1, c + 3);
      ctx.lineTo(c + 0.7, s - 3);
      ctx.lineTo(c - 2.6, s - 2.2);
      ctx.lineTo(c - 0.8, s - 4.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Crossed 4-blade rotor disc
      ctx.strokeStyle = hc ? HALO_LIGHT : color;
      ctx.lineWidth = 1.5;
      const rSpan = c - 3.5;
      ctx.beginPath();
      ctx.moveTo(c - rSpan, c - 1.5 - rSpan);
      ctx.lineTo(c + rSpan, c - 1.5 + rSpan);
      ctx.moveTo(c + rSpan, c - 1.5 - rSpan);
      ctx.lineTo(c - rSpan, c - 1.5 + rSpan);
      ctx.stroke();
      return;
    }

    if (category === "military") {
      // Sleek delta-wing fighter jet pointing North
      ctx.beginPath();
      ctx.moveTo(c, 2); // nose
      ctx.lineTo(c + 2, 7.5);
      ctx.lineTo(s - 2.5, c + 4.5); // right delta tip
      ctx.lineTo(s - 2.5, c + 6.5);
      ctx.lineTo(c + 2.5, c + 5.2);
      ctx.lineTo(c + 3.6, s - 2.5); // right twin tail
      ctx.lineTo(c + 1.2, s - 3.6);
      ctx.lineTo(c, s - 2.2); // exhaust
      ctx.lineTo(c - 1.2, s - 3.6);
      ctx.lineTo(c - 3.6, s - 2.5); // left twin tail
      ctx.lineTo(c - 2.5, c + 5.2);
      ctx.lineTo(2.5, c + 6.5);
      ctx.lineTo(2.5, c + 4.5); // left delta tip
      ctx.lineTo(c - 2, 7.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }

    if (category === "ga" || category === "unknown") {
      // Straight-wing general aviation prop silhouette pointing North
      ctx.beginPath();
      ctx.moveTo(c, 2.5);
      ctx.lineTo(c + 1.8, 6.5);
      ctx.lineTo(s - 2.5, c - 0.5);
      ctx.lineTo(s - 2.5, c + 2.2);
      ctx.lineTo(c + 1.6, c + 2.4);
      ctx.lineTo(c + 1.2, s - 5.5);
      ctx.lineTo(c + 4.5, s - 3.2);
      ctx.lineTo(c + 4.5, s - 2);
      ctx.lineTo(c, s - 2.6);
      ctx.lineTo(c - 4.5, s - 2);
      ctx.lineTo(c - 4.5, s - 3.2);
      ctx.lineTo(c - 1.2, s - 5.5);
      ctx.lineTo(c - 1.6, c + 2.4);
      ctx.lineTo(2.5, c + 2.2);
      ctx.lineTo(2.5, c - 0.5);
      ctx.lineTo(c - 1.8, 6.5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      return;
    }

    // Commercial / Cargo / Government swept-wing jetliner pointing North
    ctx.beginPath();
    ctx.moveTo(c, 2); // nose
    ctx.lineTo(c + 2.1, 6.5);
    ctx.lineTo(c + 2.1, c - 2);
    ctx.lineTo(s - 2, c + 3); // right wingtip
    ctx.lineTo(s - 2, c + 4.8);
    ctx.lineTo(c + 2, c + 2.2);
    ctx.lineTo(c + 1.6, s - 5.5);
    ctx.lineTo(c + 5.2, s - 2.8); // right tailplane
    ctx.lineTo(c + 5.2, s - 1.6);
    ctx.lineTo(c, s - 2.8);
    ctx.lineTo(c - 5.2, s - 1.6);
    ctx.lineTo(c - 5.2, s - 2.8); // left tailplane
    ctx.lineTo(c - 1.6, s - 5.5);
    ctx.lineTo(c - 2, c + 2.2);
    ctx.lineTo(2, c + 4.8);
    ctx.lineTo(2, c + 3); // left wingtip
    ctx.lineTo(c - 2.1, c - 2);
    ctx.lineTo(c - 2.1, 6.5);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  });
}

/**
 * 2. Nearby Emergency & Infrastructure POI Category Badges (8 distinct types).
 */
export function getPoiIcon(
  poiType: PoiType,
  color: string,
  options?: TacticalIconOptions,
): HTMLCanvasElement {
  const size = options?.size ?? 24;
  const hc = Boolean(options?.highContrast);
  const key = `poi:${poiType}:${color}:${size}:${hc ? 1 : 0}`;

  return getOrCreateCanvas(key, size, (ctx, s) => {
    const c = s / 2;
    const shape = poiType === "police" ? "shield" : "circle";
    drawBadgeBackdrop(ctx, s, color, hc, shape);

    const fg = hc ? HALO_LIGHT : color;
    ctx.fillStyle = fg;
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.8;

    switch (poiType) {
      case "hospital": {
        // Bold medical cross (+)
        const arm = 5;
        const t = 1.8;
        ctx.beginPath();
        ctx.rect(c - t, c - arm, t * 2, arm * 2);
        ctx.rect(c - arm, c - t, arm * 2, t * 2);
        ctx.fill();
        break;
      }
      case "police": {
        // Star chevron inside law-enforcement shield
        ctx.beginPath();
        ctx.moveTo(c - 4, c + 1.5);
        ctx.lineTo(c, c - 2.5);
        ctx.lineTo(c + 4, c + 1.5);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c, c + 2.5, 1.5, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "fire_station": {
        // Flame silhouette inside badge
        ctx.beginPath();
        ctx.moveTo(c, c - 5.5);
        ctx.bezierCurveTo(c + 4.5, c - 2, c + 4.5, c + 3, c, c + 5.2);
        ctx.bezierCurveTo(c - 4.5, c + 3, c - 4.5, c - 2, c, c - 5.5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = HALO_DARK;
        ctx.beginPath();
        ctx.arc(c, c + 2.2, 1.6, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case "pharmacy": {
        // Mortar bowl + pestle / cross
        ctx.beginPath();
        ctx.arc(c, c + 0.5, 4.2, 0, Math.PI, false);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(c - 3, c + 5);
        ctx.lineTo(c + 3, c + 5);
        ctx.moveTo(c + 1, c + 0.5);
        ctx.lineTo(c + 3.5, c - 4.2);
        ctx.stroke();
        break;
      }
      case "school": {
        // Graduation cap / pediment diamond + tassel
        ctx.beginPath();
        ctx.moveTo(c, c - 4.5);
        ctx.lineTo(c + 5.5, c - 1);
        ctx.lineTo(c, c + 2.2);
        ctx.lineTo(c - 5.5, c - 1);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(c - 3.2, c + 1.5);
        ctx.lineTo(c - 3.2, c + 4.5);
        ctx.lineTo(c + 3.2, c + 4.5);
        ctx.lineTo(c + 3.2, c + 1.5);
        ctx.stroke();
        break;
      }
      case "fuel": {
        // Fuel pump body + nozzle hose
        ctx.beginPath();
        ctx.rect(c - 4, c - 4.2, 6, 8.6);
        ctx.stroke();
        ctx.fillRect(c - 2.6, c - 2.8, 3.2, 2.4);
        ctx.beginPath();
        ctx.moveTo(c + 2, c - 2);
        ctx.lineTo(c + 4.5, c - 0.5);
        ctx.lineTo(c + 4.5, c + 3.2);
        ctx.stroke();
        break;
      }
      case "helipad": {
        // Bold "H" inside helipad circle
        ctx.beginPath();
        ctx.moveTo(c - 3.2, c - 4.2);
        ctx.lineTo(c - 3.2, c + 4.2);
        ctx.moveTo(c + 3.2, c - 4.2);
        ctx.lineTo(c + 3.2, c + 4.2);
        ctx.moveTo(c - 3.2, c);
        ctx.lineTo(c + 3.2, c);
        ctx.stroke();
        break;
      }
      case "shelter": {
        // Protective shelter roof chevron + base dot
        ctx.beginPath();
        ctx.moveTo(c - 5, c);
        ctx.lineTo(c, c - 4.8);
        ctx.lineTo(c + 5, c);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(c, c + 2.2, 2.1, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
    }
  });
}

/**
 * 3. Natural Hazards Tactical Icons (Quake epicenter, Fire flame, Volcano cone, Cyclone spiral).
 */
export function getHazardIcon(
  kind: TacticalHazardIconKind,
  color: string,
  options?: TacticalIconOptions,
): HTMLCanvasElement {
  const sev = Math.max(1, Math.min(5, Math.round(options?.severity ?? 2)));
  const baseSize =
    options?.size ??
    (kind === "quake"
      ? 18 + sev * 3
      : kind === "cyclone"
        ? 26
        : kind === "volcano"
          ? 22
          : 16 + sev * 2);
  const hc = Boolean(options?.highContrast);
  const key = `hazard:${kind}:${color}:${baseSize}:${sev}:${hc ? 1 : 0}`;

  return getOrCreateCanvas(key, baseSize, (ctx, s) => {
    const c = s / 2;
    const fg = hc ? HALO_LIGHT : color;

    if (kind === "quake") {
      // Outer seismic ring
      ctx.beginPath();
      ctx.arc(c, c, c - 2, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(9, 13, 22, 0.72)";
      ctx.fill();
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = fg;
      ctx.stroke();

      // Inner target ring
      if (s >= 22) {
        ctx.beginPath();
        ctx.arc(c, c, (c - 2) * 0.55, 0, Math.PI * 2);
        ctx.lineWidth = 1.1;
        ctx.strokeStyle = fg;
        ctx.stroke();
      }

      // Seismic waveform pulse across center
      const w = c - 3.5;
      ctx.beginPath();
      ctx.moveTo(c - w, c);
      ctx.lineTo(c - w * 0.45, c);
      ctx.lineTo(c - w * 0.2, c - w * 0.55);
      ctx.lineTo(c + w * 0.15, c + w * 0.55);
      ctx.lineTo(c + w * 0.4, c - w * 0.25);
      ctx.lineTo(c + w * 0.6, c);
      ctx.lineTo(c + w, c);
      ctx.lineWidth = 1.6;
      ctx.strokeStyle = "#ffffff";
      ctx.stroke();
      return;
    }

    if (kind === "fire") {
      drawBadgeBackdrop(ctx, s, color, hc, "circle");
      ctx.fillStyle = fg;
      ctx.beginPath();
      ctx.moveTo(c, 4);
      ctx.bezierCurveTo(c + 4.5, c - 1.5, c + 4.2, c + 3, c, s - 4);
      ctx.bezierCurveTo(c - 4.2, c + 3, c - 4.5, c - 1.5, c, 4);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (kind === "volcano") {
      drawBadgeBackdrop(ctx, s, color, hc, "circle");
      ctx.fillStyle = fg;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.5;
      // Volcanic cone triangle with crater notch
      ctx.beginPath();
      ctx.moveTo(c - 5.2, c + 4.5);
      ctx.lineTo(c - 1.8, c - 1.5);
      ctx.lineTo(c + 1.8, c - 1.5);
      ctx.lineTo(c + 5.2, c + 4.5);
      ctx.closePath();
      ctx.fill();
      // Eruption plume arcs
      ctx.beginPath();
      ctx.moveTo(c, c - 2);
      ctx.quadraticCurveTo(c - 3, c - 5.5, c - 4.2, c - 3.8);
      ctx.moveTo(c, c - 2);
      ctx.quadraticCurveTo(c + 3, c - 5.5, c + 4.2, c - 3.8);
      ctx.stroke();
      return;
    }

    // Cyclone / hurricane spiral glyph
    drawBadgeBackdrop(ctx, s, color, hc, "circle");
    ctx.strokeStyle = fg;
    ctx.fillStyle = fg;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(c, c, 2.4, 0, Math.PI * 2);
    ctx.stroke();
    // Twin curved hurricane arms
    ctx.beginPath();
    ctx.arc(c, c, 5.8, -0.3, Math.PI - 0.6);
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(c, c, 5.8, Math.PI - 0.3, Math.PI * 2 - 0.6);
    ctx.stroke();
  });
}

/**
 * 4. OSM Infrastructure Badges (`s` substation, `d` data center, `w` dam, `m` military, `p` power).
 */
export function getInfraIcon(
  kind: TacticalInfraIconKind,
  color: string,
  options?: TacticalIconOptions,
): HTMLCanvasElement {
  const size = options?.size ?? (kind === "s" ? 18 : 22);
  const hc = Boolean(options?.highContrast);
  const key = `infra:${kind}:${color}:${size}:${hc ? 1 : 0}`;

  return getOrCreateCanvas(key, size, (ctx, s) => {
    const c = s / 2;
    const fg = hc ? HALO_LIGHT : color;

    if (kind === "s") {
      // High-voltage substation diamond + lightning bolt
      drawBadgeBackdrop(ctx, s, color, hc, "diamond");
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(c + 1, c - 4.2);
      ctx.lineTo(c - 2, c + 0.3);
      ctx.lineTo(c + 0.8, c + 0.3);
      ctx.lineTo(c - 1, c + 4.2);
      ctx.stroke();
      return;
    }

    if (kind === "d") {
      // Data center server rack stack
      drawBadgeBackdrop(ctx, s, color, hc, "square");
      ctx.strokeStyle = fg;
      ctx.fillStyle = fg;
      ctx.lineWidth = 1.4;
      for (const dy of [-3.2, 0, 3.2]) {
        ctx.strokeRect(c - 4.5, c + dy - 1.1, 9, 2.2);
      }
      return;
    }

    if (kind === "w") {
      // Dam / water wave badge
      drawBadgeBackdrop(ctx, s, color, hc, "circle");
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.6;
      for (const dy of [-1.8, 2]) {
        ctx.beginPath();
        ctx.moveTo(c - 4.5, c + dy);
        ctx.quadraticCurveTo(c - 2.2, c + dy - 2.2, c, c + dy);
        ctx.quadraticCurveTo(c + 2.2, c + dy + 2.2, c + 4.5, c + dy);
        ctx.stroke();
      }
      return;
    }

    if (kind === "m") {
      // NATO tactical military installation frame (rectangle with top bar)
      drawBadgeBackdrop(ctx, s, color, hc, "square");
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.6;
      ctx.strokeRect(c - 4.8, c - 3.2, 9.6, 6.4);
      ctx.beginPath();
      ctx.moveTo(c - 4.8, c - 3.2);
      ctx.lineTo(c + 4.8, c + 3.2);
      ctx.moveTo(c + 4.8, c - 3.2);
      ctx.lineTo(c - 4.8, c + 3.2);
      ctx.stroke();
      return;
    }

    // "p" power plant generator badge
    drawBadgeBackdrop(ctx, s, color, hc, "circle");
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(c, c, 3.8, 0.25 * Math.PI, 0.75 * Math.PI, true);
    ctx.moveTo(c, c - 4.8);
    ctx.lineTo(c, c + 0.5);
    ctx.stroke();
  });
}

/**
 * 5. Tactical Badges for CCTV, Street-Level Photos, Satellites, Rocket Launches, News & Calm RAWS.
 */
export function getTacticalIcon(
  kind: TacticalMiscIconKind,
  color: string,
  options?: TacticalIconOptions,
): HTMLCanvasElement {
  const defaultSize =
    kind === "rocket"
      ? 24
      : kind === "cctv"
        ? 20
        : kind === "news"
          ? 20
          : kind === "satellite"
            ? 20
            : 18;
  const size = options?.size ?? defaultSize;
  const hc = Boolean(options?.highContrast);
  const key = `misc:${kind}:${color}:${size}:${hc ? 1 : 0}`;

  return getOrCreateCanvas(key, size, (ctx, s) => {
    const c = s / 2;
    const fg = hc ? HALO_LIGHT : color;

    if (kind === "cctv") {
      drawBadgeBackdrop(ctx, s, color, hc, "circle");
      ctx.strokeStyle = fg;
      ctx.fillStyle = fg;
      ctx.lineWidth = 1.5;
      // Camera housing + lens cone
      ctx.strokeRect(c - 4.5, c - 2.6, 6.2, 5.2);
      ctx.beginPath();
      ctx.moveTo(c + 1.7, c - 1.5);
      ctx.lineTo(c + 4.6, c - 3);
      ctx.lineTo(c + 4.6, c + 3);
      ctx.lineTo(c + 1.7, c + 1.5);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (kind === "street-photo") {
      drawBadgeBackdrop(ctx, s, color, hc, "circle");
      ctx.strokeStyle = fg;
      ctx.fillStyle = fg;
      ctx.lineWidth = 1.5;
      // 360° camera viewfinder ring + center pupil
      ctx.beginPath();
      ctx.arc(c, c, 3.6, 0, Math.PI * 2);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c, c, 1.4, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (kind === "satellite") {
      // 2D solar-wing satellite silhouette
      const bg = hc ? HALO_DARK : "rgba(9, 13, 22, 0.88)";
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.arc(c, c, c - 1.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = fg;
      ctx.fillStyle = fg;
      ctx.lineWidth = 1.5;
      // Central bus
      ctx.fillRect(c - 2, c - 2, 4, 4);
      // Left & right solar wings
      ctx.strokeRect(2.2, c - 2.6, 4.4, 5.2);
      ctx.strokeRect(s - 6.6, c - 2.6, 4.4, 5.2);
      // Dish / antenna pointing down-right
      ctx.beginPath();
      ctx.moveTo(c, c + 2);
      ctx.lineTo(c, s - 3);
      ctx.stroke();
      return;
    }

    if (kind === "rocket") {
      drawBadgeBackdrop(ctx, s, color, hc, "circle");
      ctx.fillStyle = fg;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.4;
      // Crisp vector rocket nose + body + fins
      ctx.beginPath();
      ctx.moveTo(c, 4);
      ctx.quadraticCurveTo(c + 3, 8, c + 2.4, c + 3);
      ctx.lineTo(c + 4.4, c + 5.2);
      ctx.lineTo(c + 2, c + 4.5);
      ctx.lineTo(c - 2, c + 4.5);
      ctx.lineTo(c - 4.4, c + 5.2);
      ctx.lineTo(c - 2.4, c + 3);
      ctx.quadraticCurveTo(c - 3, 8, c, 4);
      ctx.closePath();
      ctx.fill();
      return;
    }

    if (kind === "news") {
      drawBadgeBackdrop(ctx, s, color, hc, "circle");
      ctx.strokeStyle = fg;
      ctx.fillStyle = fg;
      ctx.lineWidth = 1.5;
      // Broadcast pulse dot + signal arcs
      ctx.beginPath();
      ctx.arc(c, c + 2, 1.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.arc(c, c + 2, 3.6, Math.PI * 1.2, Math.PI * 1.8);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c, c + 2, 5.8, Math.PI * 1.18, Math.PI * 1.82);
      ctx.stroke();
      return;
    }

    if (kind === "wind-arrow") {
      ctx.strokeStyle = fg;
      ctx.fillStyle = fg;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(c, 2);
      ctx.lineTo(c - 4, 8);
      ctx.lineTo(c + 4, 8);
      ctx.closePath();
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(c, 8);
      ctx.lineTo(c, s - 2);
      ctx.stroke();
      return;
    }

    if (kind === "conflict") {
      drawBadgeBackdrop(ctx, s, color, hc, "diamond");
      ctx.fillStyle = fg;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.8;
      ctx.beginPath();
      ctx.moveTo(c, c - 4);
      ctx.lineTo(c, c + 0.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(c, c + 3.2, 1.1, 0, Math.PI * 2);
      ctx.fill();
      return;
    }

    if (kind === "nuclear") {
      drawBadgeBackdrop(ctx, s, color, hc, "circle");
      ctx.fillStyle = fg;
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.arc(c, c, 1.6, 0, Math.PI * 2);
      ctx.fill();
      for (const a of [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6]) {
        ctx.beginPath();
        ctx.arc(c, c, 4.6, a - 0.35, a + 0.35);
        ctx.stroke();
      }
      return;
    }

    if (kind === "port") {
      drawBadgeBackdrop(ctx, s, color, hc, "square");
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(c, c - 4);
      ctx.lineTo(c, c + 4);
      ctx.moveTo(c - 3, c - 1.5);
      ctx.lineTo(c + 3, c - 1.5);
      ctx.arc(c, c + 0.5, 3.6, 0.15 * Math.PI, 0.85 * Math.PI);
      ctx.stroke();
      return;
    }

    if (kind === "chokepoint") {
      drawBadgeBackdrop(ctx, s, color, hc, "diamond");
      ctx.strokeStyle = fg;
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      ctx.moveTo(c - 3.5, c - 3.5);
      ctx.lineTo(c - 1.2, c);
      ctx.lineTo(c - 3.5, c + 3.5);
      ctx.moveTo(c + 3.5, c - 3.5);
      ctx.lineTo(c + 1.2, c);
      ctx.lineTo(c + 3.5, c + 3.5);
      ctx.stroke();
      return;
    }

    // "raws-calm": calm weather station concentric wind ring (0 mph)
    drawBadgeBackdrop(ctx, s, color, hc, "circle");
    ctx.strokeStyle = fg;
    ctx.lineWidth = 1.4;
    ctx.beginPath();
    ctx.arc(c, c, 2.8, 0, Math.PI * 2);
    ctx.stroke();
  });
}
