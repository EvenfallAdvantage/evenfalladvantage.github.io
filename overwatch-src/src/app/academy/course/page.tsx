"use client";

import { Suspense, useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import {
  ChevronLeft, Clock, CheckCircle2, Loader2, GraduationCap,
  Play, FileText, BarChart3, BookOpen,
} from "lucide-react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthStore } from "@/stores/auth-store";
import {
  getLegacyCourses,
  getLegacyCourseModules,
  getLegacyProgress,
  findLegacyStudentByEmail,
  type LegacyCourse,
  type LegacyCourseModule,
  type LegacyModuleProgress,
} from "@/lib/legacy-bridge";

export default function CourseDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <CourseDetailInner />
    </Suspense>
  );
}

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: "bg-green-500/15 text-green-600",
  Intermediate: "bg-blue-500/15 text-blue-600",
  Advanced: "bg-purple-500/15 text-purple-600",
  beginner: "bg-green-500/15 text-green-600",
  intermediate: "bg-blue-500/15 text-blue-600",
  advanced: "bg-purple-500/15 text-purple-600",
};

function CourseDetailInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const courseId = searchParams.get("id") ?? "";
  const user = useAuthStore((s) => s.user) as { id: string; email: string } | null;

  const [course, setCourse] = useState<LegacyCourse | null>(null);
  const [modules, setModules] = useState<LegacyCourseModule[]>([]);
  const [progress, setProgress] = useState<LegacyModuleProgress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!courseId) { setLoading(false); return; }
    try {
      // Load course info
      const courses = await getLegacyCourses();
      const found = courses.find((c) => c.id === courseId);
      setCourse(found ?? null);

      // Load modules for this course
      const mods = await getLegacyCourseModules(courseId);
      setModules(mods);

      // Load student progress
      if (user?.email) {
        const student = await findLegacyStudentByEmail(user.email);
        if (student) {
          const prog = await getLegacyProgress(student.id);
          setProgress(prog);
        }
      }
    } catch (err) {
      console.error("Course detail load error:", err);
    } finally {
      setLoading(false);
    }
  }, [courseId, user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center">
        <GraduationCap className="h-12 w-12 text-muted-foreground/30" />
        <h2 className="text-lg font-semibold">Course Not Found</h2>
        <Button variant="outline" onClick={() => router.push("/academy")}>
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to Academy
        </Button>
      </div>
    );
  }

  const completedModuleIds = new Set(
    progress.filter((p) => p.status === "completed").map((p) => p.module_id)
  );
  const progressMap = new Map(progress.map((p) => [p.module_id, p]));
  const completedCount = modules.filter((m) => completedModuleIds.has(m.module_id)).length;
  const overallPct = modules.length > 0 ? Math.round((completedCount / modules.length) * 100) : 0;

  // Find next incomplete module for "Continue" button
  const nextModule = modules.find((m) => !completedModuleIds.has(m.module_id));

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="sm" onClick={() => router.push("/academy")} className="gap-1 shrink-0 mt-0.5">
          <ChevronLeft className="h-4 w-4" /> Back
        </Button>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold tracking-tight">{course.course_name}</h1>
          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
            {course.duration_hours && (
              <span className="flex items-center gap-0.5"><Clock className="h-3 w-3" /> {course.duration_hours}h</span>
            )}
            <span className="text-border">·</span>
            <span>{modules.length} modules</span>
            {course.difficulty_level && (
              <>
                <span className="text-border">·</span>
                <Badge className={`text-[10px] px-1.5 py-0 ${DIFFICULTY_COLORS[course.difficulty_level] || "bg-muted text-muted-foreground"}`}>
                  {course.difficulty_level}
                </Badge>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Course description */}
      {course.description && (
        <p className="text-sm text-muted-foreground leading-relaxed">{course.description}</p>
      )}

      {/* Overall progress */}
      <Card className="border-border/40">
        <CardContent className="p-4 space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium flex items-center gap-1.5">
              <BarChart3 className="h-3.5 w-3.5 text-primary" /> Course Progress
            </span>
            <span className="font-mono text-xs">
              {completedCount}/{modules.length} modules · {overallPct}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${overallPct}%` }}
            />
          </div>
          {nextModule && overallPct < 100 && (
            <Link href={`/training/viewer?id=${nextModule.module_id}&course=${courseId}`}>
              <Button size="sm" className="w-full gap-1.5 text-xs mt-2">
                <Play className="h-3 w-3" /> {completedCount === 0 ? "Start Learning" : "Continue Learning"}
              </Button>
            </Link>
          )}
          {overallPct === 100 && (
            <div className="flex items-center gap-1.5 text-xs text-green-600 font-medium pt-1">
              <CheckCircle2 className="h-3.5 w-3.5" /> Course Complete!
            </div>
          )}
        </CardContent>
      </Card>

      {/* Module list */}
      <div className="space-y-2">
        <h2 className="text-sm font-semibold flex items-center gap-1.5">
          <BookOpen className="h-3.5 w-3.5" /> Modules
        </h2>
        <div className="space-y-2">
          {modules.map((m, idx) => {
            const mod = m.training_modules;
            const done = completedModuleIds.has(m.module_id);
            const prog = progressMap.get(m.module_id);
            const pct = prog?.progress_percentage ?? 0;
            const inProgress = !done && pct > 0;

            return (
              <Link
                key={m.id}
                href={`/training/viewer?id=${m.module_id}&course=${courseId}`}
              >
                <Card className={`border-border/40 overflow-hidden transition-all hover:border-primary/30 cursor-pointer ${done ? "opacity-75" : ""}`}>
                  <CardContent className="p-3 flex items-center gap-3">
                    {/* Status indicator */}
                    <div className="shrink-0">
                      {done ? (
                        <CheckCircle2 className="h-5 w-5 text-green-500" />
                      ) : inProgress ? (
                        <div className="relative h-5 w-5">
                          <svg viewBox="0 0 36 36" className="h-5 w-5 -rotate-90">
                            <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-muted" />
                            <circle
                              cx="18" cy="18" r="15" fill="none" strokeWidth="3"
                              className="stroke-primary"
                              strokeDasharray={`${pct * 0.94} 100`}
                              strokeLinecap="round"
                            />
                          </svg>
                        </div>
                      ) : (
                        <div className="h-5 w-5 rounded-full border-2 border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                          {idx + 1}
                        </div>
                      )}
                    </div>

                    {/* Module info */}
                    <div className="flex-1 min-w-0">
                      <h3 className={`text-sm font-medium truncate ${done ? "line-through text-muted-foreground" : ""}`}>
                        {mod?.module_name || `Module ${m.module_order}`}
                      </h3>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                        {mod?.duration_minutes && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {mod.duration_minutes}m
                          </span>
                        )}
                        {mod?.estimated_time && !mod?.duration_minutes && (
                          <span className="flex items-center gap-0.5">
                            <Clock className="h-2.5 w-2.5" /> {mod.estimated_time}
                          </span>
                        )}
                        {done && <span className="text-green-600">Completed</span>}
                        {inProgress && <span className="text-primary">{pct}% done</span>}
                      </div>
                    </div>

                    {/* Arrow */}
                    <Play className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>

      {/* Learning objectives */}
      {course.learning_objectives && course.learning_objectives.length > 0 && (
        <Card className="border-border/40">
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Learning Objectives
            </h3>
            <ul className="space-y-1">
              {course.learning_objectives.map((obj: string, i: number) => (
                <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 className="h-3 w-3 text-primary shrink-0 mt-0.5" />
                  <span>{obj}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
