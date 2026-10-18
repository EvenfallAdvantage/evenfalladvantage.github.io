"use client";

/** Site Watch list (panel v2 + phone pill). Map-only: no email/SMS/push. */

import { AlertTriangle } from "lucide-react";
import type { SiteAlert } from "@/lib/map/site-proximity";

export function SiteWatchStrip({ alerts, enabled, siteCount, onToggle, onLocate, max = 5 }: {
  alerts: SiteAlert[];
  enabled: boolean;
  siteCount: number;
  onToggle: () => void;
  onLocate: (lat: number, lng: number) => void;
  max?: number;
}) {
  const reds = alerts.filter((a) => a.level === "warning").length;
  return (
    <div className={`rounded-lg border px-2 py-1.5 ${reds ? "border-red-500/40 bg-red-500/10" : alerts.length ? "border-amber-500/40 bg-amber-500/10" : "border-white/10"}`}>
      <div className="flex items-center gap-2">
        <AlertTriangle className={`h-3.5 w-3.5 ${reds ? "text-red-400" : alerts.length ? "text-amber-300" : "text-white/40"}`} />
        <span className="flex-1 text-[10px] font-mono uppercase tracking-wider text-white/70">
          Site Watch{enabled ? (alerts.length ? ` · ${alerts.length}` : "") : " · off"}
        </span>
        <button onClick={onToggle} className="text-[9px] font-mono text-white/45 hover:text-white underline underline-offset-2">{enabled ? "Turn off" : "Turn on"}</button>
      </div>
      {enabled && (
        <div className="mt-1 space-y-0.5">
          {siteCount === 0 && <p className="text-[10px] text-white/45">No active sites with a location yet.</p>}
          {siteCount > 0 && alerts.length === 0 && <p className="text-[10px] text-white/45">All clear near your {siteCount} site{siteCount === 1 ? "" : "s"}.</p>}
          {alerts.slice(0, max).map((a) => (
            <button key={`${a.siteId}-${a.hazardId}`} onClick={() => onLocate(a.lat, a.lng)} className="flex w-full items-start gap-1.5 rounded px-1 py-0.5 text-left hover:bg-white/5">
              <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${a.level === "warning" ? "bg-red-500" : "bg-amber-400"}`} />
              <span className="min-w-0 text-[10px] leading-tight text-white/80">
                <span className="font-semibold">{a.siteName}</span> · {a.title}
                <span className="text-white/40"> {a.distanceKm ? `${a.distanceKm} km` : "at site"}</span>
              </span>
            </button>
          ))}
          {alerts.length > max && <p className="text-[9px] font-mono text-white/35">+{alerts.length - max} more (rings on the map)</p>}
        </div>
      )}
    </div>
  );
}
