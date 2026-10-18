/**
 * intel-hazards: one normalized feed for natural hazards.
 *
 * Every source is US-government public domain:
 *   - NWS watches/warnings/advisories polygons (NOAA mapservices WWA MapServer)
 *   - USGS earthquakes (M2.5+, 24 h GeoJSON)
 *   - NASA FIRMS active fire detections (keyless global 24 h CSV)
 *   - NIFC / WFIGS current wildfire perimeters (ArcGIS FeatureServer)
 *   - NHC active tropical cyclones, forecast cones and tracks (CurrentStorms.json + KMZ)
 *   - NASA EONET open volcano events
 *
 * Unified record: { id, kind, severity, title, geometry, starts_at, ends_at, source, url, updated_at, props }.
 */

export type HazardKind =
  | "warning" | "watch" | "advisory"
  | "quake" | "fire" | "perimeter"
  | "cyclone" | "cyclone_cone" | "cyclone_track"
  | "volcano";

/** Request groups clients ask for with ?kinds=… */
export type HazardSource = "warnings" | "quakes" | "fires" | "perimeters" | "tropical" | "volcanoes";
export const HAZARD_SOURCES: readonly HazardSource[] = ["warnings", "quakes", "fires", "perimeters", "tropical", "volcanoes"];

export type Geometry =
  | { type: "Point"; coordinates: [number, number] }
  | { type: "LineString"; coordinates: [number, number][] }
  | { type: "Polygon"; coordinates: [number, number][][] }
  | { type: "MultiPolygon"; coordinates: [number, number][][][] };

export interface Hazard {
  id: string;
  kind: HazardKind;
  /** 1 minor · 2 moderate · 3 severe · 4 extreme */
  severity: 1 | 2 | 3 | 4;
  title: string;
  geometry: Geometry;
  starts_at: string | null;
  ends_at: string | null;
  source: string;
  url: string | null;
  updated_at: string | null;
  props?: Record<string, string | number | boolean | null>;
}

export function parseKinds(raw: string | null): HazardSource[] {
  if (!raw) return ["warnings", "quakes", "fires", "perimeters", "tropical"];
  const want = new Set(raw.split(",").map((s) => s.trim().toLowerCase()));
  return HAZARD_SOURCES.filter((k) => want.has(k));
}

const r3 = (n: number) => Math.round(n * 1000) / 1000;
function iso(v: unknown): string | null {
  if (v == null || v === "") return null;
  const d = typeof v === "number" ? new Date(v) : new Date(String(v));
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function roundRing(ring: unknown): [number, number][] {
  if (!Array.isArray(ring)) return [];
  const out: [number, number][] = [];
  for (const p of ring) {
    if (!Array.isArray(p)) continue;
    const x = Number(p[0]), y = Number(p[1]);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push([r3(x), r3(y)]);
  }
  return out;
}

/** Keep Polygon / MultiPolygon geometry with rounded coordinates; null for anything else. */
export function cleanPolygonGeometry(g: unknown): Geometry | null {
  const geom = g as { type?: string; coordinates?: unknown } | null;
  if (!geom || !Array.isArray(geom.coordinates)) return null;
  if (geom.type === "Polygon") {
    const rings = (geom.coordinates as unknown[]).map(roundRing).filter((r) => r.length >= 4);
    return rings.length ? { type: "Polygon", coordinates: rings } : null;
  }
  if (geom.type === "MultiPolygon") {
    const polys = (geom.coordinates as unknown[]).map((p) => (Array.isArray(p) ? p.map(roundRing).filter((r) => r.length >= 4) : [])).filter((p) => p.length);
    return polys.length ? { type: "MultiPolygon", coordinates: polys } : null;
  }
  return null;
}

// ─── NWS watches / warnings / advisories ───────────────────────────

export const WWA_URL =
  "https://mapservices.weather.noaa.gov/eventdriven/rest/services/WWA/watch_warn_adv/MapServer/1/query" +
  "?where=1%3D1&outFields=prod_type,sig,phenom,url,expiration,onset,ends,issuance,wfo,cap_id" +
  "&returnGeometry=true&geometryPrecision=3&maxAllowableOffset=0.01&f=geojson";

/** Marine-zone and agricultural products: left out to keep the map about people and sites on land. */
export const WWA_EXCLUDED_PHENOMS = new Set([
  "SC", "GL", "SE", "SR", "HF", "MA", "RB", "SI", "SW", "LO", "UP", "BW", "MH", "RP", "SU", "LS",
  "FR", "FZ",
]);
/** Life-threatening warnings shown as extreme. */
const EXTREME_WARNINGS = new Set(["TO", "EW", "FF", "HU", "SS", "TS", "EC", "BZ", "IS"]);

export function parseWwa(fc: unknown): Hazard[] {
  const features = (fc as { features?: unknown[] })?.features ?? [];
  const out: Hazard[] = [];
  for (const f of features) {
    const p = ((f as { properties?: Record<string, unknown> }).properties ?? {}) as Record<string, string | null>;
    const sig = (p.sig ?? "").trim();
    const phenom = (p.phenom ?? "").trim();
    if (!["W", "A", "Y"].includes(sig) || WWA_EXCLUDED_PHENOMS.has(phenom)) continue;
    const geometry = cleanPolygonGeometry((f as { geometry?: unknown }).geometry);
    if (!geometry) continue;
    const kind: HazardKind = sig === "W" ? "warning" : sig === "A" ? "watch" : "advisory";
    const severity = sig === "W" ? (EXTREME_WARNINGS.has(phenom) ? 4 : 3) : sig === "A" ? 2 : 1;
    out.push({
      id: `nws:${p.cap_id ?? `${p.wfo}-${phenom}-${p.issuance}`}`,
      kind,
      severity,
      title: p.prod_type ?? "NWS alert",
      geometry,
      starts_at: iso(p.onset) ?? iso(p.issuance),
      ends_at: iso(p.ends) ?? iso(p.expiration),
      source: "NWS",
      url: p.url ?? null,
      updated_at: iso(p.issuance),
      props: { phenom, sig, wfo: p.wfo ?? null },
    });
  }
  // One feature per county/zone segment: merge pieces of the same alert.
  const byId = new Map<string, Hazard>();
  for (const h of out) {
    const prev = byId.get(h.id);
    if (!prev) { byId.set(h.id, h); continue; }
    const polys = (g: Geometry) => (g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : []);
    prev.geometry = { type: "MultiPolygon", coordinates: [...polys(prev.geometry), ...polys(h.geometry)] };
  }
  return [...byId.values()];
}

// ─── USGS earthquakes ──────────────────────────────────────────────

export const USGS_URL = "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson";

export function quakeSeverity(mag: number): 1 | 2 | 3 | 4 {
  return mag >= 6 ? 4 : mag >= 5 ? 3 : mag >= 4 ? 2 : 1;
}

export function parseUsgs(fc: unknown): Hazard[] {
  const features = (fc as { features?: unknown[] })?.features ?? [];
  const out: Hazard[] = [];
  for (const f of features) {
    const ff = f as { id?: string; geometry?: { coordinates?: number[] }; properties?: Record<string, unknown> };
    const c = ff.geometry?.coordinates;
    const p = ff.properties ?? {};
    const mag = Number(p.mag);
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1]) || !Number.isFinite(mag)) continue;
    out.push({
      id: `usgs:${ff.id}`,
      kind: "quake",
      severity: quakeSeverity(mag),
      title: `M${mag.toFixed(1)} ${String(p.place ?? "")}`.trim(),
      geometry: { type: "Point", coordinates: [r3(c[0]), r3(c[1])] },
      starts_at: iso(p.time),
      ends_at: null,
      source: "USGS",
      url: (p.url as string) ?? null,
      updated_at: iso(p.updated),
      props: { mag, depth_km: Number.isFinite(c[2]) ? r3(c[2]) : null, tsunami: Number(p.tsunami) === 1 },
    });
  }
  return out;
}

// ─── NASA FIRMS hotspots ───────────────────────────────────────────

export const FIRMS_URLS = [
  "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv",
  "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv",
];
export const FIRMS_MAX_POINTS = 2000;

export function parseFirmsCsv(csv: string, maxPoints = FIRMS_MAX_POINTS): Hazard[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const h = lines[0].split(",");
  const ix = (n: string) => h.indexOf(n);
  const lat = ix("latitude"), lng = ix("longitude"), conf = ix("confidence"), date = ix("acq_date"), time = ix("acq_time"), frp = ix("frp");
  if (lat < 0 || lng < 0) return [];
  // Strongest detections first, so sampling never drops the big fires.
  const rows = lines.slice(1).map((l) => l.split(",")).filter((c) => Number.isFinite(parseFloat(c[lat])) && Number.isFinite(parseFloat(c[lng])));
  rows.sort((a, b) => (parseFloat(b[frp]) || 0) - (parseFloat(a[frp]) || 0));
  return rows.slice(0, maxPoints).map((c, i) => {
    const power = parseFloat(c[frp]) || 0;
    const t = (c[time] ?? "").padStart(4, "0");
    const when = c[date] ? `${c[date]}T${t.slice(0, 2)}:${t.slice(2, 4)}:00Z` : null;
    return {
      id: `firms:${i}`,
      kind: "fire" as const,
      severity: (power >= 100 ? 3 : power >= 20 ? 2 : 1) as 1 | 2 | 3,
      title: `Fire ${power.toFixed(0)} MW`,
      geometry: { type: "Point" as const, coordinates: [r3(parseFloat(c[lng])), r3(parseFloat(c[lat]))] as [number, number] },
      starts_at: iso(when),
      ends_at: null,
      source: "NASA FIRMS",
      url: null,
      updated_at: null,
      props: { frp: power, conf: c[conf] ?? null },
    };
  });
}

// ─── NIFC wildfire perimeters ──────────────────────────────────────

export const NIFC_PERIMETERS_URL =
  "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/WFIGS_Interagency_Perimeters_Current/FeatureServer/0/query" +
  "?where=attr_IncidentTypeCategory%3D%27WF%27&outFields=poly_IncidentName,poly_GISAcres,attr_PercentContained,attr_UniqueFireIdentifier,poly_DateCurrent,attr_FireDiscoveryDateTime" +
  "&geometryPrecision=3&maxAllowableOffset=0.002&f=geojson";

export function perimeterSeverity(acres: number): 1 | 2 | 3 | 4 {
  return acres >= 100_000 ? 4 : acres >= 10_000 ? 3 : acres >= 1_000 ? 2 : 1;
}

export function parsePerimeters(fc: unknown): Hazard[] {
  const features = (fc as { features?: unknown[] })?.features ?? [];
  const out: Hazard[] = [];
  for (const f of features) {
    const p = ((f as { properties?: Record<string, unknown> }).properties ?? {});
    const geometry = cleanPolygonGeometry((f as { geometry?: unknown }).geometry);
    if (!geometry) continue;
    const acres = Number(p.poly_GISAcres) || 0;
    const pct = p.attr_PercentContained == null ? null : Number(p.attr_PercentContained);
    const name = String(p.poly_IncidentName ?? "Wildfire").trim();
    out.push({
      id: `nifc:${p.attr_UniqueFireIdentifier ?? name}`,
      kind: "perimeter",
      severity: pct !== null && pct >= 100 ? 1 : perimeterSeverity(acres),
      title: `${name} Fire · ${Math.round(acres).toLocaleString("en-US")} ac${pct !== null ? ` · ${pct}% contained` : ""}`,
      geometry,
      starts_at: iso(p.attr_FireDiscoveryDateTime),
      ends_at: null,
      source: "NIFC",
      url: "https://data-nifc.opendata.arcgis.com/",
      updated_at: iso(p.poly_DateCurrent),
      props: { acres: Math.round(acres), contained_pct: pct },
    });
  }
  return out;
}

// ─── NHC tropical cyclones ─────────────────────────────────────────

export const NHC_STORMS_URL = "https://www.nhc.noaa.gov/CurrentStorms.json";

export interface NhcStorm {
  id: string;
  name: string;
  classification: string;
  intensity: string;
  pressure: string;
  latitudeNumeric: number;
  longitudeNumeric: number;
  movementDir: number;
  movementSpeed: number;
  lastUpdate?: string;
  publicAdvisory?: { url?: string };
  trackCone?: { kmzFile?: string };
  forecastTrack?: { kmzFile?: string };
}

const CLASS_NAMES: Record<string, string> = {
  HU: "Hurricane", TS: "Tropical Storm", TD: "Tropical Depression", STS: "Subtropical Storm", STD: "Subtropical Depression",
  PTC: "Potential Tropical Cyclone", PC: "Post-tropical Cyclone", TY: "Typhoon",
};

export function cycloneSeverity(classification: string, knots: number): 1 | 2 | 3 | 4 {
  if (classification === "HU" || knots >= 64) return knots >= 96 ? 4 : 3;
  if (classification === "TS" || classification === "STS" || knots >= 34) return 2;
  return 1;
}

export function stormLabel(s: Pick<NhcStorm, "classification" | "name">): string {
  return `${CLASS_NAMES[s.classification] ?? "Tropical Cyclone"} ${s.name}`;
}

export function parseNhcStorms(json: unknown): { storms: NhcStorm[]; points: Hazard[] } {
  const storms = ((json as { activeStorms?: NhcStorm[] })?.activeStorms ?? []).filter((s) => Number.isFinite(s.latitudeNumeric) && Number.isFinite(s.longitudeNumeric));
  const points: Hazard[] = storms.map((s) => {
    const kt = Number(s.intensity) || 0;
    return {
      id: `nhc:${s.id}`,
      kind: "cyclone",
      severity: cycloneSeverity(s.classification, kt),
      title: `${stormLabel(s)} · ${Math.round(kt * 1.15078)} mph · ${s.pressure} mb`,
      geometry: { type: "Point", coordinates: [r3(s.longitudeNumeric), r3(s.latitudeNumeric)] },
      starts_at: null,
      ends_at: null,
      source: "NHC",
      url: s.publicAdvisory?.url ?? "https://www.nhc.noaa.gov/",
      updated_at: iso(s.lastUpdate),
      props: { storm_id: s.id, wind_kt: kt, pressure_mb: Number(s.pressure) || null, heading_deg: s.movementDir, speed_mph: s.movementSpeed },
    };
  });
  return { storms, points };
}

/** Extract the first .kml document from a KMZ (zip) archive. */
export async function kmlFromKmz(buf: Uint8Array): Promise<string | null> {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  // End of central directory: scan back for its signature.
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) return null;
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  for (let n = 0; n < count && p + 46 <= buf.length; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) return null;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const commentLen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!name.toLowerCase().endsWith(".kml")) continue;
    if (dv.getUint32(local, true) !== 0x04034b50) return null;
    const start = local + 30 + dv.getUint16(local + 26, true) + dv.getUint16(local + 28, true);
    const data = buf.subarray(start, start + csize);
    if (method === 0) return new TextDecoder().decode(data);
    if (method !== 8) return null;
    const stream = new Blob([data.slice()]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return await new Response(stream).text();
  }
  return null;
}

function parseCoordText(text: string): [number, number][] {
  return text.trim().split(/\s+/).map((t) => t.split(",").map(Number)).filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1])).map((c) => [r3(c[0]), r3(c[1])] as [number, number]);
}

/** Outer rings of every <Polygon> in a KML document. */
export function kmlPolygons(kml: string): [number, number][][] {
  const out: [number, number][][] = [];
  for (const m of kml.matchAll(/<Polygon>[\s\S]*?<outerBoundaryIs>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)) {
    const ring = parseCoordText(m[1]);
    if (ring.length >= 4) out.push(ring);
  }
  return out;
}

/** The longest <LineString> in a KML document. */
export function kmlLongestLine(kml: string): [number, number][] | null {
  let best: [number, number][] | null = null;
  for (const m of kml.matchAll(/<LineString>[\s\S]*?<coordinates>([\s\S]*?)<\/coordinates>/g)) {
    const line = parseCoordText(m[1]);
    if (line.length >= 2 && (!best || line.length > best.length)) best = line;
  }
  return best;
}

export function coneHazard(storm: NhcStorm, rings: [number, number][][], severity: 1 | 2 | 3 | 4): Hazard | null {
  if (!rings.length) return null;
  return {
    id: `nhc:${storm.id}:cone`,
    kind: "cyclone_cone",
    severity,
    title: `${stormLabel(storm)} forecast cone`,
    geometry: rings.length === 1 ? { type: "Polygon", coordinates: [rings[0]] } : { type: "MultiPolygon", coordinates: rings.map((r) => [r]) },
    starts_at: null, ends_at: null, source: "NHC", url: storm.publicAdvisory?.url ?? "https://www.nhc.noaa.gov/", updated_at: iso(storm.lastUpdate),
    props: { storm_id: storm.id },
  };
}

export function trackHazard(storm: NhcStorm, line: [number, number][] | null, severity: 1 | 2 | 3 | 4): Hazard | null {
  if (!line) return null;
  return {
    id: `nhc:${storm.id}:track`,
    kind: "cyclone_track",
    severity,
    title: `${stormLabel(storm)} forecast track`,
    geometry: { type: "LineString", coordinates: line },
    starts_at: null, ends_at: null, source: "NHC", url: storm.publicAdvisory?.url ?? "https://www.nhc.noaa.gov/", updated_at: iso(storm.lastUpdate),
    props: { storm_id: storm.id },
  };
}

// ─── NASA EONET volcanoes ──────────────────────────────────────────

export const EONET_VOLCANOES_URL = "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=volcanoes&limit=50";

export function parseEonetVolcanoes(json: unknown): Hazard[] {
  const events = (json as { events?: Array<{ id: string; title: string; link?: string; geometry?: Array<{ coordinates?: number[]; date?: string }> }> })?.events ?? [];
  const out: Hazard[] = [];
  for (const e of events) {
    const g = e.geometry?.[e.geometry.length - 1];
    const c = g?.coordinates;
    if (!c || !Number.isFinite(c[0]) || !Number.isFinite(c[1])) continue;
    out.push({
      id: `eonet:${e.id}`, kind: "volcano", severity: 2, title: e.title,
      geometry: { type: "Point", coordinates: [r3(c[0]), r3(c[1])] },
      starts_at: iso(g?.date), ends_at: null, source: "NASA EONET", url: e.link ?? null, updated_at: iso(g?.date),
    });
  }
  return out;
}

// ─── Cache ─────────────────────────────────────────────────────────

/** Seconds each source is cached in the isolate. */
export const CACHE_TTL_S: Record<HazardSource, number> = {
  warnings: 120, quakes: 120, fires: 900, perimeters: 900, tropical: 600, volcanoes: 3600,
};

export class TtlCache<T> {
  private m = new Map<string, { v: T; until: number }>();
  get(k: string, now = Date.now()): T | undefined {
    const e = this.m.get(k);
    return e && e.until > now ? e.v : undefined;
  }
  /** Last value even if expired (served when the upstream is down). */
  stale(k: string): T | undefined {
    return this.m.get(k)?.v;
  }
  set(k: string, v: T, ttlMs: number, now = Date.now()) {
    this.m.set(k, { v, until: now + ttlMs });
  }
}

// ─── Optional proximity pre-filter (?near=lat,lng;lat,lng&near_km=150) ─────

export const MAX_NEAR_POINTS = 100;
export const MAX_NEAR_KM = 500;

export function parseNear(near: string | null, nearKm: string | null): { points: [number, number][]; km: number } | null {
  if (!near) return null;
  const points: [number, number][] = [];
  for (const part of near.split(";").slice(0, MAX_NEAR_POINTS)) {
    const [lat, lng] = part.split(",").map(Number);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) points.push([lat, lng]);
  }
  if (!points.length) return null;
  const km = Math.min(MAX_NEAR_KM, Math.max(1, Number(nearKm) || 150));
  return { points, km };
}

function geomBBox(g: Geometry): [number, number, number, number] {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  const visit = (c: [number, number]) => { if (c[0] < minX) minX = c[0]; if (c[0] > maxX) maxX = c[0]; if (c[1] < minY) minY = c[1]; if (c[1] > maxY) maxY = c[1]; };
  if (g.type === "Point") visit(g.coordinates);
  else if (g.type === "LineString") g.coordinates.forEach(visit);
  else if (g.type === "Polygon") g.coordinates.forEach((r) => r.forEach(visit));
  else g.coordinates.forEach((p) => p.forEach((r) => r.forEach(visit)));
  return [minX, minY, maxX, maxY];
}

/** Keep hazards whose bounding box comes within `km` of any point (coarse; the client refines). */
export function filterNear(hazards: Hazard[], near: { points: [number, number][]; km: number }): Hazard[] {
  const dLat = near.km / 111.32;
  return hazards.filter((h) => {
    const [minX, minY, maxX, maxY] = geomBBox(h.geometry);
    return near.points.some(([lat, lng]) => {
      const dLng = near.km / (111.32 * Math.max(0.05, Math.cos((lat * Math.PI) / 180)));
      return lat >= minY - dLat && lat <= maxY + dLat && lng >= minX - dLng && lng <= maxX + dLng;
    });
  });
}
