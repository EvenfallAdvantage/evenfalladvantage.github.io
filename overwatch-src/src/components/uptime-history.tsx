"use client";

import { useEffect, useState } from "react";
import { dayLevel, fetchUptime, formatPct, uptimeLevel, windowChecks, type UptimeSummary } from "@/lib/status/uptime";

const BAR: Record<string, string> = { green: "bg-emerald-400", amber: "bg-amber-300", red: "bg-red-400", none: "bg-white/15" };

/** 90-day uptime bar + 7/30/90-day figures from get_uptime_summary(). */
export function UptimeHistory() {
  const [u, setU] = useState<UptimeSummary | null | undefined>(undefined);
  useEffect(() => {
    const ac = new AbortController();
    void fetchUptime(ac.signal).then(setU);
    return () => ac.abort();
  }, []);

  if (u === undefined) return <section aria-label="Uptime history" className="rounded-xl border border-white/10 px-5 py-4 text-sm text-white/80">Loading uptime history…</section>;
  if (!u) return <section aria-label="Uptime history" className="rounded-xl border border-white/10 px-5 py-4 text-sm text-white/80">Uptime history is not available yet.</section>;

  const figs: [string, number | null, 7 | 30 | 90][] = [["7 days", u.uptime7d, 7], ["30 days", u.uptime30d, 30], ["90 days", u.uptime90d, 90]];
  return (
    <section aria-labelledby="uptime-h" className="space-y-4 rounded-xl border border-white/10 px-5 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="uptime-h" className="font-mono text-sm font-bold tracking-wider">UPTIME · TARGET {u.target}%</h2>
        <span className="text-xs text-white/80">Checked every 5 min</span>
      </div>
      <dl className="grid grid-cols-3 gap-3">
        {figs.map(([k, v, days]) => {
          const lvl = uptimeLevel(v, u.target, windowChecks(u, days));
          return (
            <div key={k} className="rounded-lg bg-white/[0.04] px-3 py-2">
              <dt className="text-xs text-white/80">{k}</dt>
              <dd className="flex items-center gap-1.5 font-mono text-lg font-bold">
                <span className={`h-2 w-2 shrink-0 rounded-full ${BAR[lvl]}`} aria-hidden="true" />{formatPct(v)}
              </dd>
            </div>
          );
        })}
      </dl>
      <div>
        <ol aria-label="Daily uptime, last 90 days" className="flex h-8 items-stretch gap-[2px]">
          {u.daily.map((d) => {
            const lvl = dayLevel(d, u.target);
            const txt = d.checks ? `${d.day}: ${formatPct(d.pct)} (${d.checks} checks)` : `${d.day}: no data`;
            return <li key={d.day} title={txt} aria-label={txt} className={`flex-1 rounded-[1px] ${BAR[lvl]}`} />;
          })}
        </ol>
        <div className="mt-1 flex justify-between text-xs text-white/80"><span>90 days ago</span><span>Today (UTC)</span></div>
      </div>
      <p className="text-xs text-white/80">
        Measured from inside our backend; it does not see website (Cloudflare/GitHub Pages) outages. An independent external monitor covers those.
      </p>
    </section>
  );
}
