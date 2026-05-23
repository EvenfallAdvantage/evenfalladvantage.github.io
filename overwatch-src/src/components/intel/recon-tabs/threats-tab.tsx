"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchOsintThreats } from "@/lib/intel-client";
import type { IntelThreatsResponse } from "@/lib/intel-types";

const levelColors: Record<string, string> = {
  HIGH: "#ef4444",
  MEDIUM: "#fbbf24",
  LOW: "#10b981",
};

export function ThreatsTab() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IntelThreatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetchOsintThreats(query.trim() || undefined);
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Threats lookup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="IP or domain (optional)"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-white/30"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--brand-accent, #d59b3c) 80%, transparent)",
            color: "var(--brand-primary, #0f1a2e)",
          }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Pulse Feed"}
        </button>
      </form>

      {error && (
        <div className="text-[11px] text-red-300 font-mono">{error}</div>
      )}

      {result && (
        <div className="space-y-2 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span style={{ color: levelColors[result.threat_level] }}>
              ● {result.threat_level} threat level
            </span>
            {result.tor_exit_node === true && (
              <span style={{ color: "#ef4444" }}>TOR EXIT</span>
            )}
          </div>
          {result.otx && (
            <div className="border-t border-white/10 pt-1.5">
              <div className="text-white/60">
                OTX pulses: {result.otx.pulse_count}
                {result.otx.country ? ` — ${result.otx.country}` : ""}
                {result.otx.asn ? ` — AS${result.otx.asn}` : ""}
              </div>
            </div>
          )}
          {result.pulses && result.pulses.length > 0 && (
            <div className="border-t border-white/10 pt-1.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                Recent OTX pulses
              </div>
              <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                {result.pulses.map((p, i) => (
                  <div key={i} className="text-white/80">
                    <div className="font-semibold">{p.name}</div>
                    {p.adversary && (
                      <div className="text-white/50 text-[10px]">
                        Adversary: {p.adversary}
                      </div>
                    )}
                    {p.description && (
                      <div className="text-white/60 text-[10px] line-clamp-2">
                        {p.description}
                      </div>
                    )}
                    {p.tags && p.tags.length > 0 && (
                      <div className="text-white/40 text-[9px]">
                        {p.tags.join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
