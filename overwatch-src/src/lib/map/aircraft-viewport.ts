/**
 * Which box of sky to ask the aircraft proxy (opensky-proxy → adsb.lol) for.
 *
 * The layer used to query one fixed ~400 km box around the first operation
 * with a location, or the middle of Kansas (39.83, -98.58) when there was
 * none, captured once when the layer turned on. Anywhere else on the map
 * showed no aircraft at all. The box now follows the camera:
 *   - the visible rectangle when it fits the proxy limit (10° per axis);
 *   - otherwise a 10° × 10° box centred on the middle of the view;
 *   - snapped outward to a 1° grid so small pans reuse the same request
 *     (and the proxy's 10 s cache), which keeps adsb.lol rate limits happy.
 */

export interface GeoBox { south: number; north: number; west: number; east: number }

/** Proxy limit (opensky-proxy lib.ts MAX_SPAN_DEG). */
export const AIRCRAFT_MAX_SPAN_DEG = 10;
/** Grid the query box is snapped to. */
export const AIRCRAFT_SNAP_DEG = 1;
const MAX_LAT = 85;

const clampLat = (v: number) => Math.max(-MAX_LAT, Math.min(MAX_LAT, v));
const wrapLng = (v: number) => ((((v + 180) % 360) + 360) % 360) - 180;

/** Centre of a view rectangle in degrees (handles a rectangle crossing the antimeridian, west > east). */
export function viewCenter(rect: GeoBox): { lat: number; lng: number } {
  const east = rect.east < rect.west ? rect.east + 360 : rect.east;
  return { lat: (rect.south + rect.north) / 2, lng: wrapLng((rect.west + east) / 2) };
}

/** Square-ish box of `span` degrees around a point, kept inside ±85° lat and one side of the antimeridian. */
function boxAround(lat: number, lng: number, span: number): GeoBox {
  const half = span / 2;
  let south = clampLat(lat - half), north = clampLat(lat + half);
  if (north - south < span) { if (south <= -MAX_LAT) north = clampLat(south + span); else south = clampLat(north - span); }
  let west = lng - half, east = lng + half;
  if (west < -180) { west = -180; east = -180 + span; }
  if (east > 180) { east = 180; west = 180 - span; }
  return { south, north, west, east };
}

function snapOut(b: GeoBox, step: number): GeoBox {
  const s = { south: Math.floor(b.south / step) * step, north: Math.ceil(b.north / step) * step, west: Math.floor(b.west / step) * step, east: Math.ceil(b.east / step) * step };
  // Snapping can grow a box past the limit: trim back from the far edges.
  if (s.north - s.south > AIRCRAFT_MAX_SPAN_DEG) s.north = s.south + AIRCRAFT_MAX_SPAN_DEG;
  if (s.east - s.west > AIRCRAFT_MAX_SPAN_DEG) s.east = s.west + AIRCRAFT_MAX_SPAN_DEG;
  return { south: clampLat(s.south), north: clampLat(s.north), west: Math.max(-180, s.west), east: Math.min(180, s.east) };
}

/**
 * Query box for the aircraft proxy. `view` is the camera's visible rectangle
 * in degrees (null when the camera can't compute one, e.g. looking at space);
 * `fallback` is used then (first operation with a location, else the US centre).
 */
export function aircraftQueryBox(view: GeoBox | null, fallback: { lat: number; lng: number }): GeoBox {
  const valid = view && [view.south, view.north, view.west, view.east].every(Number.isFinite) && view.north > view.south;
  if (!valid) return snapOut(boxAround(fallback.lat, fallback.lng, AIRCRAFT_MAX_SPAN_DEG), AIRCRAFT_SNAP_DEG);
  const crosses = view.east < view.west;
  const lngSpan = crosses ? view.east + 360 - view.west : view.east - view.west;
  const latSpan = view.north - view.south;
  if (!crosses && lngSpan <= AIRCRAFT_MAX_SPAN_DEG && latSpan <= AIRCRAFT_MAX_SPAN_DEG) {
    return snapOut({ south: clampLat(view.south), north: clampLat(view.north), west: view.west, east: view.east }, AIRCRAFT_SNAP_DEG);
  }
  const c = viewCenter(view);
  return snapOut(boxAround(c.lat, c.lng, AIRCRAFT_MAX_SPAN_DEG), AIRCRAFT_SNAP_DEG);
}

/** Stable key for a query box (same key = same request). */
export function boxKey(b: GeoBox): string {
  return `${b.south},${b.north},${b.west},${b.east}`;
}

/** Is a point inside the box? */
export function inBox(b: GeoBox, lat: number, lng: number): boolean {
  return lat >= b.south && lat <= b.north && lng >= b.west && lng <= b.east;
}
