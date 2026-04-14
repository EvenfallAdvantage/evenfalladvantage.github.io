"use client";

import { History, Flag, Briefcase } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDate, formatTime, calcHours, type Timesheet } from "./timeclock-utils";

interface RecentWatchLogProps {
  recent: Timesheet[];
  onSelectEntry: (entry: Timesheet) => void;
}

export function RecentWatchLog({ recent, onSelectEntry }: RecentWatchLogProps) {
  return (
    <div>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <History className="h-4 w-4" /> Recent Watch Log
      </h2>
      {recent.length === 0 ? (
        <p className="text-sm text-muted-foreground">No completed shifts yet. Clock in to start logging hours.</p>
      ) : (
        <div className="space-y-2">
          {recent.map((ts: Timesheet) => (
            <button key={ts.id} type="button" onClick={() => onSelectEntry(ts)}
              className="w-full flex items-center justify-between rounded-lg border border-border/50 bg-card px-4 py-3 hover:bg-muted/30 hover:border-primary/20 transition-colors text-left">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <div className="text-xs text-muted-foreground font-medium">{formatDate(ts.clock_in)}</div>
                  <div className="text-sm">{formatTime(ts.clock_in)} → {formatTime(ts.clock_out)}</div>
                </div>
                {ts.events?.name && (
                  <div className="flex items-center gap-1 mt-1">
                    <Flag className="h-3 w-3 text-primary/60" />
                    <span className="text-[10px] text-muted-foreground truncate">{ts.events.name}</span>
                  </div>
                )}
                {!ts.events?.name && ts.clock_in_type === "admin" && (
                  <div className="flex items-center gap-1 mt-1">
                    <Briefcase className="h-3 w-3 text-amber-500/60" />
                    <span className="text-[10px] text-amber-600/70">Admin</span>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span className="font-mono text-sm font-semibold">{calcHours(ts.clock_in, ts.clock_out)}h</span>
                <Badge variant={ts.approved ? "default" : "secondary"} className="text-[10px]">
                  {ts.approved ? "Approved" : "Pending"}
                </Badge>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
