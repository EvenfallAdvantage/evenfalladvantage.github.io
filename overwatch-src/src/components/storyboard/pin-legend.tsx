"use client";

import { Trash2, GripVertical } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StoryboardPin } from "./types";
import { PinIcon } from "./pin-icon";

/* ── Pin Legend List ── */

export function PinLegend({
  pins,
  selectedPinId,
  editingPinId,
  readOnly,
  onSelectPin,
  onDelete,
}: {
  pins: StoryboardPin[];
  selectedPinId: string | null;
  editingPinId: string | null;
  readOnly: boolean;
  onSelectPin: (pin: StoryboardPin) => void;
  onDelete: (id: string) => void;
}) {
  if (pins.length === 0) return null;

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        background: "#0d1520",
        borderColor: "#1a2a3a",
      }}
    >
      <div
        className="px-3 py-2 border-b text-[10px] font-semibold uppercase tracking-wider text-slate-500"
        style={{ borderColor: "#1a2a3a" }}
      >
        Pin Legend ({pins.length})
      </div>
      <div className="divide-y" style={{ borderColor: "#1a2a3a" }}>
        {pins.map((pin, idx) => {
          const isActive = selectedPinId === pin.id || editingPinId === pin.id;
          return (
            <div
              key={pin.id}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer",
                isActive
                  ? "bg-[#d59b3c]/5"
                  : "hover:bg-white/[0.02]"
              )}
              style={{ borderColor: "#1a2a3a" }}
              onClick={() => onSelectPin(pin)}
            >
              {/* Drag handle */}
              {!readOnly && (
                <GripVertical size={12} className="text-slate-700 flex-shrink-0" />
              )}

              {/* Number badge */}
              <div
                className="flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold flex-shrink-0"
                style={{
                  background: `${pin.color}22`,
                  color: pin.color,
                  border: `1px solid ${pin.color}44`,
                }}
              >
                {idx + 1}
              </div>

              {/* Icon */}
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: pin.color }}
              >
                <PinIcon icon={pin.icon} size={12} />
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-slate-200 truncate">
                  {pin.label}
                </div>
                {pin.description && (
                  <div className="text-xs text-slate-500 truncate">
                    {pin.description}
                  </div>
                )}
              </div>

              {/* Coordinates */}
              <div className="text-[10px] text-slate-600 font-mono flex-shrink-0">
                {(pin.x * 100).toFixed(0)}%, {(pin.y * 100).toFixed(0)}%
              </div>

              {/* Delete button */}
              {!readOnly && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(pin.id);
                  }}
                  className="text-slate-700 hover:text-red-400 transition-colors flex-shrink-0"
                >
                  <Trash2 size={13} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
