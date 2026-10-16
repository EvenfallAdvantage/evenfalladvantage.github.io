/**
 * Pure helpers for viewport-driven CCTV loading (use-cctv-layer).
 * Kept Cesium-free so they are unit-testable.
 */

export interface ViewBBox { west: number; south: number; east: number; north: number }

/** Approximate web-map zoom from camera height (m). ~z0 at 35,000 km. */
export function zoomFromHeight(heightM: number): number {
  if (!Number.isFinite(heightM) || heightM <= 0) return 22;
  return Math.max(0, Math.min(22, Math.round(Math.log2(35_000_000 / heightM))));
}

const DEG = 180 / Math.PI;

/**
 * Cesium Rectangle (radians) → degrees. Cesium already reports west > east
 * when the view crosses the antimeridian; that is preserved (server splits).
 */
export function rectToBBox(rect: { west: number; south: number; east: number; north: number }): ViewBBox {
  const r = (v: number) => +(v * DEG).toFixed(4);
  return { west: r(rect.west), south: r(rect.south), east: r(rect.east), north: r(rect.north) };
}

/** Grid-round outward (matches server rounding) so pans within a cell don't refetch. */
export function roundBBox(b: ViewBBox, zoom: number): ViewBBox {
  const step = Math.max(0.01, 360 / 2 ** Math.max(0, Math.min(zoom, 22)) / 8);
  const dn = (v: number) => +(Math.floor(v / step) * step).toFixed(6);
  const up = (v: number) => +(Math.ceil(v / step) * step).toFixed(6);
  return {
    west: Math.max(-180, dn(b.west)), south: Math.max(-90, dn(b.south)),
    east: Math.min(180, up(b.east)), north: Math.min(90, up(b.north)),
  };
}

export function bboxKey(b: ViewBBox, zoom: number): string {
  return `${b.west},${b.south},${b.east},${b.north}@${zoom}`;
}

/** Ids to add/remove to go from `current` to `next`. */
export function diffIds(current: Iterable<string>, next: Iterable<string>): { add: string[]; remove: string[] } {
  const cur = new Set(current), nxt = new Set(next);
  const add: string[] = [], remove: string[] = [];
  for (const id of nxt) if (!cur.has(id)) add.push(id);
  for (const id of cur) if (!nxt.has(id)) remove.push(id);
  return { add, remove };
}

/** Compact cluster label: 1234 → "1.2k". */
export function clusterLabel(n: number): string {
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

/** Single credit line for the sources in view (sorted, deduped). */
export function attributionLine(attribution: Record<string, string> | undefined): string {
  const vals = [...new Set(Object.values(attribution ?? {}).filter(Boolean))].sort();
  return vals.length ? `CCTV: ${vals.join(" · ")}` : "";
}
