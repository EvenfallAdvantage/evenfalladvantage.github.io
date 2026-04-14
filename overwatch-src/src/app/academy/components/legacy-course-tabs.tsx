"use client";

import Link from "next/link";
import {
  GraduationCap, CheckCircle2, Clock, Trophy, Star, Zap,
  AlertTriangle, ChevronRight, BarChart3, ShieldCheck, Play,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type {
  LegacyCourse, LegacyCourseModule, LegacyModuleProgress, LegacyAssessmentResult,
} from "@/lib/legacy-bridge";

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: "bg-green-500/15 text-green-600",
  Intermediate: "bg-blue-500/15 text-blue-600",
  Advanced: "bg-purple-500/15 text-purple-600",
  Critical: "bg-red-500/15 text-red-600",
  Essential: "bg-amber-500/15 text-amber-600",
};

export function CoursesTab({ courses, enrolledCourseIds, courseModules, completedModuleIds }: {
  courses: LegacyCourse[]; enrolledCourseIds: Set<string>;
  courseModules: Record<string, LegacyCourseModule[]>; completedModuleIds: Set<string>;
}) {
  const enrolled = courses.filter((c) => enrolledCourseIds.has(c.id));
  const available = courses.filter((c) => !enrolledCourseIds.has(c.id));

  return (
    <div className="space-y-6">
      {enrolled.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Play className="h-3.5 w-3.5 text-green-500" /> My Courses</h3>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((course) => {
              const modules = courseModules[course.id] || [];
              const completedInCourse = modules.filter((m) => completedModuleIds.has(m.module_id)).length;
              const pct = modules.length > 0 ? Math.round((completedInCourse / modules.length) * 100) : 0;
              return (
                <Card key={course.id} className="border-border/40 overflow-hidden group hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h4 className="font-semibold text-sm truncate">{course.course_name}</h4>
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                          {course.duration_hours && <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {course.duration_hours}h</span>}
                          <span>{modules.length} modules</span>
                        </div>
                      </div>
                      {pct === 100 ? <Badge className="bg-green-500/15 text-green-600 text-[10px] shrink-0"><Trophy className="h-2.5 w-2.5 mr-0.5" /> Complete</Badge>
                        : <Badge className="bg-primary/10 text-primary text-[10px] shrink-0 font-mono">{pct}%</Badge>}
                    </div>
                    <div className="space-y-1">
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden"><div className="h-full bg-primary rounded-full transition-all duration-500" style={{ width: `${pct}%` }} /></div>
                      <p className="text-[10px] text-muted-foreground">{completedInCourse}/{modules.length} modules completed</p>
                    </div>
                    <div className="space-y-1">
                      {modules.slice(0, 4).map((m) => {
                        const mod = m.training_modules; const done = completedModuleIds.has(m.module_id);
                        return (<div key={m.id} className="flex items-center gap-2 text-xs">{done ? <CheckCircle2 className="h-3 w-3 text-green-500 shrink-0" /> : <div className="h-3 w-3 rounded-full border border-border shrink-0" />}<span className={done ? "text-muted-foreground line-through" : ""}>{mod?.module_name || `Module ${m.module_order}`}</span></div>);
                      })}
                      {modules.length > 4 && <p className="text-[10px] text-muted-foreground pl-5">+{modules.length - 4} more modules</p>}
                    </div>
                    <Link href={`/academy/course?id=${course.id}`}><Button size="sm" className="w-full gap-1.5 text-xs"><Play className="h-3 w-3" /> Continue Learning</Button></Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      {available.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-amber-500" /> Available Courses</h3>
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
                          {course.duration_hours && <span className="flex items-center gap-0.5"><Clock className="h-2.5 w-2.5" /> {course.duration_hours}h</span>}
                          {course.difficulty_level && <Badge className={`text-[9px] px-1 py-0 ${DIFFICULTY_COLORS[course.difficulty_level] || ""}`}>{course.difficulty_level}</Badge>}
                        </div>
                      </div>
                      <div className="text-right shrink-0">{isFree ? <Badge className="bg-green-500/15 text-green-600 text-[10px]">FREE</Badge> : <span className="text-sm font-bold font-mono">${course.price}</span>}</div>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2">{course.short_description || course.description || "Professional training course"}</p>
                    {course.learning_objectives && course.learning_objectives.length > 0 && (
                      <div className="space-y-1">{course.learning_objectives.slice(0, 3).map((obj, i) => (<div key={i} className="flex items-start gap-1.5 text-[10px] text-muted-foreground"><Zap className="h-2.5 w-2.5 text-primary shrink-0 mt-0.5" /><span className="line-clamp-1">{obj}</span></div>))}</div>
                    )}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-muted-foreground">{modules.length} modules</span>
                      <Link href="/courses"><Button size="sm" variant="outline" className="gap-1 text-xs h-7">View Details <ChevronRight className="h-3 w-3" /></Button></Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
      {courses.length === 0 && (
        <div className="text-center py-12"><GraduationCap className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" /><h3 className="text-sm font-semibold">No courses available</h3><p className="text-xs text-muted-foreground mt-1">Check back soon for new training programs</p></div>
      )}
    </div>
  );
}

export function ProgressTab({ progress }: { progress: LegacyModuleProgress[] }) {
  if (progress.length === 0) {
    return (<div className="text-center py-12"><BarChart3 className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" /><h3 className="text-sm font-semibold">No progress yet</h3><p className="text-xs text-muted-foreground mt-1">Enroll in a course and start learning to see your progress here</p></div>);
  }
  const sorted = [...progress].sort((a, b) => { if (a.status === "completed" && b.status !== "completed") return 1; if (a.status !== "completed" && b.status === "completed") return -1; return (b.progress_percentage || 0) - (a.progress_percentage || 0); });
  return (
    <div className="space-y-2">
      {sorted.map((p) => {
        const moduleName = p.training_modules?.module_name || "Unknown Module"; const pct = Math.round(p.progress_percentage || 0); const done = p.status === "completed";
        return (
          <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:border-border/60 transition-colors">
            {done ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : pct > 0 ? <div className="h-5 w-5 rounded-full border-2 border-primary shrink-0 flex items-center justify-center"><div className="h-2 w-2 rounded-full bg-primary" /></div> : <div className="h-5 w-5 rounded-full border-2 border-border shrink-0" />}
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{moduleName}</p><p className="text-[10px] text-muted-foreground">{p.training_modules?.module_code}{p.completed_at && ` — Completed ${new Date(p.completed_at).toLocaleDateString()}`}</p></div>
            <div className="flex items-center gap-2 shrink-0"><div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden hidden sm:block"><div className={`h-full rounded-full ${done ? "bg-green-500" : "bg-primary"}`} style={{ width: `${pct}%` }} /></div><span className={`text-xs font-mono w-8 text-right ${done ? "text-green-500" : "text-muted-foreground"}`}>{pct}%</span></div>
          </div>
        );
      })}
    </div>
  );
}

export function AssessmentsTab({ results }: { results: LegacyAssessmentResult[] }) {
  if (results.length === 0) {
    return (<div className="text-center py-12"><ShieldCheck className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" /><h3 className="text-sm font-semibold">No assessment results</h3><p className="text-xs text-muted-foreground mt-1">Complete module assessments to see your scores here</p></div>);
  }
  return (
    <div className="space-y-2">
      {results.map((r) => {
        const name = r.assessments?.assessment_name || "Assessment"; const passing = r.assessments?.passing_score || 80; const total = r.assessments?.total_questions || 0;
        return (
          <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40">
            {r.passed ? <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" /> : <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />}
            <div className="flex-1 min-w-0"><p className="text-sm font-medium truncate">{name}</p><p className="text-[10px] text-muted-foreground">{r.state_code && `${r.state_code} — `}{total > 0 && `${total} questions — `}Passing: {passing}%{r.completed_at && ` — ${new Date(r.completed_at).toLocaleDateString()}`}</p></div>
            <div className="shrink-0"><Badge className={`font-mono text-xs ${r.passed ? "bg-green-500/15 text-green-600" : r.score >= passing * 0.8 ? "bg-amber-500/15 text-amber-600" : "bg-red-500/15 text-red-600"}`}>{r.score}%</Badge></div>
          </div>
        );
      })}
    </div>
  );
}
