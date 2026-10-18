import { describe, expect, it } from "vitest";
import type { IntelHazard } from "@/lib/intel-types";
import {
  DEFAULT_NEAR_RADII_KM, buildScopeFilters, computeSiteWatch, haversineKm, hazardNearAnySite, inView, nearParam, pointInPolygon,
  pointToGeometryKm, resolveRadii, siteDistanceKm, siteLevels, sitesFrom, watchLevel, type SiteArea,
} from "@/lib/map/site-proximity";

const R = resolveRadii(null);
const site: SiteArea = { id: "op:1", name: "Stadium", kind: "point", lat: 34.0, lng: -118.0, radiusKm: 0.5 };
const H = (o: Partial<IntelHazard> & Pick<IntelHazard, "kind" | "geometry">): IntelHazard => ({ id: o.kind + Math.random(), severity: 2, title: o.kind, starts_at: null, ends_at: null, source: "t", url: null, updated_at: null, ...o });
const square = (lng: number, lat: number, d: number): [number, number][][] => [[[lng, lat], [lng + d, lat], [lng + d, lat + d], [lng, lat + d], [lng, lat]]];
// ~1 km of longitude at 34°N
const KM_LNG = 1 / (111.32 * Math.cos((34 * Math.PI) / 180));

describe("geometry", () => {
  it("haversine", () => {
    expect(haversineKm(34, -118, 35, -118)).toBeCloseTo(111.2, 0);
  });
  it("point in polygon with hole", () => {
    const rings = [square(0, 0, 10)[0], square(4, 4, 2)[0]];
    expect(pointInPolygon(1, 1, rings)).toBe(true);
    expect(pointInPolygon(5, 5, rings)).toBe(false);
    expect(pointInPolygon(11, 1, rings)).toBe(false);
  });
  it("distance to polygon edge and inside", () => {
    expect(pointToGeometryKm(34.0, -118.0, { type: "Polygon", coordinates: square(-118.1, 33.9, 0.2) })).toBe(0);
    const d = pointToGeometryKm(34.0, -118.0, { type: "Polygon", coordinates: square(-118 + 5 * KM_LNG, 33.9, 0.2) });
    expect(d).toBeGreaterThan(4.8);
    expect(d).toBeLessThan(5.2);
  });
  it("site radius is subtracted; polygon sites overlap", () => {
    const g = { type: "Point" as const, coordinates: [-118 + 3 * KM_LNG, 34] as [number, number] };
    expect(siteDistanceKm(site, g)).toBeCloseTo(2.5, 1);
    const poly: SiteArea = { id: "gf:1", name: "Fence", kind: "polygon", rings: square(-118.01, 33.99, 0.02), lat: 34, lng: -118 };
    expect(siteDistanceKm(poly, { type: "Polygon", coordinates: square(-118.005, 33.995, 0.5) })).toBe(0);
    expect(siteDistanceKm(poly, { type: "Point", coordinates: [-118, 34] })).toBe(0);
  });
});

describe("near-my-sites rules", () => {
  it("warnings within 10 km, fires 25 km, quakes M4+ within 100 km", () => {
    const warn = (km: number) => H({ kind: "warning", geometry: { type: "Polygon", coordinates: square(-118 + (0.5 + km) * KM_LNG, 33.5, 1) } });
    expect(hazardNearAnySite(warn(9), [site], R)).toBe(true);
    expect(hazardNearAnySite(warn(12), [site], R)).toBe(false);
    const fire = (km: number) => H({ kind: "fire", geometry: { type: "Point", coordinates: [-118 + (0.5 + km) * KM_LNG, 34] } });
    expect(hazardNearAnySite(fire(24), [site], R)).toBe(true);
    expect(hazardNearAnySite(fire(26), [site], R)).toBe(false);
    const quake = (mag: number) => H({ kind: "quake", geometry: { type: "Point", coordinates: [-118, 34.5] }, props: { mag } });
    expect(hazardNearAnySite(quake(4.2), [site], R)).toBe(true);
    expect(hazardNearAnySite(quake(3.1), [site], R)).toBe(false);
  });
  it("cyclone cones count only when they cover the site", () => {
    const cone = (lng: number) => H({ kind: "cyclone_cone", severity: 3, geometry: { type: "Polygon", coordinates: square(lng, 33, 2) } });
    expect(hazardNearAnySite(cone(-119), [site], R)).toBe(true);
    expect(hazardNearAnySite(cone(-117.9), [site], R)).toBe(false);
  });
  it("company radius overrides are validated", () => {
    expect(resolveRadii({ fires: 40, quakes: -1, bogus: 3, news: "x" })).toEqual({ ...DEFAULT_NEAR_RADII_KM, fires: 40 });
  });
});

describe("scope filters", () => {
  const far = H({ kind: "fire", geometry: { type: "Point", coordinates: [-100, 40] } });
  const near = H({ kind: "fire", geometry: { type: "Point", coordinates: [-118.01, 34.01] } });
  it("near my sites", () => {
    const f = buildScopeFilters("sites", [site], null, R);
    expect(f.effective).toBe("sites");
    expect([far, near].filter(f.hazard!)).toEqual([near]);
    expect(f.point!(34.2, -118, "news")).toBe(true);
    expect(f.point!(34.2, -118, "cameras")).toBe(false);
  });
  it("no sites or no view falls back to everywhere", () => {
    expect(buildScopeFilters("sites", [], null, R).effective).toBe("everywhere");
    expect(buildScopeFilters("view", [site], null, R).hazard).toBeUndefined();
  });
  it("map view, including the antimeridian", () => {
    const f = buildScopeFilters("view", [site], { west: -101, south: 39, east: -99, north: 41 }, R);
    expect([far, near].filter(f.hazard!)).toEqual([far]);
    expect(inView(0, 179.5, { west: 170, south: -10, east: -170, north: 10 })).toBe(true);
    expect(inView(0, 0, { west: 170, south: -10, east: -170, north: 10 })).toBe(false);
  });
  it("cyclone tracks follow distance to the track", () => {
    const f = buildScopeFilters("sites", [site], null, R);
    expect(f.hazard!(H({ kind: "cyclone_track", geometry: { type: "LineString", coordinates: [[-120, 30], [-118, 33]] } }))).toBe(true);
    expect(f.hazard!(H({ kind: "cyclone_track", geometry: { type: "LineString", coordinates: [[-150, 10], [-149, 12]] } }))).toBe(false);
  });
});

describe("Site Watch", () => {
  const sites = sitesFrom(
    [{ id: "1", name: "Stadium", lat: 34, lng: -118, status: "active", geofenceRadius: 500 }, { id: "2", name: "Old", lat: 35, lng: -118, status: "Completed" }, { id: "3", name: "Nowhere", lat: 0, lng: 0 }],
    [{ id: "g", name: "Depot", isActive: true, geometry: { type: "Polygon", coordinates: square(-117.5, 34.5, 0.01) } }, { id: "x", name: "Off", isActive: false, geometry: { type: "Polygon", coordinates: square(0, 0, 1) } }],
  );
  it("builds sites from active operations and active geofences", () => {
    expect(sites.map((s) => s.name)).toEqual(["Stadium", "Depot"]);
    expect(nearParam(sites)).toBe("34.000,-118.000;34.505,-117.495");
  });
  it("red for warnings, amber for watches; de-duplicated and sorted", () => {
    const tornado = H({ kind: "warning", severity: 4, title: "Tornado Warning", geometry: { type: "Polygon", coordinates: square(-118.05, 33.95, 0.1) } });
    const watch = H({ kind: "watch", title: "Flood Watch", geometry: { type: "Polygon", coordinates: square(-118.6, 34.2, 1.2) } });
    const fireA = H({ kind: "fire", geometry: { type: "Point", coordinates: [-118 + 10 * KM_LNG, 34] } });
    const fireB = H({ kind: "fire", geometry: { type: "Point", coordinates: [-118 + 3 * KM_LNG, 34] } });
    const alerts = computeSiteWatch(sites, [watch, fireA, tornado, fireB], R);
    expect(alerts[0]).toMatchObject({ siteName: "Stadium", level: "warning", title: "Tornado Warning", distanceKm: 0 });
    const stadiumFires = alerts.filter((a) => a.siteName === "Stadium" && a.kind === "fire");
    expect(stadiumFires).toHaveLength(1);
    expect(stadiumFires[0].level).toBe("warning"); // closest detection 2.5 km from the site edge
    expect(alerts.some((a) => a.siteName === "Depot" && a.title === "Flood Watch" && a.level === "watch")).toBe(true);
    const levels = siteLevels(alerts);
    expect(levels.get("op:1")?.level).toBe("warning");
    expect(levels.get("gf:g")?.level).toBe("watch");
  });
  it("watch levels", () => {
    expect(watchLevel({ kind: "quake", severity: 3, props: { mag: 5.4 } }, 50)).toBe("warning");
    expect(watchLevel({ kind: "perimeter", severity: 2 }, 12)).toBe("watch");
    expect(watchLevel({ kind: "cyclone_cone", severity: 2 }, 0)).toBe("watch");
  });
});
