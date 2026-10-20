"use client";

import { useEffect, useState } from "react";
import { MapPin, MapPinOff, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { getQuickFix, previewPostFence, formatDistance, type Fix } from "@/lib/geo/position";

/** One GPS fix for the open clock-in modal (null while locating). */
export function useClockFix(): { fix: Fix | null; locating: boolean } {
  const [state, setState] = useState<{ fix: Fix | null; locating: boolean }>({ fix: null, locating: true });
  useEffect(() => {
    let live = true;
    getQuickFix().then((fix) => { if (live) setState({ fix, locating: false }); });
    return () => { live = false; };
  }, []);
  return state;
}

export function LocationStatusBar({ fix, locating }: { fix: Fix | null; locating: boolean }) {
  if (locating) return (
    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground" data-testid="clock-location">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking your location…
    </div>
  );
  if (!fix) return (
    <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-200" data-testid="clock-location">
      <MapPinOff className="mt-0.5 h-3.5 w-3.5 shrink-0" />
      <span>Location is off or unavailable. You can still clock in, but it will be flagged for your supervisor.</span>
    </div>
  );
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/50 bg-muted/20 px-3 py-2 text-xs text-muted-foreground" data-testid="clock-location">
      <MapPin className="h-3.5 w-3.5 text-green-500" /> Location found{fix.accuracy ? ` (±${Math.round(fix.accuracy)} m)` : ""}. It&apos;s saved with your clock-in.
    </div>
  );
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ShiftFenceChip({ fix, locating, shift }: { fix: Fix | null; locating: boolean; shift: any }) {
  if (locating) return null;
  const ev = shift?.events ?? {};
  const { verdict, distance } = previewPostFence(fix, { lat: ev.location_lat, lng: ev.location_lng, radius: ev.geofence_radius_meters });
  if (verdict === "no_fence") return null;
  const cls = verdict === "inside" ? "text-green-400 bg-green-500/10 border-green-500/30" : "text-amber-300 bg-amber-500/10 border-amber-500/40";
  const Icon = verdict === "inside" ? CheckCircle2 : AlertTriangle;
  const text = verdict === "inside" ? `On site · ${formatDistance(distance)} from post`
    : verdict === "outside" ? `${formatDistance(distance)} from post · outside the ${ev.geofence_radius_meters} m fence, will be flagged`
    : "No location · will be flagged";
  return <span className={`mt-1.5 inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] ${cls}`} data-testid="shift-fence-chip"><Icon className="h-3 w-3" />{text}</span>;
}

/** Self-contained bar (used by the dashboard duty card's clock-in modal). */
export function SelfLocationBar() {
  const s = useClockFix();
  return <LocationStatusBar {...s} />;
}

/** Supervisor badge for a timesheet row's GPS / fence verdict. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function TimesheetVerifyBadge({ t }: { t: any }) {
  const parts: { text: string; warn: boolean }[] = [];
  const v = t?.clock_in_geofence as string | undefined;
  if (v === "inside") parts.push({ text: `In fence${t.clock_in_distance_m != null ? ` · ${formatDistance(t.clock_in_distance_m)}` : ""}`, warn: false });
  if (v === "outside") parts.push({ text: `Outside fence${t.clock_in_distance_m != null ? ` · ${formatDistance(t.clock_in_distance_m)}` : ""}`, warn: true });
  if (v === "no_gps") parts.push({ text: "No GPS", warn: true });
  if (t?.clock_out_geofence === "outside") parts.push({ text: "Out: outside fence", warn: true });
  if (t?.clock_method === "app_offline") parts.push({ text: "Offline (synced later)", warn: true });
  if (!parts.length) return null;
  return (
    <span className="inline-flex flex-wrap gap-1" data-testid="timesheet-verify">
      {parts.map((p) => (
        <span key={p.text} className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${p.warn ? "bg-amber-500/15 text-amber-400" : "bg-green-500/15 text-green-400"}`}>{p.text}</span>
      ))}
    </span>
  );
}
