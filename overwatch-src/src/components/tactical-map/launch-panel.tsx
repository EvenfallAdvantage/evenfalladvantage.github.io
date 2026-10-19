"use client";

/** Launch details card with the estimated-ascent replay (Launch Library 2 data). */
import { useEffect, useRef, useState } from "react";
import { Play, Square, X } from "lucide-react";
import { estimatedAscent, LL2_CREDIT, REPLAY_SPEEDS, type Launch } from "@/lib/map/launches";
import { startAscentReplay, type ReplayHandle } from "./hooks/use-launches-layer";
import type { CesiumRef } from "./hooks/cesium-layer-types";

export function LaunchPanel({ launch, viewerRef, cesiumRef, onClose }: { launch: Launch; viewerRef: CesiumRef; cesiumRef: CesiumRef; onClose: () => void }) {
  const [speed, setSpeed] = useState<number>(1);
  const [progress, setProgress] = useState<number | null>(null);
  const handle = useRef<ReplayHandle | null>(null);
  const canReplay = !!estimatedAscent(launch, 2);
  const stop = () => { handle.current?.stop(); handle.current = null; setProgress(null); };
  useEffect(() => () => { handle.current?.stop(); handle.current = null; }, [launch.id]);
  const play = () => {
    stop();
    const v = viewerRef.current, C = cesiumRef.current;
    if (!v || !C) return;
    setProgress(0);
    handle.current = startAscentReplay(v, C, launch, { speed, onProgress: setProgress, onDone: () => setProgress(1) });
  };
  const when = new Date(launch.net);
  return (
    <div className="absolute z-30 right-3 bottom-20 w-[min(92vw,360px)] rounded-lg border border-white/15 bg-black/85 text-white shadow-2xl backdrop-blur text-[11px]" role="dialog" aria-label="Rocket launch" data-testid="launch-panel">
      <div className="flex items-start gap-2 px-3 pt-2.5">
        <div className="min-w-0">
          <div className="font-bold text-[12px] leading-tight">{launch.name}</div>
          <div className="text-white/55 font-mono">{Number.isNaN(when.getTime()) ? launch.net : when.toISOString().replace("T", " ").slice(0, 16) + " UTC"} · {launch.status}</div>
        </div>
        <button onClick={() => { stop(); onClose(); }} className="ml-auto text-white/60 hover:text-white" aria-label="Close launch"><X className="h-4 w-4" /></button>
      </div>
      <div className="px-3 py-2 space-y-0.5 text-white/75">
        {launch.provider && <div>{launch.provider}{launch.rocket ? ` · ${launch.rocket}` : ""}</div>}
        {launch.padName && <div className="text-white/55">{launch.padName}{launch.location ? `, ${launch.location}` : ""}</div>}
        {launch.orbit && <div className="text-white/55">Target orbit: {launch.orbit}</div>}
      </div>
      <div className="flex items-center gap-2 px-3 pb-2">
        {canReplay ? (
          progress == null || progress >= 1 ? (
            <button onClick={play} className="inline-flex items-center gap-1 rounded bg-orange-500 px-2 py-1 font-bold text-black"><Play className="h-3 w-3" /> Replay ascent</button>
          ) : (
            <button onClick={stop} className="inline-flex items-center gap-1 rounded bg-white/15 px-2 py-1"><Square className="h-3 w-3" /> Stop</button>
          )
        ) : <span className="text-red-300/80">No ascent path for a failed launch</span>}
        {canReplay && (
          <div className="flex gap-0.5" role="radiogroup" aria-label="Replay speed">
            {REPLAY_SPEEDS.map((s) => <button key={s} role="radio" aria-checked={speed === s} onClick={() => setSpeed(s)} className={`rounded px-1.5 py-0.5 font-mono ${speed === s ? "bg-white/25" : "text-white/50"}`}>{s}×</button>)}
          </div>
        )}
        {progress != null && <div className="ml-auto h-1 w-16 rounded bg-white/15"><div className="h-1 rounded bg-orange-400" style={{ width: `${Math.round(progress * 100)}%` }} /></div>}
      </div>
      <div className="px-3 pb-2.5 text-[10px] text-white/45">Ascent path is a coarse estimate from the pad and target orbit, not telemetry. {LL2_CREDIT}.</div>
    </div>
  );
}
