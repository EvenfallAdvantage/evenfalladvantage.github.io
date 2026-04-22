"use client";

import { useState, useEffect } from "react";
import { Coffee, UtensilsCrossed, Loader2, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { startBreak, endBreak, getActiveBreak, getTimesheetBreaks, type TimesheetBreak, type BreakType } from "@/lib/supabase/db";
import { logger } from "@/lib/logger";

interface BreakTrackerProps {
  timesheetId: string;
}

export function BreakTracker({ timesheetId }: BreakTrackerProps) {
  const [activeBreak, setActiveBreak] = useState<TimesheetBreak | null>(null);
  const [breaks, setBreaks] = useState<TimesheetBreak[]>([]);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState(false);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getActiveBreak(timesheetId), getTimesheetBreaks(timesheetId)])
      .then(([active, all]) => {
        if (!cancelled) { setActiveBreak(active); setBreaks(all); }
      })
      .catch((e) => { logger.swallow("break-tracker:load", e, "warn"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [timesheetId]);

  // Elapsed timer for active break
  useEffect(() => {
    if (!activeBreak) { setElapsed(0); return; }
    const start = new Date(activeBreak.startTime).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [activeBreak]);

  async function handleStart(type: BreakType) {
    setActing(true);
    try {
      const id = await startBreak(timesheetId, type);
      if (id) {
        const active = await getActiveBreak(timesheetId);
        setActiveBreak(active);
        toast.success(`${type === "meal" ? "Meal" : "Rest"} break started`);
      } else {
        toast.error("Failed to start break");
      }
    } catch { toast.error("Failed to start break"); }
    finally { setActing(false); }
  }

  async function handleEnd() {
    if (!activeBreak) return;
    setActing(true);
    try {
      const ok = await endBreak(activeBreak.id);
      if (ok) {
        setActiveBreak(null);
        const all = await getTimesheetBreaks(timesheetId);
        setBreaks(all);
        toast.success("Break ended");
      } else {
        toast.error("Failed to end break");
      }
    } catch { toast.error("Failed to end break"); }
    finally { setActing(false); }
  }

  const formatElapsed = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const totalBreakMinutes = breaks
    .filter((b) => b.durationMinutes != null)
    .reduce((sum, b) => sum + (b.durationMinutes ?? 0), 0);

  if (loading) return null;

  return (
    <div className="rounded-xl border border-border/50 bg-card/50 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
          <Coffee className="h-3 w-3" /> Breaks
          {totalBreakMinutes > 0 && (
            <Badge variant="outline" className="text-[9px] ml-1">{totalBreakMinutes}m total</Badge>
          )}
        </p>
      </div>

      {/* Active break indicator */}
      {activeBreak && (
        <div className="flex items-center gap-3 rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-500/20">
            {activeBreak.breakType === "meal" ? (
              <UtensilsCrossed className="h-4 w-4 text-amber-500" />
            ) : (
              <Coffee className="h-4 w-4 text-amber-500" />
            )}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold text-amber-600">
              {activeBreak.breakType === "meal" ? "Meal Break" : "Rest Break"} in Progress
            </p>
            <p className="text-lg font-bold font-mono text-amber-500">{formatElapsed(elapsed)}</p>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-500/30"
            onClick={handleEnd} disabled={acting}>
            {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Square className="h-3 w-3" />}
            End Break
          </Button>
        </div>
      )}

      {/* Start break buttons (only when no active break) */}
      {!activeBreak && (
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1"
            onClick={() => handleStart("meal")} disabled={acting}>
            {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <UtensilsCrossed className="h-3 w-3" />}
            Meal Break
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs flex-1"
            onClick={() => handleStart("rest")} disabled={acting}>
            {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Coffee className="h-3 w-3" />}
            Rest Break
          </Button>
        </div>
      )}

      {/* Break history */}
      {breaks.length > 0 && (
        <div className="space-y-1">
          {breaks.filter((b) => b.durationMinutes != null).map((b) => (
            <div key={b.id} className="flex items-center gap-2 text-[10px] text-muted-foreground">
              {b.breakType === "meal" ? <UtensilsCrossed className="h-2.5 w-2.5" /> : <Coffee className="h-2.5 w-2.5" />}
              <span>{b.breakType === "meal" ? "Meal" : "Rest"}</span>
              <span className="font-mono">{b.durationMinutes}m</span>
              <span className="text-muted-foreground/40">
                {new Date(b.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
