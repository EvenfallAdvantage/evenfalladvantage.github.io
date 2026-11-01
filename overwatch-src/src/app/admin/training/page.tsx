"use client";

import { SubTab, SubTabList } from "@/components/ui/sub-tabs";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  GraduationCap, Plus, HelpCircle, BookOpen, BarChart3, Calendar, Users, ClipboardCheck, AlertTriangle, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { canSeeAllTrainingClasses, type CompanyRole } from "@/lib/permissions";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";
import { logger } from "@/lib/logger";
import { resolveTrainingTab, visibleTrainingTabs, type TrainingHqTab } from "@/lib/training/hq-tabs";
import type { TrainingModule } from "@/types";
import { ModulesTab } from "./components/modules-tab";
import { QuestionBankTab } from "./components/question-bank-tab";
import { StaffProgressTab } from "./components/staff-progress-tab";
import { CoursesTab } from "../instructor/components/courses-tab";
import { ClassesTab } from "../instructor/components/classes-tab";
import { StudentsTab } from "../instructor/components/students-tab";
import { AssessmentsTab } from "../instructor/components/assessments-tab";

const TAB_META: Record<TrainingHqTab, { label: string; icon: React.ElementType; title: string; subtitle: string }> = {
  modules: { label: "Modules", icon: GraduationCap, title: "TRAINING MODULES", subtitle: "Build and publish training modules" },
  questions: { label: "Question Bank", icon: HelpCircle, title: "QUESTION BANK", subtitle: "Questions used across quizzes and assessments" },
  progress: { label: "Staff Progress", icon: BarChart3, title: "STAFF PROGRESS", subtitle: "Who has completed which training" },
  courses: { label: "Courses", icon: BookOpen, title: "COURSES", subtitle: "Instructor-led courses you offer" },
  classes: { label: "Classes", icon: Calendar, title: "CLASSES", subtitle: "Scheduled class sessions" },
  students: { label: "Students", icon: Users, title: "STUDENTS", subtitle: "Enrolled students and their records" },
  assessments: { label: "Assessments", icon: ClipboardCheck, title: "ASSESSMENTS", subtitle: "Graded assessments and results" },
};

function TrainingHqInner() {
  const searchParams = useSearchParams();
  const activeCompanyId = useAuthStore((s) => s.activeCompanyId);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const user = useAuthStore((s) => s.user);
  const role = (activeCompany?.role ?? "staff") as CompanyRole;
  const isProvider = activeCompany?.isTrainingProvider ?? false;
  const visible = useMemo(() => visibleTrainingTabs(role, isProvider), [role, isProvider]);
  const hasInstructor = visible.includes("courses");

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  const [picked, setTab] = useState<TrainingHqTab | null>(null);
  // Role can load after first render; derive a valid tab instead of syncing state.
  const tab: TrainingHqTab | null = picked && visible.includes(picked) ? picked : resolveTrainingTab(searchParams.get("tab"), visible);

  const [modules, setModules] = useState<TrainingModule[]>([]);
  const [showNewModule, setShowNewModule] = useState(false);
  const [showNewQ, setShowNewQ] = useState(false);
  const [triggerNew, setTriggerNew] = useState(0);
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);

  const linkInstructor = useCallback(async () => {
    if (!user?.id || !hasInstructor) return;
    setLinking(true);
    // Instructor identity is the Overwatch users.id.
    try { setInstructorId(await ensureInternalUser()); }
    catch (e) { logger.swallow("training-hq:user", e, "warn"); }
    finally { setLinking(false); }
  }, [user?.id, hasInstructor]);

  useEffect(() => { linkInstructor(); }, [linkInstructor]);

  useEffect(() => {
    const Icon = tab ? TAB_META[tab].icon : GraduationCap;
    const action =
      tab === "modules" ? (
        <Button onClick={() => setShowNewModule(true)} className="gap-1.5" disabled={showNewModule}>
          <Plus className="h-4 w-4" /> New Module
        </Button>
      ) : tab === "questions" ? (
        <Button onClick={() => setShowNewQ(true)} className="gap-1.5" disabled={showNewQ}>
          <Plus className="h-4 w-4" /> New Question
        </Button>
      ) : tab === "courses" ? (
        <Button size="sm" className="gap-1.5" onClick={() => setTriggerNew((n) => n + 1)}>
          <Plus className="h-3.5 w-3.5" /> New Course
        </Button>
      ) : tab === "classes" ? (
        <Button size="sm" className="gap-1.5" onClick={() => setTriggerNew((n) => n + 1)} disabled={!instructorId}>
          <Plus className="h-3.5 w-3.5" /> Schedule Class
        </Button>
      ) : tab === "assessments" ? (
        <Button size="sm" className="gap-1.5" onClick={() => setTriggerNew((n) => n + 1)}>
          <Plus className="h-3.5 w-3.5" /> New Assessment
        </Button>
      ) : undefined;
    setHeader(tab ? TAB_META[tab].title : "TRAINING HQ", tab ? TAB_META[tab].subtitle : "Modules, courses, classes, students and progress", <Icon className="h-5 w-5" />, action);
    return () => clearHeader();
  }, [setHeader, clearHeader, tab, showNewModule, showNewQ, instructorId]);

  if (!tab) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h2 className="text-lg font-bold">Access Denied</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Training HQ is available to managers and above, and to instructors of a training provider company.
        </p>
      </div>
    );
  }

  const isInstructorTab = tab === "courses" || tab === "classes" || tab === "students" || tab === "assessments";

  return (
    <div className="space-y-4">
      <SubTabList>
        {visible.map((t) => (
          <SubTab key={t} active={tab === t} onClick={() => setTab(t)} icon={TAB_META[t].icon}>
            {TAB_META[t].label}
          </SubTab>
        ))}
      </SubTabList>

      {tab === "modules" && (
        <ModulesTab activeCompanyId={activeCompanyId} showNewModule={showNewModule} setShowNewModule={setShowNewModule} modules={modules} setModules={setModules} />
      )}
      {tab === "questions" && (
        <QuestionBankTab activeCompanyId={activeCompanyId} modules={modules} showNewQ={showNewQ} setShowNewQ={setShowNewQ} />
      )}
      {tab === "progress" && <StaffProgressTab activeCompanyId={activeCompanyId} modules={modules} />}

      {isInstructorTab && linking ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Loading your profile...</p>
        </div>
      ) : (
        <>
          {tab === "courses" && <CoursesTab triggerNew={triggerNew} />}
          {tab === "classes" && <ClassesTab instructorId={instructorId} triggerNew={triggerNew} seeAll={canSeeAllTrainingClasses(role)} />}
          {tab === "students" && <StudentsTab instructorId={instructorId} />}
          {tab === "assessments" && <AssessmentsTab triggerNew={triggerNew} />}
        </>
      )}
    </div>
  );
}

export default function TrainingHqPage() {
  return <Suspense fallback={<div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}><TrainingHqInner /></Suspense>;
}
