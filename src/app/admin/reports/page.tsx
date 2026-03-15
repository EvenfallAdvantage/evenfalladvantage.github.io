"use client";

import { useEffect, useState, useCallback } from "react";
import { BarChart3, Users, MapPin, Shield, ClipboardList, Clock, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyStats } from "@/lib/supabase/db";

type Stats = {
  memberCount: number;
  eventCount: number;
  assetCount: number;
  formCount: number;
  totalHoursLogged: number;
};

export default function AdminReportsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try { setStats(await getCompanyStats(activeCompanyId)); } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  const metrics = stats ? [
    { label: "Personnel", value: stats.memberCount, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Operations", value: stats.eventCount, icon: MapPin, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Assets", value: stats.assetCount, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Active Forms", value: stats.formCount, icon: ClipboardList, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Hours Logged", value: stats.totalHoursLogged, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
  ] : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight font-mono">INTEL</h1>
          <p className="text-sm text-muted-foreground">Analytics, metrics, and operational intelligence</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : stats ? (
          <>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {metrics.map((m) => (
                <Card key={m.label} className="border-border/40">
                  <CardContent className="flex items-center gap-4 py-4 px-5">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${m.bg}`}>
                      <m.icon className={`h-6 w-6 ${m.color}`} />
                    </div>
                    <div>
                      <p className="text-2xl font-bold font-mono">{m.value}</p>
                      <p className="text-xs text-muted-foreground">{m.label}</p>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card className="border-border/40">
              <CardContent className="flex flex-col items-center py-10 text-center">
                <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/30" />
                <p className="text-sm font-medium">Detailed Reports Coming Soon</p>
                <p className="mt-1 max-w-sm text-xs text-muted-foreground">
                  Charts for attendance trends, compliance rates, and shift analytics will appear here as your team accumulates more data.
                </p>
              </CardContent>
            </Card>
          </>
        ) : (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 bg-card/50 p-12 text-center">
            <BarChart3 className="mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm font-medium">No data to report yet</p>
            <p className="mt-1 max-w-xs text-xs text-muted-foreground">
              Hours, compliance, attendance, and asset reports will populate as your team uses the platform.
            </p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
