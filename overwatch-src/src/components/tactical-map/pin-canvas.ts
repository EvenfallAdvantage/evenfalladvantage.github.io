/**
 * Shared canvas pin icon builder for Cesium billboards (Staff, Incidents, Operations).
 *
 * Uses cached HiDPI (2x) vector glyphs instead of system font symbols:
 * - "person": head-and-shoulders operator silhouette
 * - "alert": warning triangle + exclamation mark
 * - "flag": tactical pennant flag on mast
 */

export type PinIconType = "flag" | "person" | "alert";

const pinCache = new Map<string, HTMLCanvasElement>();
const DPRI = 2;

export function clearPinCanvasCache(): void {
  pinCache.clear();
}

export function createPinCanvas(color: string, iconType: PinIconType): HTMLCanvasElement {
  const key = `${iconType}:${color}`;
  const cached = pinCache.get(key);
  if (cached) return cached;

  const logicalSize = 36;
  const canvas = document.createElement("canvas");
  canvas.width = logicalSize * DPRI;
  canvas.height = logicalSize * DPRI;
  canvas.style.width = `${logicalSize}px`;
  canvas.style.height = `${logicalSize}px`;
  canvas.setAttribute("data-pin-canvas", key);

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    pinCache.set(key, canvas);
    return canvas;
  }

  ctx.save();
  ctx.scale(DPRI, DPRI);
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // Dark tactical halo + colored teardrop pin body
  ctx.beginPath();
  ctx.arc(18, 14, 12, Math.PI, 0, false);
  ctx.lineTo(18, 34);
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
  ctx.strokeStyle = "#090d16";
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // Inner white highlight rim
  ctx.beginPath();
  ctx.arc(18, 14, 10.2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(9, 13, 22, 0.32)";
  ctx.fill();
  ctx.strokeStyle = "rgba(255, 255, 255, 0.85)";
  ctx.lineWidth = 1.2;
  ctx.stroke();

  // Vector glyph inside the pin head (centered around (18, 14))
  ctx.fillStyle = "#ffffff";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.6;

  if (iconType === "person") {
    // Operator head
    ctx.beginPath();
    ctx.arc(18, 11, 2.7, 0, Math.PI * 2);
    ctx.fill();
    // Operator shoulders
    ctx.beginPath();
    ctx.arc(18, 19.2, 5.2, Math.PI * 1.12, Math.PI * 1.88, false);
    ctx.closePath();
    ctx.fill();
  } else if (iconType === "alert") {
    // Warning triangle outline + exclamation mark
    ctx.beginPath();
    ctx.moveTo(18, 8.2);
    ctx.lineTo(23.6, 18.2);
    ctx.lineTo(12.4, 18.2);
    ctx.closePath();
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(18, 11.6);
    ctx.lineTo(18, 14.8);
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(18, 16.7, 0.9, 0, Math.PI * 2);
    ctx.fill();
  } else {
    // Tactical pennant flag on mast
    ctx.beginPath();
    ctx.moveTo(14.5, 8.8);
    ctx.lineTo(14.5, 19.4);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(14.5, 9.2);
    ctx.lineTo(22.8, 11.8);
    ctx.lineTo(14.5, 14.6);
    ctx.closePath();
    ctx.fill();
  }

  ctx.restore();
  pinCache.set(key, canvas);
  return canvas;
}

/** Parse incident description — extract narrative from structured form dump */
export function parseIncidentNarrative(desc: string): string {
  if (!desc) return "";
  const parts = desc.split(/\s*---\s*/);
  return parts[0]?.trim() || desc.slice(0, 120);
}
