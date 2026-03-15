"use client";

import { useEffect, useState, useCallback } from "react";
import { CalendarOff, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { getTimeOffRequests } from "@/lib/supabase/db";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Request = any;

export default function TimeOffPage() {
  const [requests, setRequests] = useState<Request[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try { setRequests(await getTimeOffRequests()); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const statusColor = (s: string) => {
    if (s === "approved") return "bg-green-500/15 text-green-600";
    if (s === "denied") return "bg-red-500/15 text-red-600";
    return "bg-amber-500/15 text-amber-600";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leave</h1>
          <p className="text-sm text-muted-foreground">Request and track leave days</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <CalendarOff className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No leave requests</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Your leave request history will appear here.
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {requests.map((r: Request) => (
              <div key={r.id} className="flex items-center gap-4 rounded-xl border border-border/50 bg-card px-4 py-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-orange-500/10">
                  <CalendarOff className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm">{r.time_off_policies?.name ?? "Leave Request"}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(r.start_date).toLocaleDateString()} — {new Date(r.end_date).toLocaleDateString()}
                  </p>
                </div>
                <Badge className={`text-[10px] ${statusColor(r.status)}`}>{r.status}</Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
