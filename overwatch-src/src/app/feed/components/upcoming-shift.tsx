"use client";

import { useEffect, useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserShifts } from "@/lib/supabase/db-operations";
import { parseUTC } from "@/lib/parse-utc";

interface UpcomingShiftProps {
  activeCompanyId: string;
}

export function UpcomingShift({ activeCompanyId }: UpcomingShiftProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [nextShift, setNextShift] = useState<any>(null);
  const [now] = useState(() => Date.now());

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    getUserShifts(activeCompanyId).then((allShifts) => {
      if (cancelled) return;
      const current = new Date();
      const upcoming = allShifts.filter((s: { start_time: string }) => parseUTC(s.start_time) > current);
      setNextShift(upcoming[0] ?? null);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  if (!nextShift) return null;

  return (
    <Card className="border-blue-500/30 bg-gradient-to-r from-blue-500/5 to-transparent">
      <CardContent className="py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 border border-blue-500/20">
            <CalendarDays className="h-5 w-5 text-blue-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Upcoming Shift</h3>
              <Badge className="text-[9px] bg-blue-500/15 text-blue-400 border-0">{
                (() => {
                  const ms = parseUTC(nextShift.start_time).getTime() - now;
                  const hrs = Math.floor(ms / 3600000);
                  if (hrs < 1) return "Starting soon";
                  if (hrs < 24) return `In ${hrs}h`;
                  const days = Math.floor(hrs / 24);
                  return `In ${days}d`;
                })()
              }</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {parseUTC(nextShift.start_time).toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" })} &bull; {parseUTC(nextShift.start_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} — {parseUTC(nextShift.end_time).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </p>
            {nextShift.events && (
              <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {nextShift.events.name}{nextShift.events.location ? ` @ ${nextShift.events.location}` : ""}
              </p>
            )}
            {nextShift.role && (
              <Badge variant="outline" className="text-[9px] mt-1">{nextShift.role}</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
