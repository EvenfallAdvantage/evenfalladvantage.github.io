"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Compass, Loader2, RefreshCw, BookOpen, BarChart3, ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import {
  getQuizzes, getKBFolders, getUserCertifications,
  getTrainingModules, getMyModuleProgress,
} from "@/lib/supabase/db";
import {
  getLegacyCourses, getLegacyCourseModules, getLegacyEnrollments,
  getLegacyProgress, getLegacyAssessmentResults, getLegacyCertificates,
  findLegacyStudentByEmail, createLegacyStudentProfile,
  type LegacyCourse, type LegacyCourseModule, type LegacyEnrollment,
  type LegacyModuleProgress, type LegacyAssessmentResult, type LegacyCertificate,
} from "@/lib/legacy-bridge";
import type { TrainingModule, StudentModuleProgress } from "@/types";
import { usePageHeader } from "@/stores/page-header-store";

import ReadinessGauges from "./components/readiness-gauges";
import TrainingModulesSection from "./components/training-modules-section";
import type { ModuleWithProgress } from "./components/training-modules-section";
import CertificationsSection from "./components/certifications-section";
import AcademyQuickLinks from "./components/academy-quick-links";
import { CoursesTab, ProgressTab, AssessmentsTab } from "./components/legacy-course-tabs";

type Cert = { id: string; cert_type: string; issue_date: string | null; expiry_date: string | null; status: string };
type LinkedQuiz = { id: string; title: string; passing_score: number };
type Tab = "courses" | "progress" | "assessments";

export default function AcademyPage() {
  const user = useAuthStore((s) => s.user);
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const hiddenTabs = new Set(activeCompany?.settings?.hiddenTabs ?? []);
  const showCourses = !hiddenTabs.has("/courses");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader("ACADEMY HUB", "Training, SOPs, assessments & certifications", <Compass className="h-5 w-5" />);
    return () => clearHeader();
  }, [setHeader, clearHeader]);

  const [tab, setTab] = useState<Tab>("courses");
  const [loading, setLoading] = useState(true);
  const [linking, setLinking] = useState(false);

  // Overwatch data
  const [owModules, setOwModules] = useState<ModuleWithProgress[]>([]);
  const [quizCount, setQuizCount] = useState(0);
  const [folderCount, setFolderCount] = useState(0);
  const [owCerts, setOwCerts] = useState<Cert[]>([]);

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
      const companyReady = activeCompanyId && activeCompanyId !== "pending";
      const owPromises = companyReady ? [
        getTrainingModules(activeCompanyId),
        getMyModuleProgress(activeCompanyId),
        getQuizzes(activeCompanyId),
        getKBFolders(activeCompanyId),
        getUserCertifications(),
      ] : [[], [], [], [], []];

      let studentId: string | null = null;
      if (user?.email) {
        try {
          const existing = await findLegacyStudentByEmail(user.email);
          if (existing) {
            studentId = existing.id;
          } else {
            setLinking(true);
            const result = await createLegacyStudentProfile(user.id, user.email, user.firstName || "", user.lastName || "");
            setLinking(false);
            if (result.success) studentId = user.id;
          }
        } catch (linkErr) {
          console.warn("Legacy student linking failed (non-fatal):", linkErr);
          setLinking(false);
        }
      }

      const [mods, modProgress, q, f, c] = await Promise.all(owPromises);

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

  // Computed helpers
  const now = new Date();
  const completedOw = owModules.filter((m) => m.progress?.status === "completed");
  const owProgress = owModules.length > 0 ? Math.round((completedOw.length / owModules.length) * 100) : 0;
  const activeOwCerts = owCerts.filter((c) => c.status === "active");
  const expiringSoon = owCerts.filter((c) => { if (!c.expiry_date) return false; const d = new Date(c.expiry_date).getTime() - now.getTime(); return d > 0 && d < 90 * 24 * 60 * 60 * 1000; });
  const certPercent = activeOwCerts.length > 0 ? Math.round((activeOwCerts.filter((c) => !c.expiry_date || new Date(c.expiry_date) > now).length / activeOwCerts.length) * 100) : 0;
  const readinessLevel = completedOw.length > 0 || quizCount > 0 ? "ACTIVE" : "STANDBY";

  const enrolledCourseIds = new Set(enrollments.map((e) => e.course_id));
  const completedModuleIds = new Set(progress.filter((p) => p.status === "completed").map((p) => p.module_id));

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
      {/* Readiness indicator */}
      <div className="flex items-center gap-2 justify-end">
        <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-1.5">
          <span className={`h-2 w-2 rounded-full ${readinessLevel === "ACTIVE" ? "bg-green-500 animate-pulse" : "bg-amber-500"}`} />
          <span className={`text-xs font-mono font-bold ${readinessLevel === "ACTIVE" ? "text-green-500" : "text-amber-500"}`}>{readinessLevel}</span>
        </div>
        <Button size="sm" variant="outline" className="gap-1.5" onClick={loadAll}>
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </Button>
      </div>

      <ReadinessGauges owProgress={owProgress} quizCount={quizCount} certPercent={certPercent} />

      <TrainingModulesSection modules={owModules} />

      <AcademyQuickLinks
        folderCount={folderCount}
        quizCount={quizCount}
        activeOwCertsCount={activeOwCerts.length}
        expiringSoonCount={expiringSoon.length}
        owProgress={owProgress}
      />

      <CertificationsSection
        owCerts={owCerts}
        legacyCertificates={certificates}
        onCertsChange={setOwCerts}
      />

      {/* Legacy Courses Section */}
      {showCourses && <div className="space-y-4">
        <h2 className="text-lg font-semibold">Course Catalog</h2>
        <div className="flex gap-1 rounded-lg bg-muted/50 p-1 w-fit overflow-x-auto">
          {([
            { id: "courses" as Tab, label: "Courses", icon: BookOpen },
            { id: "progress" as Tab, label: "Progress", icon: BarChart3 },
            { id: "assessments" as Tab, label: "Assessments", icon: ShieldCheck },
          ]).map((t) => (
            <button key={t.id} onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-colors whitespace-nowrap ${tab === t.id ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground hover:bg-background/50"}`}>
              {tab === t.id && <t.icon className="h-3.5 w-3.5 text-primary" />} {t.label}
            </button>
          ))}
        </div>
        {tab === "courses" && <CoursesTab courses={courses} enrolledCourseIds={enrolledCourseIds} courseModules={courseModules} completedModuleIds={completedModuleIds} />}
        {tab === "progress" && <ProgressTab progress={progress} />}
        {tab === "assessments" && <AssessmentsTab results={assessmentResults} />}
      </div>}
    </div>
  );
}


