"use client";
/**
 * Day picker for the "Daily" basemap (NASA GIBS VIIRS true colour, public
 * domain). Lets a user look at a site on a past date, back to the start of
 * the record. Not saved to map preferences: it resets to the latest day on
 * reload, which is what most users expect from "Daily".
 */
import { GIBS_FIRST_DAY, clampGibsDay, gibsDate } from "@/lib/map/basemap-sources";

export function GibsDateChip({ day, onChange }: { day: string | null; onChange: (day: string | null) => void }) {
  const latest = gibsDate();
  const shown = clampGibsDay(day);
  const step = (days: number) => {
    const d = new Date(`${shown}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    const next = clampGibsDay(d.toISOString().slice(0, 10));
    onChange(next === latest ? null : next);
  };
  return (
    <div
      data-testid="gibs-date-chip"
      className="absolute bottom-[6.5rem] left-3 z-20 flex items-center gap-1 rounded-full bg-black/60 backdrop-blur-sm border border-white/15 px-2 py-0.5 text-[10px] font-mono text-white/85"
      title="NASA GIBS / VIIRS daily true colour (public domain). About 250 m per pixel; cloud is part of the picture."
    >
      <span className="text-white/60">NASA daily</span>
      <button type="button" aria-label="Previous day" onClick={() => step(-1)} disabled={shown <= GIBS_FIRST_DAY} className="px-1 hover:text-white disabled:opacity-30">‹</button>
      <input
        type="date"
        aria-label="Imagery date"
        value={shown}
        min={GIBS_FIRST_DAY}
        max={latest}
        onChange={(e) => { const v = clampGibsDay(e.target.value); onChange(v === latest ? null : v); }}
        className="bg-transparent text-white/90 [color-scheme:dark] w-[7.2rem] focus:outline-none"
      />
      <button type="button" aria-label="Next day" onClick={() => step(1)} disabled={shown >= latest} className="px-1 hover:text-white disabled:opacity-30">›</button>
      {day && (
        <button type="button" onClick={() => onChange(null)} className="ml-0.5 text-cyan-300/90 hover:text-cyan-200">latest</button>
      )}
    </div>
  );
}
