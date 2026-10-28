"use client";

/** Next-24 h satellite passes over a site (CelesTrak TLEs, satellite.js SGP4). Key it by target so a new site remounts. */
import { useEffect, useState } from "react";
import { Loader2, Satellite, X } from "lucide-react";
import { formatDuration, type SatPass } from "@/lib/map/sat-passes";
import { predictSitePasses } from "./orbit-tracker";

const fmtTime = (ms: number) => new Date(ms).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const fmtDay = (ms: number) => new Date(ms).toLocaleDateString([], { weekday: "short" });
const tzLabel = () => new Date().toLocaleTimeString([], { timeZoneName: "short" }).split(" ").pop() ?? "";

export function SatPassesPanel({ target, onClose }: { target: { label: string; lat: number; lng: number }; onClose: () => void }) {
  const [state, setState] = useState<{ status: "loading" } | { status: "ok"; passes: SatPass[]; sats: number } | { status: "error" }>({ status: "loading" });
  const [filter, setFilter] = useState<"all" | "imaging" | "station">("all");

  useEffect(() => {
    let live = true;
    predictSitePasses({ lat: target.lat, lng: target.lng })
      .then(({ passes, satellites }) => { if (live) setState({ status: "ok", passes, sats: satellites }); })
      .catch(() => { if (live) setState({ status: "error" }); });
    return () => { live = false; };
  }, [target.lat, target.lng]);

  const today = new Date().toDateString();
  const rows = state.status === "ok" ? state.passes.filter((p) => filter === "all" || p.kind === filter) : [];

  return (
    <div className="relative z-30 w-72 max-w-full rounded-lg border border-white/10 bg-black/75 backdrop-blur-md text-white/90 shadow-lg pointer-events-auto" data-testid="sat-passes">
      <div className="flex items-center gap-2 px-2.5 py-2 border-b border-white/10">
        <Satellite className="h-4 w-4 text-cyan-300 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="text-xs truncate">Satellite passes · {target.label}</div>
          <div className="text-[10px] text-white/45">Next 24 h · above 10° · times {tzLabel()}</div>
        </div>
        <button onClick={onClose} aria-label="Close satellite passes" className="text-white/50 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </div>
      <div className="flex gap-1 px-2.5 pt-1.5 text-[10px] font-mono">
        {(["all", "imaging", "station"] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`px-2 py-0.5 rounded-full ${filter === f ? "bg-cyan-500/25 text-cyan-100" : "bg-white/5 text-white/55 hover:bg-white/10"}`}>
            {f === "all" ? "All" : f === "imaging" ? "Imaging" : "Stations"}
          </button>
        ))}
      </div>
      <div className="max-h-64 overflow-y-auto py-1 text-[11px] font-mono">
        {state.status === "loading" && <div className="flex items-center gap-2 px-2.5 py-2 text-white/50"><Loader2 className="h-3.5 w-3.5 animate-spin" />Computing passes…</div>}
        {state.status === "error" && <div className="px-2.5 py-2 text-white/50">Orbit data unavailable — try again later.</div>}
        {state.status === "ok" && rows.length === 0 && <div className="px-2.5 py-2 text-white/50">No passes above 10° in the next 24 h.</div>}
        {rows.map((p) => (
          <div key={`${p.name}-${p.riseMs}`} className="flex items-center gap-2 px-2.5 py-1" title={`Rise ${fmtTime(p.riseMs)} · peak ${fmtTime(p.peakMs)} · set ${fmtTime(p.setMs)}`}>
            <span className="w-16 text-white/80">{new Date(p.riseMs).toDateString() === today ? "" : `${fmtDay(p.riseMs)} `}{fmtTime(p.riseMs)}</span>
            <span className={`flex-1 truncate ${p.kind === "station" ? "text-amber-200" : "text-cyan-100"}`}>{p.name}</span>
            <span className="w-10 text-right text-white/70">{Math.round(p.maxElDeg)}°</span>
            <span className="w-14 text-right text-white/45">{formatDuration(p.setMs - p.riseMs)}</span>
          </div>
        ))}
      </div>
      <div className="px-2.5 py-1 text-[9px] text-white/35 border-t border-white/10">
        Orbits: CelesTrak TLEs · SGP4 via satellite.js (MIT){state.status === "ok" ? ` · ${state.sats} satellites` : ""}
      </div>
    </div>
  );
}
