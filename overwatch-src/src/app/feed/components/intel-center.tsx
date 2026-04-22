"use client";

import { useEffect, useState } from "react";
import {
  Clock, Users, MapPin, Shield, ClipboardList,
  CheckCircle2, Activity, AlertTriangle,
  BarChart3, UserPlus, Plug, DollarSign,
  UserCheck, CircleDot, Footprints, GraduationCap,
  Calendar, Bell, FileText,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  getCompanyStats, getIntelData, getOwnerIntel,
} from "@/lib/supabase/db";
import {
  MiniBarChart, DonutChart, ProgressBar, hireDaysAgo,
  PROVIDER_LABELS,
  type CompanyStats, type IntelData, type OwnerIntel,
} from "./shared";
import { logger } from "@/lib/logger";

interface IntelCenterProps {
  activeCompanyId: string;
}

export function IntelCenter({ activeCompanyId }: IntelCenterProps) {
  const [companyStats, setCompanyStats] = useState<CompanyStats | null>(null);
  const [intel, setIntel] = useState<IntelData | null>(null);
  const [ownerIntel, setOwnerIntel] = useState<OwnerIntel | null>(null);

  useEffect(() => {
    if (!activeCompanyId) return;
    let cancelled = false;
    Promise.all([getCompanyStats(activeCompanyId), getIntelData(activeCompanyId)])
      .then(async ([cs, id]) => {
        if (cancelled) return;
        setCompanyStats(cs);
        setIntel(id);
        try {
          const oi = await getOwnerIntel(activeCompanyId);
          if (!cancelled) setOwnerIntel(oi);
        } catch (e) { logger.swallow("intel-center:load-owner", e, "warn"); }
      }).catch(() => {});
    return () => { cancelled = true; };
  }, [activeCompanyId]);

  if (!companyStats || !intel) return null;

  const mc = companyStats.memberCount;
  const ec = companyStats.eventCount;
  const ac = companyStats.assetCount;
  const fc = companyStats.formCount;
  const hrs = companyStats.totalHoursLogged;

  const intelKpis = [
    { label: "Personnel", value: mc, icon: Users, color: "text-blue-500", bg: "bg-blue-500/10" },
    { label: "Operations", value: ec, icon: MapPin, color: "text-violet-500", bg: "bg-violet-500/10" },
    { label: "Assets", value: ac, icon: Shield, color: "text-emerald-500", bg: "bg-emerald-500/10" },
    { label: "Forms", value: fc, icon: ClipboardList, color: "text-rose-500", bg: "bg-rose-500/10" },
    { label: "Hours", value: hrs, icon: Clock, color: "text-amber-500", bg: "bg-amber-500/10" },
    { label: "On Duty", value: intel.personnel.onDuty, icon: CheckCircle2, color: intel.personnel.onDuty > 0 ? "text-green-500" : "text-muted-foreground", bg: intel.personnel.onDuty > 0 ? "bg-green-500/10" : "bg-muted" },
  ];

  const compositionSegs = [
    { value: mc, color: "#3b82f6", label: "Personnel" },
    { value: ac, color: "#10b981", label: "Assets" },
    { value: fc, color: "#f43f5e", label: "Forms" },
    { value: ec, color: "#8b5cf6", label: "Operations" },
  ];

  const pers = intel.personnel;
  const statusBkdn = [
    { label: "On Duty", count: pers.onDuty, color: "bg-green-500", pct: pers.total > 0 ? Math.round((pers.onDuty / pers.total) * 100) : 0 },
    { label: "Off Duty", count: pers.offDuty, color: "bg-slate-400", pct: pers.total > 0 ? Math.round((pers.offDuty / pers.total) * 100) : 0 },
    { label: "On Leave", count: pers.onLeave, color: "bg-amber-500", pct: pers.total > 0 ? Math.round((pers.onLeave / pers.total) * 100) : 0 },
  ];

  const pipeline = ownerIntel?.pipeline;
  const intHealth = ownerIntel?.integrationHealth;
  const payroll = ownerIntel?.payroll;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/60 flex items-center gap-1.5">
          <Activity className="h-3.5 w-3.5" /> Intel Center
        </h2>
        <Badge className="bg-primary/10 text-primary text-[10px]">
          {new Date().toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
        </Badge>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
        {intelKpis.map((kpi) => (
          <Card key={kpi.label} className="border-border/40">
            <CardContent className="p-2.5">
              <div className="flex items-center justify-between mb-1">
                <div className={`flex h-6 w-6 items-center justify-center rounded-md ${kpi.bg}`}>
                  <kpi.icon className={`h-3 w-3 ${kpi.color}`} />
                </div>
              </div>
              <p className={`text-lg font-bold font-mono ${kpi.color}`}>{kpi.value}</p>
              <p className="text-[8px] text-muted-foreground uppercase tracking-wider">{kpi.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Owner Row: Pipeline + Integrations + Payroll */}
      <div className="grid gap-3 lg:grid-cols-3">
        {/* Hiring Pipeline */}
        <Card className="border-border/40">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold flex items-center gap-1.5"><UserPlus className="h-3.5 w-3.5 text-cyan-500" /> Hiring Pipeline</h3>
              <Link href="/admin/staff"><Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-accent">View All</Badge></Link>
            </div>
            {pipeline && pipeline.total > 0 ? (
              <div className="space-y-2">
                {[
                  { label: "New / Pending", count: pipeline.new, color: "bg-cyan-500", pct: Math.round((pipeline.new / pipeline.total) * 100) },
                  { label: "Interview", count: pipeline.interview, color: "bg-blue-500", pct: Math.round((pipeline.interview / pipeline.total) * 100) },
                  { label: "Hired", count: pipeline.hired, color: "bg-green-500", pct: Math.round((pipeline.hired / pipeline.total) * 100) },
                  { label: "Rejected", count: pipeline.rejected, color: "bg-red-500/60", pct: Math.round((pipeline.rejected / pipeline.total) * 100) },
                ].map(stage => (
                  <div key={stage.label}>
                    <div className="flex items-center justify-between text-[10px] mb-0.5">
                      <span className="text-muted-foreground">{stage.label}</span>
                      <span className="font-mono font-medium">{stage.count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-border/20 overflow-hidden">
                      <div className={`h-full rounded-full ${stage.color}`} style={{ width: `${Math.max(stage.pct, stage.count > 0 ? 4 : 0)}%` }} />
                    </div>
                  </div>
                ))}
                <p className="text-[9px] text-muted-foreground text-center pt-1">{pipeline.total} total applicants</p>
              </div>
            ) : (
              <div className="text-center py-3">
                <UserPlus className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                <p className="text-[10px] text-muted-foreground">No applicants yet</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Integration Health */}
        <Card className="border-border/40">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold flex items-center gap-1.5"><Plug className="h-3.5 w-3.5 text-green-500" /> Integrations</h3>
              <Link href="/admin/settings"><Badge variant="outline" className="text-[9px] cursor-pointer hover:bg-accent">Settings</Badge></Link>
            </div>
            {intHealth && intHealth.configured > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-center gap-4 py-1">
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono text-green-500">{intHealth.active}</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Active</p>
                  </div>
                  <div className="h-6 w-px bg-border/40" />
                  <div className="text-center">
                    <p className="text-xl font-bold font-mono text-muted-foreground">{intHealth.configured}</p>
                    <p className="text-[8px] text-muted-foreground uppercase">Configured</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 justify-center pt-1">
                  {intHealth.providers.map(p => (
                    <Badge key={p.provider} variant={p.active ? "default" : "outline"}
                      className={`text-[8px] ${p.active ? "bg-green-500/15 text-green-500 border-green-500/30" : "text-muted-foreground"}`}>
                      <CircleDot className={`h-2 w-2 mr-0.5 ${p.active ? "text-green-500" : "text-muted-foreground/40"}`} />
                      {PROVIDER_LABELS[p.provider] ?? p.provider}
                    </Badge>
                  ))}
                </div>
              </div>
            ) : (
              <div className="text-center py-3">
                <Plug className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                <p className="text-[10px] text-muted-foreground">No integrations configured</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payroll Readiness */}
        <Card className="border-border/40">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-emerald-500" /> Payroll Readiness</h3>
              <Badge variant="outline" className={`text-[9px] ${payroll && payroll.readyPct >= 100 ? "text-green-500 border-green-500/30" : "text-amber-500 border-amber-500/30"}`}>
                {payroll?.readyPct ?? 100}% ready
              </Badge>
            </div>
            {payroll && payroll.totalHours > 0 ? (
              <div className="space-y-2">
                <ProgressBar value={payroll.approvedHours} max={payroll.totalHours} color="bg-emerald-500" />
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-emerald-500/10 p-2 text-center">
                    <p className="text-base font-bold font-mono text-emerald-500">{payroll.approvedHours}h</p>
                    <p className="text-[7px] text-muted-foreground uppercase">Approved</p>
                  </div>
                  <div className="rounded-lg bg-amber-500/10 p-2 text-center">
                    <p className="text-base font-bold font-mono text-amber-500">{payroll.unapprovedHours}h</p>
                    <p className="text-[7px] text-muted-foreground uppercase">Pending</p>
                  </div>
                </div>
                <p className="text-[9px] text-muted-foreground text-center">{payroll.totalHours}h total (last 14 days)</p>
              </div>
            ) : (
              <div className="text-center py-3">
                <DollarSign className="h-6 w-6 text-muted-foreground/30 mx-auto mb-1.5" />
                <p className="text-[10px] text-muted-foreground">No timesheet data yet</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid gap-3 lg:grid-cols-3">
        <Card className="border-border/40 lg:col-span-2">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold flex items-center gap-1.5"><Clock className="h-3.5 w-3.5 text-amber-500" /> Weekly Hours</h3>
              <span className="text-[10px] text-muted-foreground">{hrs}h total</span>
            </div>
            <MiniBarChart data={intel.weeklyHours} color="#f59e0b" />
            <div className="flex justify-between mt-1">
              {intel.dayLabels.map((d) => <span key={d} className="text-[8px] text-muted-foreground">{d}</span>)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><BarChart3 className="h-3.5 w-3.5 text-primary" /> Composition</h3>
            <DonutChart segments={compositionSegs} />
            <div className="mt-2 space-y-0.5">
              {compositionSegs.map((s) => (
                <div key={s.label} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: s.color }} />
                    <span className="text-muted-foreground">{s.label}</span>
                  </div>
                  <span className="font-mono font-medium">{s.value}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottom Row: Incidents + Personnel + Onboarding + Activity */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/40">
          <CardContent className="p-3">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold flex items-center gap-1.5"><AlertTriangle className="h-3.5 w-3.5 text-red-500" /> Incidents</h3>
              <span className="text-[10px] text-muted-foreground">{(intel.weeklyIncidents).reduce((a: number, b: number) => a + b, 0)} this week</span>
            </div>
            <MiniBarChart data={intel.weeklyIncidents} color="#ef4444" />
            <div className="flex justify-between mt-1">
              {intel.dayLabels.map((d) => <span key={d} className="text-[8px] text-muted-foreground">{d}</span>)}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/40">
          <CardContent className="p-3">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><Users className="h-3.5 w-3.5 text-blue-500" /> Personnel Status</h3>
            {pers.total > 0 ? (
              <div className="space-y-2">
                <div className="flex h-2.5 rounded-full overflow-hidden">
                  {statusBkdn.map((s) => (
                    <div key={s.label} className={`${s.color}`} style={{ width: `${s.pct}%` }} />
                  ))}
                </div>
                {statusBkdn.map((s) => (
                  <div key={s.label} className="flex items-center justify-between text-[10px]">
                    <div className="flex items-center gap-1">
                      <span className={`h-1.5 w-1.5 rounded-full ${s.color}`} />
                      <span className="text-muted-foreground">{s.label}</span>
                    </div>
                    <span className="font-mono font-medium">{s.count}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-[10px] text-muted-foreground text-center py-3">No personnel data</p>
            )}
          </CardContent>
        </Card>

        {/* Onboarding */}
        <Card className="border-border/40">
          <CardContent className="p-3">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5 text-cyan-500" /> Onboarding</h3>
            {ownerIntel?.onboarding && ownerIntel.onboarding.length > 0 ? (
              <div className="space-y-2">
                {ownerIntel.onboarding.slice(0, 4).map(ob => (
                  <div key={ob.id} className="flex items-center gap-2 text-[10px]">
                    <div className={`h-2 w-2 rounded-full ${ob.complete ? "bg-green-500" : "bg-amber-500 animate-pulse"}`} />
                    <span className="flex-1 truncate font-medium">{ob.name}</span>
                    <span className="text-muted-foreground">{ob.hireDate ? hireDaysAgo(ob.hireDate) : ""}</span>
                  </div>
                ))}
                {ownerIntel.onboarding.length > 4 && (
                  <p className="text-[9px] text-muted-foreground text-center">+{ownerIntel.onboarding.length - 4} more</p>
                )}
              </div>
            ) : (
              <div className="text-center py-2">
                <CheckCircle2 className="h-5 w-5 text-green-500/40 mx-auto mb-1" />
                <p className="text-[10px] text-muted-foreground">All onboarded</p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Activity */}
        <Card className="border-border/40">
          <CardContent className="p-3">
            <h3 className="text-xs font-semibold mb-2 flex items-center gap-1.5"><FileText className="h-3.5 w-3.5 text-rose-500" /> Activity</h3>
            <div className="space-y-2">
              {[
                { label: "Patrols Today", value: intel.activity.patrols, icon: Footprints, color: "text-emerald-500" },
                { label: "Training Done", value: intel.activity.training, icon: GraduationCap, color: "text-violet-500" },
                { label: "Shifts (7d)", value: intel.activity.shifts, icon: Calendar, color: "text-blue-500" },
                { label: "Forms Filed", value: fc, icon: ClipboardList, color: "text-rose-500" },
                { label: "Notifications (7d)", value: ownerIntel?.notificationsSent ?? 0, icon: Bell, color: "text-amber-500" },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between text-[10px]">
                  <div className="flex items-center gap-1">
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

      <p className="text-[9px] text-center text-muted-foreground/50">
        All data is queried live from your organization&apos;s database. Last refreshed {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}.
      </p>
    </div>
  );
}
