"use client";

import { useState } from "react";
import {
  Layers, Users, Flag, CloudRain, Building2, Mountain,
  Eye, EyeOff, ChevronRight, Target, AlertTriangle, Moon, Satellite,
  Hospital, Plane, Scan, Monitor, Orbit, Radar, Shield,
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
  annotations: boolean;
  sunPosition: boolean;
  // Satellite intel
  sentinel1: boolean;
  sentinel2: boolean;
  flirThermal: boolean;
  crtMode: boolean;
  // Live feeds
  aircraft: boolean;
  satelliteOrbits: boolean;
  // S2 Underground Intel
  s2Intel: boolean;
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
  annotations: false,
  sunPosition: false,
  sentinel1: false,
  sentinel2: false,
  flirThermal: false,
  crtMode: false,
  aircraft: false,
  satelliteOrbits: false,
  s2Intel: false,
  siteOverlays: {},
  siteOverlayOpacity: 0.75,
};

interface LayerToggle {
  key: keyof Omit<LayerVisibility, "siteOverlays">;
  label: string;
  icon: React.ReactNode;
  group: string;
}

const LAYER_TOGGLES: LayerToggle[] = [
  // Map view controls
  { key: "satellite", label: "Satellite View", icon: <Satellite className="h-3.5 w-3.5" />, group: "MAP" },
  { key: "buildings", label: "3D Buildings", icon: <Building2 className="h-3.5 w-3.5" />, group: "MAP" },
  { key: "terrain", label: "3D Terrain", icon: <Mountain className="h-3.5 w-3.5" />, group: "MAP" },
  // Operations data
  { key: "operations", label: "Operations", icon: <Flag className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "staff", label: "Staff", icon: <Users className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "breadcrumbs", label: "Patrol Trails", icon: <Radar className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "incidents", label: "Incidents", icon: <AlertTriangle className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "geofences", label: "Geofences", icon: <Target className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  { key: "annotations", label: "Drawings", icon: <Flag className="h-3.5 w-3.5" />, group: "OPERATIONS" },
  // Intelligence feeds
  { key: "weather", label: "Weather Radar", icon: <CloudRain className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "sentinel1", label: "SAR Imagery", icon: <Radar className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "sentinel2", label: "Satellite Photos", icon: <Satellite className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "nearbyPOIs", label: "Nearby Services", icon: <Hospital className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "satelliteOrbits", label: "Satellite Orbits", icon: <Orbit className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
  { key: "aircraft", label: "Aircraft", icon: <Plane className="h-3.5 w-3.5" />, group: "INTELLIGENCE" },
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
  isAdmin?: boolean;
  s2ActiveLayers?: Set<string>;
  onToggleS2Layer?: (layerId: string) => void;
  s2FeatureCount?: number;
}

export function MapLayersPanel({ layers, onChange, onFlyToAll, operations, onRealignSiteMap, isAdmin, s2ActiveLayers, onToggleS2Layer, s2FeatureCount }: MapLayersPanelProps) {
  const [open, setOpen] = useState(true);

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

          {groups.map((group) => (
            <div key={group}>
              <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-1">{group}</p>
              <div className="space-y-0.5">
                {LAYER_TOGGLES.filter((t) => t.group === group).map((t) => {
                  const active = layers[t.key];
                  return (
                    <button
                      key={t.key}
                      onClick={() => toggle(t.key)}
                      className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/60 hover:bg-white/5"
                      }`}
                    >
                      {t.icon}
                      <span className="flex-1 text-left truncate">{t.label}</span>
                      {active ? <Eye className="h-3 w-3 text-green-400" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                  );
                })}
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
              </div>
            </div>
          ))}

          {/* Site Map Overlays */}
          {opsWithSiteMaps.length > 0 && (
            <div>
              <p className="text-[9px] font-mono text-white/30 uppercase tracking-wider mb-1">SITE MAPS</p>
              <div className="space-y-0.5">
                {opsWithSiteMaps.map((op) => {
                  const active = layers.siteOverlays[op.id] ?? false;
                  return (
                    <div key={op.id}>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => { if (!isAdmin && !active) return; toggleSiteOverlay(op.id); }}
                          className={`flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                            active
                              ? "bg-white/10 text-white"
                              : "text-white/40 hover:text-white/60 hover:bg-white/5"
                          }`}
                          title={!isAdmin && !active ? "Admin access required to align site maps" : ""}
                        >
                          <Layers className="h-3 w-3" />
                          <span className="flex-1 text-left truncate">{op.name}</span>
                          {active ? <Eye className="h-3 w-3 text-green-400" /> : <EyeOff className="h-3 w-3" />}
                        </button>
                        {active && isAdmin && onRealignSiteMap && (
                          <button
                            onClick={() => onRealignSiteMap(op)}
                            className="text-[8px] text-white/30 hover:text-white/60 px-1 py-0.5 rounded"
                            title="Re-align site map"
                          >
                            ↻
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
                {/* Opacity slider for all site map overlays */}
                {Object.values(layers.siteOverlays).some(Boolean) && (
                  <div className="flex items-center gap-1.5 px-1 pt-1 min-w-0 overflow-hidden">
                    <span className="text-[7px] text-white/30 font-mono shrink-0">Opacity</span>
                    <input
                      type="range"
                      min={0} max={100} step={5}
                      value={Math.round(layers.siteOverlayOpacity * 100)}
                      onChange={(e) => onChange({ ...layers, siteOverlayOpacity: Number(e.target.value) / 100 })}
                      className="h-1 cursor-pointer min-w-0 flex-1"
                      style={{ accentColor: "var(--brand-accent, #d59b3c)", maxWidth: "80px" }}
                    />
                    <span className="text-[7px] text-white/40 font-mono shrink-0">{Math.round(layers.siteOverlayOpacity * 100)}%</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
