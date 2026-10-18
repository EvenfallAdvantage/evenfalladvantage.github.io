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

      {result && !result.network && (
        <div className="text-[11px] text-white/50 font-mono">{result.error ?? "No registry record found"}</div>
      )}

      {result?.network && (
        <div className="space-y-1.5 text-[11px] font-mono">
          <div className="text-white/90 font-bold">
            {result.network.org || result.network.name}
            {result.network.country && <span className="text-white/40 font-normal"> · {result.network.country}</span>}
          </div>
          <div className="text-white/60">
            {result.network.name} ({result.network.handle}){result.network.type ? ` · ${result.network.type}` : ""}
          </div>
          <div className="text-white/70">
            {result.network.cidr.length > 0 ? result.network.cidr.join(", ") : `${result.network.start} – ${result.network.end}`}
          </div>
          {result.ptr && result.ptr.length > 0 && (
            <div className="text-white/60">PTR: {result.ptr.join(", ")}</div>
          )}
          {result.network.abuse_email && (
            <div className="text-white/60">Abuse: {result.network.abuse_email}</div>
          )}
          {result.network.registry_url && (
            <a href={result.network.registry_url} target="_blank" rel="noreferrer" className="text-[10px] text-white/40 underline">
              Registry record (RDAP)
            </a>
          )}
        </div>
      )}
    </div>
  );
}
