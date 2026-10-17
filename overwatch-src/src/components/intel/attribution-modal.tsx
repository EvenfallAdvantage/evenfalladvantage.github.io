"use client";

/**
 * Modal that lists every Intel data source currently in use and its required
 * attribution. Some upstreams (NASA FIRMS, OpenSky, CelesTrak, etc.) require
 * attribution on display per their terms of use — this modal is the single
 * surface where all of those attributions live.
 */

import { useMemo } from "react";
import { ExternalLink, X } from "lucide-react";
import {
  DATA_SOURCES_URL,
  LEGAL_CONTACT_EMAIL,
  MAP_DISCLAIMER,
  PRIVACY_MAP_DATA_URL,
  TERMS_OVERWATCH_URL,
} from "@/lib/legal/links";
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
            Data Sources & Attribution
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
          <p className="rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-1.5 text-amber-200">
            {MAP_DISCLAIMER}
          </p>
          <p className="text-white/50">
            Overwatch shows third-party data owned by the providers below, used
            under their licences. No provider endorses Overwatch. Full credits
            and licence links:
          </p>
          <div className="flex flex-wrap gap-x-3 gap-y-1">
            <a href={DATA_SOURCES_URL} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline text-amber-400">
              Data Sources Notice <ExternalLink className="h-3 w-3" />
            </a>
            <a href={TERMS_OVERWATCH_URL} target="_blank" rel="noopener noreferrer" className="underline text-amber-400">
              Terms §16
            </a>
            <a href={PRIVACY_MAP_DATA_URL} target="_blank" rel="noopener noreferrer" className="underline text-amber-400">
              Privacy
            </a>
          </div>
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
          <p className="text-[10px] text-white/40">
            Corrections or takedown requests:{" "}
            <a href={`mailto:${LEGAL_CONTACT_EMAIL}`} className="underline">{LEGAL_CONTACT_EMAIL}</a>
          </p>
        </div>
      </div>
    </div>
  );
}
