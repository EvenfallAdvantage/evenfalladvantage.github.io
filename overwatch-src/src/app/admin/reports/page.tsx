"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart3, Users, MapPin, Shield, ClipboardList, Clock, Loader2,
  AlertTriangle, CheckCircle2, Footprints,
  GraduationCap, FileText, Calendar, Activity,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyStats, getIntelData } from "@/lib/supabase/db";

type Stats = {
  memberCount: number;
  eventCount: number;
  assetCount: number;
  formCount: number;
  totalHoursLogged: number;
};

// SVG mini bar chart component
function MiniBarChart({ data, color }: { data: number[]; color: string }) {
  const max = Math.max(...data, 1);
  const barW = 100 / data.length;
  return (
    <svg viewBox="0 0 100 40" className="w-full h-10">
      {data.map((v, i) => {
        const h = (v / max) * 36;
        return (
          <rect key={i} x={i * barW + 1} y={40 - h} width={barW - 2} height={h}
            rx={1.5} fill={color} opacity={0.15 + (i / data.length) * 0.85} />
        );
      })}
    </svg>
  );
}

// SVG donut chart
function DonutChart({ segments }: { segments: { value: number; color: string; label: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;
  const radius = 40;
  const circumference = 2 * Math.PI * radius;

  // Pre-compute offsets to avoid mutation during render
  const arcs = segments.reduce<{ pct: number; offset: number; color: string }[]>((acc, seg) => {
    const cum = acc.length > 0 ? acc[acc.length - 1].offset + acc[acc.length - 1].pct : 0;
    acc.push({ pct: (seg.value / total) * circumference, offset: cum, color: seg.color });
    return acc;
  }, []);

  return (
    <div className="relative w-32 h-32 mx-auto">
      <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
        <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="12" className="text-border/20" />
        {arcs.map((arc, i) => (
          <circle key={i} cx="50" cy="50" r={radius} fill="none" stroke={arc.color} strokeWidth="12"
            strokeDasharray={`${arc.pct} ${circumference}`}
            strokeDashoffset={-arc.offset} strokeLinecap="round" />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <p className="text-lg font-bold font-mono">{total}</p>
        <p className="text-[8px] text-muted-foreground">TOTAL</p>
      </div>
    </div>
  );
}

type IntelData = {
  weeklyHours: number[];
  weeklyIncidents: number[];
  dayLabels: string[];
  personnel: { onDuty: number; offDuty: number; onLeave: number; total: number };
  activity: { patrols: number; training: number; shifts: number };
};

export default function AdminReportsPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [stats, setStats] = useState<Stats | null>(null);
  const [intel, setIntel] = useState<IntelData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoading(false); return; }
    try {
      const [s, i] = await Promise.all([
        getCompanyStats(activeCompanyId),
        getIntelData(activeCompanyId),
      ]);
      setStats(s);
      setIntel(i);
    } catch {} finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  const memberCount = stats?.memberCount ?? 0;
  const eventCount = stats?.eventCount ?? 0;
  const assetCount = stats?.assetCount ?? 0;
  const formCount = stats?.formCount ?? 0;
  const hoursLogged = stats?.totalHoursLogged ?? 0;

  const kpiCards = [
    { label: "Personnel", value: memberCount, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Operations", value: eventCount, icon: MapPin, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Assets Tracked", value: assetCount, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Active Forms", value: formCount, icon: ClipboardList, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Hours Logged", value: hoursLogged, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "On Duty", value: intel?.personnel.onDuty ?? 0, icon: CheckCircle2, color: (intel?.personnel.onDuty ?? 0) > 0 ? "text-green-500" : "text-muted-foreground", bg: (intel?.personnel.onDuty ?? 0) > 0 ? "bg-green-500/10" : "bg-muted" },
  ];

  const compositionSegments = [
    { value: memberCount, color: "#3b82f6", label: "Personnel" },
    { value: assetCount, color: "#10b981", label: "Assets" },
    { value: formCount, color: "#f43f5e", label: "Forms" },
    { value: eventCount, color: "#8b5cf6", label: "Operations" },
  ];

  const p = intel?.personnel ?? { onDuty: 0, offDuty: 0, onLeave: 0, total: 0 };
  const statusBreakdown = [
    { label: "On Duty", count: p.onDuty, color: "bg-green-500", pct: p.total > 0 ? Math.round((p.onDuty / p.total) * 100) : 0 },
    { label: "Off Duty", count: p.offDuty, color: "bg-slate-400", pct: p.total > 0 ? Math.round((p.offDuty / p.total) * 100) : 0 },
    { label: "On Leave", count: p.onLeave, color: "bg-amber-500", pct: p.total > 0 ? Math.round((p.onLeave / p.total) * 100) : 0 },
  ];

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
              <Activity className="h-5 w-5 sm:h-6 sm:w-6" /> INTEL CENTER
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground">Operational analytics and organizational intelligence</p>
          </div>
          <Badge className="bg-primary/10 text-primary text-xs">
            {new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
          </Badge>
        </div>

        {loading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
        ) : (
          <>
            {/* KPI Row */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {kpiCards.map((kpi) => (
                <Card key={kpi.label} className="border-border/40 hover:border-primary/20 transition-all">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${kpi.bg}`}>
                        <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                      </div>
                    </div>
                    <p className={`text-xl font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
                    <p className="text-[9px] text-muted-foreground uppercase tracking-wider mt-0.5">{kpi.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Charts Row */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Weekly Hours */}
              <Card className="border-border/40 lg:col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5"><Clock className="h-4 w-4 text-amber-500" /> Weekly Hours</h3>
                    <span className="text-xs text-muted-foreground">{hoursLogged}h total</span>
                  </div>
                  <MiniBarChart data={intel?.weeklyHours ?? [0,0,0,0,0,0,0]} color="#f59e0b" />
                  <div className="flex justify-between mt-1">
                    {(intel?.dayLabels ?? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]).map((d) => <span key={d} className="text-[8px] text-muted-foreground">{d}</span>)}
                  </div>
                </CardContent>
              </Card>

              {/* Org Composition */}
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><BarChart3 className="h-4 w-4 text-primary" /> Composition</h3>
                  <DonutChart segments={compositionSegments} />
                  <div className="mt-3 space-y-1">
                    {compositionSegments.map((s) => (
                      <div key={s.label} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          <span className="text-muted-foreground">{s.label}</span>
                        </div>
                        <span className="font-mono font-medium">{s.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Second Row */}
            <div className="grid gap-4 lg:grid-cols-3">
              {/* Incident Trend */}
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-semibold flex items-center gap-1.5"><AlertTriangle className="h-4 w-4 text-red-500" /> Incidents</h3>
                    <span className="text-xs text-muted-foreground">{eventCount} total</span>
                  </div>
                  <MiniBarChart data={intel?.weeklyIncidents ?? [0,0,0,0,0,0,0]} color="#ef4444" />
                  <div className="flex justify-between mt-1">
                    {(intel?.dayLabels ?? ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"]).map((d) => <span key={d} className="text-[8px] text-muted-foreground">{d}</span>)}
                  </div>
                </CardContent>
              </Card>

              {/* Personnel Status */}
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Users className="h-4 w-4 text-blue-500" /> Personnel Status</h3>
                  {p.total > 0 ? (
                    <div className="space-y-2.5">
                      {/* Stacked bar */}
                      <div className="flex h-3 rounded-full overflow-hidden">
                        {statusBreakdown.map((s) => (
                          <div key={s.label} className={`${s.color}`} style={{ width: `${s.pct}%` }} />
                        ))}
                      </div>
                      {statusBreakdown.map((s) => (
                        <div key={s.label} className="flex items-center justify-between text-xs">
                          <div className="flex items-center gap-1.5">
                            <span className={`h-2 w-2 rounded-full ${s.color}`} />
                            <span className="text-muted-foreground">{s.label}</span>
                          </div>
                          <span className="font-mono font-medium">{s.count}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-4">No personnel data yet</p>
                  )}
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card className="border-border/40">
                <CardContent className="p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><FileText className="h-4 w-4 text-rose-500" /> Activity Summary</h3>
                  <div className="space-y-2.5">
                    {[
                      { label: "Patrols Today", value: intel?.activity.patrols ?? 0, icon: Footprints, color: "text-emerald-500" },
                      { label: "Training Done", value: intel?.activity.training ?? 0, icon: GraduationCap, color: "text-violet-500" },
                      { label: "Reports Filed", value: formCount, icon: FileText, color: "text-rose-500" },
                      { label: "Shifts (7d)", value: intel?.activity.shifts ?? 0, icon: Calendar, color: "text-blue-500" },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-1.5">
                          <item.icon className={`h-3 w-3 ${item.color}`} />
                          <span className="text-muted-foreground">{item.label}</span>
                        </div>
                        <span className="font-mono font-medium">{item.value}</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Data note */}
            <p className="text-[10px] text-center text-muted-foreground/50">
              All data is queried live from your organization&apos;s database.
            </p>
          </>
        )}
      </div>
    </>
  );
}
