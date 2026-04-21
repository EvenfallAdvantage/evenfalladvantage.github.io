"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import type { PinFormData } from "./types";
import { DEFAULT_COLORS } from "./icon-catalog";
import { IconPicker } from "./icon-picker";

/* ── Pin Form (inline popover) ── */

export function PinForm({
  initial,
  onSubmit,
  onCancel,
  submitLabel,
}: {
  initial: PinFormData;
  onSubmit: (data: PinFormData) => void;
  onCancel: () => void;
  submitLabel: string;
}) {
  const [form, setForm] = useState<PinFormData>(initial);

  return (
    <div
      className="flex flex-col gap-2.5 p-3 rounded-lg border min-w-[260px]"
      style={{
        background: "var(--brand-primary, #0d1520)",
        borderColor: "var(--brand-primary-light, #1a2a3a)",
        boxShadow: "0 8px 32px rgba(0,0,0,0.6)",
      }}
      onClick={(e) => e.stopPropagation()}
      onMouseDown={(e) => e.stopPropagation()}
    >
      {/* Label */}
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1 block">
          Label
        </label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => setForm({ ...form, label: e.target.value })}
          placeholder="e.g. Main entrance"
            autoFocus
            className="w-full rounded-md px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none focus:ring-1"
            style={{
              background: "color-mix(in srgb, var(--brand-primary, #0d1520), #ffffff 8%)",
              border: "1px solid var(--brand-primary-light, #1a2a3a)",
            }}
            onFocus={(e) => (e.target.style.outlineColor = "var(--brand-accent, #d59b3c)")}
        />
      </div>

      {/* Description */}
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1 block">
          Description
        </label>
        <textarea
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
          placeholder="Optional details..."
          rows={2}
          className="w-full rounded-md px-2.5 py-1.5 text-sm text-slate-200 placeholder:text-slate-600 outline-none resize-none focus:ring-1"
          style={{
            background: "#111b2a",
            border: "1px solid #1a2a3a",
          }}
        />
      </div>

      {/* Icon select — searchable dropdown */}
      <IconPicker value={form.icon} onChange={(v) => setForm({ ...form, icon: v })} />

      {/* Color picker */}
      <div>
        <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1 block">
          Color
        </label>
        <div className="flex flex-wrap gap-1.5">
          {DEFAULT_COLORS.map((c) => {
            const active = form.color === c;
            return (
              <button
                key={c}
                type="button"
                onClick={() => setForm({ ...form, color: c })}
                className={cn(
                  "w-6 h-6 rounded-full border-2 transition-transform",
                  active
                    ? "border-white scale-110"
                    : "border-transparent hover:scale-105"
                )}
                style={{ background: c }}
              />
            );
          })}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={() => onSubmit(form)}
          disabled={!form.label.trim()}
          className={cn(
            "flex-1 rounded-md px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors",
            form.label.trim()
              ? "bg-primary text-primary-foreground hover:opacity-90"
              : "bg-slate-800 text-slate-600 cursor-not-allowed"
          )}
        >
          {submitLabel}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-slate-400 hover:text-slate-200 border border-[#1a2a3a] hover:border-slate-600 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
