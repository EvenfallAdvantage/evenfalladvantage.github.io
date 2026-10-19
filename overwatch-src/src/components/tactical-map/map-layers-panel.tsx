"use client";
import { ionAssetsEnabled } from "@/lib/map/basemap-sources";
import { SAR_AVAILABLE } from "./sentinel-layer";

import { useState } from "react";
import {
  Layers, Users, CloudRain, Mountain, Building2,
  Eye, EyeOff, ChevronRight, ChevronDown, Target, AlertTriangle, Moon, Satellite,
  Hospital, Plane, Scan, Monitor, Orbit, Radar, Shield, MapPin, PenTool,
  Activity, Flame, Swords, Wind, Atom, Newspaper, Tv, Rss, Ship, Camera, TowerControl,
  Radio, Film, Sparkles, Focus, Crosshair, Zap,
} from "lucide-react";
import type { OperationPin } from "./types";
import { SiteMapsList } from "./site-maps-list";
import type { GroupId, PresetId } from "@/lib/map/layer-registry";
import type { AircraftFilter } from "@/lib/map/aircraft-filter";
import type { Scope } from "@/lib/map/site-proximity";
import { S2_LAYERS, type S2Layer } from "./s2-underground";
import { isConstrainedDevice } from "@/lib/map/device-profile";

export interface LayerVisibility {
  staff: boolean;
  operations: boolean;
  incidents: boolean;
  weather: boolean;
  buildings: boolean;
  terrain: boolean;
  /** 3D buildings from OpenStreetMap (OpenFreeMap vector tiles, free, no key). */
  osmBuildings: boolean;
  geofences: boolean;
  nightVision: boolean;
  satellite: boolean;
  breadcrumbs: boolean;
  nearbyPOIs: boolean;
  radioFrequencies: boolean;
  annotations: boolean;
  sunPosition: boolean;
  // Satellite intel
  sentinel1: boolean;
  sentinel2: boolean;
  flirThermal: boolean;
  crtMode: boolean;
  // Phase 1B effects (gods-eye-view ports) + HUD
  nvgGoggles: boolean;
  noir: boolean;
  bloom: boolean;
  sharpen: boolean;
  hud: boolean;
  /** Street-level photos (Panoramax, KartaView, Mapillary) in the Cameras group. */
  streetPhotos: boolean;
  /** Screen overlays (View menu): rotating sonar sweep, circular scope mask. */
  sonarSweep: boolean;
  scopeMask: boolean;
  /** NASA Black Marble city lights on the night side of the globe (View menu). */
  cityLights: boolean;
  // Live feeds
  aircraft: boolean;
  satelliteOrbits: boolean;
  // S2 Underground Intel
  s2Intel: boolean;
  // Global Intel layers (Phase C — Osiris integration)
  earthquakes: boolean;
  conflictZones: boolean;
  fires: boolean;
  eonetWeather: boolean;
  nuclearInfrastructure: boolean;
  gdelt: boolean;
  liveNews: boolean;
  sigintNews: boolean;
  maritime: boolean;
  cctv: boolean;
  raws: boolean;
  /** Lightning strike density (was bundled with Severe Weather). */
  lightning: boolean;
  /** Merged news (GDELT + RSS, de-duplicated); panel v2 only. */
  news: boolean;
  /** Panel v2 data layers (intel-hazards, nowCOAST, NWS, adsb.lol). */
  nwsWarnings: boolean;
  naturalHazards: boolean;
  tropical: boolean;
  clouds: boolean;
  wind: boolean;
  gnss: boolean;
  /** Live AIS ships (Air & Sea; panel v2 only). */
  ships: boolean;
  /** Panel v2: OSM infrastructure extract (data centres, dams, military areas, substations). */
  osmInfrastructure: boolean;
  aircraftFilter: AircraftFilter;
  /** Panel v2: where hazards, news and cameras are shown. */
  scope: Scope;
  /** Panel v2: Site Watch (hazards near my sites, on the map only). */
  siteWatch: boolean;
  /** Panel v2: master switch per group; a sub-layer draws only if its group is on. */
  groups: Record<GroupId, boolean>;
  /** Panel v2: preset last applied, or "custom" once anything is changed by hand. */
  preset: PresetId | "custom";
  // Site maps
  siteOverlays: Record<string, boolean>;
  siteOverlayOpacity: number;
}

export const DEFAULT_LAYERS: LayerVisibility = {
  staff: true,
  operations: true,
  incidents: true,
  weather: false,
  buildings: true,
  terrain: true,
  osmBuildings: true,
  geofences: false,
  nightVision: false,
  satellite: true,
  breadcrumbs: false,
  nearbyPOIs: false,
  radioFrequencies: false,
  annotations: false,
  sunPosition: false,
  sentinel1: false,
  sentinel2: false,
  flirThermal: false,
  crtMode: false,
  nvgGoggles: false,
  noir: false,
  bloom: false,
  sharpen: false,
  hud: false,
  streetPhotos: false,
  sonarSweep: false,
  scopeMask: false,
  cityLights: false,
  aircraft: false,
  satelliteOrbits: false,
  s2Intel: false,
  earthquakes: false,
  conflictZones: false,
  fires: false,
  eonetWeather: false,
  nuclearInfrastructure: false,
  gdelt: false,
  liveNews: false,
  sigintNews: false,
  maritime: false,
  cctv: false,
  raws: false,
  lightning: false,
  news: false,
  nwsWarnings: false,
  naturalHazards: false,
  tropical: false,
  clouds: false,
  wind: false,
  gnss: false,
  ships: false,
  osmInfrastructure: false,
  aircraftFilter: "all",
  scope: "sites",
  siteWatch: true,
  groups: { myOps: true, weather: true, security: true, airSea: true, cameras: true, infrastructure: true },
  preset: "custom",
  siteOverlays: {},
  siteOverlayOpacity: 0.75,
};

/** Phones/tablets: skip 3D terrain + 3D buildings by default (biggest GPU/network cost). */
export const MOBILE_DEFAULT_LAYERS: LayerVisibility = {
  ...DEFAULT_LAYERS,
  terrain: false,
  buildings: false,
  osmBuildings: false,
};

export function defaultLayersFor(constrained: boolean): LayerVisibility {
  return constrained ? MOBILE_DEFAULT_LAYERS : DEFAULT_LAYERS;
}

type BoolKey = { [K in keyof LayerVisibility]: LayerVisibility[K] extends boolean ? K : never }[keyof LayerVisibility];

interface LayerToggle {
  key: BoolKey;
  label: string;
  icon: React.ReactNode;
  group: string;
  /** True if this layer cannot be replayed historically (no free historical data source). */
  liveOnly?: boolean;
  /** Hide the toggle entirely (e.g. source not configured for this deployment). */
  hidden?: boolean;
}

const LAYER_TOGGLES: LayerToggle[] = [
  // ─── MAP — how the basemap renders (basemap + imagery overlays) ──
  { key: "satellite", label: "Satellite View", icon: <Satellite className="h-3.5 w-3.5" />, group: "MAP" },
  { key: "terrain", label: ionAssetsEnabled() ? "3D Terrain & Buildings" : "3D Terrain", icon: <Mountain className="h-3.5 w-3.5" />, group: "MAP" },
  { key: "osmBuildings", label: "3D Buildings (OSM)", icon: <Building2 className="h-3.5 w-3.5" />, group: "MAP" },
  // Real Sentinel-1 SAR only; hidden when no Sentinel Hub instance is configured.
  { key: "sentinel1", label: "SAR Imagery", icon: <Scan className="h-3.5 w-3.5" />, group: "MAP", liveOnly: true, hidden: !SAR_AVAILABLE },
  { key: "sentinel2", label: "Daily Satellite (NASA)", icon: <Layers className="h-3.5 w-3.5" />, group: "MAP", liveOnly: true },
  // ─── OPERATIONS — your company's data ──────────────────
  { key: "operations", label: "Operations", icon: <MapPin className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "staff", label: "Staff", icon: <Users className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "breadcrumbs", label: "Patrol Trails", icon: <Radar className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "incidents", label: "Incidents", icon: <AlertTriangle className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "geofences", label: "Geofences", icon: <Target className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "annotations", label: "Drawings", icon: <PenTool className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "nearbyPOIs", label: "Nearby Services", icon: <Hospital className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "radioFrequencies", label: "Radio Frequencies", icon: <Radio className="h-3.5 w-3.5" />, group: "OPERATIONS", hidden: true },
  // ─── ENVIRONMENT — natural phenomena & weather ─────────
  { key: "weather", label: "Weather Radar (US)", icon: <CloudRain className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  { key: "raws", label: "Weather Stations", icon: <TowerControl className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  { key: "eonetWeather", label: "Severe Weather", icon: <Wind className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  { key: "lightning", label: "Lightning", icon: <Zap className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  { key: "fires", label: "Active Fires", icon: <Flame className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  { key: "earthquakes", label: "Earthquakes", icon: <Activity className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  // ─── INTELLIGENCE — external data feeds ────────────────
  // Threats
  { key: "conflictZones", label: "Conflict Zones", icon: <Swords className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "gdelt", label: "World News (geotagged)", icon: <Newspaper className="h-3.5 w-3.5" />, group: "INTELLIGENCE", liveOnly: true },
  { key: "sigintNews", label: "SIGINT News", icon: <Rss className="h-3.5 w-3.5" />, group: "INTELLIGENCE", liveOnly: true },
  { key: "nuclearInfrastructure", label: "Nuclear Facilities", icon: <Atom className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  // Surveillance feeds
  { key: "cctv", label: "CCTV Cameras", icon: <Camera className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "liveNews", label: "Live Broadcasters", icon: <Tv className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  // Air & maritime tracking
  { key: "aircraft", label: "Aircraft", icon: <Plane className="h-3.5 w-3.5" />, group: "INTELLIGENCE", liveOnly: true },
  { key: "satelliteOrbits", label: "Satellite Orbits", icon: <Orbit className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "maritime", label: "Ports & Chokepoints", icon: <Ship className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  // S2 Underground Common Intel Picture (US-focused sub-feeds nested below)
  { key: "s2Intel", label: "S2 Underground CIP", icon: <Shield className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  // Visual effects
  { key: "nightVision", label: "Night Mode", icon: <Moon className="h-3.5 w-3.5" />, group: "EFFECTS" },
  { key: "flirThermal", label: "FLIR Thermal", icon: <Scan className="h-3.5 w-3.5" />, group: "EFFECTS" },
  { key: "crtMode", label: "CRT Mode", icon: <Monitor className="h-3.5 w-3.5" />, group: "EFFECTS" },
  { key: "nvgGoggles", label: "NVG Goggles", icon: <Eye className="h-3.5 w-3.5" />, group: "EFFECTS" },
  { key: "noir", label: "Noir", icon: <Film className="h-3.5 w-3.5" />, group: "EFFECTS" },
  { key: "bloom", label: "Bloom", icon: <Sparkles className="h-3.5 w-3.5" />, group: "EFFECTS" },
  { key: "sharpen", label: "Sharpen", icon: <Focus className="h-3.5 w-3.5" />, group: "EFFECTS" },
  { key: "hud", label: "Tactical HUD", icon: <Crosshair className="h-3.5 w-3.5" />, group: "EFFECTS" },
];

interface MapLayersPanelProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
  onFlyToAll: () => void;
  operations: OperationPin[];
  onRealignSiteMap?: (op: OperationPin) => void;
  onAdjustSiteMap?: (op: OperationPin) => void;
  isAdmin?: boolean;
  s2ActiveLayers?: Set<string>;
  onToggleS2Layer?: (layerId: string) => void;
  s2FeatureCount?: number;
  /** True when the Time Machine is open and dragged into the past — used to
   * tag layers that have no historical data source so the user understands
   * why those layers are temporarily empty. */
  isReplaying?: boolean;
  /** Bounds keyed by event id. An op is considered "ready" (alignable
   * overlay already laid down) if it has a non-null entry. Non-admins can
   * toggle ready overlays on/off; only admins can toggle un-ready ones
   * (which would open the SiteMapAligner). */
  savedBounds?: Record<string, unknown>;
  /** Offer a switch to the new grouped panel. */
  onUseNewPanel?: () => void;
}

export function MapLayersPanel({ layers, onChange, onFlyToAll, operations, onRealignSiteMap, onAdjustSiteMap, isAdmin, s2ActiveLayers, onToggleS2Layer, s2FeatureCount, isReplaying, savedBounds, onUseNewPanel }: MapLayersPanelProps) {
  // Collapsed by default on phones so the globe is usable; desktop unchanged.
  const [open, setOpen] = useState(() => !isConstrainedDevice());
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  function toggleGroup(group: string) {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  }

  function toggle(key: BoolKey) {
    onChange({ ...layers, [key]: !layers[key] });
  }

  const visibleToggles = LAYER_TOGGLES.filter((t) => !t.hidden);
  const groups = [...new Set(visibleToggles.map((t) => t.group))];

  return (
    <div className={`absolute top-3 right-3 z-10 transition-all duration-200 ${open ? "w-56 max-w-[calc(100vw-1.5rem)]" : "w-9"}`}>
      {/* Toggle button */}
      <button
        onClick={() => setOpen(!open)}
        className="absolute top-0 left-0 z-20 flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 hover:text-white transition-colors"
        style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)" }}
        title={open ? "Collapse layers" : "Expand layers"}
      >
        {open ? <ChevronRight className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="ml-11 rounded-xl backdrop-blur-sm border border-white/10 p-3 space-y-3 max-h-[calc(100dvh-240px)] overflow-y-auto overscroll-contain" style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)" }}>
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold font-mono text-white/50 uppercase tracking-wider">Layers</h3>
            <button onClick={onFlyToAll} className="text-[9px] hover:opacity-80 font-mono font-bold" style={{ color: "var(--brand-accent, #d59b3c)" }}>FLY TO ALL</button>
          </div>

          {groups.map((group) => {
            const isCollapsed = collapsedGroups[group] ?? false;
            return (
            <div key={group}>
              <button onClick={() => toggleGroup(group)} className="flex items-center justify-between w-full mb-1 group">
                <span className="text-[9px] font-mono text-white/30 uppercase tracking-wider">{group}</span>
                {isCollapsed ? <ChevronRight className="h-2.5 w-2.5 text-white/20" /> : <ChevronDown className="h-2.5 w-2.5 text-white/20" />}
              </button>
              {!isCollapsed && <div className="space-y-0.5">
                {visibleToggles.filter((t) => t.group === group).map((t) => {
                  const active = layers[t.key];
                  const isLiveOnlyDuringReplay = !!t.liveOnly && !!isReplaying;
                  return (
                    <button
                      key={t.key}
                      onClick={() => toggle(t.key)}
                      title={isLiveOnlyDuringReplay ? "Live data only — hidden while Time Machine is replaying" : undefined}
                      className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                        active && !isLiveOnlyDuringReplay
                          ? "bg-white/10 text-white"
                          : isLiveOnlyDuringReplay && active
                            ? "bg-white/[0.04] text-white/40"
                            : "text-white/40 hover:text-white/60 hover:bg-white/5"
                      }`}
                    >
                      {t.icon}
                      <span className="flex-1 text-left truncate">{t.label}</span>
                      {isLiveOnlyDuringReplay && active && (
                        <span className="text-[8px] font-mono uppercase tracking-wider px-1 py-0.5 rounded bg-white/5 text-white/30 shrink-0">
                          Live only
                        </span>
                      )}
                      {active ? <Eye className={`h-3 w-3 ${isLiveOnlyDuringReplay ? "text-white/20" : "text-green-400"}`} /> : <EyeOff className="h-3 w-3" />}
                    </button>
                  );
                })}
                {/* Site Map Overlays — inline after OPERATIONS group */}
                {group === "OPERATIONS" && (
                  <SiteMapsList layers={layers} onChange={onChange} operations={operations} isAdmin={isAdmin} savedBounds={savedBounds} onAdjustSiteMap={onAdjustSiteMap} onRealignSiteMap={onRealignSiteMap} />
                )}
                {/* S2 sub-layer feeds — inline under INTELLIGENCE group */}
                {group === "INTELLIGENCE" && layers.s2Intel && s2ActiveLayers && onToggleS2Layer && (
                  <div className="ml-3 mt-1 mb-1 space-y-0.5 border-l border-white/10 pl-2">
                    <p className="text-[8px] font-mono text-white/25 uppercase tracking-wider">
                      Feeds {s2FeatureCount ? `(${s2FeatureCount})` : ""}
                    </p>
                    {S2_LAYERS.map((sl: S2Layer) => {
                      const active = s2ActiveLayers.has(sl.id);
                      return (
                        <button
                          key={sl.id}
                          onClick={() => onToggleS2Layer(sl.id)}
                          className={`w-full flex items-center gap-2 rounded-md px-2 py-1 text-[10px] transition-colors ${
                            active ? "bg-white/10 text-white" : "text-white/35 hover:text-white/60 hover:bg-white/5"
                          }`}
                        >
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: sl.color }} />
                          <span className="flex-1 text-left truncate">{sl.label}</span>
                          {active ? <Eye className="h-2.5 w-2.5 text-green-400" /> : <EyeOff className="h-2.5 w-2.5" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>}
            </div>
            );
          })}

          {onUseNewPanel && (
            <button onClick={onUseNewPanel} style={{ minHeight: 40 }} className="w-full rounded text-[12px] font-mono text-white/65 hover:text-white hover:bg-white/5 underline underline-offset-2">
              Use the new grouped layers panel
            </button>
          )}
        </div>
      )}
    </div>
  );
}
