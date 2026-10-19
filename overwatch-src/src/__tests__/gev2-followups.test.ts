// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from "vitest";
import { migrateLayers } from "@/lib/map/layer-registry";
import { defaultLayersFor } from "@/components/tactical-map/map-layers-panel";
import { ascentLabel } from "@/lib/map/launches";
import { loadLastWindField, loadWindField, serializeWindField, windStride, type WindField } from "@/lib/map/wind-field";

describe("Space sub migration", () => {
  const groups = { myOps: true, weather: true, security: true, airSea: true, cameras: true, infrastructure: true };
  it("turns launches on for saved prefs that had orbits on", () => {
    const m = migrateLayers(defaultLayersFor(false), { groups, satelliteOrbits: true } as never);
    expect(m.rocketLaunches).toBe(true);
  });
  it("leaves launches off when orbits were off", () => {
    expect(migrateLayers(defaultLayersFor(false), { groups, satelliteOrbits: false } as never).rocketLaunches).toBe(false);
  });
  it("respects an explicit saved choice", () => {
    expect(migrateLayers(defaultLayersFor(false), { groups, satelliteOrbits: true, rocketLaunches: false } as never).rocketLaunches).toBe(false);
  });
});

describe("ascentLabel", () => {
  it("is fixed width and quantized", () => {
    const a = ascentLabel(0), b = ascentLabel(0.5), c = ascentLabel(1);
    expect(a).toBe("T+000s ·   0 km");
    expect(new Set([a.length, b.length, c.length]).size).toBe(1);
    expect(ascentLabel(0.501)).toBe(ascentLabel(0.5));
    expect(Number(b.slice(2, 5)) % 5).toBe(0);
  });
});

describe("wind fallback", () => {
  const field: WindField = { time: "2026-10-19T18:00:00Z", nx: 2, ny: 2, lo1: 0, la1: 10, dx: 5, dy: 5, u: new Float32Array([1, 2, 3, 4]), v: new Float32Array([0, 0, 0, 0]) };
  const now = Date.parse("2026-10-19T20:00:00Z");
  beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
  it("returns the last saved field flagged stale when the source is down", async () => {
    const stride = windStride(false);
    localStorage.setItem(`ow:wind-field:last:v1:${stride}`, JSON.stringify({ at: now - 3600_000, f: serializeWindField(field) }));
    const orig = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch;
    try {
      const f = await loadWindField(false, undefined, now);
      expect(f?.stale).toBe(true);
      expect(f?.time).toBe(field.time);
    } finally { globalThis.fetch = orig; }
  });
  it("ignores a saved field older than 24 h", () => {
    const stride = windStride(false);
    localStorage.setItem(`ow:wind-field:last:v1:${stride}`, JSON.stringify({ at: now - 25 * 3600_000, f: serializeWindField(field) }));
    expect(loadLastWindField(stride, now)).toBeNull();
  });
  it("returns null with nothing saved and the source down", async () => {
    const orig = globalThis.fetch;
    globalThis.fetch = (() => Promise.reject(new TypeError("Failed to fetch"))) as typeof fetch;
    try { expect(await loadWindField(true, undefined, now)).toBeNull(); } finally { globalThis.fetch = orig; }
  });
});
