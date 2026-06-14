"use client";

import { useState } from "react";
import {
  Layers, Users, CloudRain, Mountain,
  Eye, EyeOff, ChevronRight, ChevronDown, Target, AlertTriangle, Moon, Satellite,
  Hospital, Plane, Scan, Monitor, Orbit, Radar, Shield, MapPin, PenTool,
  Activity, Flame, Swords, Wind, Atom, Newspaper, Tv, Rss, Ship, Camera, TowerControl,
  Radio,
} from "lucide-react";
import type { OperationPin } from "./types";
import { S2_LAYERS, type S2Layer } from "./s2-underground";

export interface LayerVisibility {
  staff: boolean;
  operations: boolean;
  incidents: boolean;
  weather: boolean;
  buildings: boolean;
  terrain: boolean;
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
  // Live feeds
  aircraft: boolean;
  adsbLocal: boolean;
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
  aircraft: false,
  adsbLocal: false,
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
  siteOverlays: {},
  siteOverlayOpacity: 0.75,
};

interface LayerToggle {
  key: keyof Omit<LayerVisibility, "siteOverlays">;
  label: string;
  icon: React.ReactNode;
  group: string;
  /** True if this layer cannot be replayed historically (no free historical data source). */
  liveOnly?: boolean;
}

const LAYER_TOGGLES: LayerToggle[] = [
  // ─── MAP — how the basemap renders (basemap + imagery overlays) ──
  { key: "satellite", label: "Satellite View", icon: <Satellite className="h-3.5 w-3.5" />, group: "MAP" },
  { key: "terrain", label: "3D Terrain & Buildings", icon: <Mountain className="h-3.5 w-3.5" />, group: "MAP" },
  { key: "sentinel1", label: "SAR Imagery", icon: <Scan className="h-3.5 w-3.5" />, group: "MAP", liveOnly: true },
  { key: "sentinel2", label: "Satellite Photos", icon: <Layers className="h-3.5 w-3.5" />, group: "MAP", liveOnly: true },
  // ─── OPERATIONS — your company's data ──────────────────
  { key: "operations", label: "Operations", icon: <MapPin className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "staff", label: "Staff", icon: <Users className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "breadcrumbs", label: "Patrol Trails", icon: <Radar className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "incidents", label: "Incidents", icon: <AlertTriangle className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "geofences", label: "Geofences", icon: <Target className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "annotations", label: "Drawings", icon: <PenTool className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "nearbyPOIs", label: "Nearby Services", icon: <Hospital className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "radioFrequencies", label: "Radio Frequencies", icon: <Radio className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  // ─── ENVIRONMENT — natural phenomena & weather ─────────
  { key: "weather", label: "Weather Radar (US)", icon: <CloudRain className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  { key: "raws", label: "Weather Stations", icon: <TowerControl className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  { key: "eonetWeather", label: "Severe Weather", icon: <Wind className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  { key: "fires", label: "Active Fires", icon: <Flame className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  { key: "earthquakes", label: "Earthquakes", icon: <Activity className="h-3.5 w-3.5" />, group: "ENVIRONMENT", liveOnly: true },
  // ─── INTELLIGENCE — external data feeds ────────────────
  // Threats
  { key: "conflictZones", label: "Conflict Zones", icon: <Swords className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "gdelt", label: "Global Incidents", icon: <Newspaper className="h-3.5 w-3.5" />, group: "INTELLIGENCE", liveOnly: true },
  { key: "sigintNews", label: "SIGINT News", icon: <Rss className="h-3.5 w-3.5" />, group: "INTELLIGENCE", liveOnly: true },
  { key: "nuclearInfrastructure", label: "Nuclear Facilities", icon: <Atom className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  // Surveillance feeds
  { key: "cctv", label: "CCTV Cameras", icon: <Camera className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "liveNews", label: "Live Broadcasters", icon: <Tv className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  // Air & maritime tracking
  { key: "aircraft", label: "OpenSky Traffic", icon: <Plane className="h-3.5 w-3.5" />, group: "INTELLIGENCE", liveOnly: true },
  { key: "adsbLocal", label: "Local ADSB", icon: <Radar className="h-3.5 w-3.5" />, group: "INTELLIGENCE", liveOnly: true },
  { key: "satelliteOrbits", label: "Satellite Orbits", icon: <Orbit className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "maritime", label: "Ports & Chokepoints", icon: <Ship className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  // S2 Underground Common Intel Picture (US-focused sub-feeds nested below)
  { key: "s2Intel", label: "S2 Underground CIP", icon: <Shield className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  // Visual effects
  { key: "nightVision", label: "Night Mode", icon: <Moon className="h-3.5 w-3.5" />, group: "EFFECTS" },
  { key: "flirThermal", label: "FLIR Thermal", icon: <Scan className="h-3.5 w-3.5" />, group: "EFFECTS" },
  { key: "crtMode", label: "CRT Mode", icon: <Monitor className="h-3.5 w-3.5" />, group: "EFFECTS" },
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
}

export function MapLayersPanel({ layers, onChange, onFlyToAll, operations, onRealignSiteMap, onAdjustSiteMap, isAdmin, s2ActiveLayers, onToggleS2Layer, s2FeatureCount, isReplaying, savedBounds }: MapLayersPanelProps) {
  const [open, setOpen] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  function toggleGroup(group: string) {
    setCollapsedGroups(prev => ({ ...prev, [group]: !prev[group] }));
  }

  function toggle(key: keyof Omit<LayerVisibility, "siteOverlays">) {
    onChange({ ...layers, [key]: !layers[key] });
  }

  function toggleSiteOverlay(eventId: string) {
    onChange({
      ...layers,
      siteOverlays: { ...layers.siteOverlays, [eventId]: !layers.siteOverlays[eventId] },
    });
  }

  const groups = [...new Set(LAYER_TOGGLES.map((t) => t.group))];
  const opsWithSiteMaps = operations.filter((o) => o.siteMapUrl);

  return (
    <div className={`absolute top-3 right-3 z-10 transition-all duration-200 ${open ? "w-56" : "w-9"}`}>
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
        <div className="ml-11 rounded-xl backdrop-blur-sm border border-white/10 p-3 space-y-3 max-h-[calc(100vh-240px)] overflow-y-auto" style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)" }}>
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
                {LAYER_TOGGLES.filter((t) => t.group === group).map((t) => {
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
                {group === "OPERATIONS" && opsWithSiteMaps.length > 0 && (
                  <div className="mt-2">
                    <p className="text-[8px] font-mono text-white/25 uppercase tracking-wider mb-1">Site Maps</p>
                    <div className="space-y-0.5">
                      {opsWithSiteMaps.map((op) => {
                        const userPref = layers.siteOverlays[op.id];
                        const hasBounds = !!savedBounds?.[op.id];
                        // Effective on = explicit user pref if set, otherwise auto-on when bounds exist
                        const siteActive = userPref === undefined ? hasBounds : userPref;
                        // Non-admins may toggle aligned (bounds-exist) overlays.
                        // Only admins may toggle an un-aligned overlay (turning it on
                        // would open the aligner UI which requires admin perms).
                        const canToggle = isAdmin || hasBounds;
                        const blockedTooltip = !canToggle
                          ? "Admin access required to align this site map"
                          : "";
                        return (
                          <div key={op.id} className="flex items-center gap-1">
                            <button
                              onClick={() => { if (!canToggle) return; toggleSiteOverlay(op.id); }}
                              className={`flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                                siteActive ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                              } ${!canToggle ? "cursor-not-allowed opacity-60" : ""}`}
                              title={blockedTooltip}
                            >
                              <Layers className="h-3 w-3" />
                              <span className="flex-1 text-left truncate">{op.name}</span>
                              {siteActive ? <Eye className="h-3 w-3 text-green-400" /> : <EyeOff className="h-3 w-3" />}
                            </button>
                            {siteActive && isAdmin && hasBounds && (
                              <div className="flex gap-0.5">
                                {onAdjustSiteMap && <button onClick={() => onAdjustSiteMap(op)} className="text-[8px] text-white/30 hover:text-white/60 px-1 py-0.5 rounded" title="Fine-tune position">⇔</button>}
                                {onRealignSiteMap && <button onClick={() => onRealignSiteMap(op)} className="text-[8px] text-white/30 hover:text-white/60 px-1 py-0.5 rounded" title="Re-align (3-point pick)">↻</button>}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                    {/* Site overlay opacity slider */}
                    <div className="flex items-center gap-1.5 mt-1.5 px-1 max-w-full overflow-hidden">
                      <span className="text-[7px] text-white/30 shrink-0">Opacity</span>
                      <input type="range" min={0} max={100} value={Math.round(layers.siteOverlayOpacity * 100)}
                        onChange={(e) => onChange({ ...layers, siteOverlayOpacity: parseInt(e.target.value) / 100 })}
                        className="h-1 min-w-0 w-full max-w-[80px]" style={{ accentColor: "var(--brand-accent, #d59b3c)" }} />
                      <span className="text-[7px] text-white/40 shrink-0">{Math.round(layers.siteOverlayOpacity * 100)}%</span>
                    </div>
                  </div>
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


        </div>
      )}
    </div>
  );
}
