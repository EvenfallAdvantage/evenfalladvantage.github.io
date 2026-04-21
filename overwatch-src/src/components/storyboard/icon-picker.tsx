"use client";

import { useEffect, useRef, useState } from "react";
import { MapPin, Search, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ICON_CATEGORIES, ICON_MAP, ALL_ICONS } from "./icon-catalog";

/* ── Icon Picker (searchable dropdown) ── */

export function IconPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const selectedEntry = ALL_ICONS.find(i => i.value === value);
  const SelectedIcon = ICON_MAP[value] ?? MapPin;

  const query = search.toLowerCase().trim();
  const filtered = query
    ? ALL_ICONS.filter(i => i.label.toLowerCase().includes(query) || i.tags.some(t => t.includes(query)))
    : null;

  return (
    <div ref={ref} className="relative">
      <label className="text-[10px] font-medium uppercase tracking-wider text-slate-400 mb-1 block">Icon</label>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm text-slate-200 border transition-colors"
        style={{ background: "color-mix(in srgb, var(--brand-primary, #0d1520), #ffffff 8%)", borderColor: open ? "var(--brand-accent, #d59b3c)" : "var(--brand-primary-light, #1a2a3a)" }}
      >
        <span className="flex items-center justify-center w-6 h-6 rounded" style={{ background: "color-mix(in srgb, var(--brand-accent, #d59b3c), transparent 85%)", color: "var(--brand-accent, #d59b3c)" }}>
          <SelectedIcon size={14} strokeWidth={2.5} />
        </span>
        <span className="flex-1 text-left truncate">{selectedEntry?.label ?? value}</span>
        <ChevronDown size={12} className={cn("text-slate-500 transition-transform", open && "rotate-180")} />
      </button>

      {open && (
        <div
          className="absolute z-[100] mt-1 w-full rounded-lg border overflow-hidden"
          style={{ background: "var(--brand-primary, #0d1520)", borderColor: "var(--brand-primary-light, #1a2a3a)", boxShadow: "0 12px 40px rgba(0,0,0,0.7)" }}
        >
          {/* Search input */}
          <div className="flex items-center gap-2 px-2.5 py-2 border-b" style={{ borderColor: "#1a2a3a" }}>
            <Search size={12} className="text-slate-500 shrink-0" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              autoFocus
              className="flex-1 bg-transparent text-xs text-slate-200 placeholder:text-slate-600 outline-none focus:ring-1 focus:ring-primary"
            />
            {search && (
              <button type="button" onClick={() => setSearch("")} className="text-slate-600 hover:text-slate-300" aria-label="Clear search">
                <X size={10} />
              </button>
            )}
          </div>

          {/* Icon grid */}
          <div className="max-h-[200px] overflow-y-auto p-2 space-y-2">
            {filtered ? (
              filtered.length === 0 ? (
                <p className="text-[10px] text-slate-600 text-center py-3">No icons found</p>
              ) : (
                <div className="flex flex-wrap gap-1">
                  {filtered.map(entry => {
                    const Ic = entry.icon;
                    const active = value === entry.value;
                    return (
                      <button key={entry.value} type="button" title={entry.label}
                        onClick={() => { onChange(entry.value); setOpen(false); setSearch(""); }}
                        className={cn("flex items-center justify-center w-8 h-8 rounded-md border transition-colors",
                          active ? "border-[var(--brand-accent,#d59b3c)] bg-primary/15 text-primary" : "border-border bg-card text-slate-500 hover:text-slate-300 hover:border-slate-600"
                        )}>
                        <Ic size={14} strokeWidth={2.5} />
                      </button>
                    );
                  })}
                </div>
              )
            ) : (
              ICON_CATEGORIES.map(cat => (
                <div key={cat.label}>
                  <p className="text-[8px] font-bold uppercase tracking-widest text-slate-600 mb-1 px-0.5">{cat.label}</p>
                  <div className="flex flex-wrap gap-1 mb-1">
                    {cat.icons.map(entry => {
                      const Ic = entry.icon;
                      const active = value === entry.value;
                      return (
                        <button key={entry.value} type="button" title={entry.label}
                          onClick={() => { onChange(entry.value); setOpen(false); setSearch(""); }}
                          className={cn("flex items-center justify-center w-8 h-8 rounded-md border transition-colors",
                            active ? "border-[var(--brand-accent,#d59b3c)] bg-primary/15 text-primary" : "border-border bg-card text-slate-500 hover:text-slate-300 hover:border-slate-600"
                          )}>
                          <Ic size={14} strokeWidth={2.5} />
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
