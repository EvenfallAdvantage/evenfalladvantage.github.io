"use client";

import { useEffect, useState } from "react";
import { Clock, AlertTriangle, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getWeeklyHoursReport, type WeeklyHours } from "@/lib/supabase/db";
import { logger } from "@/lib/logger";

interface OvertimeWidgetProps {
  activeCompanyId: string;
}

export function OvertimeWidget({ activeCompanyId }: OvertimeWidgetProps) {
  const [hours, setHours] = useState<WeeklyHours[]>([]);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    getWeeklyHoursReport(activeCompanyId)
      .then((h) => { if (!cancelled) setHours(h); })
      .catch((err) => { logger.swallow("overtime-widget:load", err, "warn"); });
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  const approaching = hours.filter((h) => h.approachingOT);
  const over = hours.filter((h) => h.overThreshold);
  const hasIssues = approaching.length > 0 || over.length > 0;

  if (hours.length === 0) return null;

  return (
    <Card className={`border-border/40 ${over.length > 0 ? "border-red-500/30" : hasIssues ? "border-amber-500/30" : ""}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" /> Overtime Watch
          </h3>
          {over.length > 0 ? (
            <Badge className="bg-red-500/15 text-red-500 text-[9px]">{over.length} Over OT</Badge>
          ) : approaching.length > 0 ? (
            <Badge className="bg-amber-500/15 text-amber-500 text-[9px]">{approaching.length} Approaching</Badge>
          ) : (
            <Badge className="bg-green-500/15 text-green-500 text-[9px]">Normal</Badge>
          )}
        </div>

        {/* Staff approaching or over OT */}
        {hasIssues && (
          <div className="space-y-1.5">
            {[...over, ...approaching].slice(0, 6).map((h) => (
              <div key={h.userId} className="flex items-center gap-2 text-[11px] rounded-lg bg-muted/30 px-2.5 py-1.5">
                {h.overThreshold ? (
                  <AlertTriangle className="h-3 w-3 text-red-500 shrink-0" />
                ) : (
                  <Clock className="h-3 w-3 text-amber-500 shrink-0" />
                )}
                <span className="flex-1 truncate font-medium">{h.userName}</span>
                <span className={`font-mono text-[10px] font-bold ${h.overThreshold ? "text-red-500" : "text-amber-500"}`}>
                  {h.totalHours.toFixed(1)}h
                </span>
                {h.overtimeHours > 0 && (
                  <span className="text-[9px] text-red-400 font-mono">+{h.overtimeHours.toFixed(1)} OT</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Summary when no issues */}
        {!hasIssues && hours.length > 0 && (
          <p className="text-[11px] text-muted-foreground">
            All {hours.length} staff within normal hours this week. Top: {hours[0]?.userName} at {hours[0]?.totalHours.toFixed(1)}h.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
