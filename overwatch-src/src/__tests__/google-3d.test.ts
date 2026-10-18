import { afterEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_LAYERS, MOBILE_DEFAULT_LAYERS, type LayerVisibility } from "@/components/tactical-map/map-layers-panel";
import { allGroups, applyGoogle3dRules, applyPreset, basemapOf, classicLayers, matchingPreset, setBasemap, setLook } from "@/lib/map/layer-registry";
import { failureStatus, google3dScreenSpaceError, shouldFallBack } from "@/lib/map/google-3d";
import { activeBooleanLayers } from "@/lib/map/share-link";

const base = (): LayerVisibility => ({ ...DEFAULT_LAYERS, groups: allGroups(true), siteOverlays: {} });

describe("3D Cities basemap state", () => {
  it("is off by default on desktop and phones, and no preset turns it on", () => {
    expect(DEFAULT_LAYERS.google3d).toBe(false);
    expect(MOBILE_DEFAULT_LAYERS.google3d).toBe(false);
    for (const id of ["clean", "securityOps", "weatherWatch", "airWatch"] as const) {
      expect(applyPreset({ ...base(), google3d: true }, id).google3d).toBe(false);
    }
  });
  it("selecting it keeps satellite imagery underneath as the fallback; other basemaps clear it", () => {
    const on = setBasemap(base(), "cities3d");
    expect(on.google3d).toBe(true);
    expect(on.satellite).toBe(true);
    expect(basemapOf(on)).toBe("cities3d");
    const off = setBasemap(on, "streets");
    expect(off.google3d).toBe(false);
    expect(basemapOf(off)).toBe("streets");
  });
  it("switches every visual post-effect off while active (HUD stays)", () => {
    const s = { ...setLook(setBasemap(base(), "cities3d"), "thermal"), bloom: true, sharpen: true, hud: true };
    const eff = applyGoogle3dRules(s, { available: true });
    expect([eff.flirThermal, eff.nvgGoggles, eff.noir, eff.crtMode, eff.bloom, eff.sharpen]).toEqual([false, false, false, false, false, false]);
    expect(eff.hud).toBe(true);
    expect(s.flirThermal).toBe(true); // the user's choice is kept for when they switch back
  });
  it("is forced off when the key isn't configured or tiles failed", () => {
    const s = { ...setLook(setBasemap(base(), "cities3d"), "nvg") };
    const eff = applyGoogle3dRules(s, { available: false });
    expect(eff.google3d).toBe(false);
    expect(eff.nvgGoggles).toBe(true);
  });
  it("is never drawn by the classic panel", () => {
    expect(classicLayers(setBasemap(base(), "cities3d")).google3d).toBe(false);
  });
  it("makes the preset chip read Custom (the basemap differs from every preset)", () => {
    expect(matchingPreset(setBasemap(applyPreset(base(), "clean"), "cities3d"))).toBe("custom");
  });
  it("share links can carry it only if the caller doesn't strip it (tactical-map strips it)", () => {
    expect(activeBooleanLayers(setBasemap(base(), "cities3d")).filter((k) => k !== "google3d")).not.toContain("google3d");
  });
});

describe("Google 3D tile failure policy", () => {
  it("parses HTTP status from Cesium error messages", () => {
    expect(failureStatus("Request has failed. Status Code: 403")).toBe(403);
    expect(failureStatus("network error")).toBeUndefined();
  });
  it("falls back at once on key/quota/session errors", () => {
    for (const status of [400, 401, 403, 429]) expect(shouldFallBack([{ at: 0, status }], 1)).toBe(true);
    expect(shouldFallBack([{ at: 0, status: 404 }], 1)).toBe(false);
  });
  it("falls back on a burst of failures, not on scattered ones", () => {
    const burst = Array.from({ length: 8 }, (_, i) => ({ at: 1000 + i }));
    expect(shouldFallBack(burst, 2000)).toBe(true);
    const old = Array.from({ length: 8 }, (_, i) => ({ at: i }));
    expect(shouldFallBack(old, 60_000)).toBe(false);
  });
  it("uses coarser tiles on phones", () => {
    expect(google3dScreenSpaceError(true)).toBeGreaterThan(google3dScreenSpaceError(false));
  });
});

describe("key detection", () => {
  afterEach(() => { vi.unstubAllEnvs(); vi.resetModules(); });
  it("hidden without a key, available with one", async () => {
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAP_TILES_KEY", "");
    vi.resetModules();
    expect((await import("@/lib/map/google-3d")).GOOGLE_3D_AVAILABLE).toBe(false);
    vi.stubEnv("NEXT_PUBLIC_GOOGLE_MAP_TILES_KEY", "test-placeholder");
    vi.resetModules();
    expect((await import("@/lib/map/google-3d")).GOOGLE_3D_AVAILABLE).toBe(true);
  });
});

describe("session renewal", () => {
  it("a 400 after ~2.5 h renews the session; an early 400 is a real failure", async () => {
    const { isExpiredSession } = await import("@/lib/map/google-3d");
    expect(isExpiredSession(400, 0, 151 * 60_000)).toBe(true);
    expect(isExpiredSession(400, 0, 10 * 60_000)).toBe(false);
    expect(isExpiredSession(403, 0, 200 * 60_000)).toBe(false);
  });
});
