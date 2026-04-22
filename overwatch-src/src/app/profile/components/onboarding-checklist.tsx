"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Check, CheckCircle2, ListChecks } from "lucide-react";
import { toast } from "sonner";
import {
  getMyOnboardingProgress, toggleOnboardingTask, completeOnboarding, getMemberProfile,
} from "@/lib/supabase/db";
import type { MemberProfile, OProgress } from "./types";

interface Props {
  mp: MemberProfile;
  onMpChange: (mp: MemberProfile) => void;
  activeCompanyId: string;
  onboardingProgress: OProgress[];
  onProgressChange: (progress: OProgress[]) => void;
}

export function OnboardingChecklist({ mp, onMpChange, activeCompanyId, onboardingProgress, onProgressChange }: Props) {
  const [togglingTask, setTogglingTask] = useState<string | null>(null);

  const isOnboarding = mp?.status === "onboarding" && !mp?.onboarding_complete;
  const requiredTasks = onboardingProgress.filter((p: OProgress) => p.onboarding_tasks?.is_required);
  const completedRequired = requiredTasks.filter((p: OProgress) => p.completed);
  const allRequiredDone = requiredTasks.length > 0 && completedRequired.length === requiredTasks.length;

  if (!isOnboarding || onboardingProgress.length === 0) return null;

  async function handleToggleOnboarding(taskId: string, completed: boolean) {
    if (!activeCompanyId) return;
    setTogglingTask(taskId);
    try {
      await toggleOnboardingTask(taskId, completed);
      onProgressChange(await getMyOnboardingProgress(activeCompanyId));
    } catch (err) { console.error(err); }
    finally { setTogglingTask(null); }
  }

  async function handleCompleteOnboarding() {
    if (!activeCompanyId) return;
    try {
      await completeOnboarding(activeCompanyId);
      onMpChange(await getMemberProfile(activeCompanyId));
      toast.success("Onboarding complete!");
    } catch (err) { console.error(err); toast.error("Failed to complete onboarding"); }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <ListChecks className="h-4 w-4" /> Onboarding Checklist
          <Badge className="ml-auto text-[10px] bg-primary/15 text-primary">{completedRequired.length}/{requiredTasks.length} required</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {onboardingProgress.map((p: OProgress) => {
          const task = p.onboarding_tasks;
          if (!task) return null;
          return (
            <div key={p.id} className="flex items-center gap-3 rounded-lg border border-border/40 px-3 py-2">
              <button onClick={() => handleToggleOnboarding(p.task_id, !p.completed)}
                disabled={togglingTask === p.task_id}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border transition-colors ${p.completed ? "bg-green-500 border-green-500 text-white" : "border-border/60 hover:border-primary"}`}>
                {togglingTask === p.task_id ? <Loader2 className="h-3 w-3 animate-spin" /> : p.completed ? <Check className="h-3 w-3" /> : null}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm ${p.completed ? "line-through text-muted-foreground" : "font-medium"}`}>{task.title}</p>
                {task.description && <p className="text-[10px] text-muted-foreground">{task.description}</p>}
              </div>
              {task.is_required && <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Required</Badge>}
              <Badge variant="outline" className="text-[9px] capitalize">{task.category}</Badge>
            </div>
          );
        })}
        {allRequiredDone && (
          <Button size="sm" className="w-full mt-2 gap-1.5" onClick={handleCompleteOnboarding}>
            <CheckCircle2 className="h-4 w-4" /> Complete Onboarding
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
