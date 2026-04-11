/**
 * Pin icon canvas cache — creates and caches pin icons for Cesium billboards.
 * Avoids creating new canvases on every render cycle.
 */

const pinCache = new Map<string, HTMLCanvasElement>();

export function createPinCanvas(color: string, type: "flag" | "person" | "alert"): HTMLCanvasElement {
  const key = `${color}-${type}`;
  if (pinCache.has(key)) return pinCache.get(key)!;

  const size = 28;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const r = size / 2;

  // Drop shadow
  ctx.shadowColor = "rgba(0,0,0,0.4)";
  ctx.shadowBlur = 3;
  ctx.shadowOffsetY = 1;

  // Filled circle
  ctx.beginPath();
  ctx.arc(r, r, r - 3, 0, Math.PI * 2);
  ctx.fillStyle = color;
  ctx.fill();

  // White border
  ctx.shadowColor = "transparent";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 2;
  ctx.stroke();

  // Icon
  ctx.fillStyle = "#ffffff";
  ctx.font = `bold ${size * 0.4}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const icon = type === "flag" ? "\u2691" : type === "person" ? "\u2022" : "\u26A0";
  ctx.fillText(icon, r, r);

  pinCache.set(key, canvas);
  return canvas;
}

/** Parse incident description — extract narrative from structured form dump */
export function parseIncidentNarrative(desc: string): string {
  if (!desc) return "";
  // The description often contains "Narrative --- When --- details..." format
  const parts = desc.split(/\s*---\s*/);
  // First part is usually the narrative
  return parts[0]?.trim() || desc.slice(0, 120);
}
