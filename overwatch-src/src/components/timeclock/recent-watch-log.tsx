"use client";

import { Calendar, Flag, Briefcase, UtensilsCrossed, Coffee } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useActiveCompany } from "@/stores/auth-store";
import { calcBreakSummary, calcPayableHours, formatDate, formatTime, type Timesheet } from "./timeclock-utils";

interface RecentWatchLogProps {
  recent: Timesheet[];
  onSelectEntry: (entry: Timesheet) => void;
}

export function RecentWatchLog({ recent, onSelectEntry }: RecentWatchLogProps) {
  const activeCompany = useActiveCompany();

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
          <Calendar className="h-4 w-4" /> Recent Watch Log
        </CardTitle>
      </CardHeader>
      <CardContent>
        {recent.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">No timesheet entries yet. Clock in to start tracking.</p>
        ) : (
          <div className="space-y-1.5">
            {recent.map((t: Timesheet) => {
              const breakSummary = calcBreakSummary(t, activeCompany?.settings);
              return (
                <button
                  key={t.id}
                  onClick={() => onSelectEntry(t)}
                  className="flex w-full items-center justify-between rounded-lg border border-border/40 px-3 py-2 text-sm hover:bg-muted/30 transition-colors text-left"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-medium">{formatDate(t.clock_in)}</span>
                        {t.events?.name ? (
                          <Badge variant="outline" className="text-[9px] gap-0.5 text-primary border-primary/30">
                            <Flag className="h-2.5 w-2.5" /> {t.events.name}
                          </Badge>
                        ) : t.clock_in_type === "admin" ? (
                          <Badge variant="outline" className="text-[9px] gap-0.5 text-amber-600 border-amber-500/30">
                            <Briefcase className="h-2.5 w-2.5" /> Admin
                          </Badge>
                        ) : null}
                        {breakSummary.mealCount > 0 && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-amber-500/30 text-amber-600 dark:text-amber-400">
                            <UtensilsCrossed className="h-2.5 w-2.5" /> {breakSummary.mealMinutes}m lunch
                          </Badge>
                        )}
                        {breakSummary.restCount > 0 && (
                          <Badge variant="outline" className="text-[9px] gap-0.5 border-sky-500/30 text-sky-600 dark:text-sky-400">
                            <Coffee className="h-2.5 w-2.5" /> {breakSummary.restCount}× rest ({breakSummary.restMinutes}m)
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {formatTime(t.clock_in)} — {t.clock_out ? formatTime(t.clock_out) : "Active"}
                        {breakSummary.unpaidMinutes > 0 && ` (-${breakSummary.unpaidMinutes}m unpaid)`}
                        {t.notes && !t.events?.name && ` · ${t.notes}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-mono text-xs font-semibold">
                      {calcPayableHours(t.clock_in, t.clock_out, t, activeCompany?.settings)}h
                    </span>
                    <Badge variant={t.approved ? "default" : "secondary"} className="text-[10px]">
                      {t.approved ? "Approved" : t.clock_out ? "Pending" : "Active"}
                    </Badge>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
