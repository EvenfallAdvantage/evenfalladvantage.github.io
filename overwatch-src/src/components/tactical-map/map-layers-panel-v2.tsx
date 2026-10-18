"use client";

/**
 * Grouped layers panel (v2): presets, 6 groups with master switches and
 * sub-options, basemap switcher and a View menu. Desktop: right-hand panel.
 * Phones: a bottom sheet (half / full height) opened from the Layers button.
 * The classic panel stays available behind `onUseClassic`.
 * Model: lib/map/layer-registry.ts.
 */

import { useState, type ReactNode } from "react";
import {
  Layers, ChevronRight, ChevronDown, X, MapPin, CloudLightning, Shield, Plane, Camera, Factory, Eye, Maximize2, Minimize2,
} from "lucide-react";
import { toast } from "sonner";
import type { LayerVisibility } from "./map-layers-panel";
import type { OperationPin } from "./types";
import { SiteMapsList } from "./site-maps-list";
import { S2_LAYERS, type S2Layer } from "./s2-underground";
import { SAR_AVAILABLE } from "./sentinel-layer";
import { ionAssetsEnabled } from "@/lib/map/basemap-sources";
import {
  GROUPS, PRESET_IDS, PRESET_LABELS, BASEMAP_LABELS, LOOK_LABELS, MOBILE_LOOKS, MOBILE_MAX_DATA_GROUPS,
  activeDataGroups, applyPreset, basemapOf, lookOf, setBasemap, setGroup, setLook, setSub, subOn,
  type BasemapId, type GroupId, type LookId, type PresetId,
} from "@/lib/map/layer-registry";

const GROUP_ICONS: Record<GroupId, ReactNode> = {
  myOps: <MapPin className="h-3.5 w-3.5" />,
  weather: <CloudLightning className="h-3.5 w-3.5" />,
  security: <Shield className="h-3.5 w-3.5" />,
  airSea: <Plane className="h-3.5 w-3.5" />,
  cameras: <Camera className="h-3.5 w-3.5" />,
  infrastructure: <Factory className="h-3.5 w-3.5" />,
};

const PANEL_BG = { backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 92%, transparent)" };
const ACCENT = "var(--brand-accent, #d59b3c)";

export interface MapLayersPanelV2Props {
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
  isReplaying?: boolean;
  savedBounds?: Record<string, unknown>;
  /** Phone / low-power device: bottom sheet, fewer looks, group cap. */
  constrained: boolean;
  /** CCTV acknowledgement already given (presets only enable cameras then). */
  cctvAcked: boolean;
  onUseClassic: () => void;
  /** Extra controls rendered inside an expanded group (filters, scope, …). */
  groupExtras?: Partial<Record<GroupId, ReactNode>>;
  /** Rendered right under the presets (e.g. Site Watch). */
  topSlot?: ReactNode;
  /** Rendered at the bottom of the panel (e.g. admin defaults). */
  bottomSlot?: ReactNode;
}

function Switch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className={`relative inline-flex h-4 w-7 shrink-0 items-center rounded-full transition-colors ${on ? "" : "bg-white/15"}`}
      style={on ? { backgroundColor: ACCENT } : undefined}
    >
      <span className={`inline-block h-3 w-3 rounded-full bg-white shadow transition-transform ${on ? "translate-x-3.5" : "translate-x-0.5"}`} />
    </button>
  );
}

function Segmented<T extends string>({ value, options, labels, onPick }: { value: T; options: readonly T[]; labels: Record<T, string>; onPick: (v: T) => void }) {
  return (
    <div className="flex rounded-md bg-white/5 p-0.5 gap-0.5">
      {options.map((o) => (
        <button
          key={o}
          onClick={() => onPick(o)}
          className={`flex-1 rounded px-1.5 py-1 text-[10px] font-mono transition-colors ${value === o ? "text-black font-bold" : "text-white/55 hover:text-white"}`}
          style={value === o ? { backgroundColor: ACCENT } : undefined}
        >
          {labels[o]}
        </button>
      ))}
    </div>
  );
}

function PanelBody(props: MapLayersPanelV2Props) {
  const { layers, onChange, onFlyToAll, constrained, cctvAcked, isReplaying, s2ActiveLayers, onToggleS2Layer, s2FeatureCount, groupExtras, topSlot, bottomSlot } = props;
  const [expanded, setExpanded] = useState<Partial<Record<GroupId, boolean>>>({});
  const [viewOpen, setViewOpen] = useState(false);

  const basemaps: BasemapId[] = ["satellite", "streets", "dark", "daily", ...(SAR_AVAILABLE ? (["sar"] as BasemapId[]) : [])];
  const looks: readonly LookId[] = constrained ? MOBILE_LOOKS : ["normal", "nvg", "thermal", "noir", "crt"];

  function pickPreset(id: PresetId) {
    onChange(applyPreset(layers, id, { constrained, cctvAcked }));
    if (id === "securityOps" && !cctvAcked) toast("Cameras stay off until you turn them on once and accept the notice.");
  }

  function toggleGroup(id: GroupId) {
    const on = !layers.groups[id];
    if (on && constrained && id !== "myOps" && activeDataGroups(layers).length >= MOBILE_MAX_DATA_GROUPS) {
      toast.warning(`Phones show up to ${MOBILE_MAX_DATA_GROUPS} data groups at once. Turn one off first.`);
      return;
    }
    onChange(setGroup(layers, id, on));
  }

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] font-bold font-mono text-white/60 uppercase tracking-wider">Map layers</h3>
        <button onClick={onFlyToAll} className="text-[9px] hover:opacity-80 font-mono font-bold" style={{ color: ACCENT }}>FLY TO ALL</button>
      </div>

      {/* Presets */}
      <div className="flex flex-wrap gap-1" role="radiogroup" aria-label="Presets">
        {PRESET_IDS.map((id) => (
          <button
            key={id}
            role="radio"
            aria-checked={layers.preset === id}
            onClick={() => pickPreset(id)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-mono border transition-colors ${layers.preset === id ? "text-black font-bold border-transparent" : "text-white/60 border-white/15 hover:text-white"}`}
            style={layers.preset === id ? { backgroundColor: ACCENT } : undefined}
          >
            {PRESET_LABELS[id]}
          </button>
        ))}
        <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono border ${layers.preset === "custom" ? "text-white border-white/40" : "text-white/30 border-white/10"}`}>Custom</span>
      </div>

      {topSlot}

      {isReplaying && (
        <p className="text-[9px] font-mono text-amber-300/80">Time Machine: live-only layers are hidden while replaying.</p>
      )}

      {/* Groups */}
      <div className="space-y-1">
        {GROUPS.map((g) => {
          const on = layers.groups[g.id] !== false;
          const subs = g.subs.filter((s) => !(constrained && s.desktopOnly));
          const activeCount = subs.filter((s) => subOn(layers, s)).length;
          const isOpen = !!expanded[g.id];
          return (
            <div key={g.id} className={`rounded-lg border ${on && activeCount ? "border-white/15 bg-white/[0.04]" : "border-white/5"}`}>
              <div className="flex items-center gap-2 px-2 py-1.5">
                <button onClick={() => setExpanded((p) => ({ ...p, [g.id]: !isOpen }))} className="flex flex-1 min-w-0 items-center gap-2 text-left" aria-expanded={isOpen}>
                  <span className={on ? "text-white" : "text-white/35"}>{GROUP_ICONS[g.id]}</span>
                  <span className="min-w-0 flex-1">
                    <span className={`block text-xs truncate ${on ? "text-white" : "text-white/45"}`}>{g.label}</span>
                    <span className="block text-[9px] font-mono text-white/35 truncate">
                      {on && activeCount ? `${activeCount} of ${subs.length} on` : g.blurb}
                    </span>
                  </span>
                  {isOpen ? <ChevronDown className="h-3 w-3 text-white/30" /> : <ChevronRight className="h-3 w-3 text-white/30" />}
                </button>
                <Switch on={on && activeCount > 0} onToggle={() => toggleGroup(g.id)} label={`${g.label} on/off`} />
              </div>
              {isOpen && (
                <div className={`px-2 pb-2 space-y-0.5 ${on ? "" : "opacity-50"}`}>
                  {subs.map((s) => {
                    const checked = subOn(layers, s);
                    return (
                      <div key={s.id}>
                        <label className="flex items-center gap-2 rounded px-1.5 py-1 text-[11px] text-white/80 hover:bg-white/5 cursor-pointer" title={s.hint}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              let next = setSub(layers, s, !checked);
                              if (!checked && !on) next = { ...next, groups: { ...next.groups, [g.id]: true } };
                              onChange(next);
                            }}
                            className="h-3 w-3"
                            style={{ accentColor: ACCENT }}
                          />
                          <span className="flex-1 truncate">{s.label}</span>
                        </label>
                        {g.id === "security" && s.id === "events" && checked && s2ActiveLayers && onToggleS2Layer && (
                          <div className="ml-6 mb-1 space-y-0.5">
                            <p className="text-[8px] font-mono text-white/30 uppercase">Feeds {s2FeatureCount ? `(${s2FeatureCount})` : ""}</p>
                            {S2_LAYERS.map((sl: S2Layer) => (
                              <label key={sl.id} className="flex items-center gap-1.5 text-[10px] text-white/60 cursor-pointer">
                                <input type="checkbox" checked={s2ActiveLayers.has(sl.id)} onChange={() => onToggleS2Layer(sl.id)} className="h-2.5 w-2.5" style={{ accentColor: sl.color }} />
                                <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: sl.color }} />
                                <span className="truncate">{sl.label}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {groupExtras?.[g.id]}
                  {g.id === "myOps" && (
                    <SiteMapsList layers={layers} onChange={onChange} operations={props.operations} isAdmin={props.isAdmin} savedBounds={props.savedBounds} onAdjustSiteMap={props.onAdjustSiteMap} onRealignSiteMap={props.onRealignSiteMap} />
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Basemap */}
      <div className="space-y-1.5 pt-1 border-t border-white/10">
        <p className="text-[9px] font-mono text-white/35 uppercase tracking-wider">Basemap</p>
        <Segmented value={basemapOf(layers)} options={basemaps} labels={BASEMAP_LABELS} onPick={(b) => onChange(setBasemap(layers, b))} />
        <label className="flex items-center justify-between text-[11px] text-white/70">
          <span>{ionAssetsEnabled() ? "3D terrain & buildings" : "3D terrain"}</span>
          <Switch on={layers.terrain} onToggle={() => onChange({ ...layers, terrain: !layers.terrain })} label="3D terrain" />
        </label>
      </div>

      {/* View menu */}
      <div className="pt-1 border-t border-white/10">
        <button onClick={() => setViewOpen((o) => !o)} className="flex w-full items-center gap-2 text-[9px] font-mono text-white/45 uppercase tracking-wider hover:text-white/80" aria-expanded={viewOpen}>
          <Eye className="h-3 w-3" /> <span className="flex-1 text-left">View · {LOOK_LABELS[lookOf(layers)]}{layers.hud ? " · HUD" : ""}</span>
          {viewOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
        </button>
        {viewOpen && (
          <div className="mt-1.5 space-y-1.5">
            <Segmented value={looks.includes(lookOf(layers)) ? lookOf(layers) : "normal"} options={looks} labels={LOOK_LABELS} onPick={(l) => onChange(setLook(layers, l))} />
            {!constrained && (
              <div className="flex gap-3 text-[11px] text-white/70">
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={layers.sharpen} onChange={() => onChange({ ...layers, sharpen: !layers.sharpen })} className="h-3 w-3" style={{ accentColor: ACCENT }} />Sharpen</label>
                <label className="flex items-center gap-1.5"><input type="checkbox" checked={layers.bloom} onChange={() => onChange({ ...layers, bloom: !layers.bloom })} className="h-3 w-3" style={{ accentColor: ACCENT }} />Bloom</label>
              </div>
            )}
            <label className="flex items-center justify-between text-[11px] text-white/70">
              <span>Tactical HUD</span>
              <Switch on={layers.hud} onToggle={() => onChange({ ...layers, hud: !layers.hud })} label="Tactical HUD" />
            </label>
          </div>
        )}
      </div>

      {bottomSlot}

      <button onClick={props.onUseClassic} className="w-full text-[9px] font-mono text-white/35 hover:text-white/70 underline underline-offset-2">
        Switch to the classic layers panel
      </button>
    </div>
  );
}

export function MapLayersPanelV2(props: MapLayersPanelV2Props) {
  const [open, setOpen] = useState(() => !props.constrained);
  const [full, setFull] = useState(false);
  const activeGroups = activeDataGroups(props.layers).length;

  const launcher = (
    <button
      onClick={() => setOpen(!open)}
      className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-white/10 text-white/70 hover:text-white transition-colors"
      style={PANEL_BG}
      title={open ? "Collapse layers" : "Map layers"}
      aria-label={open ? "Collapse layers" : "Map layers"}
    >
      {open && !props.constrained ? <ChevronRight className="h-4 w-4" /> : <Layers className="h-4 w-4" />}
      {!open && activeGroups > 0 && (
        <span className="absolute -top-1 -right-1 h-3.5 min-w-3.5 rounded-full px-0.5 text-[8px] font-bold leading-[14px] text-black" style={{ backgroundColor: ACCENT }}>{activeGroups}</span>
      )}
    </button>
  );

  if (props.constrained) {
    return (
      <>
        <div className="absolute top-3 right-3 z-10">{launcher}</div>
        {open && (
          <div
            className={`absolute inset-x-0 bottom-0 z-30 rounded-t-2xl border-t border-white/15 backdrop-blur-md flex flex-col ${full ? "h-[88%]" : "h-[48%]"}`}
            style={PANEL_BG}
            role="dialog"
            aria-label="Map layers"
          >
            <div className="flex items-center justify-between px-3 pt-1.5 shrink-0">
              <button onClick={() => setFull((f) => !f)} className="flex-1 flex flex-col items-center gap-0.5 py-1 text-white/40" aria-label={full ? "Half height" : "Full height"}>
                <span className="h-1 w-10 rounded-full bg-white/30" />
                {full ? <Minimize2 className="h-3 w-3" /> : <Maximize2 className="h-3 w-3" />}
              </button>
              <button onClick={() => setOpen(false)} className="text-white/50 hover:text-white p-1" aria-label="Close layers"><X className="h-4 w-4" /></button>
            </div>
            <div className="flex-1 overflow-y-auto overscroll-contain px-3 pb-4">
              <PanelBody {...props} />
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <div className={`absolute top-3 right-3 z-10 transition-all duration-200 ${open ? "w-72 max-w-[calc(100vw-1.5rem)]" : "w-9"}`}>
      <div className="absolute top-0 left-0 z-20">{launcher}</div>
      {open && (
        <div className="ml-11 rounded-xl backdrop-blur-sm border border-white/10 p-3 max-h-[calc(100dvh-240px)] overflow-y-auto overscroll-contain" style={PANEL_BG}>
          <PanelBody {...props} />
        </div>
      )}
    </div>
  );
}
