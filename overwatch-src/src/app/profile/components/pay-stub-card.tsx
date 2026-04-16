"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DollarSign } from "lucide-react";
import { getMyPaySummary } from "@/lib/supabase/db-pay";
import { parseUTC } from "@/lib/parse-utc";

interface PayStubCardProps {
  activeCompanyId: string;
}

export function PayStubCard({ activeCompanyId }: PayStubCardProps) {
  const [data, setData] = useState<Awaited<ReturnType<typeof getMyPaySummary>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getMyPaySummary(activeCompanyId);
        if (!cancelled) setData(result);
      } catch {
        /* ignore */
      }
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  if (loading || !data) return null;
  if (data.timesheets.length === 0 && data.effectiveRate == null) return null;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <DollarSign className="h-4 w-4 text-green-500" />
          Pay Summary
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Current rate */}
        {data.effectiveRate != null && (
          <div className="flex items-center justify-between rounded-lg bg-green-500/10 border border-green-500/20 px-3 py-2">
            <span className="text-xs text-muted-foreground">Your Rate</span>
            <span className="text-lg font-bold text-green-500">${data.effectiveRate.toFixed(2)}/hr</span>
          </div>
        )}

        {/* Totals */}
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
            <p className="text-[10px] text-muted-foreground">Total Hours</p>
            <p className="text-sm font-bold">{data.totalHours.toFixed(1)}h</p>
          </div>
          <div className="rounded-lg bg-muted/30 px-3 py-2 text-center">
            <p className="text-[10px] text-muted-foreground">Total Pay</p>
            <p className="text-sm font-bold text-green-500">${data.totalPay.toFixed(2)}</p>
          </div>
        </div>

        {/* Recent timesheets with pay */}
        {data.timesheets.length > 0 && (
          <div className="max-h-48 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground border-b border-border/30">
                  <th className="text-left pb-1">Date</th>
                  <th className="text-left pb-1">Event</th>
                  <th className="text-right pb-1">Hours</th>
                  <th className="text-right pb-1">Rate</th>
                  <th className="text-right pb-1">Pay</th>
                </tr>
              </thead>
              <tbody>
                {data.timesheets.slice(0, 20).map((t) => (
                  <tr key={t.id} className="border-b border-border/10">
                    <td className="py-1.5">{parseUTC(t.clock_in).toLocaleDateString([], { month: "short", day: "numeric" })}</td>
                    <td className="py-1.5 text-muted-foreground truncate max-w-[100px]">{t.event_name ?? "General"}</td>
                    <td className="py-1.5 text-right">{t.hours.toFixed(1)}</td>
                    <td className="py-1.5 text-right">{t.rate != null ? `$${t.rate.toFixed(2)}` : "\u2014"}</td>
                    <td className="py-1.5 text-right font-medium">{t.pay != null ? `$${t.pay.toFixed(2)}` : "\u2014"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
