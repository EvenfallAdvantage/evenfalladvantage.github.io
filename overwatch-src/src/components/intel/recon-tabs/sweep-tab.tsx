"use client";

/**
 * Subnet sweep tab — invokes the Shodan-backed `/intel-osint-sweep` Edge
 * Function and renders a per-device summary. When `onVisualize` is wired,
 * the result is also forwarded to the parent so the map can draw a pulse
 * + device cone at the geolocated center (matches Osiris's UX).
 */

import { useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { fetchOsintSweep } from "@/lib/intel-client";
import type { SweepResult } from "@/lib/intel-types";

interface SweepTabProps {
  /** Optional camera fly-to. */
  onLocate?: (lat: number, lng: number) => void;
  /** Optional map visualization handler. Reserved for Phase D dossier wiring. */
  onVisualize?: (result: SweepResult) => void;
}

const riskColors: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MEDIUM: "#fbbf24",
  LOW: "#84cc16",
  INFO: "#94a3b8",
};

export function SweepTab({ onLocate, onVisualize }: SweepTabProps) {
  const [ip, setIp] = useState("");
  const [cidr, setCidr] = useState("28");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<SweepResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ip.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetchOsintSweep(ip.trim(), parseInt(cidr, 10));
      setResult(r);
      if (onVisualize) onVisualize(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sweep failed");
    } finally {
      setBusy(false);
    }
  }

  const breakdownEntries = result
    ? Object.entries(result.summary.device_breakdown).sort(
        (a, b) => b[1] - a[1],
      )
    : [];

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="space-y-2">
        <div className="flex gap-2">
          <input
            type="text"
            value={ip}
            onChange={(e) => setIp(e.target.value)}
            placeholder="public IPv4 (e.g. 8.8.8.8)"
            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-white/30"
            spellCheck={false}
          />
          <select
            value={cidr}
            onChange={(e) => setCidr(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-lg px-2 py-1.5 text-xs text-white font-mono focus:outline-none"
          >
            <option value="32">/32</option>
            <option value="30">/30</option>
            <option value="28">/28</option>
            <option value="26">/26</option>
            <option value="24">/24</option>
          </select>
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
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Sweep"}
          </button>
        </div>
        <p className="text-[9px] text-white/40">
          Tight rate limit (2/min). Only public IPs accepted.
        </p>
      </form>

      {error && (
        <div className="text-[11px] text-red-300 font-mono">{error}</div>
      )}

      {result && (
        <div className="space-y-2 text-[11px] font-mono">
          <div className="flex items-start justify-between">
            <div>
              <div className="text-white/90 font-bold">{result.subnet}</div>
              <div className="text-white/60">
                {result.center.city}, {result.center.country} (
                {result.center.countryCode})
              </div>
              <div className="text-white/40 text-[10px]">
                {result.center.asn} — {result.center.isp}
              </div>
            </div>
            {onLocate && (
              <button
                onClick={() => onLocate(result.center.lat, result.center.lng)}
                className="text-white/40 hover:text-white/80"
                title="Locate"
              >
                <MapPin className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="border-t border-white/10 pt-1.5 grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Hosts
              </div>
              <div className="text-white/90">{result.summary.total_hosts}</div>
            </div>
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Responsive
              </div>
              <div className="text-white/90">
                {result.summary.total_responsive}
              </div>
            </div>
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Time
              </div>
              <div className="text-white/90">{result.sweep_time_ms}ms</div>
            </div>
          </div>

          {breakdownEntries.length > 0 && (
            <div className="border-t border-white/10 pt-1.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                Device breakdown
              </div>
              <div className="space-y-0.5">
                {breakdownEntries.map(([type, count]) => (
                  <div
                    key={type}
                    className="flex justify-between text-white/70"
                  >
                    <span>{type}</span>
                    <span className="text-white/50">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.devices.length > 0 && (
            <div className="border-t border-white/10 pt-1.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                Devices ({result.devices.length})
              </div>
              <div className="max-h-64 overflow-y-auto pr-1 space-y-1.5">
                {result.devices.map((d) => (
                  <div
                    key={d.ip}
                    className="bg-white/5 border border-white/5 rounded p-1.5"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: riskColors[d.risk_level] }}
                      />
                      <span className="text-white/90 font-semibold">
                        {d.ip}
                      </span>
                      <span className="text-white/50 text-[10px]">
                        {d.device_type}
                      </span>
                    </div>
                    {d.hostnames.length > 0 && (
                      <div className="text-white/50 text-[10px] mt-0.5 truncate">
                        {d.hostnames.join(", ")}
                      </div>
                    )}
                    {d.ports.length > 0 && (
                      <div className="text-white/40 text-[10px] mt-0.5">
                        ports: {d.ports.slice(0, 12).join(", ")}
                        {d.ports.length > 12 ? "…" : ""}
                      </div>
                    )}
                    {d.vulns.length > 0 && (
                      <div className="text-red-300 text-[10px] mt-0.5">
                        {d.vulns.length} vuln(s): {d.vulns.slice(0, 3).join(", ")}
                        {d.vulns.length > 3 ? "…" : ""}
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
