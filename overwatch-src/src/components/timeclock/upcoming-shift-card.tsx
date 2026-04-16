"use client";

import { useState } from "react";
import { CalendarDays, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { parseUTC } from "@/lib/parse-utc";
import { formatFullDate, formatTime, type Shift } from "./timeclock-utils";

function formatTimeUntil(startTime: string, now: number): string {
  const ms = parseUTC(startTime).getTime() - now;
  const hrs = Math.floor(ms / 3600000);
  if (hrs < 1) return "Starting soon";
  if (hrs < 24) return `In ${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `In ${days}d`;
}

interface UpcomingShiftCardProps {
  shift: Shift;
}

export function UpcomingShiftCard({ shift }: UpcomingShiftCardProps) {
  const [now] = useState(() => Date.now());
  const tz: string | undefined = shift.events?.timezone ?? undefined;

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
              <Badge className="text-[9px] bg-blue-500/15 text-blue-400">
                {formatTimeUntil(shift.start_time, now)}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatFullDate(shift.start_time, tz)} &bull; {formatTime(shift.start_time, tz)} — {formatTime(shift.end_time, tz)}
            </p>
            {shift.events && (
              <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3" /> {shift.events.name}{shift.events.location ? ` @ ${shift.events.location}` : ""}
              </p>
            )}
            {shift.role && (
              <Badge variant="outline" className="text-[9px] mt-1">{shift.role}</Badge>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
