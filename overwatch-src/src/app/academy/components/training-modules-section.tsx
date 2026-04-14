"use client";

import Link from "next/link";
import { GraduationCap, CheckCircle2, Clock, FileText, Play, ChevronRight, Lock, Target } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { TrainingModule, StudentModuleProgress } from "@/types";

type LinkedQuiz = { id: string; title: string; passing_score: number };
export type ModuleWithProgress = TrainingModule & { progress: StudentModuleProgress | null; linkedQuiz: LinkedQuiz | null };

const DIFFICULTY_COLORS: Record<string, string> = {
  Beginner: "bg-green-500/15 text-green-600",
  Intermediate: "bg-blue-500/15 text-blue-600",
  Advanced: "bg-purple-500/15 text-purple-600",
  Critical: "bg-red-500/15 text-red-600",
  Essential: "bg-amber-500/15 text-amber-600",
};

interface TrainingModulesSectionProps {
  modules: ModuleWithProgress[];
}

export default function TrainingModulesSection({ modules }: TrainingModulesSectionProps) {
  const completedOw = modules.filter((m) => m.progress?.status === "completed");
  const inProgressOw = modules.filter((m) => m.progress?.status === "in_progress");

  if (modules.length === 0) {
    return (
      <Card className="border-dashed border-border/60">
        <CardContent className="flex flex-col items-center gap-2 py-8 text-center">
          <GraduationCap className="h-10 w-10 text-muted-foreground/30" />
          <h3 className="text-sm font-semibold">No Training Modules Yet</h3>
          <p className="text-xs text-muted-foreground max-w-xs">Training modules will appear here once your company admin creates them.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Training Modules</h2>
          <p className="text-xs text-muted-foreground">
            {completedOw.length}/{modules.length} completed
            {inProgressOw.length > 0 && ` · ${inProgressOw.length} in progress`}
          </p>
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {modules.map((mod) => {
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
  );
}
