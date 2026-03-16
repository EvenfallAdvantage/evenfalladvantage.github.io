"use client";

import { useState, useEffect, useCallback } from "react";
import {
  GraduationCap, BookOpen, Clock, Loader2, CheckCircle2,
  Award, BarChart3, Play, ChevronRight, Trophy,
  ShieldCheck, Star, Zap, AlertTriangle, RefreshCw,
  Target, FileText, Plus, Trash2, TrendingUp, Lock,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import {
  getQuizzes, getKBFolders, getUserCertifications,
  addCertification, deleteCertification,
  getTrainingModules, getMyModuleProgress,
} from "@/lib/supabase/db";
import {
  getLegacyCourses,
  getLegacyCourseModules,
  getLegacyEnrollments,
  getLegacyProgress,
  getLegacyAssessmentResults,
  getLegacyCertificates,
  findLegacyStudentByEmail,
  createLegacyStudentProfile,
  type LegacyCourse,
  type LegacyCourseModule,
  type LegacyEnrollment,
  type LegacyModuleProgress,
  type LegacyAssessmentResult,
  type LegacyCertificate,
} from "@/lib/legacy-bridge";
import type { TrainingModule, StudentModuleProgress } from "@/types";

type Cert = { id: string; cert_type: string; issue_date: string | null; expiry_date: string | null; status: string };
type LinkedQuiz = { id: string; title: string; passing_score: number };
type ModuleWithProgress = TrainingModule & { progress: StudentModuleProgress | null; linkedQuiz: LinkedQuiz | null };

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: "bg-green-500/15 text-green-600",
  Intermediate: "bg-blue-500/15 text-blue-600",
  Advanced: "bg-purple-500/15 text-purple-600",
  Critical: "bg-red-500/15 text-red-600",
  Essential: "bg-amber-500/15 text-amber-600",
};

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

type Tab = "courses" | "progress" | "assessments" | "certificates";

export default function AcademyPage() {
  const user = useAuthStore((s) => s.user);
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);

  const [tab, setTab] = useState<Tab>("courses");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);
  const [, setLegacyStudentId] = useState<string | null>(null);

  // Overwatch data (readiness center)
  const [owModules, setOwModules] = useState<ModuleWithProgress[]>([]);
  const [quizCount, setQuizCount] = useState(0);
  const [folderCount, setFolderCount] = useState(0);
  const [owCerts, setOwCerts] = useState<Cert[]>([]);
  const [showAddCert, setShowAddCert] = useState(false);
  const [certType, setCertType] = useState("");
  const [certIssue, setCertIssue] = useState("");
  const [certExpiry, setCertExpiry] = useState("");
  const [addingCert, setAddingCert] = useState(false);
  const [deletingCert, setDeletingCert] = useState<string | null>(null);

  // Legacy data
  const [courses, setCourses] = useState<LegacyCourse[]>([]);
  const [enrollments, setEnrollments] = useState<LegacyEnrollment[]>([]);
  const [courseModules, setCourseModules] = useState<Record<string, LegacyCourseModule[]>>({});
  const [progress, setProgress] = useState<LegacyModuleProgress[]>([]);
  const [assessmentResults, setAssessmentResults] = useState<LegacyAssessmentResult[]>([]);
  const [certificates, setCertificates] = useState<LegacyCertificate[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      // Load Overwatch data
      const companyReady = activeCompanyId && activeCompanyId !== "pending";
      const owPromises = companyReady ? [
        getTrainingModules(activeCompanyId),
        getMyModuleProgress(activeCompanyId),
        getQuizzes(activeCompanyId),
        getKBFolders(activeCompanyId),
        getUserCertifications(),
      ] : [[], [], [], [], []];

      // Load legacy data
      let studentId: string | null = null;
      if (user?.email) {
        const existing = await findLegacyStudentByEmail(user.email);
        if (existing) {
          studentId = existing.id;
        } else {
          setLinking(true);
          const result = await createLegacyStudentProfile(user.id, user.email, user.firstName || "", user.lastName || "");
          setLinking(false);
          if (result.success) studentId = user.id;
        }
        setLegacyStudentId(studentId);
      }

      const [mods, modProgress, q, f, c] = await Promise.all(owPromises);

      // Build Overwatch modules with progress
      const progressMap = new Map((modProgress as StudentModuleProgress[]).map((p) => [p.module_id, p]));
      const quizByModule = new Map<string, LinkedQuiz>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const quiz of q as any[]) {
        if (quiz.module_id) quizByModule.set(quiz.module_id, { id: quiz.id, title: quiz.title, passing_score: quiz.passing_score });
      }
      setOwModules((mods as TrainingModule[]).map((m) => ({ ...m, progress: progressMap.get(m.id) ?? null, linkedQuiz: quizByModule.get(m.id) ?? null })));
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setQuizCount((q as any[]).length);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setFolderCount((f as any[]).length);
      setOwCerts(c as Cert[]);

      // Legacy courses
      const [coursesData, enrollmentsData] = await Promise.all([
        getLegacyCourses(),
        studentId ? getLegacyEnrollments(studentId) : Promise.resolve([]),
      ]);
      setCourses(coursesData);
      setEnrollments(enrollmentsData);
      const modulesMap: Record<string, LegacyCourseModule[]> = {};
      await Promise.all(coursesData.map(async (co) => { modulesMap[co.id] = await getLegacyCourseModules(co.id); }));
      setCourseModules(modulesMap);
      if (studentId) {
        const [pd, ad, cd] = await Promise.all([getLegacyProgress(studentId), getLegacyAssessmentResults(studentId), getLegacyCertificates(studentId)]);
        setProgress(pd); setAssessmentResults(ad); setCertificates(cd);
      }
    } catch (err) { console.error("Academy load error:", err); } finally { setLoading(false); }
  }, [user, activeCompanyId]);

  useEffect(() => { loadAll(); }, [loadAll]);

  async function handleAddCert() {
    if (!certType.trim()) return;
    setAddingCert(true);
    try {
      await addCertification({ certType: certType.trim(), issueDate: certIssue || undefined, expiryDate: certExpiry || undefined });
      setCertType(""); setCertIssue(""); setCertExpiry(""); setShowAddCert(false);
      setOwCerts(await getUserCertifications() as Cert[]);
    } catch (err) { console.error(err); } finally { setAddingCert(false); }
  }
  async function handleDeleteCert(id: string) {
    if (!confirm("Delete this certification?")) return;
    setDeletingCert(id);
    try { await deleteCertification(id); setOwCerts(await getUserCertifications() as Cert[]); }
    catch (err) { console.error(err); } finally { setDeletingCert(null); }
  }

  // Overwatch readiness helpers
  const now = new Date();
  const completedOw = owModules.filter((m) => m.progress?.status === "completed");
  const inProgressOw = owModules.filter((m) => m.progress?.status === "in_progress");
  const owProgress = owModules.length > 0 ? Math.round((completedOw.length / owModules.length) * 100) : 0;
  const activeOwCerts = owCerts.filter((c) => c.status === "active");
  const expiringSoon = owCerts.filter((c) => { if (!c.expiry_date) return false; const d = new Date(c.expiry_date).getTime() - now.getTime(); return d > 0 && d < 90 * 24 * 60 * 60 * 1000; });
  const certPercent = activeOwCerts.length > 0 ? Math.round((activeOwCerts.filter((c) => !c.expiry_date || new Date(c.expiry_date) > now).length / activeOwCerts.length) * 100) : 0;
  const readinessLevel = completedOw.length > 0 || quizCount > 0 ? "ACTIVE" : "STANDBY";

  // Legacy helpers
  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));
  const completedModuleIds = new Set(progress.filter((p) => p.status === "completed").map((p) => p.module_id));
  const legacyCerts = certificates.filter((c) => c.status !== "revoked").length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{linking ? "Linking your training account..." : "Loading academy..."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with readiness indicator */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight font-mono flex items-center gap-2">
            <GraduationCap className="h-5 w-5 sm:h-6 sm:w-6" /> ACADEMY
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Training, SOPs, assessments &amp; certifications</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-1.5">
            <span className={`h-2 w-2 rounded-full ${readinessLevel === "ACTIVE" ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
            <span className={`text-xs font-mono font-bold ${readinessLevel === "ACTIVE" ? "text-green-500" : "text-amber-500"}`}>{readinessLevel}</span>
          </div>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={loadAll}>
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Readiness Gauges */}
      <Card className="border-border/40 bg-gradient-to-br from-card to-card/80">
        <CardContent className="py-6">
          <div className="flex items-center justify-around">
            <RadialGauge value={owProgress} label="Module Progress" color="#3b82f6" />
            <RadialGauge value={quizCount > 0 ? Math.min(quizCount * 25, 100) : 0} label="Drill Readiness" color="#f59e0b" />
            <RadialGauge value={certPercent} label="Certs Current" color="#10b981" />
          </div>
        </CardContent>
      </Card>

      {/* Training Modules */}
      {owModules.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">Training Modules</h2>
              <p className="text-xs text-muted-foreground">
                {completedOw.length}/{owModules.length} completed
                {inProgressOw.length > 0 && ` · ${inProgressOw.length} in progress`}
              </p>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {owModules.map((mod) => {
              const p = mod.progress;
              const isCompleted = p?.status === "completed";
              const isInProgress = p?.status === "in_progress";
              const pct = p?.progress_percentage ?? 0;
              return (
                <Link key={mod.id} href={`/training/viewer?id=${mod.id}`}>
                  <Card className={`group relative h-full cursor-pointer overflow-hidden border-border/40 transition-all hover:shadow-lg hover:-translate-y-0.5 ${isCompleted ? "border-green-500/30 hover:border-green-500/50" : isInProgress ? "border-blue-500/30 hover:border-blue-500/50" : "hover:border-border"}`}>
                    {isCompleted && <div className="absolute top-2 right-2"><CheckCircle2 className="h-5 w-5 text-green-500" /></div>}
                    <CardContent className="p-4">
                      <div className="flex items-start gap-3">
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${isCompleted ? "bg-green-500/10" : isInProgress ? "bg-blue-500/10" : "bg-muted"}`}>
                          <GraduationCap className={`h-5 w-5 ${isCompleted ? "text-green-500" : isInProgress ? "text-blue-500" : "text-muted-foreground"}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-sm font-semibold leading-tight truncate">{mod.module_name}</h3>
                          {mod.description && <p className="mt-0.5 text-xs text-muted-foreground line-clamp-2">{mod.description}</p>}
                          <div className="mt-2 flex flex-wrap items-center gap-1.5">
                            <Badge className={`text-[9px] ${DIFFICULTY_COLORS[mod.difficulty_level] ?? "bg-muted text-muted-foreground"}`}>{mod.difficulty_level}</Badge>
                            <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><Clock className="h-3 w-3" /> {mod.duration_minutes}m</span>
                            {(mod.slide_count ?? 0) > 0 && <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground"><FileText className="h-3 w-3" /> {mod.slide_count} slides</span>}
                            {mod.is_required && <Badge className="text-[9px] bg-red-500/10 text-red-500">Required</Badge>}
                            {mod.linkedQuiz && <span className="flex items-center gap-0.5 text-[10px] text-amber-600"><Target className="h-3 w-3" /> Quiz</span>}
                          </div>
                        </div>
                      </div>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[10px] mb-1">
                          <span className="text-muted-foreground font-mono">{isCompleted ? "Complete" : isInProgress ? `${pct}%` : "Not started"}</span>
                          <span className="flex items-center gap-1 text-muted-foreground">
                            {isCompleted ? <CheckCircle2 className="h-3 w-3 text-green-500" /> : isInProgress ? <Play className="h-3 w-3 text-blue-500" /> : (mod.slide_count ?? 0) === 0 ? <Lock className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                            {isCompleted ? "Done" : isInProgress ? "Continue" : (mod.slide_count ?? 0) === 0 ? "No content" : "Start"}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-border/40 overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${isCompleted ? "bg-green-500" : isInProgress ? "bg-blue-500" : "bg-transparent"}`} style={{ width: `${isCompleted ? 100 : pct}%` }} />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>
      )}
      {owModules.length === 0 && (
        <Card className="border-dashed border-border/60">
          <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
            <GraduationCap className="h-10 w-10 text-muted-foreground/30" />
            <h3 className="text-sm font-semibold">No Training Modules Yet</h3>
            <p className="text-xs text-muted-foreground max-w-xs">Training modules will appear here once your company admin creates them.</p>
          </CardContent>
        </Card>
      )}

      {/* Quick links — Field Manual & Drills */}
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
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-mono"><FileText className="mr-1 h-3 w-3" />{folderCount} {folderCount === 1 ? "section" : "sections"}</Badge>
                </div>
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
                <div className="mt-3 flex items-center gap-2">
                  <Badge variant="secondary" className="text-[10px] font-mono"><Zap className="mr-1 h-3 w-3" />{quizCount} {quizCount === 1 ? "drill" : "drills"} available</Badge>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* Status cards */}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
          <ShieldCheck className="h-5 w-5 text-green-500" />
          <div><p className="text-xs text-muted-foreground">Certifications</p><p className="text-sm font-semibold font-mono">{activeOwCerts.length}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
          <AlertTriangle className="h-5 w-5 text-amber-500" />
          <div><p className="text-xs text-muted-foreground">Expiring Soon</p><p className="text-sm font-semibold font-mono">{expiringSoon.length}</p></div>
        </div>
        <div className="flex items-center gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          <div><p className="text-xs text-muted-foreground">Module Progress</p><p className="text-sm font-semibold font-mono">{owProgress}%</p></div>
        </div>
      </div>

      {/* My Certifications */}
      <Card className="border-border/40">
        <CardContent className="space-y-4 pt-6">
          <div className="flex items-center justify-between">
            <div><h3 className="text-sm font-semibold">My Certifications</h3><p className="text-xs text-muted-foreground">Guard cards, licenses, and credentials</p></div>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setShowAddCert(true)}><Plus className="h-3.5 w-3.5" /> Add</Button>
          </div>
          {showAddCert && (
            <div className="space-y-2 rounded-lg border border-primary/30 bg-primary/5 p-3">
              <Input placeholder="Certification type (e.g. Guard Card, CPR, BSIS) *" value={certType} onChange={(e) => setCertType(e.target.value)} />
              <div className="flex gap-2">
                <div className="flex-1"><label className="text-[10px] text-muted-foreground">Issue Date</label><Input type="date" value={certIssue} onChange={(e) => setCertIssue(e.target.value)} className="h-8 text-sm" /></div>
                <div className="flex-1"><label className="text-[10px] text-muted-foreground">Expiry Date</label><Input type="date" value={certExpiry} onChange={(e) => setCertExpiry(e.target.value)} className="h-8 text-sm" /></div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={handleAddCert} disabled={!certType.trim() || addingCert}>{addingCert ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save"}</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddCert(false)}>Cancel</Button>
              </div>
            </div>
          )}
          {owCerts.length === 0 ? (
            <div className="flex items-center gap-3 rounded-lg border border-dashed border-border/60 p-4">
              <ShieldCheck className="h-5 w-5 text-muted-foreground/40" />
              <p className="text-xs text-muted-foreground">No certifications added yet. Add your guard card, CPR, or other credentials.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {owCerts.map((c) => {
                const isExpired = c.expiry_date && new Date(c.expiry_date) < now;
                const isExpiringSoon = c.expiry_date && !isExpired && (new Date(c.expiry_date).getTime() - now.getTime()) < 90 * 24 * 60 * 60 * 1000;
                return (
                  <div key={c.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2.5">
                    <ShieldCheck className={`h-4 w-4 shrink-0 ${isExpired ? "text-red-500" : isExpiringSoon ? "text-amber-500" : "text-green-500"}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{c.cert_type}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        {c.issue_date && <span>Issued: {new Date(c.issue_date).toLocaleDateString()}</span>}
                        {c.expiry_date && <span>Expires: {new Date(c.expiry_date).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    {isExpired ? <Badge className="text-[9px] bg-red-500/15 text-red-600">Expired</Badge>
                      : isExpiringSoon ? <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Expiring</Badge>
                      : <Badge className="text-[9px] bg-green-500/15 text-green-600">Active</Badge>}
                    <button onClick={() => handleDeleteCert(c.id)} disabled={deletingCert === c.id}
                      className="rounded p-1 text-muted-foreground/40 hover:text-red-500 hover:bg-red-500/10" title="Delete">
                      {deletingCert === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legacy Courses Section */}
      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Course Catalog</h2>
        <div className="flex items-center gap-1 border-b border-border/40 overflow-x-auto">
          {([
            { id: "courses" as Tab, label: "Courses", icon: BookOpen },
            { id: "progress" as Tab, label: "Progress", icon: BarChart3 },
            { id: "assessments" as Tab, label: "Assessments", icon: ShieldCheck },
            { id: "certificates" as Tab, label: "Certificates", icon: Award },
          ]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`px-3 py-2 text-xs sm:text-sm font-medium border-b-2 transition-colors whitespace-nowrap flex items-center gap-1.5 ${tab === t.id ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
              <t.icon className="h-3.5 w-3.5" /> {t.label}
              {t.id === "certificates" && legacyCerts > 0 && (
                <span className="ml-1 bg-amber-500/15 text-amber-600 text-[10px] px-1.5 py-0.5 rounded-full font-mono">{legacyCerts}</span>
              )}
            </button>
          ))}
        </div>
        {tab === "courses" && <CoursesTab courses={courses} enrolledCourseIds={enrolledCourseIds} courseModules={courseModules} completedModuleIds={completedModuleIds} />}
        {tab === "progress" && <ProgressTab progress={progress} />}
        {tab === "assessments" && <AssessmentsTab results={assessmentResults} />}
        {tab === "certificates" && <CertificatesTab certificates={certificates} />}
      </div>
    </div>
  );
}

// ─── Courses Tab ─────────────────────────────────────

function CoursesTab({
  courses,
  enrolledCourseIds,
  courseModules,
  completedModuleIds,
}: {
  courses: LegacyCourse[];
  enrolledCourseIds: Set<string>;
  courseModules: Record<string, LegacyCourseModule[]>;
  completedModuleIds: Set<string>;
}) {
  const enrolled = courses.filter((c) => enrolledCourseIds.has(c.id));
  const available = courses.filter((c) => !enrolledCourseIds.has(c.id));

  return (
    <div className="space-y-6">
      {/* Enrolled Courses */}
      {enrolled.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Play className="h-3.5 w-3.5 text-green-500" /> My Courses
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((course) => {
              const modules = courseModules[course.id] || [];
              const completedInCourse = modules.filter(
                (m) => completedModuleIds.has(m.module_id)
              ).length;
              const pct = modules.length > 0
                ? Math.round((completedInCourse / modules.length) * 100)
                : 0;

              return (
                <Card key={course.id} className="border-border/40 overflow-hidden group hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate">{course.course_name}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          {course.duration_hours && (
                            <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {course.duration_hours}h</span>
                          )}
                          <span>{modules.length} modules</span>
                        </div>
                      </div>
                      {pct === 100 ? (
                        <Badge className="bg-green-500/15 text-green-600 text-[10px] shrink-0">
                          <Trophy className="h-2.5 w-2.5 mr-0.5" /> Complete
                        </Badge>
                      ) : (
                        <Badge className="bg-primary/10 text-primary text-[10px] shrink-0 font-mono">
                          {pct}%
                        </Badge>
                      )}
                    </div>

                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full transition-all duration-500"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-muted-foreground">
                        {completedInCourse}/{modules.length} modules completed
                      </p>
                    </div>

                    {/* Module list preview */}
                    <div className="space-y-1">
                      {modules.slice(0, 4).map((m) => {
                        const mod = m.training_modules;
                        const done = completedModuleIds.has(m.module_id);
                        return (
                          <div key={m.id} className="flex items-center gap-2 text-xs">
                            {done ? (
                              <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" />
                            ) : (
                              <div className="h-3 w-3 rounded-full border border-border shrink-0" />
                            )}
                            <span className={done ? "text-muted-foreground line-through" : ""}>
                              {mod?.module_name || `Module ${m.module_order}`}
                            </span>
                          </div>
                        );
                      })}
                      {modules.length > 4 && (
                        <p className="text-[10px] text-muted-foreground pl-5">
                          +{modules.length - 4} more modules
                        </p>
                      )}
                    </div>

                    <Link href="/training">
                      <Button size="sm" className="w-full gap-1.5 text-xs">
                        <Play className="h-3 w-3" /> Continue Learning
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Available Courses */}
      {available.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Star className="h-3.5 w-3.5 text-amber-500" /> Available Courses
          </h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {available.map((course) => {
              const modules = courseModules[course.id] || [];
              const isFree = !course.price || course.price === 0;

              return (
                <Card key={course.id} className="border-border/40 overflow-hidden hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate">{course.course_name}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          {course.duration_hours && (
                            <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {course.duration_hours}h</span>
                          )}
                          {course.difficulty_level && (
                            <Badge className={`text-[9px] px-1 py-0 ${DIFFICULTY_COLORS[course.difficulty_level] || ""}`}>
                              {course.difficulty_level}
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        {isFree ? (
                          <Badge className="bg-green-500/15 text-green-600 text-[10px]">FREE</Badge>
                        ) : (
                          <span className="text-sm font-bold font-mono">${course.price}</span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {course.short_description || course.description || "Professional training course"}
                    </p>

                    {/* Learning objectives preview */}
                    {course.learning_objectives && course.learning_objectives.length > 0 && (
                      <div className="space-y-1">
                        {course.learning_objectives.slice(0, 3).map((obj, i) => (
                          <div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground">
                            <Zap className="h-2.5 w-2.5 text-primary shrink-0 mt-0.5" />
                            <span className="line-clamp-1">{obj}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">
                        {modules.length} modules
                      </span>
                      <Link href="/courses">
                        <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                          View Details <ChevronRight className="h-3 w-3" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {courses.length === 0 && (
        <div className="text-center py-12">
          <GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <h3 className="text-sm font-semibold">No courses available</h3>
          <p className="text-xs text-muted-foreground mt-1">Check back soon for new training programs</p>
        </div>
      )}
    </div>
  );
}

// ─── Progress Tab ────────────────────────────────────

function ProgressTab({ progress }: { progress: LegacyModuleProgress[] }) {
  if (progress.length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
        <h3 className="text-sm font-semibold">No progress yet</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Enroll in a course and start learning to see your progress here
        </p>
      </div>
    );
  }

  const sorted = [...progress].sort((a, b) => {
    if (a.status === "completed" && b.status !== "completed") return 1;
    if (a.status !== "completed" && b.status === "completed") return -1;
    return (b.progress_percentage || 0) - (a.progress_percentage || 0);
  });

  return (
    <div className="space-y-2">
      {sorted.map((p) => {
        const moduleName = p.training_modules?.module_name || "Unknown Module";
        const pct = Math.round(p.progress_percentage || 0);
        const done = p.status === "completed";

        return (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:border-border/60 transition-colors">
            {done ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : pct > 0 ? (
              <div className="h-5 w-5 rounded-full border-2 border-primary shrink-0 flex items-center justify-center">
                <div className="h-2 w-2 rounded-full bg-primary" />
              </div>
            ) : (
              <div className="h-5 w-5 rounded-full border-2 border-border shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{moduleName}</p>
              <p className="text-[10px] text-muted-foreground">
                {p.training_modules?.module_code}
                {p.completed_at && ` — Completed ${new Date(p.completed_at).toLocaleDateString()}`}
              </p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block">
                <div
                  className={`h-full rounded-full ${done ? "bg-green-500" : "bg-primary"}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className={`text-xs font-mono w-8 text-right ${done ? "text-green-500" : "text-muted-foreground"}`}>
                {pct}%
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Assessments Tab ─────────────────────────────────

function AssessmentsTab({ results }: { results: LegacyAssessmentResult[] }) {
  if (results.length === 0) {
    return (
      <div className="text-center py-12">
        <ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
        <h3 className="text-sm font-semibold">No assessment results</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Complete module assessments to see your scores here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {results.map((r) => {
        const name = r.assessments?.assessment_name || "Assessment";
        const passing = r.assessments?.passing_score || 80;
        const total = r.assessments?.total_questions || 0;

        return (
          <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40">
            {r.passed ? (
              <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{name}</p>
              <p className="text-[10px] text-muted-foreground">
                {r.state_code && `${r.state_code} — `}
                {total > 0 && `${total} questions — `}
                Passing: {passing}%
                {r.completed_at && ` — ${new Date(r.completed_at).toLocaleDateString()}`}
              </p>
            </div>
            <div className="shrink-0">
              <Badge className={`font-mono text-xs ${
                r.passed
                  ? "bg-green-500/15 text-green-600"
                  : r.score >= passing * 0.8
                    ? "bg-amber-500/15 text-amber-600"
                    : "bg-red-500/15 text-red-600"
              }`}>
                {r.score}%
              </Badge>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Certificates Tab ────────────────────────────────

function CertificatesTab({ certificates }: { certificates: LegacyCertificate[] }) {
  if (certificates.length === 0) {
    return (
      <div className="text-center py-12">
        <Award className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
        <h3 className="text-sm font-semibold">No certificates yet</h3>
        <p className="text-xs text-muted-foreground mt-1">
          Complete all course requirements and pass assessments to earn certificates
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {certificates.map((cert) => {
        const isRevoked = cert.status === "revoked";
        const isExpired = cert.expiration_date && new Date(cert.expiration_date) < new Date();

        return (
          <Card key={cert.id} className={`border-border/40 overflow-hidden ${isRevoked ? "opacity-50" : ""}`}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                    <Award className="h-4 w-4 text-amber-500" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold">
                      {cert.certificate_name || cert.certificate_type}
                    </h4>
                    {cert.certificate_number && (
                      <p className="text-[10px] text-muted-foreground font-mono">
                        #{cert.certificate_number}
                      </p>
                    )}
                  </div>
                </div>
                {isRevoked ? (
                  <Badge className="bg-red-500/15 text-red-600 text-[10px]">Revoked</Badge>
                ) : isExpired ? (
                  <Badge className="bg-amber-500/15 text-amber-600 text-[10px]">Expired</Badge>
                ) : (
                  <Badge className="bg-green-500/15 text-green-600 text-[10px]">Active</Badge>
                )}
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-[10px] text-muted-foreground">
                <div>
                  <span className="font-semibold text-foreground">Issued:</span>{" "}
                  {new Date(cert.issue_date).toLocaleDateString()}
                </div>
                {cert.expiration_date && (
                  <div>
                    <span className="font-semibold text-foreground">Expires:</span>{" "}
                    {new Date(cert.expiration_date).toLocaleDateString()}
                  </div>
                )}
                {cert.state_issued && (
                  <div>
                    <span className="font-semibold text-foreground">State:</span>{" "}
                    {cert.state_issued}
                  </div>
                )}
                {cert.issued_by_instructor && (
                  <div>
                    <span className="font-semibold text-foreground">Instructor:</span>{" "}
                    {cert.issued_by_instructor.first_name} {cert.issued_by_instructor.last_name}
                  </div>
                )}
              </div>

              {cert.verification_code && (
                <div className="pt-1 border-t border-border/30">
                  <p className="text-[10px] text-muted-foreground">
                    Verification: <span className="font-mono text-foreground">{cert.verification_code}</span>
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
