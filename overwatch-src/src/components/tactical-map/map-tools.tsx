"use client";

import { useState } from "react";
import { Ruler, Target, X, Crosshair } from "lucide-react";
import { Button } from "@/components/ui/button";

export type ActiveTool = "none" | "measure" | "range-rings";

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
}

export function MapToolsBar({ activeTool, onToolChange, measureResult, rangeCenter }: MapToolsProps) {
  return (
    <div className="absolute bottom-3 left-3 z-10 flex items-end gap-2">
      {/* Tool buttons */}
      <div className="flex gap-1 rounded-xl backdrop-blur-sm border border-white/10 p-1.5" style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)" }}>
        <ToolButton
          icon={<Ruler className="h-3.5 w-3.5" />}
          label="Measure"
          active={activeTool === "measure"}
          onClick={() => onToolChange(activeTool === "measure" ? "none" : "measure")}
        />
        <ToolButton
          icon={<Crosshair className="h-3.5 w-3.5" />}
          label="Range Rings"
          active={activeTool === "range-rings"}
          onClick={() => onToolChange(activeTool === "range-rings" ? "none" : "range-rings")}
        />
      </div>

      {/* Measurement result */}
      {activeTool === "measure" && (
        <div className="rounded-xl backdrop-blur-sm border border-white/10 px-3 py-2 text-xs font-mono" style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)" }}>
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

      {/* Range rings info */}
      {activeTool === "range-rings" && (
        <div className="rounded-xl backdrop-blur-sm border border-white/10 px-3 py-2 text-xs font-mono" style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)" }}>
          {rangeCenter ? (
            <div className="text-white/60">
              Rings at: {rangeCenter.lat.toFixed(5)}, {rangeCenter.lng.toFixed(5)}
              <br />
              <span className="text-white/30">0.25 / 0.5 / 1 / 2 / 5 mi</span>
            </div>
          ) : (
            <span className="text-white/40">Click to place range rings</span>
          )}
        </div>
      )}
    </div>
  );
}

function ToolButton({ icon, label, active, onClick }: { icon: React.ReactNode; label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[10px] font-medium transition-colors ${
        active
          ? "border"
          : "text-white/50 hover:text-white/80 hover:bg-white/5"
      }`}
      style={active ? { backgroundColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 20%, transparent)", color: "var(--brand-accent, #d59b3c)", borderColor: "color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)" } : undefined}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

// ─── Math helpers (exported for use by tactical-map) ──

const EARTH_RADIUS_M = 6371000;

/** Haversine distance in meters */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Initial bearing in degrees (0-360) */
export function initialBearing(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const toDeg = (r: number) => (r * 180) / Math.PI;
  const dLng = toRad(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(toRad(lat2));
  const x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) - Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLng);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/** Range ring radii in meters (0.25, 0.5, 1, 2, 5 miles) */
export const RANGE_RING_RADII_M = [402.336, 804.672, 1609.34, 3218.69, 8046.72];
export const RANGE_RING_LABELS = ["¼ mi", "½ mi", "1 mi", "2 mi", "5 mi"];
