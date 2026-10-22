import { describe, expect, it } from "vitest";
import fs from "fs";
import { STATION_DUP_RE, stationPool } from "@/components/tactical-map/orbit-tracker";
import path from "path";
import { SAT_CATEGORIES, SAT_CATEGORY_COLOR, satCategory, satModelUrl, satOrientation } from "@/lib/map/sat-category";
import { CATEGORY_COLOR, matchesShipFilter, shipIsBeacon, shipIsEmergency } from "@/lib/map/ships";
import { TLE_GROUPS } from "@/components/tactical-map/orbit-tracker";
import { migrateLayers, type RegistryState } from "@/lib/map/layer-registry";

describe("satellite categories", () => {
  it("classifies by group and name", () => {
    expect(satCategory({ name: "ISS (ZARYA)", group: "stations" })).toBe("station");
    expect(satCategory({ name: "CSS (TIANHE)", group: "stations" })).toBe("station");
    expect(satCategory({ name: "GPS BIIF-2 (PRN 01)", group: "gps-ops" })).toBe("nav");
    expect(satCategory({ name: "USA 245", group: "military" })).toBe("military");
    expect(satCategory({ name: "NROL-44" })).toBe("military");
    expect(satCategory({ name: "INTELSAT 901", group: "intelsat" })).toBe("comms");
    expect(satCategory({ name: "NOAA 20", group: "weather" })).toBe("science");
    expect(satCategory({ name: "SENTINEL-2A", group: "resource" })).toBe("science");
    expect(satCategory({ name: "MYSTERY-1" })).toBe("unknown");
  });
  it("picks a model per type, all files present and small", () => {
    expect(satModelUrl({ name: "ISS (ZARYA)", group: "stations" })).toMatch(/station\.glb/);
    expect(satModelUrl({ name: "GPS BIIR-2", group: "gps-ops" })).toMatch(/gps\.glb/);
    expect(satModelUrl({ name: "INTELSAT 901", group: "intelsat" })).toMatch(/comms\.glb/);
    expect(satModelUrl({ name: "FLOCK 4Q-1", group: "resource" })).toMatch(/cubesat\.glb/);
    let total = 0;
    for (const f of ["comms", "station", "cubesat", "gps"]) total += fs.statSync(path.join(__dirname, "../../public/models/sats", `${f}.glb`)).size;
    expect(total).toBeLessThan(55_000);
  });
  it("keeps the propagation load at 30 satellites", () => {
    expect(TLE_GROUPS.reduce((a, g) => a + g.take, 0)).toBe(30);
  });
  it("military is the same red-orange as ships", () => {
    expect(SAT_CATEGORY_COLOR.military).toBe(CATEGORY_COLOR.military);
    expect(new Set(SAT_CATEGORIES.map((c) => SAT_CATEGORY_COLOR[c])).size).toBe(SAT_CATEGORIES.length);
  });
});

describe("ships filter", () => {
  const s = (o: Partial<{ mmsi: number; nav_status: number | null; ship_type: number | null }>) => ({ mmsi: 366000001, nav_status: 0, ship_type: 70, ...o });
  it("military = AIS 35 / 55", () => {
    expect(matchesShipFilter(s({ ship_type: 35 }), "military")).toBe(true);
    expect(matchesShipFilter(s({ ship_type: 55 }), "military")).toBe(true);
    expect(matchesShipFilter(s({ ship_type: 70 }), "military")).toBe(false);
  });
  it("emergency = beacons, distress statuses, SAR and medical units", () => {
    expect(shipIsBeacon(s({ mmsi: 970123456 }))).toBe(true);
    expect(shipIsBeacon(s({ mmsi: 972123456 }))).toBe(true);
    expect(shipIsBeacon(s({ mmsi: 974123456 }))).toBe(true);
    expect(shipIsBeacon(s({ nav_status: 14 }))).toBe(true);
    for (const o of [{ nav_status: 2 }, { nav_status: 6 }, { ship_type: 51 }, { ship_type: 58 }]) expect(shipIsEmergency(s(o))).toBe(true);
    expect(shipIsEmergency(s({}))).toBe(false);
    expect(matchesShipFilter(s({}), "all")).toBe(true);
    expect(matchesShipFilter(s({}), undefined)).toBe(true);
  });
  it("saved filter survives migration; bad values reset to All", () => {
    const d = { groups: {}, preset: "custom" } as unknown as RegistryState;
    expect(migrateLayers(d, { groups: {}, shipFilter: "military" } as never).shipFilter).toBe("military");
    expect(migrateLayers(d, { groups: {}, shipFilter: "bogus" } as never).shipFilter).toBe("all");
  });
});

describe("stations group de-dup", () => {
  it("drops ISS/CSS modules, keeps other stations", () => {
    expect(STATION_DUP_RE.test("POISK")).toBe(true);
    expect(STATION_DUP_RE.test("ISS (NAUKA)")).toBe(true);
    expect(STATION_DUP_RE.test("CSS (WENTIAN)")).toBe(true);
    expect(STATION_DUP_RE.test("AEROCUBE 12A")).toBe(false);
  });
});

describe("stationPool", () => {
  it("keeps ISS/CSS cores first and drops modules/debris", () => {
    const n = (x: string) => ({ name: x });
    expect(stationPool([n("POISK"), n("FREGAT DEB"), n("ISS (ZARYA)"), n("CSS (TIANHE)"), n("ISS (NAUKA)"), n("AEROCUBE")]).map((t) => t.name))
      .toEqual(["ISS (ZARYA)", "CSS (TIANHE)", "AEROCUBE"]);
  });
});

describe("satOrientation", () => {
  it("returns a unit quaternion mapping +X to flight and +Y to radial", () => {
    const pos = { x: 6.8e6, y: 1e5, z: 2e5 }, next = { x: 6.79e6, y: 4.6e5, z: 2.1e5 };
    const q = satOrientation(pos, next)!;
    expect(Math.hypot(...q)).toBeCloseTo(1, 9);
    const [x, y, z, w] = q;
    const rot = (v: number[]) => { // q * v * q^-1
      const [vx, vy, vz] = v; const ix = w * vx + y * vz - z * vy, iy = w * vy + z * vx - x * vz, iz = w * vz + x * vy - y * vx, iw = -x * vx - y * vy - z * vz;
      return [ix * w + iw * -x + iy * -z - iz * -y, iy * w + iw * -y + iz * -x - ix * -z, iz * w + iw * -z + ix * -y - iy * -x];
    };
    const r = Math.hypot(pos.x, pos.y, pos.z); const upv = rot([0, 1, 0]);
    expect(upv[0]).toBeCloseTo(pos.x / r, 6); expect(upv[1]).toBeCloseTo(pos.y / r, 6);
    expect(rot([1, 0, 0])[1]).toBeGreaterThan(0.9);
  });
  it("returns null for degenerate input", () => { expect(satOrientation({ x: 1e6, y: 0, z: 0 }, { x: 1e6, y: 0, z: 0 })).toBeNull(); });
});
