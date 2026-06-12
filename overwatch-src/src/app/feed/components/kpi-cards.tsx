"use client";

import { useEffect, useState } from "react";
import {
  Users, AlertTriangle, Footprints, FileText, CalendarDays,
  ChevronRight, BarChart3,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { getDashboardMetrics, getDashboardTrends } from "@/lib/supabase/db";
import type { DashboardTrends } from "@/lib/supabase/db-analytics";
import type { Metrics } from "./shared";
import { Sparkline } from "@/components/charts";
import { logger } from "@/lib/logger";

interface KpiCardsProps {
  activeCompanyId: string;
}

export function KpiCards({ activeCompanyId }: KpiCardsProps) {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [trends, setTrends] = useState<DashboardTrends | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    getDashboardMetrics(activeCompanyId).then((m) => {
      if (!cancelled) setMetrics(m);
    }).catch(() => {});
    getDashboardTrends(activeCompanyId).then((t) => {
      if (!cancelled) setTrends(t);
    }).catch((e) => logger.swallow("kpi-cards:trends", e, "trace"));
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  if (!metrics) return null;

  // For tiles whose underlying domain has trend data (incidents, patrols,
  // form submissions/reports) we link to /admin/analytics so the manager can
  // explore the same dataset with date range + drill-down. Pure navigation
  // tiles (directory, schedule) keep their existing detail-page links.
  const kpis = [
    {
      label: "On Duty",
      value: metrics.activePersonnel,
      total: metrics.totalStaff,
      icon: Users,
      color: "text-green-500",
      bg: "bg-green-500/10",
      href: "/directory",
      trend: undefined as number[] | undefined,
    },
    {
      label: "Open Incidents",
      value: metrics.openIncidents,
      icon: AlertTriangle,
      color: metrics.openIncidents > 0 ? "text-red-500" : "text-muted-foreground",
      bg: metrics.openIncidents > 0 ? "bg-red-500/10" : "bg-muted",
      href: "#analytics",
      trend: trends?.incidents,
      trendColor: "#ef4444",
    },
    {
      label: "Patrols Today",
      value: metrics.todayPatrols,
      icon: Footprints,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10",
      href: "/patrols",
      trend: trends?.patrols,
      trendColor: "#10b981",
    },
    {
      label: "Pending Reports",
      value: metrics.pendingReports,
      icon: FileText,
      color: metrics.pendingReports > 0 ? "text-amber-500" : "text-muted-foreground",
      bg: metrics.pendingReports > 0 ? "bg-amber-500/10" : "bg-muted",
      href: "/forms",
      trend: trends?.reports,
      trendColor: "#f59e0b",
    },
    {
      label: "Open Shifts",
      value: metrics.upcomingShifts,
      icon: CalendarDays,
      color: "text-blue-500",
      bg: "bg-blue-500/10",
      href: "/schedule",
      trend: undefined as number[] | undefined,
    },
    {
      label: "Total Staff",
      value: metrics.totalStaff,
      icon: Users,
      color: "text-primary",
      bg: "bg-primary/10",
      href: "/directory",
      trend: undefined as number[] | undefined,
    },
  ];

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60">
          Operational Status
        </h2>
        <button
          onClick={() => document.getElementById("analytics")?.scrollIntoView({ behavior: "smooth" })}
          className="text-[10px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
        >
          <BarChart3 className="h-3 w-3" />
          View analytics
          <ChevronRight className="h-3 w-3" />
        </button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {kpis.map((kpi) => (
          <Link key={kpi.label} href={kpi.href}>
            <Card className="group cursor-pointer border-border/40 transition-all hover:border-primary/30 hover:shadow-md hover:-translate-y-0.5">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                  </div>
                  <ChevronRight className="h-3 w-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="flex items-end justify-between gap-2">
                  <div className={`text-2xl font-bold font-mono ${kpi.color}`}>
                    {kpi.value}{kpi.total !== undefined && <span className="text-xs text-muted-foreground font-normal">/{kpi.total}</span>}
                  </div>
                  {kpi.trend && kpi.trend.length > 0 && (
                    <Sparkline data={kpi.trend} color={kpi.trendColor ?? "#6366f1"} width={50} height={14} ariaLabel={`${kpi.label} 7-day trend`} />
                  )}
                </div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{kpi.label}</div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
