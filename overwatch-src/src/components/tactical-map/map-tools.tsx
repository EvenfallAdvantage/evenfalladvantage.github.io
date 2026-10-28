"use client";

import { useState } from "react";
import { Ruler, Crosshair, Pencil, Pentagon, Circle, ArrowRight, Type, Minus, Trash2, Check, X, Eye, Mountain } from "lucide-react";

export type ActiveTool = "none" | "measure" | "range-rings" | "los" | "elevation";
export type DrawMode = "none" | "line" | "polygon" | "circle" | "arrow" | "text" | "freehand";

interface MeasureResult {
  distanceM: number;
  distanceMi: number;
  bearing: number;
}

export interface MapToolsProps {
  activeTool: ActiveTool;
  onToolChange: (tool: ActiveTool) => void;
  measureResult: MeasureResult | null;
  rangeCenter: { lat: number; lng: number } | null;
  losResult: { visible: boolean; distance?: number } | null;
  elevationStatus: string | null;
  // Draw props
  drawMode: DrawMode;
  onDrawModeChange: (mode: DrawMode) => void;
  drawColor: string;
  onDrawColorChange: (color: string) => void;
  drawPointCount: number;
  drawLabel?: string;
  onDrawLabelChange?: (label: string) => void;
  onDrawFinish: () => void;
  onDrawCancel: () => void;
  onDrawClearAll: () => void;
  isAdmin: boolean;
}

const DRAW_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ffffff"];

export function MapToolsBar({
  activeTool, onToolChange, measureResult, rangeCenter, losResult, elevationStatus,
  drawMode, onDrawModeChange, drawColor, onDrawColorChange,
  drawPointCount, drawLabel = "", onDrawLabelChange,
  onDrawFinish, onDrawCancel, onDrawClearAll, isAdmin,
}: MapToolsProps) {
  const [measureOpen, setMeasureOpen] = useState(false);
  const [annotateOpen, setAnnotateOpen] = useState(false);
  const [confirmingClear, setConfirmingClear] = useState(false);

  const isMeasureExpanded = measureOpen || activeTool !== "none";
  const isAnnotateExpanded = isAdmin && (annotateOpen || drawMode !== "none" || confirmingClear);
  const panelBg = "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)";

  const handleToggleMeasureMenu = () => {
    if (isMeasureExpanded) {
      onToolChange("none");
      setMeasureOpen(false);
    } else {
      onDrawModeChange("none");
      setAnnotateOpen(false);
      setConfirmingClear(false);
      setMeasureOpen(true);
    }
  };

  const handleToggleAnnotateMenu = () => {
    if (isAnnotateExpanded) {
      onDrawCancel();
      setAnnotateOpen(false);
      setConfirmingClear(false);
    } else {
      onToolChange("none");
      setMeasureOpen(false);
      setAnnotateOpen(true);
    }
  };

  return (
    <div
      data-testid="map-tools-bar"
      className="absolute bottom-7 left-1/2 -translate-x-1/2 z-10 flex items-end gap-2"
    >
      {/* Collapsible tool groups — compact by default */}
      <div
        className="flex items-center gap-1 rounded-xl backdrop-blur-sm border border-white/10 p-1"
        style={{ backgroundColor: panelBg }}
      >
        {/* Measure group toggle */}
        <button
          type="button"
          data-testid="map-tools-measure-toggle"
          onClick={handleToggleMeasureMenu}
          title={isMeasureExpanded ? "Collapse measure tools" : "Measure & terrain tools"}
          aria-expanded={isMeasureExpanded}
          className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors ${
            isMeasureExpanded
              ? "border text-white"
              : "text-white/65 hover:text-white hover:bg-white/5"
          }`}
          style={
            isMeasureExpanded
              ? {
                  backgroundColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 20%, transparent)",
                  color: "var(--brand-accent, #d59b3c)",
                  borderColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 35%, transparent)",
                }
              : undefined
          }
        >
          <Ruler className="h-3.5 w-3.5" />
          <span>Measure</span>
        </button>

        {/* Expanded Measure tools */}
        {isMeasureExpanded && (
          <div className="flex items-center gap-px pl-0.5 pr-1 border-l border-white/10">
            <ToolBtn
              icon={<Ruler className="h-3.5 w-3.5" />}
              label="Distance"
              active={activeTool === "measure"}
              onClick={() => {
                onDrawModeChange("none");
                onToolChange(activeTool === "measure" ? "none" : "measure");
              }}
            />
            <ToolBtn
              icon={<Crosshair className="h-3.5 w-3.5" />}
              label="Range Rings"
              active={activeTool === "range-rings"}
              onClick={() => {
                onDrawModeChange("none");
                onToolChange(activeTool === "range-rings" ? "none" : "range-rings");
              }}
            />
            <ToolBtn
              icon={<Eye className="h-3.5 w-3.5" />}
              label="Line of Sight"
              active={activeTool === "los"}
              onClick={() => {
                onDrawModeChange("none");
                onToolChange(activeTool === "los" ? "none" : "los");
              }}
            />
            <ToolBtn
              icon={<Mountain className="h-3.5 w-3.5" />}
              label="Elevation"
              active={activeTool === "elevation"}
              onClick={() => {
                onDrawModeChange("none");
                onToolChange(activeTool === "elevation" ? "none" : "elevation");
              }}
            />
          </div>
        )}

        {/* Annotate group (admin+ only) */}
        {isAdmin && (
          <>
            <div className="w-px h-4 bg-white/10 mx-0.5" />
            <button
              type="button"
              data-testid="map-tools-annotate-toggle"
              onClick={handleToggleAnnotateMenu}
              title={isAnnotateExpanded ? "Collapse annotation tools" : "Tactical drawing & annotations"}
              aria-expanded={isAnnotateExpanded}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider transition-colors ${
                isAnnotateExpanded
                  ? "border text-white"
                  : "text-white/65 hover:text-white hover:bg-white/5"
              }`}
              style={
                isAnnotateExpanded
                  ? {
                      backgroundColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 20%, transparent)",
                      color: "var(--brand-accent, #d59b3c)",
                      borderColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 35%, transparent)",
                    }
                  : undefined
              }
            >
              <Pencil className="h-3.5 w-3.5" />
              <span>Annotate</span>
            </button>

            {isAnnotateExpanded && (
              <div className="flex items-center gap-px pl-0.5 pr-1 border-l border-white/10">
                <ToolBtn
                  icon={<Minus className="h-3.5 w-3.5" />}
                  label="Line"
                  active={drawMode === "line"}
                  onClick={() => {
                    onToolChange("none");
                    setConfirmingClear(false);
                    onDrawModeChange(drawMode === "line" ? "none" : "line");
                  }}
                />
                <ToolBtn
                  icon={<Pentagon className="h-3.5 w-3.5" />}
                  label="Area"
                  active={drawMode === "polygon"}
                  onClick={() => {
                    onToolChange("none");
                    setConfirmingClear(false);
                    onDrawModeChange(drawMode === "polygon" ? "none" : "polygon");
                  }}
                />
                <ToolBtn
                  icon={<Circle className="h-3.5 w-3.5" />}
                  label="Circle"
                  active={drawMode === "circle"}
                  onClick={() => {
                    onToolChange("none");
                    setConfirmingClear(false);
                    onDrawModeChange(drawMode === "circle" ? "none" : "circle");
                  }}
                />
                <ToolBtn
                  icon={<ArrowRight className="h-3.5 w-3.5" />}
                  label="Arrow"
                  active={drawMode === "arrow"}
                  onClick={() => {
                    onToolChange("none");
                    setConfirmingClear(false);
                    onDrawModeChange(drawMode === "arrow" ? "none" : "arrow");
                  }}
                />
                <ToolBtn
                  icon={<Type className="h-3.5 w-3.5" />}
                  label="Label"
                  active={drawMode === "text"}
                  onClick={() => {
                    onToolChange("none");
                    setConfirmingClear(false);
                    onDrawModeChange(drawMode === "text" ? "none" : "text");
                  }}
                />

                {/* Color swatches */}
                {drawMode !== "none" && (
                  <>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    {DRAW_COLORS.map((c) => (
                      <button
                        type="button"
                        key={c}
                        onClick={() => onDrawColorChange(c)}
                        title={`Color ${c}`}
                        className={`w-3.5 h-3.5 rounded-full border mx-px ${
                          drawColor === c ? "border-white scale-125" : "border-white/20"
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </>
                )}

                {/* Clear all with two-step inline confirmation */}
                <div className="w-px h-4 bg-white/10 mx-1" />
                {confirmingClear ? (
                  <div
                    data-testid="clear-annotations-confirm"
                    className="flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono"
                  >
                    <span className="text-red-300">Clear all?</span>
                    <button
                      type="button"
                      onClick={() => {
                        onDrawClearAll();
                        setConfirmingClear(false);
                      }}
                      className="px-1.5 py-0.5 rounded bg-red-500/25 text-red-200 hover:bg-red-500/40 font-semibold"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingClear(false)}
                      className="px-1.5 py-0.5 rounded bg-white/10 text-white/60 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmingClear(true)}
                    className="text-white/35 hover:text-red-400 transition-colors p-1"
                    title="Clear all drawings"
                    aria-label="Clear all drawings"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Status panel — measure result, range info, inline text label input, or draw point count */}
      {activeTool === "measure" && (
        <div className="rounded-xl backdrop-blur-sm border border-white/10 px-3 py-2 text-xs font-mono" style={{ backgroundColor: panelBg }}>
          {measureResult ? (
            <div className="text-white space-y-0.5">
              <div className="flex items-center gap-3">
                <span className="text-white/50">Dist:</span>
                <span className="font-bold" style={{ color: "var(--brand-accent, #d59b3c)" }}>
                  {measureResult.distanceMi < 0.5
                    ? `${Math.round(measureResult.distanceM)} m (${Math.round(measureResult.distanceM * 3.281)} ft)`
                    : `${measureResult.distanceMi.toFixed(2)} mi (${(measureResult.distanceM / 1000).toFixed(2)} km)`}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-white/50">Bearing:</span>
                <span className="text-cyan-400">{measureResult.bearing.toFixed(1)}&deg;</span>
              </div>
            </div>
          ) : (
            <span className="text-white/40">Click two points to measure</span>
          )}
        </div>
      )}

      {activeTool === "range-rings" && (
        <div className="rounded-xl backdrop-blur-sm border border-white/10 px-3 py-2 text-xs font-mono" style={{ backgroundColor: panelBg }}>
          {rangeCenter ? (
            <div className="text-white/60">
              Rings at: {rangeCenter.lat.toFixed(5)}, {rangeCenter.lng.toFixed(5)}
              <br /><span className="text-white/30">0.25 / 0.5 / 1 / 2 / 5 mi</span>
            </div>
          ) : (
            <span className="text-white/40">Click to place range rings</span>
          )}
        </div>
      )}

      {activeTool === "los" && (
        <div className="rounded-xl backdrop-blur-sm border border-white/10 px-3 py-2 text-xs font-mono" style={{ backgroundColor: panelBg }}>
          {losResult ? (
            <div className="text-white space-y-0.5">
              <div className="flex items-center gap-2">
                <span className={losResult.visible ? "text-green-400" : "text-red-400"}>
                  {losResult.visible ? "CLEAR LINE OF SIGHT" : "OBSTRUCTED"}
                </span>
              </div>
              {losResult.distance != null && (
                <div className="text-white/40">
                  {losResult.distance < 1000
                    ? `${Math.round(losResult.distance)} m`
                    : `${(losResult.distance / 1000).toFixed(2)} km`}
                </div>
              )}
            </div>
          ) : (
            <span className="text-white/40">Click two points to check LOS</span>
          )}
        </div>
      )}

      {activeTool === "elevation" && (
        <div className="rounded-xl backdrop-blur-sm border border-white/10 px-3 py-2 text-xs font-mono" style={{ backgroundColor: panelBg }}>
          {elevationStatus ? (
            <span className="text-white/70">{elevationStatus}</span>
          ) : (
            <span className="text-white/40">Click two points for elevation profile</span>
          )}
        </div>
      )}

      {/* Inline Label input when drawMode === "text" */}
      {drawMode === "text" && (
        <div
          data-testid="map-tools-label-pill"
          className="rounded-xl backdrop-blur-sm border border-white/10 px-2.5 py-1.5 flex items-center gap-2 text-[11px] font-mono text-white/80"
          style={{ backgroundColor: panelBg }}
        >
          <input
            type="text"
            data-testid="map-tools-label-input"
            value={drawLabel}
            onChange={(e) => onDrawLabelChange?.(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && drawLabel.trim() && drawPointCount >= 1) {
                e.preventDefault();
                onDrawFinish();
              } else if (e.key === "Escape") {
                e.preventDefault();
                onDrawCancel();
              }
            }}
            placeholder={
              drawPointCount >= 1
                ? "Enter label & press Enter…"
                : "Type label, then click map…"
            }
            className="bg-black/30 border border-white/15 rounded px-2 py-0.5 text-[11px] text-white placeholder:text-white/35 focus:outline-none focus:border-white/40 w-44"
          />
          {drawPointCount >= 1 && drawLabel.trim() && (
            <button
              type="button"
              onClick={onDrawFinish}
              className="text-green-400 hover:text-green-300 flex items-center gap-0.5"
              title="Place label"
            >
              <Check className="h-3 w-3 inline" /> Place
            </button>
          )}
          <button
            type="button"
            onClick={onDrawCancel}
            className="text-red-400 hover:text-red-300"
            title="Cancel label"
            aria-label="Cancel label"
          >
            <X className="h-3.5 w-3.5 inline" />
          </button>
        </div>
      )}

      {drawMode !== "none" && drawMode !== "text" && (
        <div className="rounded-xl backdrop-blur-sm border border-white/10 px-3 py-2 text-[10px] font-mono text-white/60" style={{ backgroundColor: panelBg }}>
          {drawPointCount} point{drawPointCount !== 1 ? "s" : ""}
          {drawPointCount >= 2 && (
            <button type="button" onClick={onDrawFinish} className="ml-2 text-green-400 hover:text-green-300">
              <Check className="h-3 w-3 inline" /> Done
            </button>
          )}
          <button type="button" onClick={onDrawCancel} className="ml-2 text-red-400 hover:text-red-300" aria-label="Cancel drawing">
            <X className="h-3 w-3 inline" />
          </button>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active}
      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
        active ? "border" : "text-white/55 hover:text-white/85 hover:bg-white/5"
      }`}
      style={active ? {
        backgroundColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 20%, transparent)",
        color: "var(--brand-accent, #d59b3c)",
        borderColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)",
      } : undefined}
    >
      {icon}
    </button>
  );
}

// ─── Math helpers (exported for use by tactical-map) ──

const EARTH_RADIUS_M = 6371000;

export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function initialBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export const RANGE_RING_RADII_M = [402.336, 804.672, 1609.34, 3218.69, 8046.72];
export const RANGE_RING_LABELS = ["¼ mi", "½ mi", "1 mi", "2 mi", "5 mi"];
