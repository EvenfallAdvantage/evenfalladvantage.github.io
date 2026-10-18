/**
 * Consolidated layer model for the Operations map (panel v2).
 *
 * The map hooks still read one flat `LayerVisibility` object. This registry
 * puts a user-facing structure on top of it:
 *   - 6 groups, each with a master switch (`layers.groups[id]`) and sub-options
 *     that map onto one or more flat keys;
 *   - one basemap choice and one "look" (View menu) derived from flat keys;
 *   - presets that set a whole configuration at once.
 *
 * `effectiveLayers()` turns the stored state into what the hooks should draw:
 * a sub-option is drawn only if its group's master switch is on.
 * See OPSMAP_LAYER_CONSOLIDATION.md.
 */

export type GroupId = "myOps" | "weather" | "security" | "airSea" | "cameras" | "infrastructure";
export const GROUP_IDS: readonly GroupId[] = ["myOps", "weather", "security", "airSea", "cameras", "infrastructure"];

export type PresetId = "clean" | "securityOps" | "weatherWatch" | "airWatch";
export const PRESET_IDS: readonly PresetId[] = ["clean", "securityOps", "weatherWatch", "airWatch"];

export type BasemapId = "satellite" | "streets" | "dark" | "daily" | "sar";
export type LookId = "normal" | "nvg" | "thermal" | "noir" | "crt";

/** The flat boolean keys the registry manipulates (subset of LayerVisibility). */
export type FlatKey =
  | "operations" | "staff" | "incidents" | "breadcrumbs" | "geofences" | "annotations" | "nearbyPOIs" | "radioFrequencies"
  | "weather" | "raws" | "eonetWeather" | "fires" | "earthquakes" | "lightning"
  | "conflictZones" | "gdelt" | "sigintNews" | "news" | "nuclearInfrastructure" | "cctv" | "liveNews"
  | "aircraft" | "satelliteOrbits" | "maritime" | "s2Intel"
  | "satellite" | "nightVision" | "sentinel1" | "sentinel2" | "terrain" | "buildings"
  | "flirThermal" | "crtMode" | "nvgGoggles" | "noir" | "bloom" | "sharpen" | "hud"
  | "nwsWarnings" | "naturalHazards" | "tropical" | "clouds" | "wind" | "gnss";

/** Minimal shape the registry needs; LayerVisibility satisfies it. */
export type RegistryState = Record<FlatKey, boolean> & {
  groups: Record<GroupId, boolean>;
  preset: PresetId | "custom";
  aircraftFilter?: "all" | "military" | "emergency";
};

export interface SubOption {
  id: string;
  label: string;
  /** Flat keys this option switches together. */
  keys: FlatKey[];
  hint?: string;
  /** Not offered on phones / constrained devices. */
  desktopOnly?: boolean;
}

export interface GroupDef {
  id: GroupId;
  label: string;
  /** One-line description for the collapsed row. */
  blurb: string;
  subs: SubOption[];
}

export const GROUPS: readonly GroupDef[] = [
  {
    id: "myOps", label: "My Operations", blurb: "Sites, staff, incidents",
    subs: [
      { id: "sites", label: "Sites", keys: ["operations"] },
      { id: "staff", label: "Staff", keys: ["staff"] },
      { id: "incidents", label: "Incidents", keys: ["incidents"] },
      { id: "trails", label: "Patrol trails", keys: ["breadcrumbs"] },
      { id: "geofences", label: "Geofences", keys: ["geofences"] },
      { id: "drawings", label: "Drawings", keys: ["annotations"] },
      { id: "nearby", label: "Nearby services", keys: ["nearbyPOIs"], hint: "Hospitals, police, fire stations (OpenStreetMap)" },
    ],
  },
  {
    id: "weather", label: "Weather & Hazards", blurb: "Warnings, quakes, fires, radar",
    subs: [
      { id: "warnings", label: "Weather warnings", keys: ["nwsWarnings"], hint: "NWS warnings, watches and advisories (US)" },
      { id: "hazards", label: "Quakes, fires & volcanoes", keys: ["naturalHazards"], hint: "USGS earthquakes, NASA FIRMS fire detections, NIFC wildfire perimeters, volcanoes" },
      { id: "tropical", label: "Hurricanes", keys: ["tropical"], hint: "NHC active storms, forecast cones and tracks" },
      { id: "radar", label: "Radar loop", keys: ["weather"], hint: "NOAA MRMS reflectivity, last hour (US)" },
      { id: "clouds", label: "Clouds", keys: ["clouds"], hint: "Infrared satellite, day and night" },
      { id: "lightning", label: "Lightning", keys: ["lightning"], hint: "NOAA 15-minute strike density" },
      { id: "wind", label: "Wind", keys: ["wind"], hint: "Observed surface wind barbs (US)" },
      { id: "stations", label: "Fire-weather stations", keys: ["raws"] },
    ],
  },
  {
    id: "security", label: "Security & Conflict", blurb: "Security events, conflict zones, news",
    subs: [
      { id: "events", label: "Security events", keys: ["s2Intel"], hint: "S2 Underground: kinetic events, drone and tipline reports" },
      { id: "conflict", label: "Conflict zones", keys: ["conflictZones"] },
      { id: "news", label: "News", keys: ["news"], hint: "Headlines with a location, duplicates merged" },
    ],
  },
  {
    id: "airSea", label: "Air & Sea", blurb: "Aircraft, ports",
    subs: [
      { id: "aircraft", label: "Aircraft", keys: ["aircraft"] },
      { id: "gnss", label: "GPS interference", keys: ["gnss"], hint: "Areas where many aircraft report poor GPS accuracy (an anomaly, not confirmed jamming)" },
      { id: "ports", label: "Ports & chokepoints", keys: ["maritime"] },
    ],
  },
  {
    id: "cameras", label: "Cameras", blurb: "Public traffic cameras",
    subs: [{ id: "cctv", label: "Traffic cameras", keys: ["cctv"] }],
  },
  {
    id: "infrastructure", label: "Infrastructure", blurb: "Nuclear facilities, space",
    subs: [
      { id: "nuclear", label: "Nuclear facilities", keys: ["nuclearInfrastructure"] },
      { id: "space", label: "Space (satellite orbits)", keys: ["satelliteOrbits"], desktopOnly: true },
    ],
  },
];

/** Flat keys that panel v2 never draws (dropped, merged or moved). */
export const V2_RETIRED_KEYS: readonly FlatKey[] = ["eonetWeather", "gdelt", "sigintNews", "liveNews", "radioFrequencies", "earthquakes", "fires"];
/** Flat keys the classic panel never draws (v2-only merges). */
export const CLASSIC_HIDDEN_KEYS: readonly FlatKey[] = ["news", "radioFrequencies", "nwsWarnings", "naturalHazards", "tropical", "clouds", "wind", "gnss"];

export const PRESET_LABELS: Record<PresetId, string> = {
  clean: "Clean",
  securityOps: "Security Ops",
  weatherWatch: "Weather Watch",
  airWatch: "Air Watch",
};

export const BASEMAP_LABELS: Record<BasemapId, string> = {
  satellite: "Satellite",
  streets: "Streets",
  dark: "Dark",
  daily: "Daily",
  sar: "SAR",
};

export const LOOK_LABELS: Record<LookId, string> = {
  normal: "Normal",
  nvg: "NVG",
  thermal: "Thermal",
  noir: "Noir",
  crt: "CRT",
};
/** Looks offered on phones (cheap shaders only). */
export const MOBILE_LOOKS: readonly LookId[] = ["normal", "nvg", "thermal"];
/** At most this many data groups (besides My Operations) on a phone at once. */
export const MOBILE_MAX_DATA_GROUPS = 3;

export function groupDef(id: GroupId): GroupDef {
  return GROUPS.find((g) => g.id === id)!;
}

export function allGroups(on: boolean): Record<GroupId, boolean> {
  return Object.fromEntries(GROUP_IDS.map((g) => [g, on])) as Record<GroupId, boolean>;
}

export function subOn(state: RegistryState, sub: SubOption): boolean {
  return sub.keys.every((k) => state[k]);
}

export function setSub<T extends RegistryState>(state: T, sub: SubOption, on: boolean): T {
  const next = { ...state, preset: "custom" as const };
  for (const k of sub.keys) (next as RegistryState)[k] = on;
  return next;
}

export function setGroup<T extends RegistryState>(state: T, id: GroupId, on: boolean): T {
  const next = { ...state, groups: { ...state.groups, [id]: on }, preset: "custom" as const };
  // Turning a group on with nothing selected selects its first option, so the switch always does something.
  if (on && !groupDef(id).subs.some((s) => subOn(next, s))) {
    for (const k of groupDef(id).subs[0].keys) (next as RegistryState)[k] = true;
  }
  return next;
}

/** Data groups (not My Operations) whose master switch is on and that draw something. */
export function activeDataGroups(state: RegistryState): GroupId[] {
  return GROUP_IDS.filter((g) => g !== "myOps" && state.groups[g] && groupDef(g).subs.some((s) => subOn(state, s)));
}

/** What the map hooks should draw under panel v2. */
export function effectiveLayers<T extends RegistryState>(state: T, opts: { constrained?: boolean; hiddenGroups?: readonly GroupId[] } = {}): T {
  const next = { ...state };
  for (const g of GROUPS) {
    const groupOn = state.groups?.[g.id] !== false && (g.id === "myOps" || !opts.hiddenGroups?.includes(g.id));
    for (const s of g.subs) {
      const allowed = groupOn && !(opts.constrained && s.desktopOnly);
      if (!allowed) for (const k of s.keys) (next as RegistryState)[k] = false;
    }
  }
  for (const k of V2_RETIRED_KEYS) (next as RegistryState)[k] = false;
  return next;
}

/** What the map hooks should draw under the classic panel. */
export function classicLayers<T extends RegistryState>(state: T): T {
  const next = { ...state };
  for (const k of CLASSIC_HIDDEN_KEYS) (next as RegistryState)[k] = false;
  return next;
}

/** Stored state that, under the classic panel, draws what v2 drew (used when switching back). */
export function flattenForClassic<T extends RegistryState>(state: T): T {
  const eff = effectiveLayers(state);
  return {
    ...eff, groups: allGroups(true), preset: "custom",
    gdelt: eff.news || state.gdelt, sigintNews: eff.news || state.sigintNews, eonetWeather: false,
    earthquakes: eff.naturalHazards, fires: eff.naturalHazards,
    liveNews: state.liveNews && state.groups?.security !== false,
  };
}

// ─── Basemap + look ────────────────────────────────────────────────

export function basemapOf(s: RegistryState): BasemapId {
  if (s.sentinel1) return "sar";
  if (s.sentinel2) return "daily";
  if (!s.satellite) return "streets";
  if (s.nightVision) return "dark";
  return "satellite";
}

export function setBasemap<T extends RegistryState>(s: T, b: BasemapId): T {
  return {
    ...s,
    satellite: b !== "streets",
    nightVision: b === "dark",
    sentinel1: b === "sar",
    sentinel2: b === "daily",
  };
}

export function lookOf(s: RegistryState): LookId {
  if (s.nvgGoggles) return "nvg";
  if (s.flirThermal) return "thermal";
  if (s.noir) return "noir";
  if (s.crtMode) return "crt";
  return "normal";
}

export function setLook<T extends RegistryState>(s: T, look: LookId): T {
  return { ...s, nvgGoggles: look === "nvg", flirThermal: look === "thermal", noir: look === "noir", crtMode: look === "crt" };
}

// ─── Presets ───────────────────────────────────────────────────────

interface PresetSpec {
  groups: GroupId[];
  /** Sub-option ids (group:sub) turned on; every other sub-option is turned off. */
  subs: string[];
  /** Extra sub-options only on desktop. */
  desktopSubs?: string[];
  basemap: BasemapId;
  aircraftFilter?: "all" | "military" | "emergency";
}

export const PRESETS: Record<PresetId, PresetSpec> = {
  clean: { groups: ["myOps"], subs: ["myOps:sites", "myOps:incidents"], basemap: "satellite" },
  securityOps: {
    groups: ["myOps", "weather", "security", "airSea", "cameras"],
    subs: ["myOps:sites", "myOps:staff", "myOps:incidents", "weather:warnings", "weather:hazards", "weather:tropical", "security:events", "security:conflict", "airSea:aircraft", "cameras:cctv"],
    basemap: "satellite",
    aircraftFilter: "emergency",
  },
  weatherWatch: {
    groups: ["myOps", "weather"],
    subs: ["myOps:sites", "weather:warnings", "weather:hazards", "weather:tropical", "weather:radar", "weather:lightning"],
    desktopSubs: ["weather:wind"],
    basemap: "dark",
  },
  airWatch: {
    groups: ["myOps", "airSea"],
    subs: ["myOps:sites", "airSea:aircraft"],
    desktopSubs: ["airSea:gnss"],
    basemap: "satellite",
    aircraftFilter: "all",
  },
};

export function defaultPresetFor(constrained: boolean): PresetId {
  return constrained ? "clean" : "securityOps";
}

/**
 * Apply a preset. Cameras need a one-time acknowledgement, so a preset only
 * turns them on for users who already gave it (`cctvAcked`).
 */
export function applyPreset<T extends RegistryState>(state: T, id: PresetId, opts: { constrained?: boolean; cctvAcked?: boolean } = {}): T {
  const spec = PRESETS[id];
  const want = new Set([...spec.subs, ...(opts.constrained ? [] : spec.desktopSubs ?? [])]);
  if (!opts.cctvAcked) want.delete("cameras:cctv");
  let next = { ...state } as T;
  for (const g of GROUPS) {
    for (const s of g.subs) {
      const on = want.has(`${g.id}:${s.id}`);
      for (const k of s.keys) (next as RegistryState)[k] = on;
    }
  }
  const groups = allGroups(false);
  for (const g of spec.groups) groups[g] = GROUPS.find((d) => d.id === g)!.subs.some((s) => want.has(`${g}:${s.id}`));
  groups.myOps = true;
  next = setBasemap({ ...next, groups, preset: id, aircraftFilter: spec.aircraftFilter ?? "all" }, spec.basemap);
  for (const k of V2_RETIRED_KEYS) (next as RegistryState)[k] = false;
  return next;
}

/**
 * Bring saved state from any earlier version up to date. `saved` may be
 * classic-panel state (no `groups`), in which case everything the user had
 * on stays on.
 */
export function migrateLayers<T extends RegistryState>(defaults: T, saved: Partial<T> & Record<string, unknown>): T {
  const merged = { ...defaults, ...saved } as T;
  if (!saved.groups || typeof saved.groups !== "object") {
    merged.groups = allGroups(true);
    merged.preset = "custom";
    // Classic-panel users keep seeing what they saw (new users start near their sites).
    if (saved.scope === undefined) (merged as RegistryState & { scope?: string }).scope = "everywhere";
  } else {
    merged.groups = { ...allGroups(true), ...(saved.groups as Record<GroupId, boolean>) };
  }
  if (saved.lightning === undefined) merged.lightning = !!saved.eonetWeather;
  if (saved.news === undefined) merged.news = !!(saved.gdelt || saved.sigintNews);
  if (saved.naturalHazards === undefined) merged.naturalHazards = !!(saved.earthquakes || saved.fires);
  if (!["all", "military", "emergency"].includes(merged.aircraftFilter as string)) merged.aircraftFilter = "all";
  const m = merged as RegistryState & { scope?: string; siteWatch?: unknown };
  if (!["sites", "view", "everywhere"].includes(m.scope as string)) m.scope = "sites";
  if (typeof m.siteWatch !== "boolean") m.siteWatch = true;
  if (!PRESET_IDS.includes(merged.preset as PresetId)) merged.preset = "custom";
  merged.radioFrequencies = false;
  return merged;
}

/** Old flat keys in share links / saved state and the keys that replace them. */
export const KEY_ALIASES: Record<string, FlatKey[]> = {
  gdelt: ["news"],
  sigintNews: ["news"],
  eonetWeather: ["lightning"],
  earthquakes: ["naturalHazards"],
  fires: ["naturalHazards"],
};

/** Expand a shared layer list with the keys that replaced retired ones. */
export function expandSharedLayers(list: readonly string[]): string[] {
  const out = new Set(list);
  for (const k of list) for (const a of KEY_ALIASES[k] ?? []) out.add(a);
  return [...out];
}
