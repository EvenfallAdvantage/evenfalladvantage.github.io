import { describe, expect, it, vi } from "vitest";
import { DEFAULT_LAYERS, type LayerVisibility } from "@/components/tactical-map/map-layers-panel";
import { allGroups, effectiveLayers, migrateLayers } from "@/lib/map/layer-registry";
import { anyStrikeInCircle, lightningSampleUrl } from "@/lib/map/lightning-sample";

vi.mock("@/lib/supabase/client", () => {
  const calls: { table: string; op: string; payload?: unknown; opts?: unknown }[] = [];
  const builder = (table: string) => {
    const b: Record<string, unknown> = {};
    b.select = () => b;
    b.eq = () => b;
    b.maybeSingle = async () => (table === "missing" ? { data: null, error: { code: "42P01" } } : { data: null, error: null });
    b.upsert = async (payload: unknown, opts: unknown) => {
      calls.push({ table, op: "upsert", payload, opts });
      return { error: (payload as { company_id?: string }).company_id === "no-table" ? { code: "42P01", message: "x" } : null };
    };
    return b;
  };
  return { createClient: () => ({ from: builder }), __calls: calls };
});

const base = (): LayerVisibility => ({ ...DEFAULT_LAYERS, groups: allGroups(true), siteOverlays: {} });

describe("scope / Site Watch layer state", () => {
  it("defaults to near my sites with Site Watch on", () => {
    expect(DEFAULT_LAYERS.scope).toBe("sites");
    expect(DEFAULT_LAYERS.siteWatch).toBe(true);
  });
  it("migrateLayers keeps a valid scope and rejects junk", () => {
    const withGroups = { groups: allGroups(true) };
    expect(migrateLayers(base(), { ...withGroups, scope: "view" } as never).scope).toBe("view");
    expect(migrateLayers(base(), { ...withGroups, scope: "mars" } as never).scope).toBe("sites");
    expect(migrateLayers(base(), { ...withGroups, siteWatch: "yes" } as never).siteWatch).toBe(true);
    expect(migrateLayers(base(), { ...withGroups, siteWatch: false } as never).siteWatch).toBe(false);
  });
  it("classic-panel users keep an everywhere scope (no surprise filtering)", () => {
    expect(migrateLayers(base(), { earthquakes: true } as never).scope).toBe("everywhere");
  });
  it("company-hidden groups switch their layers off but never My Ops", () => {
    const s = { ...base(), cctv: true, operations: true };
    const eff = effectiveLayers(s, { hiddenGroups: ["cameras", "myOps"] as never });
    expect(eff.cctv).toBe(false);
    expect(eff.operations).toBe(true);
  });
});

describe("lightning sampling", () => {
  it("builds a small EPSG:4326 GetMap box around the site", () => {
    const u = new URL(lightningSampleUrl(40, -100, 15));
    expect(u.searchParams.get("crs")).toBe("EPSG:4326");
    expect(u.searchParams.get("width")).toBe("24");
    const [s, w, n, e] = u.searchParams.get("bbox")!.split(",").map(Number);
    expect(n - s).toBeCloseTo(2 * 15 / 110.574, 3);
    expect(e - w).toBeGreaterThan(n - s); // longitude degrees are shorter at 40°N
  });
  it("only counts strikes inside the circle", () => {
    const px = 10;
    const img = new Uint8ClampedArray(px * px * 4);
    img[(0 * px + 0) * 4 + 3] = 255; // corner (outside circle)
    expect(anyStrikeInCircle(img, px)).toBe(false);
    img[(5 * px + 5) * 4 + 3] = 255; // centre
    expect(anyStrikeInCircle(img, px)).toBe(true);
  });
});

describe("db-map-prefs", () => {
  it("never syncs site overlays and upserts on the composite key", async () => {
    const { saveUserMapPrefs } = await import("@/lib/supabase/db-map-prefs");
    const mod = (await import("@/lib/supabase/client")) as unknown as { __calls: { payload: Record<string, unknown>; opts: { onConflict: string } }[] };
    const ok = await saveUserMapPrefs("c1", "desktop", { preset: "custom", layers: { ...base(), siteOverlays: { a: true } }, view: { panelV2: true } });
    expect(ok).toBe(true);
    const last = mod.__calls.at(-1)!;
    expect(last.opts.onConflict).toBe("user_id,company_id,device_class");
    expect((last.payload.layers as Record<string, unknown>).siteOverlays).toBeUndefined();
  });
  it("returns null when no row exists and a friendly error when the table is missing", async () => {
    const { getUserMapPrefs, saveCompanyMapDefaults, DEFAULT_COMPANY_MAP_DEFAULTS } = await import("@/lib/supabase/db-map-prefs");
    expect(await getUserMapPrefs("c1", "mobile")).toBeNull();
    const r = await saveCompanyMapDefaults("no-table", { ...DEFAULT_COMPANY_MAP_DEFAULTS, hiddenGroups: ["myOps", "cameras"] });
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/database update pending/);
  });
  it("strips My Ops from hidden groups before saving", async () => {
    const { saveCompanyMapDefaults, DEFAULT_COMPANY_MAP_DEFAULTS } = await import("@/lib/supabase/db-map-prefs");
    const mod = (await import("@/lib/supabase/client")) as unknown as { __calls: { payload: Record<string, unknown> }[] };
    await saveCompanyMapDefaults("c2", { ...DEFAULT_COMPANY_MAP_DEFAULTS, hiddenGroups: ["myOps", "cameras"] });
    expect(mod.__calls.at(-1)!.payload.hidden_groups).toEqual(["cameras"]);
  });
});
