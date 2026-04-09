"use client";

import { useState } from "react";
import {
  Layers, Users, Flag, CloudRain, Zap, Building2, Mountain,
  Eye, EyeOff, ChevronRight, ChevronLeft, Target, AlertTriangle, Moon,
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
  siteOverlays: Record<string, boolean>; // eventId -> visible
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
  siteOverlays: {},
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
  { key: "buildings", label: "3D Buildings", icon: <Building2 className="h-3.5 w-3.5" />, group: "TERRAIN" },
  { key: "terrain", label: "3D Terrain", icon: <Mountain className="h-3.5 w-3.5" />, group: "TERRAIN" },
];

interface MapLayersPanelProps {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
  onFlyToAll: () => void;
  operations: OperationPin[];
}

export function MapLayersPanel({ layers, onChange, onFlyToAll, operations }: MapLayersPanelProps) {
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
        className="absolute top-0 left-0 z-20 flex h-9 w-9 items-center justify-center rounded-lg bg-[#0f1a2e]/90 border border-white/10 text-white/70 hover:text-white hover:bg-[#0f1a2e] transition-colors"
        title={open ? "Collapse layers" : "Expand layers"}
      >
        {open ? <ChevronRight className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
      </button>

      {/* Panel */}
      {open && (
        <div className="ml-11 rounded-xl bg-[#0f1a2e]/90 backdrop-blur-sm border border-white/10 p-3 space-y-3 max-h-[calc(100vh-240px)] overflow-y-auto">
          <div className="flex items-center justify-between">
            <h3 className="text-[10px] font-bold font-mono text-white/50 uppercase tracking-wider">Layers</h3>
            <button onClick={onFlyToAll} className="text-[9px] text-amber-500 hover:text-amber-400 font-mono">FLY TO ALL</button>
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
                    <button
                      key={op.id}
                      onClick={() => toggleSiteOverlay(op.id)}
                      className={`w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                        active
                          ? "bg-white/10 text-white"
                          : "text-white/40 hover:text-white/60 hover:bg-white/5"
                      }`}
                    >
                      <Layers className="h-3 w-3" />
                      <span className="flex-1 text-left truncate">{op.name}</span>
                      {active ? <Eye className="h-3 w-3 text-green-400" /> : <EyeOff className="h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
