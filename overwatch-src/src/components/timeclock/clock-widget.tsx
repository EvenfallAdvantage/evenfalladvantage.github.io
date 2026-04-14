"use client";

import { Clock, LogIn, LogOut, Loader2, Flag, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDuration, formatTime, type Timesheet } from "./timeclock-utils";

interface ClockWidgetProps {
  active: Timesheet | null;
  loading: boolean;
  acting: boolean;
  elapsed: number;
  onClockIn: () => void;
  onClockOut: () => void;
}

export function ClockWidget({ active, loading, acting, elapsed, onClockIn, onClockOut }: ClockWidgetProps) {
  const isClockedIn = !!active;

  return (
    <Card className={isClockedIn ? "border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent" : "border-primary/20 bg-gradient-to-br from-primary/5 to-transparent"}>
      <CardContent className="flex flex-col items-center py-8">
        <div className={`mb-4 flex h-24 w-24 items-center justify-center rounded-full border-4 ${isClockedIn ? "border-green-500/30 bg-green-500/10" : "border-primary/20 bg-primary/10"}`}>
          {loading ? <Loader2 className="h-10 w-10 animate-spin text-muted-foreground" /> : <Clock className={`h-10 w-10 ${isClockedIn ? "text-green-500" : "text-primary"}`} />}
        </div>
        <p className="mb-1 text-sm text-muted-foreground">{isClockedIn ? "On duty since" : "Status"}</p>
        {isClockedIn ? (
          <>
            <p className="text-sm font-medium text-green-600">{formatTime(active.clock_in)}</p>
            <p className="my-2 font-mono text-3xl font-bold tracking-wider text-green-600">{formatDuration(elapsed)}</p>
            {/* Operation context */}
            {active.events?.name ? (
              <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                <Flag className="h-3.5 w-3.5 text-green-500 shrink-0" />
                <span className="text-xs font-medium text-green-600">{active.events.name}</span>
                {active.shifts?.role && <Badge className="text-[9px] bg-green-500/15 text-green-600">{active.shifts.role}</Badge>}
              </div>
            ) : active.clock_in_type === "admin" ? (
              <div className="flex items-center gap-2 mt-1 px-3 py-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <Briefcase className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                <span className="text-xs font-medium text-amber-600">Admin / Off-Shift</span>
              </div>
            ) : null}
          </>
        ) : (
          <p className="mb-3 text-2xl font-bold text-muted-foreground">Off Duty</p>
        )}
        {!loading && (
          <Button size="lg" className={`mt-2 gap-2 px-10 ${isClockedIn ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}`}
            onClick={isClockedIn ? onClockOut : onClockIn} disabled={acting}>
            {acting ? <Loader2 className="h-5 w-5 animate-spin" /> : isClockedIn ? <LogOut className="h-5 w-5" /> : <LogIn className="h-5 w-5" />}
            {isClockedIn ? "Clock Out" : "Clock In"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
