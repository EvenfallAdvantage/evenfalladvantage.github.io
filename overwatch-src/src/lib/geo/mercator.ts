/** Web Mercator helpers for 256 px tiles (pure, unit-tested). */
export const TILE = 256;

export function lngLatToWorld(lng: number, lat: number, z: number): { x: number; y: number } {
  const s = TILE * 2 ** z;
  const sin = Math.sin((Math.max(-85.05112878, Math.min(85.05112878, lat)) * Math.PI) / 180);
  return { x: ((lng + 180) / 360) * s, y: (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * s };
}

export function worldToLngLat(x: number, y: number, z: number): { lng: number; lat: number } {
  const s = TILE * 2 ** z;
  const lng = (x / s) * 360 - 180;
  const n = Math.PI - (2 * Math.PI * y) / s;
  return { lng, lat: (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) };
}

/** Open ring of [lng, lat] -> closed GeoJSON Polygon, or null if < 3 corners. */
export function ringToPolygon(pts: Array<[number, number]>): { type: "Polygon"; coordinates: Array<Array<[number, number]>> } | null {
  if (pts.length < 3) return null;
  return { type: "Polygon", coordinates: [[...pts, pts[0]]] };
}

/** Closed GeoJSON Polygon outer ring -> open ring (for editing). */
export function polygonToRing(g: unknown): Array<[number, number]> {
  const ring = (g as { type?: string; coordinates?: Array<Array<[number, number]>> })?.type === "Polygon" ? (g as { coordinates: Array<Array<[number, number]>> }).coordinates[0] ?? [] : [];
  if (ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1]) return ring.slice(0, -1);
  return ring;
}
