import { describe, expect, it } from "vitest";
import { DEFAULT_LAYERS, MOBILE_DEFAULT_LAYERS, type LayerVisibility } from "@/components/tactical-map/map-layers-panel";
import {
  GROUPS, GROUP_IDS, V2_RETIRED_KEYS, activeDataGroups, allGroups, applyPreset, basemapOf, classicLayers, defaultPresetFor,
  effectiveLayers, expandSharedLayers, flattenForClassic, groupDef, lookOf, matchingPreset, migrateLayers, setBasemap, setGroup, setLook, setSub, subOn,
} from "@/lib/map/layer-registry";
import { activeBooleanLayers, applySharedLayers } from "@/lib/map/share-link";

const base = (): LayerVisibility => ({ ...DEFAULT_LAYERS, groups: allGroups(true), siteOverlays: {} });

describe("layer registry structure", () => {
  it("has the 6 groups in order", () => {
    expect(GROUPS.map((g) => g.id)).toEqual(["myOps", "weather", "security", "airSea", "cameras", "infrastructure"]);
    expect(GROUP_IDS).toHaveLength(6);
  });
  it("every sub-option key is a real boolean layer key", () => {
    for (const g of GROUPS) for (const s of g.subs) for (const k of s.keys) expect(typeof DEFAULT_LAYERS[k]).toBe("boolean");
  });
  it("no key belongs to two sub-options", () => {
    const seen = new Set<string>();
    for (const g of GROUPS) for (const s of g.subs) for (const k of s.keys) { expect(seen.has(k)).toBe(false); seen.add(k); }
  });
  it("retired / hidden layers are not offered", () => {
    const offered = GROUPS.flatMap((g) => g.subs.flatMap((s) => s.keys));
    for (const k of V2_RETIRED_KEYS) expect(offered).not.toContain(k);
    expect(offered).not.toContain("radioFrequencies");
  });
  it("orbits sit under Infrastructure, ports under Air & Sea", () => {
    expect(groupDef("infrastructure").subs.some((s) => s.keys.includes("satelliteOrbits"))).toBe(true);
    expect(groupDef("airSea").subs.some((s) => s.keys.includes("maritime"))).toBe(true);
  });
});

describe("effectiveLayers", () => {
  it("a group master off hides all its sub-layers without losing the choice", () => {
    const s = { ...base(), earthquakes: true, fires: true, weather: true, groups: { ...allGroups(true), weather: false } };
    const eff = effectiveLayers(s);
    expect(eff.earthquakes || eff.fires || eff.weather).toBe(false);
    expect(s.earthquakes).toBe(true);
    expect(effectiveLayers({ ...s, groups: allGroups(true) }).earthquakes).toBe(true);
  });
  it("retired keys never draw under v2", () => {
    const s = { ...base(), gdelt: true, sigintNews: true, eonetWeather: true, liveNews: true, radioFrequencies: true };
    const eff = effectiveLayers(s);
    for (const k of V2_RETIRED_KEYS) expect(eff[k]).toBe(false);
  });
  it("desktop-only sub-options are off on phones", () => {
    const s = { ...base(), satelliteOrbits: true };
    expect(effectiveLayers(s, { constrained: true }).satelliteOrbits).toBe(false);
    expect(effectiveLayers(s).satelliteOrbits).toBe(true);
  });
  it("classic ignores groups but hides the v2-only merged news", () => {
    const s = { ...base(), news: true, gdelt: true, groups: allGroups(false) };
    const c = classicLayers(s);
    expect(c.news).toBe(false);
    expect(c.gdelt).toBe(true);
  });
  it("non-registry state passes through", () => {
    const s = { ...base(), siteOverlayOpacity: 0.3, terrain: false };
    expect(effectiveLayers(s).siteOverlayOpacity).toBe(0.3);
    expect(effectiveLayers(s).terrain).toBe(false);
  });
});

describe("groups and subs", () => {
  it("turning on an empty group selects its first option", () => {
    const s = { ...base(), aircraft: false, maritime: false, groups: { ...allGroups(true), airSea: false } };
    const n = setGroup(s, "airSea", true);
    expect(n.groups.airSea).toBe(true);
    expect(n.aircraft).toBe(true);
    expect(n.preset).toBe("custom");
  });
  it("setSub toggles all keys of a multi-key option", () => {
    const hazards = groupDef("weather").subs.find((s) => s.id === "hazards")!;
    const n = setSub(base(), hazards, true);
    expect(n.earthquakes && n.fires).toBe(true);
    expect(subOn(n, hazards)).toBe(true);
  });
  it("activeDataGroups ignores My Operations and empty groups", () => {
    const s = { ...base(), aircraft: true, cctv: false, earthquakes: false, fires: false, weather: false, lightning: false, raws: false, s2Intel: false, conflictZones: false, news: false, maritime: false, nuclearInfrastructure: false, satelliteOrbits: false };
    expect(activeDataGroups(s)).toEqual(["airSea"]);
  });
});

describe("basemap and looks", () => {
  it("round-trips every basemap", () => {
    for (const b of ["satellite", "streets", "dark", "daily", "sar"] as const) expect(basemapOf(setBasemap(base(), b))).toBe(b);
  });
  it("looks are exclusive", () => {
    let s = setLook(base(), "nvg");
    s = setLook(s, "crt");
    expect(lookOf(s)).toBe("crt");
    expect(s.nvgGoggles || s.flirThermal || s.noir).toBe(false);
    expect(lookOf(setLook(s, "normal"))).toBe("normal");
  });
});

describe("presets", () => {
  it("defaults: desktop Security Ops, phone Clean", () => {
    expect(defaultPresetFor(false)).toBe("securityOps");
    expect(defaultPresetFor(true)).toBe("clean");
  });
  it("Clean shows only sites + incidents", () => {
    const s = applyPreset({ ...base(), aircraft: true, staff: true }, "clean");
    const eff = effectiveLayers(s);
    expect(eff.operations && eff.incidents).toBe(true);
    expect(eff.staff || eff.aircraft || eff.earthquakes || eff.cctv).toBe(false);
    expect(activeDataGroups(s)).toEqual([]);
    expect(s.preset).toBe("clean");
  });
  it("Security Ops only enables cameras after the CCTV acknowledgement", () => {
    expect(applyPreset(base(), "securityOps").cctv).toBe(false);
    expect(applyPreset(base(), "securityOps").groups.cameras).toBe(false);
    const acked = applyPreset(base(), "securityOps", { cctvAcked: true });
    expect(acked.cctv && acked.groups.cameras).toBe(true);
    expect(acked.s2Intel && acked.earthquakes && acked.staff).toBe(true);
  });
  it("Weather Watch uses the Dark basemap; Air Watch shows aircraft", () => {
    expect(basemapOf(applyPreset(base(), "weatherWatch"))).toBe("dark");
    const air = effectiveLayers(applyPreset(base(), "airWatch"));
    expect(air.aircraft).toBe(true);
    expect(air.weather).toBe(false);
  });
  it("presets keep terrain, look and site overlays", () => {
    const s = { ...setLook(base(), "nvg"), terrain: false, siteOverlays: { a: true } };
    const n = applyPreset(s, "airWatch");
    expect(n.terrain).toBe(false);
    expect(lookOf(n)).toBe("nvg");
    expect(n.siteOverlays).toEqual({ a: true });
  });
});

describe("migration and share links", () => {
  it("classic saved state keeps everything that was on", () => {
    const saved = { aircraft: true, gdelt: true, eonetWeather: true, radioFrequencies: true };
    const m = migrateLayers(DEFAULT_LAYERS, saved as Partial<LayerVisibility>);
    expect(m.groups).toEqual(allGroups(true));
    expect(m.preset).toBe("custom");
    expect(m.news).toBe(true);
    expect(m.lightning).toBe(true);
    expect(m.radioFrequencies).toBe(false);
    expect(effectiveLayers(m).aircraft).toBe(true);
  });
  it("v2 saved state keeps group switches", () => {
    const m = migrateLayers(MOBILE_DEFAULT_LAYERS, { groups: { ...allGroups(true), weather: false }, preset: "clean", news: false } as Partial<LayerVisibility>);
    expect(m.groups.weather).toBe(false);
    expect(m.preset).toBe("clean");
    expect(m.terrain).toBe(false);
  });
  it("unknown preset becomes custom", () => {
    expect(migrateLayers(DEFAULT_LAYERS, { groups: allGroups(true), preset: "bogus" } as never).preset).toBe("custom");
  });
  it("old share links map retired keys to their replacements", () => {
    expect(expandSharedLayers(["gdelt", "eonetWeather"]).sort()).toEqual(["eonetWeather", "gdelt", "lightning", "news"]);
    const s = applySharedLayers(base(), expandSharedLayers(["sigintNews", "aircraft"]));
    const eff = effectiveLayers({ ...s, groups: allGroups(true) });
    expect(eff.news && eff.aircraft).toBe(true);
  });
  it("share link of v2 effective layers excludes hidden groups", () => {
    const s = { ...base(), aircraft: true, groups: { ...allGroups(true), airSea: false } };
    expect(activeBooleanLayers(effectiveLayers(s))).not.toContain("aircraft");
  });
  it("switching back to classic keeps what v2 showed", () => {
    const s = { ...base(), news: true, aircraft: true, earthquakes: true, groups: { ...allGroups(true), weather: false } };
    const c = classicLayers(flattenForClassic(s));
    expect(c.aircraft).toBe(true);
    expect(c.earthquakes).toBe(false);
    expect(c.gdelt && c.sigintNews).toBe(true);
  });
});

describe("matchingPreset (derived preset chip)", () => {
  it("recognises each preset right after applying it", () => {
    for (const id of ["clean", "securityOps", "weatherWatch", "airWatch"] as const) {
      expect(matchingPreset(applyPreset(base(), id, { cctvAcked: true }), { cctvAcked: true })).toBe(id);
      expect(matchingPreset(applyPreset(base(), id, { constrained: true }), { constrained: true })).toBe(id);
    }
  });
  it("still matches after a classic -> grouped round trip", () => {
    const start = applyPreset(base(), "securityOps", { cctvAcked: true });
    const classic = flattenForClassic(start);
    const back = migrateLayers(base(), { ...classic, news: classic.news || classic.gdelt || classic.sigintNews } as never);
    expect(back.preset).toBe("custom"); // stored history says custom...
    expect(matchingPreset(back, { cctvAcked: true })).toBe("securityOps"); // ...but the chip reflects the screen
  });
  it("turning a sub-option off makes it custom; turning it back re-matches", () => {
    const start = applyPreset(base(), "weatherWatch");
    const radar = groupDef("weather").subs.find((s) => s.id === "radar")!;
    const off = setSub(start, radar, false);
    expect(matchingPreset(off)).toBe("custom");
    expect(matchingPreset(setSub(off, radar, true))).toBe("weatherWatch");
  });
  it("looks and HUD never break a preset match", () => {
    const start = applyPreset(base(), "clean");
    expect(matchingPreset({ ...setLook(start, "crt"), hud: true })).toBe("clean");
  });
});
