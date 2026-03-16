"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Users, BookOpen, Award, CheckCircle2,
  Loader2, RefreshCw, ClipboardList, BarChart3,
  AlertTriangle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import { getCompanyMembers, getTrainingModules, getAllModuleProgress, getQuizzes } from "@/lib/supabase/db";

type Tab = "staff" | "modules" | "overview";

interface StaffMember {
  id: string;
  user: { id: string; first_name: string; last_name: string; email: string } | null;
  role: string;
  status: string;
}

interface TrainingModule {
  id: string;
  module_name: string;
  module_code: string;
  description: string | null;
  is_required: boolean;
  slide_count: number;
}

interface ProgressRecord {
  module_id: string;
  user_id: string;
  status: string;
  progress_percentage: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface Quiz { id: string; title: string; description: string | null; questions: any[]; passing_score: number }

export default function TrainingManagerPage() {
  const companyId = useAuthStore((s) => s.activeCompanyId);
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [progress, setProgress] = useState<ProgressRecord[]>([]);
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);

  const loadData = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    try {
      const [membersRaw, modulesRaw, progressRaw, quizzesRaw] = await Promise.all([
        getCompanyMembers(companyId),
        getTrainingModules(companyId),
        getAllModuleProgress(companyId),
        getQuizzes(companyId),
      ]);
      setStaff((membersRaw ?? []) as unknown as StaffMember[]);
      setModules((modulesRaw ?? []).map((m: Record<string, unknown>) => ({
        id: m.id as string,
        module_name: m.module_name as string,
        module_code: m.module_code as string,
        description: m.description as string | null,
        is_required: m.is_required as boolean,
        slide_count: m.slide_count as number,
      })));
      setProgress((progressRaw ?? []) as unknown as ProgressRecord[]);
      setQuizzes((quizzesRaw ?? []) as unknown as Quiz[]);
    } catch (err) {
      console.error("Training manager load error:", err);
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ─── Computed stats ───
  const totalStaff = staff.length;
  const requiredModules = modules.filter((m) => m.is_required);
  const completedProgress = progress.filter((p) => p.status === "completed");
  const inProgressCount = progress.filter((p) => p.status === "in_progress").length;

  // Per-staff completion rate for required modules
  function getStaffCompletion(userId: string) {
    if (requiredModules.length === 0) return { completed: 0, total: 0, pct: 100 };
    const completed = requiredModules.filter((m) =>
      progress.some((p) => p.user_id === userId && p.module_id === m.id && p.status === "completed")
    ).length;
    return { completed, total: requiredModules.length, pct: Math.round((completed / requiredModules.length) * 100) };
  }

  // Per-module completion rate
  function getModuleCompletion(moduleId: string) {
    if (totalStaff === 0) return { completed: 0, total: totalStaff, pct: 0 };
    const completed = staff.filter((s) =>
      progress.some((p) => p.user_id === (s.user?.id ?? "") && p.module_id === moduleId && p.status === "completed")
    ).length;
    return { completed, total: totalStaff, pct: Math.round((completed / totalStaff) * 100) };
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="text-center py-20 space-y-3">
        <ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/30" />
        <h2 className="text-lg font-bold">No Company Found</h2>
        <p className="text-sm text-muted-foreground">Training Manager requires a company account.</p>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "overview", label: "Overview", icon: <BarChart3 className="h-3.5 w-3.5" /> },
    { id: "staff", label: "Staff", icon: <Users className="h-3.5 w-3.5" /> },
    { id: "modules", label: "Modules", icon: <BookOpen className="h-3.5 w-3.5" /> },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight font-mono flex items-center gap-2">
            <ClipboardList className="h-5 w-5" /> TRAINING MANAGER
          </h1>
          <p className="text-xs text-muted-foreground">Track staff training progress and module completion</p>
        </div>
        <Button size="sm" variant="ghost" className="gap-1" onClick={loadData}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/30 rounded-lg p-1">
        {TABS.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ─── Overview Tab ─── */}
      {tab === "overview" && (
        <div className="space-y-4">
          {/* KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card className="border-border/40"><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono">{totalStaff}</p>
              <p className="text-[10px] text-muted-foreground">Staff Members</p>
            </CardContent></Card>
            <Card className="border-border/40"><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono">{modules.length}</p>
              <p className="text-[10px] text-muted-foreground">Training Modules</p>
            </CardContent></Card>
            <Card className="border-border/40"><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono text-green-500">{completedProgress.length}</p>
              <p className="text-[10px] text-muted-foreground">Completions</p>
            </CardContent></Card>
            <Card className="border-border/40"><CardContent className="p-3 text-center">
              <p className="text-2xl font-bold font-mono text-amber-500">{inProgressCount}</p>
              <p className="text-[10px] text-muted-foreground">In Progress</p>
            </CardContent></Card>
          </div>

          {/* Overall Company Compliance */}
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

          {/* Quizzes summary */}
          {quizzes.length > 0 && (
            <Card className="border-border/40">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><BookOpen className="h-4 w-4" /> Company Quizzes</h3>
                <div className="space-y-1">
                  {quizzes.map((q) => (
                    <div key={q.id} className="flex items-center justify-between p-2 rounded-lg border border-border/30">
                      <div>
                        <p className="text-xs font-medium">{q.title}</p>
                        {q.description && <p className="text-[10px] text-muted-foreground truncate max-w-[200px]">{q.description}</p>}
                      </div>
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

          {modules.length === 0 && quizzes.length === 0 && (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-10 text-center">
                <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm font-semibold">No training content yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create modules in Training Admin and quizzes in Drills to track staff progress here.</p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ─── Staff Tab ─── */}
      {tab === "staff" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{totalStaff} staff members</p>
          {staff.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-8 text-center">
                <Users className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold">No staff found</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-1">
              {staff.map((s) => {
                const comp = getStaffCompletion(s.user?.id ?? "");
                const name = s.user ? `${s.user.first_name ?? ""} ${s.user.last_name ?? ""}`.trim() : "Unknown";
                return (
                  <Card key={s.id} className="border-border/40">
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{name || s.user?.email}</p>
                          <Badge className="text-[9px] bg-muted">{s.role}</Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">{s.user?.email}</p>
                        {requiredModules.length > 0 && (
                          <div className="flex items-center gap-2 mt-1.5">
                            <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden max-w-[120px]">
                              <div className={`h-full rounded-full ${comp.pct === 100 ? "bg-green-500" : comp.pct >= 50 ? "bg-amber-500" : "bg-red-500"}`}
                                style={{ width: `${comp.pct}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-muted-foreground">{comp.completed}/{comp.total}</span>
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {comp.pct === 100 ? (
                          <CheckCircle2 className="h-4 w-4 text-green-500" />
                        ) : comp.total > 0 ? (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        ) : null}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ─── Modules Tab ─── */}
      {tab === "modules" && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground">{modules.length} modules ({requiredModules.length} required)</p>
          {modules.length === 0 ? (
            <Card className="border-dashed border-border/60">
              <CardContent className="py-8 text-center">
                <BookOpen className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
                <p className="text-sm font-semibold">No modules yet</p>
                <p className="text-xs text-muted-foreground">Create modules in Training Admin</p>
              </CardContent>
            </Card>
          ) : (
            modules.map((m) => {
              const mc = getModuleCompletion(m.id);
              return (
                <Card key={m.id} className="border-border/40">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-semibold">{m.module_name}</h3>
                        {m.is_required && <Badge className="text-[9px] bg-red-500/15 text-red-600">Required</Badge>}
                        <Badge className="text-[9px] bg-muted">{m.slide_count} slides</Badge>
                      </div>
                      <span className={`text-xs font-mono font-bold ${mc.pct === 100 ? "text-green-500" : mc.pct > 0 ? "text-amber-500" : "text-muted-foreground"}`}>
                        {mc.pct}%
                      </span>
                    </div>
                    {m.description && <p className="text-[10px] text-muted-foreground mb-2">{m.description}</p>}
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${mc.pct === 100 ? "bg-green-500" : mc.pct > 0 ? "bg-amber-500" : "bg-muted"}`}
                        style={{ width: `${mc.pct}%` }} />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{mc.completed} of {mc.total} staff completed</p>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
