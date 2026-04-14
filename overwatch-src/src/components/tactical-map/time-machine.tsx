"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Pause, SkipBack, SkipForward, Clock, X } from "lucide-react";

interface TimeMachineProps {
  open: boolean;
  onClose: () => void;
  onTimeChange: (timestamp: number) => void;
  /** Max hours back from now */
  maxHours?: number;
}

export function TimeMachine({ open, onClose, onTimeChange, maxHours = 48 }: TimeMachineProps) {
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(4); // playback speed multiplier
  const [offsetMs, setOffsetMs] = useState(0); // 0 = now, negative = past
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const maxOffsetMs = maxHours * 60 * 60 * 1000;

  // Capture mount time once, use it as the "now" baseline for replay calculations
  const [mountTime] = useState(() => Date.now());
  // Current replay timestamp
  const replayTime = mountTime + offsetMs;

  // Playback loop
  useEffect(() => {
    if (!playing || !open) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    intervalRef.current = setInterval(() => {
      setOffsetMs(prev => {
        const next = prev + speed * 60 * 1000; // Each tick advances by speed * 1 minute
        if (next >= 0) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, 200); // 5 ticks per second for smooth playback

    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [playing, speed, open]);

  // Notify parent of time changes
  useEffect(() => {
    onTimeChange(replayTime);
  }, [replayTime, onTimeChange]);

  // Reset when closed — uses cleanup to reset on close, avoiding synchronous setState in effect
  useEffect(() => {
    if (!open) return;
    return () => {
      setPlaying(false);
      setOffsetMs(0);
    };
  }, [open]);

  if (!open) return null;

  const pct = ((maxOffsetMs + offsetMs) / maxOffsetMs) * 100;
  const timeStr = new Date(replayTime).toLocaleString([], {
    month: "short", day: "numeric", hour: "2-digit", minute: "2-digit"
  });
  const hoursAgo = Math.abs(offsetMs) / (60 * 60 * 1000);
  const isLive = offsetMs === 0;

  return (
    <div className="absolute bottom-14 left-3 right-3 z-20 rounded-xl backdrop-blur-md border border-white/10 overflow-hidden"
      style={{ backgroundColor: "color-mix(in srgb, var(--brand-primary, #0f1a2e) 92%, transparent)" }}>

      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-white/50" />
          <span className="text-[10px] font-mono text-white/70">TIME MACHINE</span>
          {isLive ? (
            <span className="text-[9px] font-mono text-green-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> LIVE
            </span>
          ) : (
            <span className="text-[10px] font-mono" style={{ color: "var(--brand-accent, #d59b3c)" }}>
              {timeStr} ({hoursAgo.toFixed(1)}h ago)
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white"><X className="h-3.5 w-3.5" /></button>
      </div>

      {/* Controls + Slider */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Transport controls */}
        <button onClick={() => setOffsetMs(-maxOffsetMs)} className="text-white/50 hover:text-white" title={`Go to ${maxHours}h ago`}>
          <SkipBack className="h-3.5 w-3.5" />
        </button>
        <button onClick={() => setPlaying(!playing)} className="text-white/80 hover:text-white" title={playing ? "Pause" : "Play"}>
          {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </button>
        <button onClick={() => { setOffsetMs(0); setPlaying(false); }} className="text-white/50 hover:text-white" title="Jump to live">
          <SkipForward className="h-3.5 w-3.5" />
        </button>

        {/* Speed selector */}
        <div className="flex items-center gap-0.5 mx-1">
          {[1, 2, 4, 8, 16].map(s => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              className={`text-[8px] font-mono px-1.5 py-0.5 rounded transition-colors ${
                speed === s ? "bg-white/15 text-white" : "text-white/30 hover:text-white/60"
              }`}
            >
              {s}x
            </button>
          ))}
        </div>

        {/* Timeline slider */}
        <div className="flex-1 relative h-6 flex items-center">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={pct}
            onChange={e => {
              const newPct = Number(e.target.value);
              const newOffset = (newPct / 100) * maxOffsetMs - maxOffsetMs;
              setOffsetMs(newOffset);
              setPlaying(false);
            }}
            className="w-full h-1.5 cursor-pointer"
            style={{ accentColor: "var(--brand-accent, #d59b3c)" }}
          />
          {/* Hour markers */}
          <div className="absolute top-4 left-0 right-0 flex justify-between pointer-events-none px-1">
            {Array.from({ length: 5 }, (_, i) => {
              const h = Math.round(maxHours * (i / 4));
              return <span key={i} className="text-[7px] text-white/20 font-mono">{h === 0 ? "now" : `-${h}h`}</span>;
            }).reverse()}
          </div>
        </div>
      </div>
    </div>
  );
}
