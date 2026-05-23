"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchOsintIp } from "@/lib/intel-client";
import type { IntelIpResponse } from "@/lib/intel-types";

export function IpTab() {
  const [ip, setIp] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IntelIpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ip.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetchOsintIp(ip.trim());
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "IP lookup failed");
    } finally {
      setBusy(false);
    }
  }

  const riskColor =
    result?.reputation.risk_level === "HIGH"
      ? "#ef4444"
      : result?.reputation.risk_level === "MEDIUM"
      ? "#f97316"
      : "#10b981";

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={ip}
          onChange={(e) => setIp(e.target.value)}
          placeholder="8.8.8.8"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-white/30"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={busy || !ip.trim()}
          className="px-3 py-1.5 rounded-lg text-[11px] font-semibold transition-colors disabled:opacity-50"
          style={{
            backgroundColor:
              "color-mix(in srgb, var(--brand-accent, #d59b3c) 80%, transparent)",
            color: "var(--brand-primary, #0f1a2e)",
          }}
        >
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Lookup"}
        </button>
      </form>

      {error && (
        <div className="text-[11px] text-red-300 font-mono">{error}</div>
      )}

      {result?.geo && (
        <div className="space-y-1.5 text-[11px] font-mono">
          <div className="flex items-center gap-2">
            <span style={{ color: riskColor }}>
              ● {result.reputation.risk_level}
            </span>
            <span className="text-white/40">{result.geo.country_code}</span>
          </div>
          <div className="text-white/80">
            {result.geo.city}, {result.geo.region}, {result.geo.country}
          </div>
          <div className="text-white/60">
            {result.geo.lat.toFixed(4)}, {result.geo.lon.toFixed(4)} —{" "}
            {result.geo.timezone}
          </div>
          <div className="border-t border-white/10 pt-1.5 mt-1.5">
            <div className="text-white/60">ISP: {result.geo.isp}</div>
            <div className="text-white/60">Org: {result.geo.org}</div>
            <div className="text-white/60">
              {result.geo.as_number} ({result.geo.as_name})
            </div>
          </div>
          <div className="flex gap-3 text-[10px] mt-1">
            {result.reputation.is_proxy && (
              <span style={{ color: "#ef4444" }}>PROXY</span>
            )}
            {result.reputation.is_hosting && (
              <span style={{ color: "#fbbf24" }}>HOSTING</span>
            )}
            {result.reputation.is_mobile && (
              <span className="text-white/60">MOBILE</span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
