"use client";

/**
 * Global status bar — fixed bottom-center ribbon on the tactical map.
 * Surfaces three at-a-glance signals refreshed every 30 minutes:
 *
 *   - Exchanges open / total (market hours indicator)
 *   - CISA KEV CVE count + threat level
 *   - Top 3 country risk codes (with severity color dot)
 *
 * Self-fetches; no parent state. Render gated by an `enabled` prop so the
 * tactical-map shell can hide it for non-admin users if needed.
 */

import { useEffect, useState } from "react";
import { Loader2, Info } from "lucide-react";
import {
  fetchIntelCountryRisk,
  fetchIntelCyberThreats,
} from "@/lib/intel-client";
import type {
  IntelCountryRiskResponse,
  IntelCyberThreatsResponse,
} from "@/lib/intel-types";
import { logger } from "@/lib/logger";

interface GlobalStatusBarProps {
  enabled?: boolean;
  onOpenAttribution?: () => void;
}

const riskColors: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  ELEVATED: "#fbbf24",
  LOW: "#10b981",
};
const threatColors: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  ELEVATED: "#fbbf24",
};

const REFRESH_MS = 30 * 60_000;

export function GlobalStatusBar({ enabled = true, onOpenAttribution }: GlobalStatusBarProps) {
  const [risk, setRisk] = useState<IntelCountryRiskResponse | null>(null);
  const [cyber, setCyber] = useState<IntelCyberThreatsResponse | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    async function load() {
      setBusy(true);
      try {
        const [r, c] = await Promise.all([
          fetchIntelCountryRisk().catch((e) => {
            logger.swallow("intel:global-status:risk", e, "debug");
            return null;
          }),
          fetchIntelCyberThreats().catch((e) => {
            logger.swallow("intel:global-status:cyber", e, "debug");
            return null;
          }),
        ]);
        if (cancelled) return;
        if (r) setRisk(r);
        if (c) setCyber(c);
      } finally {
        if (!cancelled) setBusy(false);
      }
    }
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [enabled]);

  if (!enabled) return null;

  const topCountries = risk?.countries.slice(0, 3) ?? [];

  return (
    <div
      className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10 pointer-events-auto rounded-full px-3 py-1.5 flex items-center gap-3 backdrop-blur-sm border border-white/10 text-[10px] font-mono uppercase tracking-wider"
      style={{
        backgroundColor:
          "color-mix(in srgb, var(--brand-primary, #0f1a2e) 88%, transparent)",
        color: "rgba(255,255,255,0.7)",
      }}
    >
      {/* Exchanges */}
      {risk && (
        <div className="flex items-center gap-1">
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{
              backgroundColor: risk.open_exchanges > 0 ? "#10b981" : "#64748b",
            }}
          />
          <span className="text-white/80">
            {risk.open_exchanges}/{risk.total_exchanges}
          </span>
          <span className="text-white/40">exch</span>
        </div>
      )}

      <span className="text-white/20">·</span>

      {/* CVE / threat */}
      {cyber && (
        <div className="flex items-center gap-1" title={`${cyber.stats.cisa_total ?? "?"} total CISA KEV`}>
          <span
            className="inline-block w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: threatColors[cyber.stats.threat_level] ?? "#64748b" }}
          />
          <span className="text-white/80">
            {cyber.stats.active_cves}
          </span>
          <span className="text-white/40">cves · {cyber.stats.threat_level}</span>
        </div>
      )}

      <span className="text-white/20">·</span>

      {/* Top 3 country risks */}
      {topCountries.length > 0 && (
        <div className="flex items-center gap-2">
          {topCountries.map((c) => (
            <div key={c.code} className="flex items-center gap-1" title={`${c.code} risk ${c.risk_score} (${c.tags.join(", ")})`}>
              <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: riskColors[c.risk_level] ?? "#64748b" }}
              />
              <span className="text-white/80">{c.code}</span>
              <span className="text-white/40">{c.risk_score}</span>
            </div>
          ))}
        </div>
      )}

      {busy && (
        <span className="text-white/30">
          <Loader2 className="h-3 w-3 animate-spin inline" />
        </span>
      )}

      {onOpenAttribution && (
        <button
          onClick={onOpenAttribution}
          className="text-white/30 hover:text-white/80 ml-1"
          title="Data sources"
        >
          <Info className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
