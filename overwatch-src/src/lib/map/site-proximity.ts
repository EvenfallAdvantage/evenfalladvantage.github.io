/**
 * Near-my-sites engine: distances between company sites (operation points
 * with a radius, plus geofence polygons) and hazards, news and cameras;
 * the scope filter (Near my sites / Map view / Everywhere) and Site Watch.
 */
import type { HazardGeometry, IntelHazard } from "@/lib/intel-types";

export type Scope = "sites" | "view" | "everywhere";
export const SCOPE_LABELS: Record<Scope, string> = { sites: "Near my sites", view: "Map view", everywhere: "Everywhere" };

/** Default "near" distances (km). Companies can override per key. */
export const DEFAULT_NEAR_RADII_KM = {
  warnings: 10,
  fires: 25,
  perimeters: 25,
  quakes: 100,
  volcanoes: 100,
  lightning: 15,
  /** Storm center distance; forecast cones count when they cover the site. */
  cyclones: 300,
  news: 50,
  s2: 50,
  aircraftEmergency: 50,
  cameras: 5,
} as const;
export type NearRadiusKey = keyof typeof DEFAULT_NEAR_RADII_KM;
export type NearRadii = Record<NearRadiusKey, number>;
/** Quakes count near a site only from this magnitude. */
export const NEAR_QUAKE_MIN_MAG = 4;

export function resolveRadii(overrides?: Partial<Record<string, unknown>> | null): NearRadii {
  const out = { ...DEFAULT_NEAR_RADII_KM } as NearRadii;
  for (const k of Object.keys(out) as NearRadiusKey[]) {
    const v = Number(overrides?.[k]);
    if (Number.isFinite(v) && v > 0 && v <= 1000) out[k] = v;
  }
  return out;
}

export type SiteArea =
  | { id: string; name: string; kind: "point"; lat: number; lng: number; radiusKm: number }
  | { id: string; name: string; kind: "polygon"; rings: [number, number][][]; lat: number; lng: number };

const R_KM = 6371.0088;
const rad = (d: number) => (d * Math.PI) / 180;

export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
  return 2 * R_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Ray-casting point-in-ring; ring is [lng, lat][] */
export function pointInRing(lng: number, lat: number, ring: readonly [number, number][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i], [xj, yj] = ring[j];
    if ((yi > lat) !== (yj > lat) && lng < ((xj - xi) * (lat - yi)) / (yj - yi || 1e-12) + xi) inside = !inside;
  }
  return inside;
}

/** Point in polygon with holes (first ring outer). */
export function pointInPolygon(lng: number, lat: number, rings: readonly [number, number][][]): boolean {
  if (!rings.length || !pointInRing(lng, lat, rings[0])) return false;
  return !rings.slice(1).some((h) => pointInRing(lng, lat, h));
}

/** Distance (km) from a point to segment a-b, local equirectangular projection around the point. */
function pointSegmentKm(lat: number, lng: number, a: [number, number], b: [number, number]): number {
  const kx = 111.32 * Math.cos(rad(lat));
  const ky = 110.574;
  const ax = (a[0] - lng) * kx, ay = (a[1] - lat) * ky, bx = (b[0] - lng) * kx, by = (b[1] - lat) * ky;
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / len2)) : 0;
  const px = ax + t * dx, py = ay + t * dy;
  return Math.sqrt(px * px + py * py);
}

function polygonsOf(g: HazardGeometry): [number, number][][][] {
  if (g.type === "Polygon") return [g.coordinates];
  if (g.type === "MultiPolygon") return g.coordinates;
  return [];
}

/** Distance (km) from a point to a hazard geometry (0 if inside an area). */
export function pointToGeometryKm(lat: number, lng: number, g: HazardGeometry): number {
  if (g.type === "Point") return haversineKm(lat, lng, g.coordinates[1], g.coordinates[0]);
  if (g.type === "LineString") {
    let best = Infinity;
    for (let i = 1; i < g.coordinates.length; i++) best = Math.min(best, pointSegmentKm(lat, lng, g.coordinates[i - 1], g.coordinates[i]));
    return best;
  }
  let best = Infinity;
  for (const rings of polygonsOf(g)) {
    if (pointInPolygon(lng, lat, rings)) return 0;
    for (const ring of rings) for (let i = 1; i < ring.length; i++) best = Math.min(best, pointSegmentKm(lat, lng, ring[i - 1], ring[i]));
  }
  return best;
}

function geometryVertices(g: HazardGeometry): [number, number][] {
  if (g.type === "Point") return [g.coordinates];
  if (g.type === "LineString") return g.coordinates;
  return polygonsOf(g).flatMap((rings) => rings[0] ?? []);
}

/** Distance (km) from a site's edge to a hazard (0 when they overlap). */
export function siteDistanceKm(site: SiteArea, g: HazardGeometry): number {
  if (site.kind === "point") return Math.max(0, pointToGeometryKm(site.lat, site.lng, g) - site.radiusKm);
  // Polygon site: overlap if any vertex of one lies inside the other, else min vertex→edge distance.
  const sitePoly: HazardGeometry = { type: "Polygon", coordinates: site.rings };
  let best = Infinity;
  for (const [lng, lat] of site.rings[0] ?? []) {
    const d = pointToGeometryKm(lat, lng, g);
    if (d === 0) return 0;
    best = Math.min(best, d);
  }
  for (const [lng, lat] of geometryVertices(g)) {
    const d = pointToGeometryKm(lat, lng, sitePoly);
    if (d === 0) return 0;
    best = Math.min(best, d);
  }
  return best;
}

/** Which radius applies to a hazard, or null if it never counts as "near" (e.g. small quakes). */
export function hazardRadiusKm(h: Pick<IntelHazard, "kind" | "props">, r: NearRadii): number | null {
  switch (h.kind) {
    case "warning": case "watch": case "advisory": return r.warnings;
    case "fire": return r.fires;
    case "perimeter": return r.perimeters;
    case "quake": return Number(h.props?.mag ?? 0) >= NEAR_QUAKE_MIN_MAG ? r.quakes : null;
    case "volcano": return r.volcanoes;
    case "cyclone": return r.cyclones;
    case "cyclone_cone": return 0;
    case "cyclone_track": return null; // shown with its storm
  }
}

/** Coarse bbox prefilter so big hazard lists stay fast. */
function quickReject(site: SiteArea, g: HazardGeometry, km: number): boolean {
  const pad = km + (site.kind === "point" ? site.radiusKm : 50) + 1;
  const dLat = pad / 110.574, dLng = pad / (111.32 * Math.max(0.05, Math.cos(rad(site.lat))));
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of geometryVertices(g)) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
  return site.lat < minY - dLat || site.lat > maxY + dLat || site.lng < minX - dLng || site.lng > maxX + dLng;
}

export function hazardNearAnySite(h: IntelHazard, sites: readonly SiteArea[], r: NearRadii): boolean {
  const km = hazardRadiusKm(h, r);
  if (km === null) return false;
  return sites.some((s) => !quickReject(s, h.geometry, km) && siteDistanceKm(s, h.geometry) <= km);
}

export function pointNearAnySite(lat: number, lng: number, sites: readonly SiteArea[], km: number): boolean {
  return sites.some((s) => siteDistanceKm(s, { type: "Point", coordinates: [lng, lat] }) <= km);
}

export interface ViewRect { west: number; south: number; east: number; north: number }

export function inView(lat: number, lng: number, v: ViewRect): boolean {
  if (lat < v.south || lat > v.north) return false;
  return v.west <= v.east ? lng >= v.west && lng <= v.east : lng >= v.west || lng <= v.east;
}

function geometryInView(g: HazardGeometry, v: ViewRect): boolean {
  return geometryVertices(g).some(([lng, lat]) => inView(lat, lng, v));
}

/**
 * Scope filters. "sites" with no sites falls back to everywhere (so a new
 * company still sees data). Cyclone tracks follow their storm.
 */
export function buildScopeFilters(scope: Scope, sites: readonly SiteArea[], view: ViewRect | null, r: NearRadii) {
  const effective: Scope = scope === "sites" && sites.length === 0 ? "everywhere" : scope === "view" && !view ? "everywhere" : scope;
  if (effective === "everywhere") return { effective, hazard: undefined, point: undefined } as const;
  if (effective === "view") {
    return {
      effective,
      hazard: (h: IntelHazard) => geometryInView(h.geometry, view!),
      point: (lat: number, lng: number, _key?: NearRadiusKey) => inView(lat, lng, view!),
    } as const;
  }
  return {
    effective,
    hazard: (h: IntelHazard) =>
      h.kind === "cyclone_track"
        ? sites.some((s) => siteDistanceKm(s, h.geometry) <= r.cyclones)
        : hazardNearAnySite(h, sites, r),
    point: (lat: number, lng: number, key: NearRadiusKey = "news") => pointNearAnySite(lat, lng, sites, r[key]),
  } as const;
}

// ─── Site Watch ────────────────────────────────────────────────────

export type WatchLevel = "warning" | "watch";

export interface SiteAlert {
  siteId: string;
  siteName: string;
  lat: number;
  lng: number;
  level: WatchLevel;
  kind: string;
  title: string;
  distanceKm: number;
  hazardId: string;
}

/** Red (warning) vs amber (watch) for a hazard at a given distance. */
export function watchLevel(h: Pick<IntelHazard, "kind" | "severity" | "props">, distanceKm: number): WatchLevel {
  switch (h.kind) {
    case "warning": return "warning";
    case "watch": case "advisory": return "watch";
    case "quake": return Number(h.props?.mag ?? 0) >= 5 ? "warning" : "watch";
    case "fire": case "perimeter": return distanceKm <= 5 ? "warning" : "watch";
    case "cyclone_cone": case "cyclone": return h.severity >= 3 ? "warning" : "watch";
    default: return "watch";
  }
}

export function computeSiteWatch(sites: readonly SiteArea[], hazards: readonly IntelHazard[], r: NearRadii): SiteAlert[] {
  const out: SiteAlert[] = [];
  for (const s of sites) {
    for (const h of hazards) {
      const km = hazardRadiusKm(h, r);
      if (km === null || quickReject(s, h.geometry, km)) continue;
      const d = siteDistanceKm(s, h.geometry);
      if (d > km) continue;
      out.push({ siteId: s.id, siteName: s.name, lat: s.lat, lng: s.lng, level: watchLevel(h, d), kind: h.kind, title: h.title, distanceKm: Math.round(d * 10) / 10, hazardId: h.id });
    }
  }
  return sortAlerts(dedupeAlerts(out));
}

/** One alert per (site, title): NWS segments and fire detections repeat. */
function dedupeAlerts(list: SiteAlert[]): SiteAlert[] {
  const best = new Map<string, SiteAlert>();
  for (const a of list) {
    const k = `${a.siteId}|${a.kind === "fire" ? "fire" : a.title}`;
    const prev = best.get(k);
    if (!prev || a.distanceKm < prev.distanceKm || (a.level === "warning" && prev.level !== "warning")) best.set(k, a);
  }
  return [...best.values()];
}

export function sortAlerts(list: SiteAlert[]): SiteAlert[] {
  return list.sort((a, b) => (a.level === b.level ? 0 : a.level === "warning" ? -1 : 1) || a.distanceKm - b.distanceKm || a.siteName.localeCompare(b.siteName));
}

/** Highest level per site (for map rings). */
export function siteLevels(alerts: readonly SiteAlert[]): Map<string, { level: WatchLevel; lat: number; lng: number; name: string; count: number }> {
  const m = new Map<string, { level: WatchLevel; lat: number; lng: number; name: string; count: number }>();
  for (const a of alerts) {
    const prev = m.get(a.siteId);
    if (!prev) m.set(a.siteId, { level: a.level, lat: a.lat, lng: a.lng, name: a.siteName, count: 1 });
    else { prev.count++; if (a.level === "warning") prev.level = "warning"; }
  }
  return m;
}

/** Operations that count as active sites. */
export function isActiveSiteStatus(status: string | null | undefined): boolean {
  return !/^(completed|complete|cancel+ed|archived|closed|inactive)$/i.test((status ?? "").trim());
}

export function sitesFrom(
  operations: ReadonlyArray<{ id: string; name: string; lat: number; lng: number; status?: string; geofenceRadius?: number }>,
  geofences: ReadonlyArray<{ id: string; name: string; isActive?: boolean; geometry: unknown }> = [],
): SiteArea[] {
  const out: SiteArea[] = [];
  for (const o of operations) {
    if (!Number.isFinite(o.lat) || !Number.isFinite(o.lng) || (o.lat === 0 && o.lng === 0) || !isActiveSiteStatus(o.status)) continue;
    out.push({ id: `op:${o.id}`, name: o.name, kind: "point", lat: o.lat, lng: o.lng, radiusKm: Math.max(0.1, (o.geofenceRadius ?? 200) / 1000) });
  }
  for (const g of geofences) {
    if (g.isActive === false) continue;
    const geom = g.geometry as { type?: string; coordinates?: [number, number][][] } | null;
    if (geom?.type !== "Polygon" || !geom.coordinates?.[0]?.length) continue;
    const full = geom.coordinates[0];
    const closed = full.length > 1 && full[0][0] === full[full.length - 1][0] && full[0][1] === full[full.length - 1][1];
    const ring = closed ? full.slice(0, -1) : full;
    const lat = ring.reduce((s, p) => s + p[1], 0) / ring.length;
    const lng = ring.reduce((s, p) => s + p[0], 0) / ring.length;
    out.push({ id: `gf:${g.id}`, name: g.name, kind: "polygon", rings: geom.coordinates, lat, lng });
  }
  return out;
}

/** Points sent to intel-hazards ?near= (site centers, capped). */
export function nearParam(sites: readonly SiteArea[], max = 100): string {
  return sites.slice(0, max).map((s) => `${s.lat.toFixed(3)},${s.lng.toFixed(3)}`).join(";");
}
