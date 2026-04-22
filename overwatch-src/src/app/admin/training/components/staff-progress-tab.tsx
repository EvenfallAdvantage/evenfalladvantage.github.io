"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2, BookOpen, CheckCircle2, BarChart3, Users, Award, AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getAllModuleProgress, getCompanyMembers, getQuizzes } from "@/lib/supabase/db";
import type { TrainingModule } from "@/types";

interface StaffProgressTabProps {
  activeCompanyId: string | null;
  modules: TrainingModule[];
}

export function StaffProgressTab({ activeCompanyId, modules }: StaffProgressTabProps) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [staff, setStaff] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [allProgress, setAllProgress] = useState<any[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [quizzes, setQuizzes] = useState<any[]>([]);
  const [progressLoading, setProgressLoading] = useState(false);

  const loadProgress = useCallback(async () => {
    if (!activeCompanyId) return;
    setProgressLoading(true);
    try {
      const [s, p, q] = await Promise.all([
        getCompanyMembers(activeCompanyId),
        getAllModuleProgress(activeCompanyId),
        getQuizzes(activeCompanyId),
      ]);
      setStaff(s ?? []);
      setAllProgress(p ?? []);
      setQuizzes(q ?? []);
    } catch (err) { console.error(err); }
    finally { setProgressLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadProgress(); }, [loadProgress]);

  const requiredModules = modules.filter((m) => m.is_required);
  const completedCount = allProgress.filter((p: { status: string }) => p.status === "completed").length;
  const inProgressCount = allProgress.filter((p: { status: string }) => p.status === "in_progress").length;

  function getStaffCompletion(userId: string) {
    if (requiredModules.length === 0) return { completed: 0, total: 0, pct: 100 };
    const done = requiredModules.filter((m) =>
      allProgress.some((p: { user_id: string; module_id: string; status: string }) => p.user_id === userId && p.module_id === m.id && p.status === "completed")
    ).length;
    return { completed: done, total: requiredModules.length, pct: Math.round((done / requiredModules.length) * 100) };
  }

  function getModuleCompletion(moduleId: string) {
    if (staff.length === 0) return { completed: 0, total: staff.length, pct: 0 };
    const done = staff.filter((s: { users: { id: string } | null }) =>
      allProgress.some((p: { user_id: string; module_id: string; status: string }) => p.user_id === (s.users?.id ?? "") && p.module_id === moduleId && p.status === "completed")
    ).length;
    return { completed: done, total: staff.length, pct: Math.round((done / staff.length) * 100) };
  }

  if (progressLoading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-border/40"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold font-mono">{staff.length}</p>
          <p className="text-[10px] text-muted-foreground">Staff</p>
        </CardContent></Card>
        <Card className="border-border/40"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold font-mono">{modules.length}</p>
          <p className="text-[10px] text-muted-foreground">Modules</p>
        </CardContent></Card>
        <Card className="border-border/40"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold font-mono text-green-500">{completedCount}</p>
          <p className="text-[10px] text-muted-foreground">Completions</p>
        </CardContent></Card>
        <Card className="border-border/40"><CardContent className="p-3 text-center">
          <p className="text-2xl font-bold font-mono text-amber-500">{inProgressCount}</p>
          <p className="text-[10px] text-muted-foreground">In Progress</p>
        </CardContent></Card>
      </div>

      {/* Required Training Compliance */}
      {requiredModules.length > 0 && (
        <Card className="border-border/40">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Award className="h-4 w-4" /> Required Training Compliance</h3>
            <div className="space-y-2">
              {requiredModules.map((m) => {
                const mc = getModuleCompletion(m.id);
                return (
                  <div key={m.id} className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium truncate">{m.module_name}</p>
                      <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${mc.pct === 100 ? "bg-green-500" : mc.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                          style={{ width: `${mc.pct}%` }} />
                      </div>
                    </div>
                    <span className={`text-xs font-mono font-bold ${mc.pct === 100 ? "text-green-500" : mc.pct >= 50 ? "text-amber-500" : "text-red-500"}`}>
                      {mc.completed}/{mc.total}
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Staff Roster with Progress */}
      {staff.length > 0 && (
        <Card className="border-border/40">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5"><Users className="h-4 w-4" /> Staff Training Status</h3>
            <div className="space-y-1">
              {staff.map((s: { id: string; users: { id: string; first_name: string; last_name: string; email: string } | null; role: string }) => {
                const comp = getStaffCompletion(s.users?.id ?? "");
                const name = s.users ? `${s.users.first_name ?? ""} ${s.users.last_name ?? ""}`.trim() : "Unknown";
                return (
                  <div key={s.id} className="flex items-center justify-between p-2 rounded-lg border border-border/30">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-xs font-medium truncate">{name || s.users?.email}</p>
                        <Badge className="text-[9px] bg-muted">{s.role}</Badge>
                      </div>
                      {requiredModules.length > 0 && (
                        <div className="flex items-center gap-2 mt-1">
                          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                            <div className={`h-full rounded-full ${comp.pct === 100 ? "bg-green-500" : comp.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                              style={{ width: `${comp.pct}%` }} />
                          </div>
                          <span className="text-[10px] font-mono text-muted-foreground">{comp.completed}/{comp.total}</span>
                        </div>
                      )}
                    </div>
                    {comp.pct === 100 ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : comp.total > 0 ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500" />
                    ) : null}
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quizzes */}
      {quizzes.length > 0 && (
        <Card className="border-border/40">
          <CardContent className="p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Company Quizzes</h3>
            <div className="space-y-1">
              {quizzes.map((q: { id: string; title: string; description: string | null; questions: unknown[]; passing_score: number }) => (
                <div key={q.id} className="flex items-center justify-between p-2 rounded-lg border border-border/30">
                  <p className="text-xs font-medium">{q.title}</p>
                  <div className="flex items-center gap-2">
                    <Badge className="text-[9px] bg-muted">{q.questions?.length ?? 0} Q&apos;s</Badge>
                    <Badge className="text-[9px] bg-primary/10 text-primary">Pass: {q.passing_score}%</Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {staff.length === 0 && modules.length === 0 && (
        <Card className="border-dashed border-border/60">
          <CardContent className="py-10 text-center">
            <BarChart3 className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-sm font-semibold">No data yet</p>
            <p className="text-xs text-muted-foreground mt-1">Create modules and add staff to track progress here.</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
