"use client";

import { useState } from "react";
import {
  Pencil, Pentagon, Circle, ArrowRight, Type, Minus,
  Trash2, Check, X,
} from "lucide-react";

export type DrawMode = "none" | "line" | "polygon" | "circle" | "arrow" | "text" | "freehand";

interface DrawToolsProps {
  mode: DrawMode;
  onModeChange: (mode: DrawMode) => void;
  onClear: () => void;
  drawColor: string;
  onColorChange: (color: string) => void;
  pointCount: number;
  onFinish: () => void;
  onCancel: () => void;
  isAdmin: boolean;
}

const DRAW_COLORS = ["#ef4444", "#f97316", "#eab308", "#22c55e", "#06b6d4", "#3b82f6", "#8b5cf6", "#ffffff"];

const TOOLS: { mode: DrawMode; icon: React.ReactNode; label: string }[] = [
  { mode: "line", icon: <Minus className="h-3.5 w-3.5" />, label: "Line" },
  { mode: "polygon", icon: <Pentagon className="h-3.5 w-3.5" />, label: "Area" },
  { mode: "circle", icon: <Circle className="h-3.5 w-3.5" />, label: "Circle" },
  { mode: "arrow", icon: <ArrowRight className="h-3.5 w-3.5" />, label: "Arrow" },
  { mode: "freehand", icon: <Pencil className="h-3.5 w-3.5" />, label: "Draw" },
  { mode: "text", icon: <Type className="h-3.5 w-3.5" />, label: "Label" },
];

export function DrawToolsBar({
  mode, onModeChange, onClear, drawColor, onColorChange,
  pointCount, onFinish, onCancel, isAdmin,
}: DrawToolsProps) {
  const [expanded, setExpanded] = useState(false);

  if (!isAdmin) return null;

  return (
    <div className="absolute bottom-3 left-48 z-10 flex items-end gap-2">
      {/* Toggle */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-medium backdrop-blur-sm border border-white/10 transition-colors ${
          expanded || mode !== "none"
            ? "text-white"
            : "text-white/50 hover:text-white/80"
        }`}
        style={{
          backgroundColor: expanded || mode !== "none"
            ? "color-mix(in srgb, var(--brand-accent, #d59b3c) 20%, color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent))"
            : "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)",
        }}
      >
        <Pencil className="h-3.5 w-3.5" />
        <span>Draw</span>
      </button>

      {/* Expanded toolbar */}
      {expanded && (
        <div className="flex items-center gap-1 rounded-xl backdrop-blur-sm border border-white/10 p-1.5"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)" }}>
          {TOOLS.map((tool) => (
            <button
              key={tool.mode}
              onClick={() => onModeChange(mode === tool.mode ? "none" : tool.mode)}
              title={tool.label}
              className={`flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-medium transition-colors ${
                mode === tool.mode ? "bg-white/15 text-white" : "text-white/50 hover:text-white/80"
              }`}
            >
              {tool.icon}
            </button>
          ))}

          {/* Color picker */}
          <div className="flex items-center gap-0.5 ml-1 pl-1 border-l border-white/10">
            {DRAW_COLORS.map((c) => (
              <button
                key={c}
                onClick={() => onColorChange(c)}
                className={`w-4 h-4 rounded-full border ${drawColor === c ? "border-white scale-125" : "border-white/20"}`}
                style={{ backgroundColor: c }}
              />
            ))}
          </div>

          {/* Clear all */}
          <button onClick={onClear} className="ml-1 text-white/30 hover:text-red-400 transition-colors" title="Clear all drawings">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Active drawing indicator */}
      {mode !== "none" && mode !== "text" && (
        <div className="rounded-xl backdrop-blur-sm border border-white/10 px-3 py-2 text-[10px] font-mono text-white/60"
          style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 90%, transparent)" }}>
          {pointCount} point{pointCount !== 1 ? "s" : ""}
          {pointCount >= 2 && (
            <button onClick={onFinish} className="ml-2 text-green-400 hover:text-green-300">
              <Check className="h-3 w-3 inline" /> Done
            </button>
          )}
          <button onClick={onCancel} className="ml-2 text-red-400 hover:text-red-300">
            <X className="h-3 w-3 inline" />
          </button>
        </div>
      )}
    </div>
  );
}
