"use client";

import { useState } from "react";
import {
  Layers, Users, Flag, CloudRain, Building2, Mountain,
  Eye, EyeOff, ChevronRight, Target, AlertTriangle, Moon, Satellite,
} from "lucide-react";
import type { OperationPin } from "./tactical-map";

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
  siteOverlays: Record<string, boolean>; // eventId -> visible
  siteOverlayOpacity: number; // 0-1
}

export const DEFAULT_LAYERS: LayerVisibility = {
  staff: true,
  operations: true,
  incidents: true,
  weather: false,
  buildings: true,
  terrain: true,
  geofences: true,
  nightVision: false,
  satellite: true,
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
  { key: "operations", label: "Operations", icon: <Flag className="h-3.5 w-3.5" />, group: "PINS" },
  { key: "staff", label: "Staff Locations", icon: <Users className="h-3.5 w-3.5" />, group: "PINS" },
  { key: "incidents", label: "Incidents", icon: <AlertTriangle className="h-3.5 w-3.5" />, group: "PINS" },
  { key: "geofences", label: "Geofences", icon: <Target className="h-3.5 w-3.5" />, group: "PINS" },
  { key: "weather", label: "Weather Radar", icon: <CloudRain className="h-3.5 w-3.5" />, group: "OVERLAYS" },
  { key: "nightVision", label: "Night Vision", icon: <Moon className="h-3.5 w-3.5" />, group: "OVERLAYS" },
  { key: "satellite", label: "Satellite Imagery", icon: <Satellite className="h-3.5 w-3.5" />, group: "TERRAIN" },
  { key: "buildings", label: "3D Buildings", icon: <Building2 className="h-3.5 w-3.5" />, group: "TERRAIN" },
  { key: "terrain", label: "3D Terrain", icon: <Mountain className="h-3.5 w-3.5" />, group: "TERRAIN" },
];

interface MapLayersPanelProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
  onFlyToAll: () => void;
  operations: OperationPin[];
  onRealignSiteMap?: (op: OperationPin) => void;
  isAdmin?: boolean;
}

export function MapLayersPanel({ layers, onChange, onFlyToAll, operations, onRealignSiteMap, isAdmin }: MapLayersPanelProps) {
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
                  <div className="flex items-center gap-2 px-2 pt-1">
                    <span className="text-[8px] text-white/30 font-mono">Opacity</span>
                    <input
                      type="range"
                      min={0} max={100} step={5}
                      value={Math.round(layers.siteOverlayOpacity * 100)}
                      onChange={(e) => onChange({ ...layers, siteOverlayOpacity: Number(e.target.value) / 100 })}
                      className="flex-1 h-1 accent-white/50 cursor-pointer"
                    />
                    <span className="text-[8px] text-white/40 font-mono w-6 text-right">{Math.round(layers.siteOverlayOpacity * 100)}%</span>
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
