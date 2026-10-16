// intel-cctv helpers. Parsers live in ../_shared/cctv (shared with ingest).
export * from "../_shared/cctv/parsers.ts";

export interface BBoxQuery { west: number; south: number; east: number; north: number; zoom: number; limit: number }

export const MAX_LIMIT = 5000;
export const DEFAULT_LIMIT = 2000;

/** Grid step (deg) used to round bboxes so nearby viewports share cache keys. */
export function gridStep(zoom: number): number {
  return Math.max(0.01, 360 / 2 ** Math.max(0, Math.min(zoom, 22)) / 8);
}

const roundTo = (v: number, step: number, dir: "down" | "up") =>
  +(dir === "down" ? Math.floor(v / step) * step : Math.ceil(v / step) * step).toFixed(6);

/** Normalise any longitude to [-180, 180]. */
export function wrapLng(lng: number): number {
  if (lng >= -180 && lng <= 180) return lng;
  return ((((lng + 180) % 360) + 360) % 360) - 180;
}

/**
 * Parse `bbox=w,s,e,n&zoom=z[&limit=n]`. Longitudes are wrapped, so a view
 * crossing the antimeridian arrives as west > east (handled by the SQL).
 * Boxes spanning >= 360° become the whole world. The box is rounded OUTWARD
 * to a zoom-dependent grid for cache sharing.
 */
export function parseBBoxQuery(params: URLSearchParams): BBoxQuery | { error: string } | null {
  const raw = params.get("bbox");
  if (raw == null) return null;
  const parts = raw.split(",").map((x) => Number(x.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return { error: "bbox must be west,south,east,north" };
  let [west, south, east, north] = parts;
  const zoomRaw = Number(params.get("zoom") ?? "10");
  if (!Number.isFinite(zoomRaw)) return { error: "zoom must be a number" };
  const zoom = Math.max(0, Math.min(22, Math.round(zoomRaw)));
  const limitRaw = Number(params.get("limit") ?? DEFAULT_LIMIT);
  const limit = Math.max(1, Math.min(MAX_LIMIT, Number.isFinite(limitRaw) ? Math.round(limitRaw) : DEFAULT_LIMIT));
  if (south > north) [south, north] = [north, south];
  south = Math.max(-90, south); north = Math.min(90, north);
  const step = gridStep(zoom);
  if (east - west >= 360) { west = -180; east = 180; }
  else {
    west = wrapLng(roundTo(wrapLng(west), step, "down"));
    east = wrapLng(roundTo(wrapLng(east), step, "up"));
  }
  south = Math.max(-90, roundTo(south, step, "down"));
  north = Math.min(90, roundTo(north, step, "up"));
  return { west, south, east, north, zoom, limit };
}

export function bboxCacheKey(q: BBoxQuery): string {
  return `${q.west},${q.south},${q.east},${q.north},${q.zoom},${q.limit}`;
}

/** Attach attribution strings for the sources present in a bbox response. */
export function attributionFor(sources: Record<string, number> | undefined, table: Record<string, string>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const s of Object.keys(sources ?? {})) out[s] = table[s] ?? s;
  return out;
}
