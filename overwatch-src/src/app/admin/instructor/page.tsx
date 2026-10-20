"use client";

import { SubTab, SubTabList } from "@/components/ui/sub-tabs";
import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Plus, Loader2, Users, Calendar,
  ClipboardCheck, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { canManageLegacyCourses, canSeeAllTrainingClasses, type CompanyRole } from "@/lib/permissions";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";
import { usePageHeader } from "@/stores/page-header-store";
import { CoursesTab } from "./components/courses-tab";
import { ClassesTab } from "./components/classes-tab";
import { StudentsTab } from "./components/students-tab";
import { AssessmentsTab } from "./components/assessments-tab";
import { logger } from "@/lib/logger";

type Tab = "courses" | "classes" | "students" | "assessments";

export default function InstructorHQPage() {
  const user = useAuthStore((s) => s.user);
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const role = (activeCompany?.role ?? "staff") as CompanyRole;
  const isProvider = activeCompany?.isTrainingProvider ?? false;
  const hasAccess = isProvider && canManageLegacyCourses(role);

  const [tab, setTab] = useState<Tab>("courses");
  const [instructorId, setInstructorId] = useState<string | null>(null);
  const [triggerNew, setTriggerNew] = useState(0);

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  useEffect(() => {
    setHeader("INSTRUCTOR HQ", "Courses, classes and students",
      tab === "classes" ? <Calendar className="h-5 w-5" /> : tab === "assessments" ? <ClipboardCheck className="h-5 w-5" /> : <BookOpen className="h-5 w-5" />,
      tab === "courses" ? (
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
      ) : undefined
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, tab, instructorId]);
  const [linking, setLinking] = useState(false);

  const linkInstructor = useCallback(async () => {
    if (!user?.id || !hasAccess) return;
    setLinking(true);
    // Instructor identity is the Overwatch users.id (EADB instructor linking is retired).
    try { setInstructorId(await ensureInternalUser()); }
    catch (e) { logger.swallow("instructor-hq:user", e, "warn"); }
    finally { setLinking(false); }
  }, [user, hasAccess]);

  useEffect(() => { linkInstructor(); }, [linkInstructor]);

  if (!hasAccess) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
        <AlertTriangle className="h-10 w-10 text-amber-500" />
        <h2 className="text-lg font-bold">Access Denied</h2>
        <p className="text-sm text-muted-foreground max-w-sm">
          Instructor HQ is only available to instructors, admins, and owners of the training provider company.
        </p>
      </div>
    );
  }

  if (linking) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Loading your profile...</p>
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: "courses", label: "Courses", icon: BookOpen },
    { id: "classes", label: "Classes", icon: Calendar },
    { id: "students", label: "Students", icon: Users },
    { id: "assessments", label: "Assessments", icon: ClipboardCheck },
  ];

  return (
    <div className="space-y-4">
      <SubTabList>
        {TABS.map((t) => (
          <SubTab active={tab === t.id} onClick={() => setTab(t.id)} icon={t.icon} key={t.id}>
            {t.label}
          </SubTab>
        ))}
      </SubTabList>

      {tab === "courses" && <CoursesTab triggerNew={triggerNew} />}
      {tab === "classes" && <ClassesTab instructorId={instructorId} triggerNew={triggerNew} seeAll={canSeeAllTrainingClasses(role)} />}
      {tab === "students" && <StudentsTab instructorId={instructorId} />}
      {tab === "assessments" && <AssessmentsTab triggerNew={triggerNew} />}
    </div>
  );
}
