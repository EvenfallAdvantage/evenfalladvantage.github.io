"use client";

import { Eye, EyeOff, Layers } from "lucide-react";
import type { LayerVisibility } from "./map-layers-panel";
import type { OperationPin } from "./types";

/** Per-site plan overlays (shared by the classic and v2 layer panels). */
export function SiteMapsList({ layers, onChange, operations, isAdmin, savedBounds, onAdjustSiteMap, onRealignSiteMap }: {
  layers: LayerVisibility;
  onChange: (layers: LayerVisibility) => void;
  operations: OperationPin[];
  isAdmin?: boolean;
  savedBounds?: Record<string, unknown>;
  onAdjustSiteMap?: (op: OperationPin) => void;
  onRealignSiteMap?: (op: OperationPin) => void;
}) {
  const opsWithSiteMaps = operations.filter((o) => o.siteMapUrl);
  if (opsWithSiteMaps.length === 0) return null;
  function toggleSiteOverlay(eventId: string) {
    onChange({
      ...layers,
      siteOverlays: { ...layers.siteOverlays, [eventId]: !layers.siteOverlays[eventId] },
    });
  }
  return (
    <div className="mt-2">
      <p className="text-[8px] font-mono text-white/25 uppercase tracking-wider mb-1">Site Maps</p>
      <div className="space-y-0.5">
        {opsWithSiteMaps.map((op) => {
          const userPref = layers.siteOverlays[op.id];
          const hasBounds = !!savedBounds?.[op.id];
          // Effective on = explicit user pref if set, otherwise auto-on when bounds exist
          const siteActive = userPref === undefined ? hasBounds : userPref;
          // Non-admins may toggle aligned (bounds-exist) overlays.
          // Only admins may toggle an un-aligned overlay (turning it on
          // would open the aligner UI which requires admin perms).
          const canToggle = isAdmin || hasBounds;
          const blockedTooltip = !canToggle
            ? "Admin access required to align this site map"
            : "";
          return (
            <div key={op.id} className="flex items-center gap-1">
              <button
                onClick={() => { if (!canToggle) return; toggleSiteOverlay(op.id); }}
                className={`flex-1 flex items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors ${
                  siteActive ? "bg-white/10 text-white" : "text-white/40 hover:text-white/60 hover:bg-white/5"
                } ${!canToggle ? "cursor-not-allowed opacity-60" : ""}`}
                title={blockedTooltip}
              >
                <Layers className="h-3 w-3" />
                <span className="flex-1 text-left truncate">{op.name}</span>
                {siteActive ? <Eye className="h-3 w-3 text-green-400" /> : <EyeOff className="h-3 w-3" />}
              </button>
              {siteActive && isAdmin && hasBounds && (
                <div className="flex gap-0.5">
                  {onAdjustSiteMap && <button onClick={() => onAdjustSiteMap(op)} className="text-[8px] text-white/30 hover:text-white/60 px-1 py-0.5 rounded" title="Fine-tune position">⇔</button>}
                  {onRealignSiteMap && <button onClick={() => onRealignSiteMap(op)} className="text-[8px] text-white/30 hover:text-white/60 px-1 py-0.5 rounded" title="Re-align (3-point pick)">↻</button>}
                </div>
              )}
            </div>
          );
        })}
      </div>
      {/* Site overlay opacity slider */}
      <div className="flex items-center gap-1.5 mt-1.5 px-1 max-w-full overflow-hidden">
        <span className="text-[7px] text-white/30 shrink-0">Opacity</span>
        <input type="range" min={0} max={100} value={Math.round(layers.siteOverlayOpacity * 100)}
          onChange={(e) => onChange({ ...layers, siteOverlayOpacity: parseInt(e.target.value) / 100 })}
          className="h-1 min-w-0 w-full max-w-[80px]" style={{ accentColor: "var(--brand-accent, #d59b3c)" }} />
        <span className="text-[7px] text-white/40 shrink-0">{Math.round(layers.siteOverlayOpacity * 100)}%</span>
      </div>
    </div>
  );
}
