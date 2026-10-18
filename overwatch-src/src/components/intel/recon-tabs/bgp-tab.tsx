"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchOsintBgp } from "@/lib/intel-client";
import type { IntelBgpResponse } from "@/lib/intel-types";

export function BgpTab() {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IntelBgpResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetchOsintBgp(query.trim());
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ASN lookup failed");
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
          placeholder="IP or ASN (e.g. AS15169)"
          className="flex-1 bg-white/5 border border-white/10 rounded-lg px-2.5 py-1.5 text-xs text-white placeholder-white/30 font-mono focus:outline-none focus:border-white/30"
          spellCheck={false}
        />
        <button
          type="submit"
          disabled={busy || !query.trim()}
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

      {result?.error && !result.asn && !result.peeringdb && !result.network && (
        <div className="text-[11px] text-white/50 font-mono">{result.error}</div>
      )}

      {result && (
        <div className="space-y-2 text-[11px] font-mono">
          {result.type === "asn" && (result.asn || result.peeringdb) && (
            <div>
              <div className="text-white/90 font-bold">
                AS{result.asn?.number ?? result.query.replace(/^AS/i, "")} — {result.peeringdb?.name || result.asn?.org || result.asn?.name}
              </div>
              {result.asn && (
                <div className="text-white/60">
                  {result.asn.name}{result.asn.country ? ` · ${result.asn.country}` : ""}
                </div>
              )}
              {result.asn?.abuse_email && <div className="text-white/50">Abuse: {result.asn.abuse_email}</div>}
            </div>
          )}

          {result.peeringdb && (
            <div className="border-t border-white/10 pt-1.5 space-y-0.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">PeeringDB</div>
              {result.peeringdb.aka && <div className="text-white/60">{result.peeringdb.aka}</div>}
              <div className="text-white/70">
                {[result.peeringdb.type, result.peeringdb.scope, result.peeringdb.policy && `${result.peeringdb.policy} peering`].filter(Boolean).join(" · ")}
              </div>
              <div className="text-white/60">
                ~{result.peeringdb.prefixes4 ?? "?"} IPv4 / ~{result.peeringdb.prefixes6 ?? "?"} IPv6 prefixes ·{" "}
                {result.peeringdb.ix_count} IXs · {result.peeringdb.fac_count} facilities
              </div>
              {result.peeringdb.url && (
                <a href={result.peeringdb.url} target="_blank" rel="noreferrer" className="text-[10px] text-white/40 underline">View on PeeringDB</a>
              )}
            </div>
          )}

          {result.type === "ip" && result.network && (
            <div>
              <div className="text-white/90 font-bold">{result.network.org || result.network.name}</div>
              <div className="text-white/70">{result.network.cidr.join(", ") || `${result.network.start} – ${result.network.end}`}</div>
              <div className="text-white/50">{result.network.handle}{result.network.country ? ` · ${result.network.country}` : ""}</div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
