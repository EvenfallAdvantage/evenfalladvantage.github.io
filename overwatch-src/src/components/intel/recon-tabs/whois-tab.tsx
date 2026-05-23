"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { fetchOsintWhois } from "@/lib/intel-client";
import type { IntelWhoisResponse } from "@/lib/intel-types";

const gradeColors: Record<string, string> = {
  A: "#10b981",
  B: "#84cc16",
  C: "#fbbf24",
  F: "#ef4444",
};

export function WhoisTab() {
  const [domain, setDomain] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IntelWhoisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!domain.trim()) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const r = await fetchOsintWhois(domain.trim());
      setResult(r);
    } catch (err) {
      setError(err instanceof Error ? err.message : "WHOIS lookup failed");
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
          {result.rdap && (
            <div>
              <div className="text-white/40 text-[10px] uppercase tracking-wider">
                Registration
              </div>
              {result.registration && (
                <div className="text-white/80">
                  Registered: {result.registration.split("T")[0]}
                </div>
              )}
              {result.expiration && (
                <div className="text-white/80">
                  Expires: {result.expiration.split("T")[0]}
                </div>
              )}
              {result.last_changed && (
                <div className="text-white/60">
                  Last changed: {result.last_changed.split("T")[0]}
                </div>
              )}
              {result.rdap.nameservers.length > 0 && (
                <div className="mt-1.5">
                  <div className="text-white/40 text-[10px]">Nameservers</div>
                  {result.rdap.nameservers.map((n) => (
                    <div key={n} className="text-white/70">
                      {n}
                    </div>
                  ))}
                </div>
              )}
              {result.rdap.entities.length > 0 && (
                <div className="mt-1.5">
                  <div className="text-white/40 text-[10px]">Entities</div>
                  {result.rdap.entities.map((e, i) => (
                    <div key={i} className="text-white/70">
                      {(e.name || e.org) ?? e.handle}
                      {e.roles.length > 0 && (
                        <span className="text-white/40">
                          {" "}
                          ({e.roles.join(", ")})
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {result.security_score && (
            <div className="border-t border-white/10 pt-2">
              <div className="flex items-center gap-2">
                <span className="text-white/40 text-[10px] uppercase tracking-wider">
                  Security
                </span>
                <span
                  className="text-base font-bold"
                  style={{ color: gradeColors[result.security_score.grade] }}
                >
                  {result.security_score.grade}
                </span>
                <span className="text-white/50">
                  {result.security_score.score}/{result.security_score.max}
                </span>
              </div>
              {result.http?.headers && (
                <div className="mt-1 space-y-0.5 text-[10px]">
                  {Object.entries(result.http.headers).map(([k, v]) => (
                    <div key={k} className="text-white/60 truncate">
                      <span className="text-white/40">{k}:</span> {v}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
