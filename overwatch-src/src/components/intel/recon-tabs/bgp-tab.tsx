"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchOsintBgp } from "@/lib/intel-client";
import type { IntelBgpResponse } from "@/lib/intel-types";

interface AsnDetail {
  name?: string;
  description_short?: string;
  country_code?: string;
  asn?: number;
}
interface BgpPrefix {
  prefix?: string;
  ip?: string;
  cidr?: number;
  name?: string;
  description?: string;
}

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
      setError(err instanceof Error ? err.message : "BGP lookup failed");
    } finally {
      setBusy(false);
    }
  }

  const asnDetail = result?.asn as AsnDetail | undefined;

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

      {result && (
        <div className="space-y-2 text-[11px] font-mono">
          {result.type === "asn" && asnDetail && (
            <div>
              <div className="text-white/90 font-bold">
                AS{asnDetail.asn} — {asnDetail.name}
              </div>
              {asnDetail.description_short && (
                <div className="text-white/60">
                  {asnDetail.description_short}
                </div>
              )}
              {asnDetail.country_code && (
                <div className="text-white/40 text-[10px]">
                  {asnDetail.country_code}
                </div>
              )}
            </div>
          )}

          {result.prefixes && (
            <div className="border-t border-white/10 pt-1.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Prefixes ({result.prefixes.total_v4} IPv4
                {result.prefixes.total_v6 > 0
                  ? `, ${result.prefixes.total_v6} IPv6`
                  : ""}
                )
              </div>
              <div className="max-h-40 overflow-y-auto pr-1">
                {(result.prefixes.ipv4 as BgpPrefix[]).map((p, i) => (
                  <div key={i} className="text-white/70">
                    {p.prefix ?? `${p.ip}/${p.cidr}`}
                    {p.description && (
                      <span className="text-white/40">
                        {" "}
                        — {p.description}
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.peers && (
            <div className="border-t border-white/10 pt-1.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Peers ({result.peers.total})
              </div>
              {(result.peers.upstream as AsnDetail[])
                .slice(0, 10)
                .map((peer, i) => (
                  <div key={i} className="text-white/70">
                    AS{peer.asn}
                    {peer.name ? ` — ${peer.name}` : ""}
                  </div>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
