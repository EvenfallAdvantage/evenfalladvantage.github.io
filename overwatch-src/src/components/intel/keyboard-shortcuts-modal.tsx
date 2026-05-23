"use client";

/**
 * Keyboard shortcuts reference modal. Opens on `?` and lists every
 * registered hotkey on the tactical map. Tabular layout for quick scan.
 *
 * The actual hotkey wiring lives in tactical-map.tsx's global keydown
 * listener; this modal is documentation-only.
 */

import { X } from "lucide-react";

interface KeyboardShortcutsModalProps {
  onClose: () => void;
}

interface Shortcut {
  keys: string[];
  description: string;
  category: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ["?"],   description: "Show this help",              category: "General" },
  { keys: ["Esc"], description: "Close any open modal/drawer", category: "General" },
  { keys: ["I"],   description: "Toggle Intel drawer",         category: "Intel" },
  { keys: ["A"],   description: "Switch Intel drawer to Alerts tab", category: "Intel" },
  { keys: ["R"],   description: "Switch Intel drawer to RECON tab",  category: "Intel" },
  { keys: ["S"],   description: "Switch Intel drawer to Sources tab", category: "Intel" },
  { keys: ["F"],   description: "Toggle fullscreen map",       category: "View" },
  { keys: ["N"],   description: "Reset camera to north (top-down)", category: "View" },
  { keys: ["T"],   description: "Toggle Time Machine",         category: "View" },
  { keys: ["Right-click"], description: "Open region dossier at point", category: "Intel" },
];

export function KeyboardShortcutsModal({ onClose }: KeyboardShortcutsModalProps) {
  const categories = Array.from(new Set(SHORTCUTS.map((s) => s.category)));

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-xl shadow-2xl"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--brand-primary, #0f1a2e) 97%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-semibold text-white">Keyboard Shortcuts</span>
          <button onClick={onClose} className="text-white/40 hover:text-white" title="Close (Esc)">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3 space-y-3 text-[11px] font-mono">
          {categories.map((cat) => (
            <div key={cat}>
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                {cat}
              </div>
              <div className="space-y-1">
                {SHORTCUTS.filter((s) => s.category === cat).map((s) => (
                  <div key={s.description} className="flex items-baseline justify-between gap-3">
                    <span className="text-white/70">{s.description}</span>
                    <span className="flex gap-1 shrink-0">
                      {s.keys.map((k) => (
                        <kbd
                          key={k}
                          className="inline-block px-1.5 py-0.5 rounded text-white/90 text-[10px]"
                          style={{
                            backgroundColor: "rgba(255,255,255,0.08)",
                            border: "1px solid rgba(255,255,255,0.12)",
                          }}
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
