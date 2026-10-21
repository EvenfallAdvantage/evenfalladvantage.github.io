"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CheckCircle2, AlertTriangle, XCircle, HelpCircle, RefreshCw } from "lucide-react";
import { setVisibleInterval } from "@/lib/visible-interval";
import { fetchHealth, type HealthSnapshot } from "@/lib/status/health";

const OVERALL: Record<HealthSnapshot["status"], { text: string; cls: string; Icon: typeof CheckCircle2 }> = {
  ok: { text: "All systems operational", cls: "bg-emerald-700 text-white", Icon: CheckCircle2 },
  degraded: { text: "Some features are degraded", cls: "bg-amber-300 text-[#0b1422]", Icon: AlertTriangle },
  down: { text: "Major outage", cls: "bg-red-700 text-white", Icon: XCircle },
  unknown: { text: "Status check unavailable", cls: "bg-slate-600 text-white", Icon: HelpCircle },
};

/** Public status page: live backend checks every 60 s. /overwatch/status/ */
export default function StatusPage() {
  const [snap, setSnap] = useState<HealthSnapshot | null>(null);
  const [busy, setBusy] = useState(false);

  async function check() { setBusy(true); setSnap(await fetchHealth()); setBusy(false); }
  useEffect(() => {
    const poll = () => { void fetchHealth().then(setSnap); };
    poll();
    return setVisibleInterval(poll, 60_000);
  }, []);

  const o = OVERALL[snap?.status ?? "unknown"];
  return (
    <main className="min-h-screen bg-[#0b1422] text-white">
      <div className="mx-auto max-w-2xl px-6 py-12 space-y-6">
        <header className="flex items-center justify-between">
          <h1 className="font-mono text-2xl font-bold">OVERWATCH STATUS</h1>
          <Link href="/" className="text-sm text-white/80 underline underline-offset-2">Back to Overwatch</Link>
        </header>
        <div role="status" aria-live="polite" className={`flex items-center gap-3 rounded-xl px-5 py-4 font-semibold ${snap ? o.cls : "bg-slate-700 text-white"}`}>
          <o.Icon className="h-5 w-5" aria-hidden="true" /> {snap ? o.text : "Checking…"}
        </div>
        <ul className="divide-y divide-white/10 rounded-xl border border-white/10">
          {(snap?.components ?? []).map((c) => (
            <li key={c.key} className="flex items-center justify-between px-5 py-3">
              <span>{c.label}</span>
              <span className="flex items-center gap-2 text-sm">
                {c.ms !== null && <span className="text-white/80">{c.ms} ms</span>}
                {c.ok === true ? <><CheckCircle2 className="h-4 w-4 text-emerald-300" aria-hidden="true" /> Operational</>
                  : c.ok === false ? <><XCircle className="h-4 w-4 text-red-300" aria-hidden="true" /> Down</>
                  : <><HelpCircle className="h-4 w-4 text-white/80" aria-hidden="true" /> Unknown</>}
              </span>
            </li>
          ))}
        </ul>
        <div className="flex items-center justify-between text-sm text-white/80">
          <span>Last checked {snap ? new Date(snap.checkedAt).toLocaleString() : "…"}</span>
          <button type="button" onClick={() => void check()} disabled={busy} className="inline-flex min-h-[32px] items-center gap-1.5 rounded-lg border border-white/20 px-3 hover:bg-white/10 disabled:opacity-60">
            <RefreshCw className={`h-4 w-4 ${busy ? "animate-spin" : ""}`} aria-hidden="true" /> Refresh
          </button>
        </div>
        <p className="text-sm text-white/80">
          Overwatch runs on GitHub Pages (website) and Supabase (database, sign-in, storage). Our uptime target is 99.5% per month; this is a target, not a contractual SLA.
          Report a problem: <a className="underline" href="mailto:contact@evenfalladvantage.com">contact@evenfalladvantage.com</a>
        </p>
      </div>
    </main>
  );
}
