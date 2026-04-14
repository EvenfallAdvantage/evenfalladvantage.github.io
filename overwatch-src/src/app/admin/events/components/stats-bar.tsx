"use client";

import { AlertTriangle } from "lucide-react";
import type { OperationAvailability } from "@/lib/supabase/db-availability";

interface StatsBarProps {
  totalShifts: number;
  filledShifts: number;
  openShifts: number;
  fillPct: number;
  conflictCount: number;
  opDaysCount: number;
  availability: OperationAvailability[];
  membersCount: number;
}

export function StatsBar({
  totalShifts,
  filledShifts,
  openShifts,
  fillPct,
  conflictCount,
  opDaysCount,
  availability,
  membersCount,
}: StatsBarProps) {
  const availableCount = availability.filter(a => a.status === "available").length;
  const unavailableCount = availability.filter(a => a.status === "unavailable").length;
  const tentativeCount = availability.filter(a => a.status === "tentative").length;
  const pendingAvailCount = membersCount - availability.length;

  return (
    <div className="px-3 sm:px-4 py-2 flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-border/20 bg-muted/30">
      <span className="text-[10px] font-mono font-semibold">{totalShifts}</span>
      <span className="text-[10px] text-muted-foreground">shifts ·</span>
      <span className="text-[10px] font-mono text-green-500">{filledShifts} filled</span>
      <span className="text-[10px] text-muted-foreground">·</span>
      <span className="text-[10px] font-mono text-amber-500">{openShifts} open</span>
      {conflictCount > 0 && (
        <span className="text-[10px] font-mono text-red-500 flex items-center gap-0.5">· <AlertTriangle className="h-2.5 w-2.5" /> {conflictCount} conflict{conflictCount !== 1 ? "s" : ""}</span>
      )}
      {totalShifts > 0 && (
        <>
          <div className="h-1.5 w-16 sm:w-20 rounded-full bg-muted overflow-hidden">
            <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${fillPct}%` }} />
          </div>
          <span className="text-[10px] font-mono text-muted-foreground">{fillPct}%</span>
        </>
      )}
      {availability.length > 0 && (
        <>
          <span className="text-[10px] text-muted-foreground">·</span>
          <span className="text-[10px] font-mono text-green-500">{availableCount}✓</span>
          {tentativeCount > 0 && <span className="text-[10px] font-mono text-amber-500">{tentativeCount}?</span>}
          {unavailableCount > 0 && <span className="text-[10px] font-mono text-red-500">{unavailableCount}✗</span>}
          {pendingAvailCount > 0 && <span className="text-[10px] font-mono text-muted-foreground/50">{pendingAvailCount} pending</span>}
        </>
      )}
      <span className="text-[10px] font-mono text-muted-foreground ml-auto">{opDaysCount} day{opDaysCount !== 1 ? "s" : ""}</span>
    </div>
  );
}
