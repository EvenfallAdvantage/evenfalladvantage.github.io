"use client";

import { X, Trash2 } from "lucide-react";
import type { StoryboardPin } from "./types";
import { PinIcon } from "./pin-icon";

/* ── Selected Pin Detail Popover (read-only card with Edit/Delete) ── */

export function PinDetailPopover({
  pin,
  readOnly,
  onClose,
  onEdit,
  onDelete,
}: {
  pin: StoryboardPin;
  readOnly: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className="rounded-lg border p-3 min-w-[220px]"
      style={{
        background: "#0d1520",
        borderColor: "#1a2a3a",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2">
          <div
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: pin.color }}
          >
            <PinIcon icon={pin.icon} size={12} />
          </div>
          <span className="text-sm font-semibold text-slate-200">
            {pin.label}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-600 hover:text-slate-300 transition-colors"
        >
          <X size={14} />
        </button>
      </div>

      {pin.description && (
        <p className="text-xs text-slate-400 mb-2 leading-relaxed">
          {pin.description}
        </p>
      )}

      {pin.timestamp && (
        <p className="text-[10px] text-slate-600 mb-2">
          {new Date(pin.timestamp).toLocaleString()}
          {pin.createdBy && ` · ${pin.createdBy}`}
        </p>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2 pt-1 border-t border-[#1a2a3a]">
          <button
            type="button"
            onClick={onEdit}
            className="flex-1 rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#d59b3c] bg-[#d59b3c]/10 border border-[#d59b3c]/20 hover:bg-[#d59b3c]/20 transition-colors"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="flex items-center justify-center rounded-md px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-red-400 bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 transition-colors"
          >
            <Trash2 size={11} className="mr-1" />
            Delete
          </button>
        </div>
      )}
    </div>
  );
}
