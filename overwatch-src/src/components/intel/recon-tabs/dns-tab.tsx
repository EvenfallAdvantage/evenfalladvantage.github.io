"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchOsintDns } from "@/lib/intel-client";
import type { IntelDnsResponse } from "@/lib/intel-types";

export function DnsTab() {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IntelDnsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetchOsintDns(domain.trim());
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "DNS lookup failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onSubmit} className="flex gap-2">
        <input
          type="text"
          value={domain}
          onChange={(e) => setDomain(e.target.value)}
          placeholder="example.com"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-white/30"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
        />
        <button
          type="submit"
          disabled={busy || !domain.trim()}
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

      {result && (
        <div className="space-y-2 text-[11px] font-mono">
          <div className="text-white/40">
            {result.summary.total_records} records
          </div>
          {result.summary.ip_addresses.length > 0 && (
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                A records
              </div>
              {result.summary.ip_addresses.map((ip) => (
                <div key={ip} className="text-white/80">
                  {ip}
                </div>
              ))}
            </div>
          )}
          {result.summary.mail_servers.length > 0 && (
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                MX
              </div>
              {result.summary.mail_servers.map((m) => (
                <div key={m} className="text-white/80">
                  {m}
                </div>
              ))}
            </div>
          )}
          {result.summary.nameservers.length > 0 && (
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                NS
              </div>
              {result.summary.nameservers.map((n) => (
                <div key={n} className="text-white/80">
                  {n}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
