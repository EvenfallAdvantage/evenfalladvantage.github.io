"use client";

import { Ruler, Crosshair, Pencil, Pentagon, Circle, ArrowRight, Type, Minus, Trash2, Check, X, Eye, Mountain } from "lucide-react";

export type ActiveTool = "none" | "measure" | "range-rings" | "los" | "elevation";
export type DrawMode = "none" | "line" | "polygon" | "circle" | "arrow" | "text" | "freehand";

interface MeasureResult {
  distanceM: number;
  distanceMi: number;
  bearing: number;
}

interface MapToolsProps {
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
  onDrawFinish: () => void;
  onDrawCancel: () => void;
  onDrawClearAll: () => void;
  isAdmin: boolean;
}

const DRAW_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ffffff"];

export function MapToolsBar({
  activeTool, onToolChange, measureResult, rangeCenter, losResult, elevationStatus,
  drawMode, onDrawModeChange, drawColor, onDrawColorChange,
  drawPointCount, onDrawFinish, onDrawCancel, onDrawClearAll, isAdmin,
}: MapToolsProps) {
  const panelBg = "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)";

  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-end gap-2">
      {/* Tool buttons — single unified card */}
      <div className="flex items-center gap-px rounded-xl backdrop-blur-sm border border-white/10 p-1.5" style={{ backgroundColor: panelBg }}>
        {/* Measure tools */}
        <ToolBtn icon={<Ruler className="h-3.5 w-3.5" />} label="Measure" active={activeTool === "measure"}
          onClick={() => { onDrawModeChange("none"); onToolChange(activeTool === "measure" ? "none" : "measure"); }} />
        <ToolBtn icon={<Crosshair className="h-3.5 w-3.5" />} label="Range Rings" active={activeTool === "range-rings"}
          onClick={() => { onDrawModeChange("none"); onToolChange(activeTool === "range-rings" ? "none" : "range-rings"); }} />
        <ToolBtn icon={<Eye className="h-3.5 w-3.5" />} label="Line of Sight" active={activeTool === "los"}
          onClick={() => { onDrawModeChange("none"); onToolChange(activeTool === "los" ? "none" : "los"); }} />
        <ToolBtn icon={<Mountain className="h-3.5 w-3.5" />} label="Elevation" active={activeTool === "elevation"}
          onClick={() => { onDrawModeChange("none"); onToolChange(activeTool === "elevation" ? "none" : "elevation"); }} />

        {/* Divider */}
        {isAdmin && <div className="w-px h-5 bg-white/10 mx-1" />}

        {/* Draw tools (admin+ only) */}
        {isAdmin && (
          <>
            <ToolBtn icon={<Minus className="h-3.5 w-3.5" />} label="Line" active={drawMode === "line"}
              onClick={() => { onToolChange("none"); onDrawModeChange(drawMode === "line" ? "none" : "line"); }} />
            <ToolBtn icon={<Pentagon className="h-3.5 w-3.5" />} label="Area" active={drawMode === "polygon"}
              onClick={() => { onToolChange("none"); onDrawModeChange(drawMode === "polygon" ? "none" : "polygon"); }} />
            <ToolBtn icon={<Circle className="h-3.5 w-3.5" />} label="Circle" active={drawMode === "circle"}
              onClick={() => { onToolChange("none"); onDrawModeChange(drawMode === "circle" ? "none" : "circle"); }} />
            <ToolBtn icon={<ArrowRight className="h-3.5 w-3.5" />} label="Arrow" active={drawMode === "arrow"}
              onClick={() => { onToolChange("none"); onDrawModeChange(drawMode === "arrow" ? "none" : "arrow"); }} />
            <ToolBtn icon={<Pencil className="h-3.5 w-3.5" />} label="Draw" active={drawMode === "freehand"}
              onClick={() => { onToolChange("none"); onDrawModeChange(drawMode === "freehand" ? "none" : "freehand"); }} />
            <ToolBtn icon={<Type className="h-3.5 w-3.5" />} label="Label" active={drawMode === "text"}
              onClick={() => { onToolChange("none"); onDrawModeChange(drawMode === "text" ? "none" : "text"); }} />

            {/* Color swatches */}
            {drawMode !== "none" && (
              <>
                <div className="w-px h-5 bg-white/10 mx-1" />
                {DRAW_COLORS.map((c) => (
                  <button key={c} onClick={() => onDrawColorChange(c)}
                    className={`w-3.5 h-3.5 rounded-full border mx-px ${drawColor === c ? "border-white scale-125" : "border-white/20"}`}
                    style={{ backgroundColor: c }} />
                ))}
              </>
            )}

            {/* Clear all */}
            <div className="w-px h-5 bg-white/10 mx-1" />
            <button onClick={onDrawClearAll} className="text-white/30 hover:text-red-400 transition-colors p-1" title="Clear all drawings">
              <Trash2 className="h-3 w-3" />
            </button>
          </>
        )}
      </div>

      {/* Status panel — measure result, range info, or draw point count */}
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

      {drawMode !== "none" && drawMode !== "text" && (
        <div className="rounded-xl backdrop-blur-sm border border-white/10 px-3 py-2 text-[10px] font-mono text-white/60" style={{ backgroundColor: panelBg }}>
          {drawPointCount} point{drawPointCount !== 1 ? "s" : ""}
          {drawPointCount >= 2 && (
            <button onClick={onDrawFinish} className="ml-2 text-green-400 hover:text-green-300">
              <Check className="h-3 w-3 inline" /> Done
            </button>
          )}
          <button onClick={onDrawCancel} className="ml-2 text-red-400 hover:text-red-300">
            <X className="h-3 w-3 inline" />
          </button>
        </div>
      )}
    </div>
  );
}

function ToolBtn({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick} title={label}
      className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
        active ? "border" : "text-white/50 hover:text-white/80 hover:bg-white/5"
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
