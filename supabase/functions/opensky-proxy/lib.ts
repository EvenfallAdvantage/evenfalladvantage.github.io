// Pure helpers for opensky-proxy: convert readsb/ADSBExchange-v2 style
// responses (adsb.lol) into OpenSky /states/all state vectors so the
// browser client (flight-tracker.ts parseStates) needs no changes.

export interface BBox { lamin: number; lamax: number; lomin: number; lomax: number }

/** readsb aircraft record (subset). Altitudes ft, speeds kt, rates ft/min. */
export interface ReadsbAircraft {
  hex?: string;
  flight?: string;
  lat?: number;
  lon?: number;
  alt_baro?: number | "ground";
  alt_geom?: number;
  gs?: number;
  track?: number;
  true_heading?: number;
  baro_rate?: number;
  geom_rate?: number;
  squawk?: string;
  seen?: number;
  seen_pos?: number;
  spi?: number;
  mlat?: unknown[];
  tisb?: unknown[];
  lastPosition?: { lat?: number; lon?: number };
  /** readsb database flags: bit 0 military, bit 1 interesting, bit 2 PIA, bit 3 LADD. */
  dbFlags?: number;
  /** ADS-B emergency/priority status, e.g. "none", "general", "lifeguard", "nordo", "unlawful". */
  emergency?: string;
  /** Navigation accuracy category for position (0–11; < 8 means > 92.6 m 95% bound). */
  nac_p?: number;
  /** Navigation integrity category (0–11). */
  nic?: number;
  /** ICAO aircraft type designator. */
  t?: string;
  /** ADS-B emitter category, e.g. "A3" (large), "A7" (rotorcraft). */
  category?: string;
}

/** Emergency squawks: hijack, radio failure, general emergency. */
export const EMERGENCY_SQUAWKS = new Set(["7500", "7600", "7700"]);
export const FLAG_MILITARY = 1;
export const FLAG_EMERGENCY = 2;

/** Extra flags appended at index 17 of each state vector. */
export function aircraftFlags(a: ReadsbAircraft): number {
  let f = 0;
  if (typeof a.dbFlags === "number" && (a.dbFlags & 1) === 1) f |= FLAG_MILITARY;
  if ((a.squawk && EMERGENCY_SQUAWKS.has(a.squawk)) || (a.emergency && a.emergency !== "none")) f |= FLAG_EMERGENCY;
  return f;
}

export type StateVector = (string | number | boolean | null)[];

const FT_TO_M = 0.3048;
const KT_TO_MS = 0.514444;
const FPM_TO_MS = 0.00508;
const MAX_RADIUS_NM = 250;
export const MAX_SPAN_DEG = 10;

export function parseBBox(params: URLSearchParams): BBox | { error: string } {
  const raw = ["lamin", "lamax", "lomin", "lomax"].map((k) => params.get(k));
  if (raw.some((v) => v == null || v === "")) return { error: "Missing required params: lamin, lamax, lomin, lomax" };
  const [lamin, lamax, lomin, lomax] = raw.map(Number);
  if ([lamin, lamax, lomin, lomax].some((n) => !Number.isFinite(n))) return { error: "Parameters must be valid numbers" };
  if (lamin > lamax || lomin > lomax) return { error: "lamin/lomin must be <= lamax/lomax" };
  if (Math.abs(lamin) > 90 || Math.abs(lamax) > 90 || Math.abs(lomin) > 180 || Math.abs(lomax) > 180) {
    return { error: "Coordinates out of range" };
  }
  if (lamax - lamin > MAX_SPAN_DEG || lomax - lomin > MAX_SPAN_DEG) {
    return { error: "Bounding box too large. Max 10 degrees per axis." };
  }
  return { lamin, lamax, lomin, lomax };
}

/** Cache key rounded to 0.1° so slightly different viewports share entries. */
export function cacheKey(b: BBox): string {
  return [b.lamin, b.lamax, b.lomin, b.lomax].map((n) => n.toFixed(1)).join(",");
}

function haversineNm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // earth radius, nautical miles
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Center point + radius (nm, capped at 250) that covers the bbox. */
export function bboxToPointQuery(b: BBox): { lat: number; lon: number; radiusNm: number } {
  const lat = (b.lamin + b.lamax) / 2;
  const lon = (b.lomin + b.lomax) / 2;
  const r = Math.max(
    haversineNm(lat, lon, b.lamin, b.lomin), haversineNm(lat, lon, b.lamin, b.lomax),
    haversineNm(lat, lon, b.lamax, b.lomin), haversineNm(lat, lon, b.lamax, b.lomax),
  );
  return { lat: +lat.toFixed(4), lon: +lon.toFixed(4), radiusNm: Math.min(MAX_RADIUS_NM, Math.max(1, Math.ceil(r))) };
}

export function upstreamUrls(b: BBox): { name: string; url: string }[] {
  const { lat, lon, radiusNm } = bboxToPointQuery(b);
  return [
    { name: "adsb.lol", url: `https://api.adsb.lol/v2/lat/${lat}/lon/${lon}/dist/${radiusNm}` },
  ];
}

/**
 * Map readsb records to OpenSky state vectors:
 * [0 icao24, 1 callsign, 2 origin_country, 3 time_position, 4 last_contact,
 *  5 lon, 6 lat, 7 baro_alt_m, 8 on_ground, 9 velocity_ms, 10 true_track,
 *  11 vertical_rate_ms, 12 sensors, 13 geo_alt_m, 14 squawk, 15 spi, 16 position_source]
 * plus Overwatch extensions (ignored by OpenSky-only parsers):
 *  [17 flags (1 military, 2 emergency), 18 nac_p, 19 nic, 20 type designator, 21 emergency status,
 *   22 ADS-B emitter category]
 * Aircraft without a position, or outside the bbox, are dropped.
 */
export function toOpenSkyStates(aircraft: ReadsbAircraft[], b: BBox, nowSec: number): StateVector[] {
  const out: StateVector[] = [];
  for (const a of aircraft ?? []) {
    const lat = typeof a.lat === "number" ? a.lat : undefined;
    const lon = typeof a.lon === "number" ? a.lon : undefined;
    if (lat == null || lon == null || !a.hex) continue;
    if (lat < b.lamin || lat > b.lamax || lon < b.lomin || lon > b.lomax) continue;
    const onGround = a.alt_baro === "ground";
    const baroM = typeof a.alt_baro === "number" ? +(a.alt_baro * FT_TO_M).toFixed(1) : onGround ? 0 : null;
    const geomM = typeof a.alt_geom === "number" ? +(a.alt_geom * FT_TO_M).toFixed(1) : null;
    const rate = typeof a.baro_rate === "number" ? a.baro_rate : typeof a.geom_rate === "number" ? a.geom_rate : null;
    const seen = typeof a.seen === "number" ? a.seen : 0;
    const seenPos = typeof a.seen_pos === "number" ? a.seen_pos : seen;
    const source = a.mlat && a.mlat.length ? 2 : 0; // 0 ADS-B, 2 MLAT
    out.push([
      a.hex.toLowerCase().replace(/^~/, ""),
      (a.flight ?? "").trim(),
      "",
      Math.round(nowSec - seenPos),
      Math.round(nowSec - seen),
      lon,
      lat,
      baroM,
      onGround,
      typeof a.gs === "number" ? +(a.gs * KT_TO_MS).toFixed(2) : null,
      typeof a.track === "number" ? a.track : typeof a.true_heading === "number" ? a.true_heading : null,
      rate != null ? +(rate * FPM_TO_MS).toFixed(2) : null,
      null,
      geomM,
      a.squawk ?? null,
      Boolean(a.spi),
      source,
      aircraftFlags(a),
      typeof a.nac_p === "number" ? a.nac_p : null,
      typeof a.nic === "number" ? a.nic : null,
      a.t ?? null,
      a.emergency && a.emergency !== "none" ? a.emergency : null,
      typeof a.category === "string" && /^[A-D][0-7]$/.test(a.category) ? a.category : null,
    ]);
  }
  return out;
}

/** readsb responses use `ac` (adsb.lol) or `aircraft` (other readsb aggregators). */
export function extractAircraft(body: unknown): ReadsbAircraft[] | null {
  if (!body || typeof body !== "object") return null;
  const o = body as Record<string, unknown>;
  const list = Array.isArray(o.ac) ? o.ac : Array.isArray(o.aircraft) ? o.aircraft : null;
  return list as ReadsbAircraft[] | null;
}

// ── 24 h track history (our own, OverwatchDB) ─────────────────────────────
// adsb.lol asked that trace_full files not be used as an API, so history is
// now recorded by this proxy: every area cache miss stores one point per
// aircraft per minute in public.aircraft_positions (24 h TTL), and ?trace=
// reads it back via the signed-in-only aircraft_track RPC. Positions are
// derived from adsb.lol data (ODbL 1.0). Coverage: only areas Overwatch
// users have viewed.

/** One normalized history point: [epoch ms, lat, lon, altitude m (barometric) | null]. */
export type TracePoint = [number, number, number, number | null];

export const TRACE_WINDOW_MS = 24 * 3600_000;
export const TRACE_MAX_POINTS = 1_440;
/** Matches aircraft_positions_record's batch cap. */
export const RECORD_MAX_ROWS = 5_000;

/** Validate ?trace=<hex>: 6 hex chars, optionally prefixed by "~" (non-ICAO / TIS-B address). */
export function parseTraceParam(params: URLSearchParams): string | null {
  const raw = (params.get("trace") ?? "").trim().toLowerCase();
  return /^~?[0-9a-f]{6}$/.test(raw) ? raw : null;
}

export interface PositionRow { hex: string; ts: number; lat: number; lon: number; alt_m: number | null; flags: number }

/** OpenSky-shaped state vectors → rows for aircraft_positions_record (deduped per hex, capped). */
export function statesToPositionRows(states: StateVector[], maxRows = RECORD_MAX_ROWS): PositionRow[] {
  const seen = new Set<string>();
  const out: PositionRow[] = [];
  for (const s of states) {
    const hex = typeof s[0] === "string" ? s[0] : "";
    const ts = s[3], lon = s[5], lat = s[6], alt = s[7], flags = s[17];
    if (!/^~?[0-9a-f]{6}$/.test(hex) || seen.has(hex)) continue;
    if (typeof ts !== "number" || typeof lat !== "number" || typeof lon !== "number") continue;
    if (Math.abs(lat) > 90 || Math.abs(lon) > 180 || (lat === 0 && lon === 0)) continue;
    const altM = typeof alt === "number" && alt >= -500 && alt <= 30000 ? Math.round(alt) : null;
    seen.add(hex);
    out.push({ hex, ts, lat: +lat.toFixed(5), lon: +lon.toFixed(5), alt_m: altM, flags: typeof flags === "number" ? flags : 0 });
    if (out.length >= maxRows) break;
  }
  return out;
}

/** aircraft_track RPC rows → TracePoints (sorted, last 24 h, capped). */
export function rowsToTrace(rows: unknown, nowMs: number, windowMs = TRACE_WINDOW_MS, maxPoints = TRACE_MAX_POINTS): TracePoint[] {
  if (!Array.isArray(rows)) return [];
  const pts: TracePoint[] = [];
  for (const r of rows as Record<string, unknown>[]) {
    if (!r || typeof r !== "object") continue;
    const t = typeof r.ts === "string" ? Date.parse(r.ts) : NaN;
    const lat = Number(r.lat), lon = Number(r.lon);
    if (!Number.isFinite(t) || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
    if (t < nowMs - windowMs || t > nowMs + 60_000) continue;
    pts.push([t, lat, lon, typeof r.alt_m === "number" ? r.alt_m : null]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  return pts.length > maxPoints ? pts.slice(-maxPoints) : pts;
}
