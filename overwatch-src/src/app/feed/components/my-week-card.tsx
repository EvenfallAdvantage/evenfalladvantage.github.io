"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { CalendarDays, MapPin, Timer, ChevronRight, CalendarX } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserShifts } from "@/lib/supabase/db-operations";
import { getTimesheetsForDateRange, getOvertimeConfig, DEFAULT_OT_CONFIG } from "@/lib/supabase/db";
import { parseUTC } from "@/lib/parse-utc";
import { workweekStart, sumWorkedHours, countdownLabel } from "@/lib/dashboard/week";
import { logger } from "@/lib/logger";
import { WidgetEmpty, WidgetSkeleton } from "./widget-states";

type Shift = { id: string; start_time: string; end_time: string; role?: string | null; events?: { name?: string; location?: string | null } | null };

/** Officer side-rail card: next shift with countdown, and hours this week vs the overtime threshold. */
export function MyWeekCard({ activeCompanyId }: { activeCompanyId: string }) {
  const [next, setNext] = useState<Shift | null>(null);
  const [upcomingCount, setUpcomingCount] = useState(0);
  const [hours, setHours] = useState(0);
  const [threshold, setThreshold] = useState(DEFAULT_OT_CONFIG.weeklyThreshold);
  const [loaded, setLoaded] = useState(false);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    (async () => {
      const cfg = await getOvertimeConfig(activeCompanyId).catch(() => DEFAULT_OT_CONFIG);
      const start = workweekStart(new Date(), cfg.weekStartDay);
      const [shifts, sheets] = await Promise.all([
        getUserShifts(activeCompanyId).catch(() => []),
        getTimesheetsForDateRange(start.toISOString(), new Date().toISOString(), activeCompanyId).catch(() => []),
      ]);
      if (cancelled) return;
      const nowD = new Date();
      const upcoming = ((shifts ?? []) as Shift[]).filter((s) => parseUTC(s.end_time) > nowD)
        .sort((a, b) => parseUTC(a.start_time).getTime() - parseUTC(b.start_time).getTime());
      setNext(upcoming[0] ?? null);
      setUpcomingCount(upcoming.filter((s) => parseUTC(s.start_time).getTime() - nowD.getTime() < 7 * 864e5).length);
      setHours(sumWorkedHours(sheets as never));
      setThreshold(cfg.weeklyThreshold || DEFAULT_OT_CONFIG.weeklyThreshold);
    })().catch((e) => logger.swallow("my-week:load", e, "warn")).finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  if (!loaded) return <WidgetSkeleton rows={3} />;

  const pct = Math.min(100, Math.round((hours / threshold) * 100));
  const tone = hours >= threshold ? "bg-red-500" : hours >= threshold - 5 ? "bg-amber-500" : "bg-primary";

  return (
    <Card className="border-border/40">
      <CardContent className="p-5 space-y-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
          <CalendarDays className="h-3.5 w-3.5" /> My Week
        </h3>

        {next ? (
          <Link href="/schedule" className="group block rounded-xl border border-border/40 bg-muted/20 p-3 hover:border-primary/30">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold">Next shift</span>
              <Badge className="text-[10px] bg-primary/15 text-primary border-0">{countdownLabel(parseUTC(next.start_time).getTime(), now)}</Badge>
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground" />
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {parseUTC(next.start_time).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })} ·{" "}
              {parseUTC(next.start_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}–{parseUTC(next.end_time).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
            </p>
            {next.events?.name && (
              <p className="mt-0.5 flex items-center gap-1 text-[11px] text-muted-foreground/80 truncate">
                <MapPin className="h-3 w-3 shrink-0" /> {next.events.name}{next.events.location ? ` @ ${next.events.location}` : ""}
              </p>
            )}
            {upcomingCount > 1 && <p className="mt-1 text-[10px] text-muted-foreground">{upcomingCount} shifts in the next 7 days</p>}
          </Link>
        ) : (
          <WidgetEmpty icon={CalendarX} title="No upcoming shifts" hint="New assignments will show here." />
        )}

        <div>
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 text-muted-foreground"><Timer className="h-3.5 w-3.5" /> Hours this week</span>
            <span className="font-mono font-semibold">{hours}h <span className="text-muted-foreground font-normal">/ {threshold}h</span></span>
          </div>
          <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-muted" role="progressbar" aria-valuenow={hours} aria-valuemin={0} aria-valuemax={threshold} aria-label="Hours this week">
            <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
          </div>
          {hours >= threshold - 5 && (
            <p className={`mt-1 text-[10px] ${hours >= threshold ? "text-red-500" : "text-amber-500"}`}>
              {hours >= threshold ? "You're in overtime this week." : `${Math.max(0, Math.round((threshold - hours) * 10) / 10)}h until overtime.`}
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
