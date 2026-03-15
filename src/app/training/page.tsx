"use client";

import { useEffect, useState, useCallback } from "react";
import { BookOpen, Target, ChevronRight, Zap, ShieldCheck, AlertTriangle, TrendingUp, FileText } from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/dashboard-layout";
import { useAuthStore } from "@/stores/auth-store";
import { getQuizzes, getKBFolders } from "@/lib/supabase/db";

function RadialGauge({ value, label, color }: { value: number; label: string; color: string }) {
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (value / 100) * circumference;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative h-24 w-24">
        <svg className="h-24 w-24 -rotate-90" viewBox="0 0 96 96">
          <circle cx="48" cy="48" r="40" fill="none" stroke="currentColor" strokeWidth="6" className="text-border/30" />
          <circle cx="48" cy="48" r="40" fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
            strokeDasharray={circumference} strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-lg font-bold font-mono">{value}%</span>
        </div>
      </div>
      <span className="text-xs text-muted-foreground font-medium">{label}</span>
    </div>
  );
}

export default function TrainingPage() {
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const [quizCount, setQuizCount] = useState(0);
  const [folderCount, setFolderCount] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!activeCompanyId || activeCompanyId === "pending") { setLoaded(true); return; }
    try {
      const [q, f] = await Promise.all([
        getQuizzes(activeCompanyId),
        getKBFolders(activeCompanyId),
      ]);
      setQuizCount(q.length);
      setFolderCount(f.length);
    } catch {} finally { setLoaded(true); }
  }, [activeCompanyId]);

  useEffect(() => { load(); }, [load]);

  const readinessLevel = quizCount > 0 || folderCount > 0 ? "ACTIVE" : "STANDBY";
  const readinessColor = readinessLevel === "ACTIVE" ? "text-green-500" : "text-amber-500";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Header with readiness indicator */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight font-mono">READINESS CENTER</h1>
            <p className="text-sm text-muted-foreground">Tactical training, SOPs, and operational drills</p>
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-1.5">
            <span className={`h-2 w-2 rounded-full ${readinessLevel === "ACTIVE" ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
            <span className={`text-xs font-mono font-bold ${readinessColor}`}>{readinessLevel}</span>
          </div>
        </div>

        {/* Readiness gauges */}
        <Card className="border-border/40 bg-gradient-to-br from-card to-card/80">
          <CardContent className="py-6">
            <div className="flex items-center justify-around">
              <RadialGauge value={loaded ? (folderCount > 0 ? 100 : 0) : 0} label="SOPs Loaded" color="#3b82f6" />
              <RadialGauge value={loaded ? (quizCount > 0 ? Math.min(quizCount * 25, 100) : 0) : 0} label="Drill Readiness" color="#f59e0b" />
              <RadialGauge value={0} label="Certs Current" color="#10b981" />
            </div>
          </CardContent>
        </Card>

        {/* Action cards — larger, more tactile */}
        <div className="grid gap-4 sm:grid-cols-2">
          <Link href="/knowledge-base">
            <Card className="group relative h-full cursor-pointer overflow-hidden border-border/40 transition-all hover:border-blue-500/40 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-1">
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-blue-500/5 transition-transform group-hover:scale-150" />
              <CardContent className="relative flex items-start gap-4 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-blue-500/10 transition-transform group-hover:scale-110">
                  <BookOpen className="h-7 w-7 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">Field Manual</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">SOPs, protocols, and reference materials</p>
                  {loaded && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        <FileText className="mr-1 h-3 w-3" />
                        {folderCount} {folderCount === 1 ? "section" : "sections"}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>

          <Link href="/quizzes">
            <Card className="group relative h-full cursor-pointer overflow-hidden border-border/40 transition-all hover:border-amber-500/40 hover:shadow-lg hover:shadow-amber-500/5 hover:-translate-y-1">
              <div className="absolute top-0 right-0 h-32 w-32 translate-x-8 -translate-y-8 rounded-full bg-amber-500/5 transition-transform group-hover:scale-150" />
              <CardContent className="relative flex items-start gap-4 p-6">
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-amber-500/10 transition-transform group-hover:scale-110">
                  <Target className="h-7 w-7 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-base">Drills</h3>
                    <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 group-hover:translate-x-1" />
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">Training assessments and readiness checks</p>
                  {loaded && (
                    <div className="mt-3 flex items-center gap-2">
                      <Badge variant="secondary" className="text-[10px] font-mono">
                        <Zap className="mr-1 h-3 w-3" />
                        {quizCount} {quizCount === 1 ? "drill" : "drills"} available
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </Link>
        </div>

        {/* Status cards row */}
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
            <ShieldCheck className="h-5 w-5 text-green-500" />
            <div>
              <p className="text-xs text-muted-foreground">Certifications</p>
              <p className="text-sm font-semibold font-mono">—</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">Expiring Soon</p>
              <p className="text-sm font-semibold font-mono">—</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">Completion Rate</p>
              <p className="text-sm font-semibold font-mono">—</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
