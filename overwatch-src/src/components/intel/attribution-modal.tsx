"use client";

/**
 * Modal that lists every Intel data source currently in use and its required
 * attribution. Some upstreams (NASA FIRMS, OpenSky, CelesTrak, etc.) require
 * attribution on display per their terms of use — this modal is the single
 * surface where all of those attributions live.
 */

import { useMemo } from "react";
import { X } from "lucide-react";
import {
  INTEL_LAYER_FLAGS,
  type IntelLayerKey,
} from "@/lib/intel-feature-flags";

interface AttributionModalProps {
  /** Layer keys currently visible on screen. */
  activeLayers?: IntelLayerKey[];
  onClose: () => void;
}

export function AttributionModal({ activeLayers, onClose }: AttributionModalProps) {
  const rows = useMemo(() => {
    const keys = activeLayers && activeLayers.length > 0
      ? activeLayers
      : (Object.keys(INTEL_LAYER_FLAGS) as IntelLayerKey[]);
    return keys
      .map((k) => ({ key: k, ...INTEL_LAYER_FLAGS[k] }))
      .sort((a, b) => (b.attributionRequired ? 1 : 0) - (a.attributionRequired ? 1 : 0));
  }, [activeLayers]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.55)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] overflow-y-auto rounded-xl shadow-2xl"
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--brand-primary, #0f1a2e) 97%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--brand-accent, #d59b3c) 30%, transparent)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <span className="text-sm font-semibold text-white">
            Intel Data Sources & Attribution
          </span>
          <button
            onClick={onClose}
            className="text-white/30 hover:text-white"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-4 py-3 space-y-2 text-xs text-white/80">
          <p className="text-white/50">
            The Intel features in Overwatch aggregate public data from the
            following sources. Some are free with attribution; some require
            legal review before commercial use. See{" "}
            <code className="font-mono text-[10px] text-white/70">
              docs/THIRD-PARTY-NOTICES.md
            </code>{" "}
            for the full license posture.
          </p>
          <table className="w-full font-mono text-[11px] mt-3">
            <thead className="text-white/40 border-b border-white/10">
              <tr>
                <th className="text-left py-1 pr-2">Layer</th>
                <th className="text-left py-1 pr-2">Source</th>
                <th className="text-left py-1">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.key} className="border-b border-white/5">
                  <td className="py-1 pr-2 text-white/90">{r.key}</td>
                  <td className="py-1 pr-2 text-white/70">{r.attribution}</td>
                  <td className="py-1 text-[10px]">
                    {r.enabled ? (
                      <span style={{ color: "#10b981" }}>active</span>
                    ) : (
                      <span style={{ color: "#fbbf24" }} title={r.gatedBy}>
                        gated
                      </span>
                    )}
                    {r.attributionRequired && (
                      <span className="ml-2 text-white/40">attr. required</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-white/40 mt-3">
            Vendored code from the Osiris OSS project
            (github.com/simplifaisoul/osiris, MIT). License preserved per MIT
            terms.
          </p>
        </div>
      </div>
    </div>
  );
}
