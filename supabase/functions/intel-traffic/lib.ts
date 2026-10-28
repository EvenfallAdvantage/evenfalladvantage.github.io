/**
 * Pure normalizers, parsers, and helpers for `intel-traffic` (live DOT/511 road
 * closures, crashes, construction, hazards, and TomTom traffic flow / incidents).
 *
 * Kept free of Deno-specific globals so it can be unit-tested in both Deno and Vitest.
 */

export type RoadIncidentKind = "crash" | "closure" | "construction" | "hazard" | "congestion";
export type RoadIncidentSeverity = "minor" | "moderate" | "major" | "critical";

export interface RoadIncident {
  id: string;
  kind: RoadIncidentKind;
  severity: RoadIncidentSeverity;
  title: string;
  road: string;
  direction?: string;
  description: string;
  lat: number;
  lng: number;
  startTime?: string;
  endTime?: string;
  source: string;
  attribution: string;
}

/** [west, south, east, north] in WGS84 degrees. */
export type BBox = [number, number, number, number];

export function validLatLng(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    !(lat === 0 && lng === 0) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180
  );
}

const num = (v: unknown): number => (typeof v === "number" ? v : parseFloat(String(v ?? "")));
const str = (v: unknown): string => (typeof v === "string" ? v.trim() : v == null ? "" : String(v).trim());
const safeId = (v: unknown): string => str(v).replace(/[^A-Za-z0-9_.:-]/g, "");

/** Parse `?bbox=west,south,east,north`. */
export function parseBBoxParam(raw: string | null | undefined): BBox | null {
  if (!raw) return null;
  const parts = raw.split(",").map((p) => Number(p.trim()));
  if (parts.length !== 4 || parts.some((n) => !Number.isFinite(n))) return null;
  const [west, south, east, north] = parts;
  if (south > north || south < -90 || north > 90 || west < -180 || east > 180) return null;
  return [west, south, east, north];
}

/**
 * Parse `?near=lat,lng[,radiusKm]` or `?near=lat1,lng1;lat2,lng2&near_km=radiusKm`
 * into an enclosing BBox.
 */
export function parseNearParam(raw: string | null | undefined, nearKmRaw?: string | null): BBox | null {
  if (!raw) return null;
  const groups = raw.split(";").map((s) => s.trim()).filter(Boolean).slice(0, 100);
  if (!groups.length) return null;
  let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
  let inlineKm: number | undefined;
  let count = 0;
  for (const g of groups) {
    const parts = g.split(",").map((p) => Number(p.trim()));
    if (parts.length < 2 || !Number.isFinite(parts[0]) || !Number.isFinite(parts[1])) continue;
    const [lat, lng] = parts;
    if (!validLatLng(lat, lng)) continue;
    if (parts.length >= 3 && Number.isFinite(parts[2]) && parts[2] > 0) inlineKm = parts[2];
    if (lat < minLat) minLat = lat;
    if (lat > maxLat) maxLat = lat;
    if (lng < minLng) minLng = lng;
    if (lng > maxLng) maxLng = lng;
    count++;
  }
  if (!count) return null;
  const parsedKm = Number(nearKmRaw);
  const radiusKm = Math.min(
    500,
    Math.max(1, Number.isFinite(parsedKm) && parsedKm > 0 ? parsedKm : inlineKm ?? 50),
  );
  const dLat = radiusKm / 111.32;
  const midLat = (minLat + maxLat) / 2;
  const cosLat = Math.max(0.1, Math.cos((midLat * Math.PI) / 180));
  const dLng = radiusKm / (111.32 * cosLat);
  return [
    Math.max(-180, minLng - dLng),
    Math.max(-90, minLat - dLat),
    Math.min(180, maxLng + dLng),
    Math.min(90, maxLat + dLat),
  ];
}

export class TtlCache<T> {
  private m = new Map<string, { v: T; until: number }>();
  constructor(private defaultTtlMs = 240_000) {}
  get(k: string, now = Date.now()): T | undefined {
    const e = this.m.get(k);
    return e && e.until > now ? e.v : undefined;
  }
  stale(k: string): T | undefined {
    return this.m.get(k)?.v;
  }
  set(k: string, v: T, ttlMs = this.defaultTtlMs, now = Date.now()): void {
    if (this.m.size > 1000) this.m.clear();
    this.m.set(k, { v, until: now + ttlMs });
  }
}

export function inBBox(lat: number, lng: number, bbox: BBox | null): boolean {
  if (!bbox) return true;
  const [west, south, east, north] = bbox;
  if (lat < south || lat > north) return false;
  return west <= east ? lng >= west && lng <= east : lng >= west || lng <= east;
}

export function bboxesIntersect(a: BBox, b: BBox): boolean {
  const [w1, s1, e1, n1] = a;
  const [w2, s2, e2, n2] = b;
  if (n1 < s2 || s1 > n2) return false;
  if (w1 <= e1 && w2 <= e2) {
    return !(e1 < w2 || w1 > e2);
  }
  return true;
}

/**
 * Clamp a query BBox around its center so its span does not exceed `maxSpanDeg`
 * (~0.85° ≈ 8,900 km² at equator, safely under TomTom's 10,000 km² limit).
 */
export function clampTomTomBBox(bbox: BBox, maxSpanDeg = 0.85): BBox {
  const [west, south, east, north] = bbox;
  const spanLng = east >= west ? east - west : 360 - (west - east);
  const spanLat = north - south;
  const cLat = (south + north) / 2;
  const cLng = east >= west ? (west + east) / 2 : ((west + east + 360) / 2 + 180) % 360 - 180;
  const halfLat = Math.min(spanLat, maxSpanDeg) / 2;
  const halfLng = Math.min(spanLng, maxSpanDeg) / 2;
  return [
    Math.max(-180, Number((cLng - halfLng).toFixed(5))),
    Math.max(-85, Number((cLat - halfLat).toFixed(5))),
    Math.min(180, Number((cLng + halfLng).toFixed(5))),
    Math.min(85, Number((cLat + halfLat).toFixed(5))),
  ];
}

/** Parse `?tile=z/x/y` for Web Mercator slippy tiles. */
export function parseTileParam(raw: string | null | undefined): { z: number; x: number; y: number } | null {
  if (!raw) return null;
  const m = /^(\d{1,2})\/(\d+)\/(\d+)$/.exec(raw.trim());
  if (!m) return null;
  const z = Number(m[1]);
  const x = Number(m[2]);
  const y = Number(m[3]);
  if (z < 0 || z > 22) return null;
  const max = 1 << z;
  if (x < 0 || x >= max || y < 0 || y >= max) return null;
  return { z, x, y };
}

/** 1x1 transparent PNG (68 bytes) returned when tiles are unconfigured or empty. */
export const TRANSPARENT_PNG_1X1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0a, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

export function classifyIncidentKind(text: string, isFullClosure = false): RoadIncidentKind {
  const t = text.toLowerCase();
  if (isFullClosure || /\b(road closed|full closure|closed to traffic|all lanes closed|impassable|bridge closed|ramp closed|tie on suljettu|suljettu liikenteeltä)\b/.test(t)) {
    return "closure";
  }
  if (/\b(crash|collision|accident|overturned|rollover|multi-vehicle|spinout|spin-out|wreck|vehicle fire|car fire|onnettomuus|kolari)\b/.test(t)) {
    return "crash";
  }
  if (/\b(construction|roadwork|road work|maintenance|paving|resurfacing|work zone|lane closure|lanes closed|alternating traffic|flagger|tietyö)\b/.test(t)) {
    return "construction";
  }
  if (/\b(congestion|slow traffic|heavy traffic|standstill|queue|delays|jam)\b/.test(t)) {
    return "congestion";
  }
  return "hazard";
}

export function classifyIncidentSeverity(text: string, kind: RoadIncidentKind, rawSeverity?: string): RoadIncidentSeverity {
  const s = (rawSeverity ?? "").toLowerCase();
  const t = text.toLowerCase();
  if (s === "critical" || s === "severe" || s === "extreme" || s === "major" && kind === "closure") return "critical";
  if (kind === "closure") return "major";
  if (s === "major" || s === "high" || /\b(fatal|serious|multi-vehicle|all lanes|full closure|major)\b/.test(t)) return "major";
  if (s === "moderate" || s === "medium" || kind === "crash") return "moderate";
  return "minor";
}

// ─── 1. Caltrans CWWP2 Lane Closures & Chain Controls (California) ───────────

export const CALTRANS_DISTRICT_BBOXES: Record<number, BBox> = {
  1: [-124.5, 38.7, -122.3, 42.1],
  2: [-123.6, 39.7, -119.9, 42.1],
  3: [-122.5, 38.0, -119.8, 40.3],
  4: [-123.6, 36.8, -121.1, 38.9],
  5: [-122.2, 34.3, -119.4, 37.2],
  6: [-121.0, 34.7, -117.6, 37.6],
  7: [-119.6, 33.3, -117.6, 34.9],
  8: [-117.8, 33.4, -114.1, 35.9],
  9: [-119.6, 34.8, -115.6, 38.7],
  10: [-121.7, 36.9, -119.5, 38.6],
  11: [-117.6, 32.5, -114.4, 33.6],
  12: [-118.2, 33.3, -117.4, 34.0],
};

export const CALIFORNIA_BBOX: BBox = [-124.6, 32.4, -114.0, 42.1];

export function caltransDistrictsForBBox(bbox: BBox | null): number[] {
  if (!bbox) return [3, 4, 7, 8, 11, 12];
  if (!bboxesIntersect(bbox, CALIFORNIA_BBOX)) return [];
  return Object.entries(CALTRANS_DISTRICT_BBOXES)
    .filter(([, b]) => bboxesIntersect(bbox, b))
    .map(([d]) => Number(d));
}

export function caltransLcsUrl(district: number): string {
  return `https://cwwp2.dot.ca.gov/data/d${district}/lcs/lcsStatusD${String(district).padStart(2, "0")}.json`;
}

export function caltransCcUrl(district: number): string {
  return `https://cwwp2.dot.ca.gov/data/d${district}/cc/ccStatusD${String(district).padStart(2, "0")}.json`;
}

function epochToIso(epochStr: unknown): string | undefined {
  const n = Number(epochStr);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return new Date(n * 1000).toISOString();
}

export function parseCaltransLcs(body: unknown, district: number, nowEpochSec = Math.floor(Date.now() / 1000)): RoadIncident[] {
  const rows = (body as { data?: Array<{ lcs?: Record<string, unknown> }> })?.data;
  if (!Array.isArray(rows)) return [];
  const out: RoadIncident[] = [];
  for (const r of rows) {
    const lcs = r?.lcs;
    if (!lcs) continue;
    const loc = (lcs.location ?? {}) as Record<string, unknown>;
    const begin = (loc.begin ?? {}) as Record<string, unknown>;
    const end = (loc.end ?? {}) as Record<string, unknown>;
    const closure = (lcs.closure ?? {}) as Record<string, unknown>;
    const ts = (closure.closureTimestamp ?? {}) as Record<string, unknown>;
    const c1097 = ((closure.code1097 ?? {}) as Record<string, unknown>).isCode1097 === "true";
    const c1098 = ((closure.code1098 ?? {}) as Record<string, unknown>).isCode1098 === "true";
    const c1022 = ((closure.code1022 ?? {}) as Record<string, unknown>).isCode1022 === "true";
    if (c1098 || c1022) continue;

    const startEpoch = Number(ts.closureStartEpoch ?? 0);
    const endEpoch = Number(ts.closureEndEpoch ?? 0);
    const indefinite = str(ts.isClosureEndIndefinite).toLowerCase() === "true";
    const inTimeWindow = startEpoch > 0 && startEpoch <= nowEpochSec && (indefinite || endEpoch >= nowEpochSec);
    if (!c1097 && !inTimeWindow) continue;

    const lat = num(begin.beginLatitude);
    const lng = num(begin.beginLongitude);
    if (!validLatLng(lat, lng)) continue;

    const route = str(begin.beginRoute) || "CA Highway";
    const dir = str(loc.travelFlowDirection);
    const beginName = str(begin.beginLocationName);
    const endName = str(end.endLocationName);
    const place = str(begin.beginNearbyPlace) || str(begin.beginCounty) || "California";
    const typeOfClosure = str(closure.typeOfClosure) || "Lane";
    const facility = str(closure.facility) || "Mainline";
    const typeOfWork = str(closure.typeOfWork) || "Maintenance";
    const lanesClosed = str(closure.lanesClosed);
    const totalLanes = str(closure.totalExistingLanes);
    const delay = str(closure.estimatedDelay);

    const isFull =
      /full/i.test(typeOfClosure) ||
      (Number(lanesClosed) > 0 && Number(lanesClosed) >= Number(totalLanes) && Number(totalLanes) > 0);
    const kind: RoadIncidentKind = isFull ? "closure" : "construction";
    const severity: RoadIncidentSeverity = isFull
      ? "major"
      : Number(lanesClosed) >= 2
        ? "moderate"
        : "minor";

    const spanText = beginName && endName && beginName !== endName ? `${beginName} to ${endName}` : beginName || place;
    const laneText = isFull
      ? `Full ${facility.toLowerCase()} closure`
      : lanesClosed && totalLanes
        ? `${lanesClosed} of ${totalLanes} lanes closed (${facility})`
        : `${typeOfClosure} closure (${facility})`;
    const title = `${route}${dir ? ` ${dir}` : ""} — ${isFull ? "Full Closure" : `${typeOfClosure} Closure`}`;
    const descParts = [
      `${laneText} near ${place}${spanText ? ` (${spanText})` : ""}.`,
      typeOfWork ? `Work: ${typeOfWork}.` : "",
      delay && delay !== "None" && delay !== "0" ? `Est. delay: ${delay} min.` : "",
    ].filter(Boolean);

    const id = `caltrans-lcs-d${district}-${safeId(closure.closureID || lcs.index || `${lat}-${lng}`)}`;
    out.push({
      id,
      kind,
      severity,
      title,
      road: route,
      direction: dir || undefined,
      description: descParts.join(" "),
      lat,
      lng,
      startTime: epochToIso(ts.closureStartEpoch),
      endTime: indefinite ? undefined : epochToIso(ts.closureEndEpoch),
      source: "Caltrans",
      attribution: "Caltrans CWWP2",
    });
  }
  return out;
}

export function parseCaltransCc(body: unknown, district: number): RoadIncident[] {
  const rows = (body as { data?: Array<{ cc?: Record<string, unknown> }> })?.data;
  if (!Array.isArray(rows)) return [];
  const out: RoadIncident[] = [];
  for (const r of rows) {
    const cc = r?.cc;
    if (!cc || str(cc.inService) === "false") continue;
    const loc = (cc.location ?? {}) as Record<string, unknown>;
    const statusData = (cc.statusData ?? {}) as Record<string, unknown>;
    const status = str(statusData.status);
    if (!status || status === "R-0") continue;

    const lat = num(loc.latitude);
    const lng = num(loc.longitude);
    if (!validLatLng(lat, lng)) continue;

    const route = str(loc.route) || "CA Highway";
    const dir = str(loc.direction);
    const locName = str(loc.locationName) || str(loc.nearbyPlace) || "California";
    const statusDesc = str(statusData.statusDescription) || `Chain control ${status} in effect.`;
    const isClosed = status === "RC";

    out.push({
      id: `caltrans-cc-d${district}-${safeId(cc.index || `${lat}-${lng}`)}`,
      kind: isClosed ? "closure" : "hazard",
      severity: isClosed ? "critical" : status === "R-2" || status === "R-3" ? "major" : "moderate",
      title: `${route}${dir ? ` ${dir}` : ""} — ${isClosed ? "Road Closed" : `Chain Control (${status})`}`,
      road: route,
      direction: dir || undefined,
      description: `${locName}: ${statusDesc}`,
      lat,
      lng,
      source: "Caltrans",
      attribution: "Caltrans CWWP2",
    });
  }
  return out;
}

// ─── 2. IBI 511 Events API (GA, WI, ID, ON, AB) ──────────────────────────────

export interface Five11EventHost {
  id: string;
  secret: string;
  host: string;
  prefix: string;
  bbox: BBox;
  attribution: string;
}

export const FIVE11_EVENT_HOSTS: readonly Five11EventHost[] = [
  { id: "511 Georgia", secret: "GA511_API_KEY", host: "https://511ga.org", prefix: "ga511", bbox: [-85.7, 30.3, -80.7, 35.1], attribution: "Georgia DOT 511GA" },
  { id: "511 Wisconsin", secret: "WI511_API_KEY", host: "https://511wi.gov", prefix: "wi511", bbox: [-93.0, 42.4, -86.7, 47.2], attribution: "Wisconsin DOT 511WI" },
  { id: "511 Idaho", secret: "ID511_API_KEY", host: "https://511.idaho.gov", prefix: "id511", bbox: [-117.3, 41.9, -111.0, 49.1], attribution: "Idaho Transportation Department 511" },
  { id: "511 Ontario", secret: "ONTARIO511_API_KEY", host: "https://511on.ca", prefix: "on511", bbox: [-95.2, 41.6, -74.3, 56.9], attribution: "Ontario 511 (OGL – Ontario)" },
  { id: "511 Alberta", secret: "ALBERTA511_API_KEY", host: "https://511.alberta.ca", prefix: "ab511", bbox: [-120.1, 48.9, -109.9, 60.1], attribution: "511 Alberta (OGL – Alberta)" },
];

export function five11EventsUrl(host: string, key: string): string {
  return `${host}/api/v2/get/event?key=${encodeURIComponent(key)}&format=json`;
}

export function parse511Events(body: unknown, source: string, prefix: string, attribution: string): RoadIncident[] {
  if (!Array.isArray(body)) return [];
  const out: RoadIncident[] = [];
  for (const r of body as Array<Record<string, unknown>>) {
    const lat = num(r.Latitude ?? r.latitude);
    const lng = num(r.Longitude ?? r.longitude);
    if (!validLatLng(lat, lng)) continue;
    const road = str(r.RoadwayName ?? r.Roadway) || source;
    const dir = str(r.DirectionOfTravel ?? r.Direction);
    const eventType = str(r.EventType);
    const eventSubType = str(r.EventSubType);
    const desc = str(r.Description) || str(r.Details) || `${eventType} ${eventSubType}`.trim();
    const isFullClosure = r.IsFullClosure === true || str(r.IsFullClosure).toLowerCase() === "true";
    const combined = `${eventType} ${eventSubType} ${desc}`;
    const kind = classifyIncidentKind(combined, isFullClosure);
    const severity = classifyIncidentSeverity(combined, kind, str(r.Severity));
    const label = isFullClosure
      ? "Road Closed"
      : eventSubType || eventType || (kind === "crash" ? "Crash" : kind === "construction" ? "Roadwork" : "Incident");

    out.push({
      id: `${prefix}-${safeId(r.ID ?? r.Id ?? `${lat}-${lng}`)}`,
      kind,
      severity,
      title: `${road}${dir ? ` ${dir}` : ""} — ${label}`,
      road,
      direction: dir || undefined,
      description: desc || label,
      lat,
      lng,
      startTime: typeof r.StartDate === "number" ? new Date(r.StartDate * 1000).toISOString() : str(r.StartDate) || undefined,
      endTime: typeof r.PlannedEndDate === "number" ? new Date(r.PlannedEndDate * 1000).toISOString() : str(r.PlannedEndDate) || undefined,
      source,
      attribution,
    });
  }
  return out;
}

// ─── 3. Iowa DOT CARS 511 ArcGIS FeatureServer ───────────────────────────────

export const IOWA_BBOX: BBox = [-96.7, 40.3, -90.1, 43.6];
export const IOWA_EVENTS_URL =
  "https://services.arcgis.com/8lRhdTsQyJpO52F1/arcgis/rest/services/CARS511_Iowa_View/FeatureServer/0/query?where=1%3D1&outFields=*&outSR=4326&f=json";

export function parseIowaEvents(body: unknown): RoadIncident[] {
  const features = (body as { features?: Array<{ attributes?: Record<string, unknown>; geometry?: { x?: unknown; y?: unknown } }> })?.features;
  if (!Array.isArray(features)) return [];
  const out: RoadIncident[] = [];
  for (const f of features) {
    const a = f.attributes ?? {};
    const lat = num(f.geometry?.y);
    const lng = num(f.geometry?.x);
    if (!validLatLng(lat, lng)) continue;

    const route = str(a.Route) || "Iowa Highway";
    const style = str(a.STYLE).toLowerCase();
    const headline = str(a.headline);
    const phrase = str(a.phrase);
    const cause = str(a.cause);
    const restrict = str(a.Restrict_);
    const desc = str(a.Desc0) || str(a.msg0) || [headline, phrase, cause, restrict].filter(Boolean).join(". ");
    const combined = `${style} ${headline} ${phrase} ${cause} ${restrict} ${desc}`;
    const isClosed = /closed|impassable|blocked/i.test(style) || /road closed|ramp closed|all lanes blocked/i.test(combined);
    const kind: RoadIncidentKind = isClosed
      ? "closure"
      : style.includes("accident") || style.includes("crash")
        ? "crash"
        : style.includes("work") || style.includes("construction")
          ? "construction"
          : classifyIncidentKind(combined, isClosed);
    const severity = classifyIncidentSeverity(combined, kind);
    const label = phrase || headline || (kind === "closure" ? "Road Closed" : kind === "crash" ? "Crash" : "Road Advisory");

    out.push({
      id: `iowa-${safeId(a.ID || a.OBJECTID || `${lat}-${lng}`)}`,
      kind,
      severity,
      title: `${route} — ${label}`,
      road: route,
      description: desc || label,
      lat,
      lng,
      source: "Iowa DOT",
      attribution: "Source: Iowa DOT",
    });
  }
  return out;
}

// ─── 4. DriveBC Open511 Events (British Columbia) ────────────────────────────

export const DRIVEBC_BBOX: BBox = [-139.1, 48.2, -114.0, 60.1];
export const DRIVEBC_EVENTS_URL = "https://api.open511.gov.bc.ca/events?format=json&status=ACTIVE&limit=300";

function extractGeoMidpoint(geo: Record<string, unknown> | undefined): [number, number] | null {
  if (!geo) return null;
  const type = str(geo.type);
  const coords = geo.coordinates;
  if (type === "Point" && Array.isArray(coords) && coords.length >= 2) {
    const lng = num(coords[0]);
    const lat = num(coords[1]);
    return validLatLng(lat, lng) ? [lat, lng] : null;
  }
  if (type === "LineString" && Array.isArray(coords) && coords.length > 0) {
    const mid = coords[Math.floor(coords.length / 2)];
    if (Array.isArray(mid) && mid.length >= 2) {
      const lng = num(mid[0]);
      const lat = num(mid[1]);
      return validLatLng(lat, lng) ? [lat, lng] : null;
    }
  }
  return null;
}

export function parseDriveBcEvents(body: unknown): RoadIncident[] {
  const events = (body as { events?: Array<Record<string, unknown>> })?.events;
  if (!Array.isArray(events)) return [];
  const out: RoadIncident[] = [];
  for (const ev of events) {
    if (str(ev.status) && str(ev.status) !== "ACTIVE") continue;
    const pt = extractGeoMidpoint(ev.geography as Record<string, unknown> | undefined);
    if (!pt) continue;
    const [lat, lng] = pt;

    const roads = Array.isArray(ev.roads) ? (ev.roads as Array<Record<string, unknown>>) : [];
    const primaryRoad = roads[0] ?? {};
    const road = str(primaryRoad.name) || "BC Highway";
    const dir = str(primaryRoad.direction);
    const roadState = str(primaryRoad.state);
    const headline = str(ev.headline) || str(ev.event_type) || "Road Event";
    const desc = str(ev.description) || headline;
    const eventType = str(ev.event_type);
    const subtypes = Array.isArray(ev.event_subtypes) ? ev.event_subtypes.map(str).join(" ") : "";
    const isClosed = /CLOSED/i.test(roadState) || /road closed|closed in both directions/i.test(desc);
    const combined = `${eventType} ${subtypes} ${headline} ${desc}`;
    const kind: RoadIncidentKind = isClosed
      ? "closure"
      : eventType === "CONSTRUCTION"
        ? "construction"
        : classifyIncidentKind(combined, isClosed);
    const severity = classifyIncidentSeverity(combined, kind, str(ev.severity));

    out.push({
      id: `drivebc-${safeId(ev.id || `${lat}-${lng}`)}`,
      kind,
      severity,
      title: `${road}${dir && dir !== "NONE" ? ` ${dir}` : ""} — ${headline}`,
      road,
      direction: dir && dir !== "NONE" ? dir : undefined,
      description: desc,
      lat,
      lng,
      startTime: str(ev.created) || undefined,
      source: "DriveBC",
      attribution: "DriveBC (OGL-BC)",
    });
  }
  return out;
}

// ─── 5. City of Austin Real-Time Traffic Incident Reports ────────────────────

export const AUSTIN_BBOX: BBox = [-98.3, 29.9, -97.3, 30.7];
export const AUSTIN_EVENTS_URL =
  "https://data.austintexas.gov/resource/dx9v-zd7x.json?$where=traffic_report_status='ACTIVE'&$limit=200&$order=published_date%20DESC";

export function parseAustinEvents(body: unknown): RoadIncident[] {
  if (!Array.isArray(body)) return [];
  const out: RoadIncident[] = [];
  for (const r of body as Array<Record<string, unknown>>) {
    if (str(r.traffic_report_status) && str(r.traffic_report_status).toUpperCase() !== "ACTIVE") continue;
    const lat = num(r.latitude);
    const lng = num(r.longitude);
    if (!validLatLng(lat, lng)) continue;
    const issue = str(r.issue_reported) || "Traffic Incident";
    const address = str(r.address) || "Austin, TX";
    const kind = classifyIncidentKind(`${issue} ${address}`);
    const severity = classifyIncidentSeverity(issue, kind);

    out.push({
      id: `austin-${safeId(r.traffic_report_id || `${lat}-${lng}`)}`,
      kind,
      severity,
      title: `${address} — ${issue}`,
      road: address,
      description: `${issue} at ${address}`,
      lat,
      lng,
      startTime: str(r.published_date) || undefined,
      source: "City of Austin",
      attribution: "City of Austin Open Data",
    });
  }
  return out;
}

// ─── 6. Transport for London (TfL) Road Disruptions ──────────────────────────

export const TFL_BBOX: BBox = [-0.6, 51.2, 0.4, 51.8];
export const TFL_DISRUPTIONS_URL = "https://api.tfl.gov.uk/Road/all/Disruption";

export function parseTflDisruptions(body: unknown): RoadIncident[] {
  if (!Array.isArray(body)) return [];
  const out: RoadIncident[] = [];
  for (const r of body as Array<Record<string, unknown>>) {
    const pt = extractGeoMidpoint(r.geography as Record<string, unknown> | undefined);
    if (!pt) continue;
    const [lat, lng] = pt;
    const location = str(r.location) || "London Road Network";
    const category = str(r.category) || "Disruption";
    const subCategory = str(r.subCategory);
    const comments = str(r.comments);
    const update = str(r.currentUpdate);
    const hasClosures = r.hasClosures === true || str(r.hasClosures).toLowerCase() === "true";
    const combined = `${category} ${subCategory} ${comments} ${update}`;
    const kind: RoadIncidentKind = hasClosures
      ? "closure"
      : /works/i.test(category)
        ? "construction"
        : /collision|accident/i.test(combined)
          ? "crash"
          : classifyIncidentKind(combined, hasClosures);
    const severity = classifyIncidentSeverity(combined, kind, str(r.severity));

    out.push({
      id: `tfl-${safeId(r.id || `${lat}-${lng}`)}`,
      kind,
      severity,
      title: `${location} — ${subCategory || category}`,
      road: location,
      description: [comments, update].filter(Boolean).join(" ") || `${category} at ${location}`,
      lat,
      lng,
      startTime: str(r.startDateTime) || undefined,
      endTime: str(r.endDateTime) || undefined,
      source: "TfL",
      attribution: "Powered by TfL Open Data",
    });
  }
  return out;
}

// ─── 7. Fintraffic Digitraffic (Finland) Traffic Announcements ───────────────

export const DIGITRAFFIC_BBOX: BBox = [19.0, 59.5, 31.6, 70.2];
export const DIGITRAFFIC_MESSAGES_URL =
  "https://tie.digitraffic.fi/api/traffic-message/v1/messages?inactiveHours=0&includeAreaGeometry=false&situationType=TRAFFIC_ANNOUNCEMENT";

export function parseDigitrafficMessages(body: unknown): RoadIncident[] {
  const features = (body as { features?: Array<{ geometry?: Record<string, unknown>; properties?: Record<string, unknown> }> })?.features;
  if (!Array.isArray(features)) return [];
  const out: RoadIncident[] = [];
  for (const f of features) {
    const pt = extractGeoMidpoint(f.geometry);
    if (!pt) continue;
    const [lat, lng] = pt;
    const props = f.properties ?? {};
    const anns = Array.isArray(props.announcements) ? (props.announcements as Array<Record<string, unknown>>) : [];
    const ann = anns[0] ?? {};
    const title = str(ann.title) || "Traffic Announcement";
    const locDesc = str((ann.location as Record<string, unknown> | undefined)?.description);
    const comment = str(ann.comment);
    const feats = Array.isArray(ann.features)
      ? (ann.features as Array<{ name?: unknown }>).map((x) => str(x.name)).filter(Boolean).join(", ")
      : "";
    const td = (ann.timeAndDuration ?? {}) as Record<string, unknown>;
    const combined = `${title} ${locDesc} ${feats} ${comment}`;
    const kind = classifyIncidentKind(combined);
    const severity = classifyIncidentSeverity(combined, kind);

    out.push({
      id: `digitraffic-${safeId(props.situationId || `${lat}-${lng}`)}`,
      kind,
      severity,
      title,
      road: title.split(",")[0] || "Finland Road",
      description: [locDesc, feats, comment].filter(Boolean).join(" — ") || title,
      lat,
      lng,
      startTime: str(td.startTime) || str(props.releaseTime) || undefined,
      endTime: str(td.endTime) || undefined,
      source: "Digitraffic (FI)",
      attribution: "Fintraffic / digitraffic.fi (CC BY 4.0)",
    });
  }
  return out;
}

// ─── 8. TomTom Traffic Incidents API v5 ──────────────────────────────────────

export function tomtomIncidentsUrl(bbox: BBox, apiKey: string): string {
  const clamped = clampTomTomBBox(bbox, 0.85);
  const fields = "{incidents{type,geometry{type,coordinates},properties{id,iconCategory,magnitudeOfDelay,events{description,code},startTime,endTime,from,to,length,delay,roadNumbers,timeValidity}}}";
  const params = new URLSearchParams({
    key: apiKey,
    bbox: `${clamped[0]},${clamped[1]},${clamped[2]},${clamped[3]}`,
    fields,
    language: "en-US",
    timeValidityFilter: "present",
  });
  return `https://api.tomtom.com/traffic/services/5/incidentDetails?${params.toString()}`;
}

export function tomtomFlowTileUrl(z: number, x: number, y: number, apiKey: string, style = "relative0-dark"): string {
  const safeStyle = /^[a-z0-9-]+$/i.test(style) ? style : "relative0-dark";
  return `https://api.tomtom.com/traffic/map/4/tile/flow/${safeStyle}/${z}/${x}/${y}.png?tileSize=256&key=${encodeURIComponent(apiKey)}`;
}

function tomtomCategoryToKind(iconCategory: number, text: string): RoadIncidentKind {
  switch (iconCategory) {
    case 1:
      return "crash";
    case 8:
      return "closure";
    case 7:
    case 9:
      return /closed/i.test(text) && !/lane/i.test(text) ? "closure" : "construction";
    case 6:
      return "congestion";
    case 2:
    case 3:
    case 4:
    case 5:
    case 10:
    case 11:
    case 14:
      return "hazard";
    default:
      return classifyIncidentKind(text);
  }
}

function tomtomDelayToSeverity(magnitude: number, kind: RoadIncidentKind): RoadIncidentSeverity {
  if (magnitude >= 4) return "critical";
  if (magnitude === 3 || kind === "closure") return "major";
  if (magnitude === 2 || kind === "crash") return "moderate";
  return "minor";
}

export function parseTomTomIncidents(body: unknown): RoadIncident[] {
  const incidents = (body as { incidents?: Array<{ geometry?: Record<string, unknown>; properties?: Record<string, unknown> }> })?.incidents;
  if (!Array.isArray(incidents)) return [];
  const out: RoadIncident[] = [];
  for (const item of incidents) {
    const pt = extractGeoMidpoint(item.geometry);
    if (!pt) continue;
    const [lat, lng] = pt;
    const p = item.properties ?? {};
    const iconCat = Number(p.iconCategory ?? 0);
    const mag = Number(p.magnitudeOfDelay ?? 0);
    const events = Array.isArray(p.events)
      ? (p.events as Array<{ description?: unknown }>).map((e) => str(e.description)).filter(Boolean)
      : [];
    const roadNums = Array.isArray(p.roadNumbers)
      ? (p.roadNumbers as unknown[]).map(str).filter(Boolean)
      : [];
    const fromLoc = str(p.from);
    const toLoc = str(p.to);
    const road = roadNums[0] || fromLoc || "Roadway";
    const eventText = events.join("; ") || "Traffic incident";
    const kind = tomtomCategoryToKind(iconCat, eventText);
    const severity = tomtomDelayToSeverity(mag, kind);
    const delaySec = Number(p.delay ?? 0);
    const delayMin = delaySec >= 60 ? Math.round(delaySec / 60) : 0;
    const span = fromLoc && toLoc && fromLoc !== toLoc ? `From ${fromLoc} to ${toLoc}.` : fromLoc ? `Near ${fromLoc}.` : "";
    const desc = [eventText, span, delayMin > 0 ? `Delay: ~${delayMin} min.` : ""].filter(Boolean).join(" ");

    out.push({
      id: `tomtom-${safeId(p.id || `${lat}-${lng}`)}`,
      kind,
      severity,
      title: `${road} — ${events[0] || "Traffic Incident"}`,
      road,
      description: desc,
      lat,
      lng,
      startTime: str(p.startTime) || undefined,
      endTime: str(p.endTime) || undefined,
      source: "TomTom",
      attribution: "© TomTom",
    });
  }
  return out;
}

const SEVERITY_RANK: Record<RoadIncidentSeverity, number> = {
  critical: 4,
  major: 3,
  moderate: 2,
  minor: 1,
};

/**
 * Deduplicate nearby incidents (~110m grid cell + kind) and sort highest
 * severity first so critical closures and crashes are never truncated by budget.
 */
export function dedupeIncidents(items: readonly RoadIncident[]): RoadIncident[] {
  const sorted = [...items].sort(
    (a, b) => (SEVERITY_RANK[b.severity] ?? 0) - (SEVERITY_RANK[a.severity] ?? 0),
  );
  const seen = new Set<string>();
  const out: RoadIncident[] = [];
  for (const item of sorted) {
    if (seen.has(item.id)) continue;
    const cellKey = `${item.kind}:${item.lat.toFixed(3)}:${item.lng.toFixed(3)}`;
    if (seen.has(cellKey)) continue;
    seen.add(item.id);
    seen.add(cellKey);
    out.push(item);
  }
  return out;
}
