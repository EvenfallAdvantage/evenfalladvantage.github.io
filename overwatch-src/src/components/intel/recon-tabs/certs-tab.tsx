"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchOsintCerts } from "@/lib/intel-client";
import type { IntelCertsResponse } from "@/lib/intel-types";

export function CertsTab() {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IntelCertsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetchOsintCerts(domain.trim());
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Certificate lookup failed");
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
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Search"}
        </button>
      </form>

      {error && (
        <div className="text-[11px] text-red-300 font-mono">{error}</div>
      )}

      {result && (
        <div className="space-y-2 text-[11px] font-mono">
          <div className="text-white/60">
            {result.total_certs} certs · {result.unique_subdomains} unique
            subdomains
          </div>

          {result.subdomains.length > 0 && (
            <div className="border-t border-white/10 pt-1.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                Subdomains
              </div>
              <div className="max-h-48 overflow-y-auto pr-1 space-y-0.5">
                {result.subdomains.map((s) => (
                  <div key={s} className="text-white/80 truncate">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          )}

          {result.certificates.length > 0 && (
            <div className="border-t border-white/10 pt-1.5">
              <div className="text-white/40 text-[10px] uppercase tracking-wider mb-1">
                Recent certificates
              </div>
              <div className="max-h-48 overflow-y-auto pr-1 space-y-1.5">
                {result.certificates.slice(0, 20).map((c) => (
                  <div key={c.id} className="text-white/80 leading-snug">
                    <div className="truncate">{c.common_name}</div>
                    <div className="text-[9px] text-white/40">
                      {c.issuer} · {c.not_before?.split("T")[0]} →{" "}
                      {c.not_after?.split("T")[0]}
                    </div>
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
