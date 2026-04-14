"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DAY_LABELS } from "./timeclock-utils";

interface WeeklyHoursCalendarProps {
  weekDates: Date[];
  weekHours: number[];
  weekTotal: number;
  weekOffset: number;
  isCurrentWeek: boolean;
  onPrevWeek: () => void;
  onNextWeek: () => void;
  onGoToToday: () => void;
}

export function WeeklyHoursCalendar({
  weekDates,
  weekHours,
  weekTotal,
  weekOffset,
  isCurrentWeek,
  onPrevWeek,
  onNextWeek,
  onGoToToday,
}: WeeklyHoursCalendarProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            Weekly Hours
          </h3>
          <div className="flex items-center gap-1">
            <button onClick={onPrevWeek} className="p-1 rounded hover:bg-muted/50 text-muted-foreground" aria-label="Previous week"><ChevronLeft className="h-4 w-4" /></button>
            {!isCurrentWeek && (
              <button onClick={onGoToToday} className="text-[10px] text-primary px-2 py-0.5 rounded hover:bg-primary/10">Today</button>
            )}
            <button onClick={onNextWeek} disabled={isCurrentWeek} className="p-1 rounded hover:bg-muted/50 text-muted-foreground disabled:opacity-30" aria-label="Next week"><ChevronRight className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground mb-2">
          {weekDates[0].toLocaleDateString([], { month: "short", day: "numeric" })} — {weekDates[6].toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
        </div>
        <div className="grid grid-cols-7 gap-1.5">
          {weekDates.map((date, i) => {
            const isToday = date.getTime() === today.getTime();
            const hrs = weekHours[i];
            const hasHours = hrs > 0;
            return (
              <div key={i} className={`flex flex-col items-center rounded-lg p-2 ${isToday ? "bg-primary/10 border border-primary/20" : "bg-muted/20"}`}>
                <span className={`text-[10px] font-medium ${isToday ? "text-primary" : "text-muted-foreground"}`}>{DAY_LABELS[i]}</span>
                <span className={`text-[10px] ${isToday ? "text-primary" : "text-muted-foreground/60"}`}>{date.getDate()}</span>
                <div className={`mt-1 text-xs font-mono font-bold ${hasHours ? "text-green-500" : "text-muted-foreground/30"}`}>
                  {hasHours ? `${hrs.toFixed(1)}` : "—"}
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Week Total</span>
          <span className="font-mono font-bold text-primary">{weekTotal.toFixed(1)}h</span>
        </div>
      </CardContent>
    </Card>
  );
}
