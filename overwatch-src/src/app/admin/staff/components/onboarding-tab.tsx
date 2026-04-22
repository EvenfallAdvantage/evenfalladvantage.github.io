"use client";

import { useEffect, useState, useCallback } from "react";
import {
  ListChecks, Plus, X, ChevronUp, ChevronDown, Trash2, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  getOnboardingTasks, createOnboardingTask, deleteOnboardingTask, reorderOnboardingTasks,
} from "@/lib/supabase/db";
import { logger } from "@/lib/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type OTask = any;

interface OnboardingTabProps {
  activeCompanyId: string;
  canManage: boolean;
}

export function OnboardingTab({ activeCompanyId, canManage }: OnboardingTabProps) {
  const [oTasks, setOTasks] = useState<OTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddTask, setShowAddTask] = useState(false);
  const [taskForm, setTaskForm] = useState({ title: "", description: "", category: "general", isRequired: true });
  const [savingTask, setSavingTask] = useState(false);

  const loadTasks = useCallback(async () => {
    if (!activeCompanyId) { setLoading(false); return; }
    try {
      setOTasks(await getOnboardingTasks(activeCompanyId));
    } catch (e) { logger.swallow("onboarding:load", e, "warn"); }
    finally { setLoading(false); }
  }, [activeCompanyId]);

  useEffect(() => { loadTasks(); }, [loadTasks]);

  async function handleAddTask() {
    if (!taskForm.title.trim() || !activeCompanyId) return;
    setSavingTask(true);
    try {
      await createOnboardingTask(activeCompanyId, { ...taskForm, sortOrder: oTasks.length });
      setTaskForm({ title: "", description: "", category: "general", isRequired: true });
      setShowAddTask(false);
      setOTasks(await getOnboardingTasks(activeCompanyId));
      toast.success("Task created");
    } catch (err) { console.error(err); toast.error("Failed to create task"); }
    finally { setSavingTask(false); }
  }

  async function handleDeleteTask(id: string) {
    if (!confirm("Delete this onboarding task?")) return;
    try {
      await deleteOnboardingTask(id);
      if (activeCompanyId) setOTasks(await getOnboardingTasks(activeCompanyId));
    } catch (err) { console.error(err); }
  }

  async function handleMoveTask(index: number, direction: "up" | "down") {
    const swapIdx = direction === "up" ? index - 1 : index + 1;
    if (swapIdx < 0 || swapIdx >= oTasks.length) return;
    const updated = [...oTasks];
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    setOTasks(updated);
    try {
      await reorderOnboardingTasks(updated.map((t: OTask, i: number) => ({ id: t.id, sort_order: i })));
    } catch (err) { console.error(err); }
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="rounded-xl border border-border/50 bg-card p-4">
      <div className="flex flex-wrap items-start justify-between gap-2 mb-3">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-sm flex items-center gap-2"><ListChecks className="h-4 w-4 shrink-0" /> Onboarding Checklist</p>
          <p className="text-xs text-muted-foreground mt-0.5">Configure tasks that new hires must complete. These are auto-assigned when an applicant is hired.</p>
        </div>
        {canManage && (
          <Button size="sm" className="gap-1.5 shrink-0" onClick={() => setShowAddTask(!showAddTask)}>
            {showAddTask ? <X className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
            {showAddTask ? "Cancel" : "Add Task"}
          </Button>
        )}
      </div>

      {showAddTask && (
        <div className="rounded-lg border border-primary/30 bg-muted/30 p-3 space-y-2 mb-3">
          <Input placeholder="Task title (e.g. Complete guard card upload)" value={taskForm.title}
            onChange={(e) => setTaskForm(p => ({ ...p, title: e.target.value }))} />
          <Input placeholder="Description (optional)" value={taskForm.description}
            onChange={(e) => setTaskForm(p => ({ ...p, description: e.target.value }))} />
          <div className="flex gap-2 items-center">
            <select value={taskForm.category}
              onChange={(e) => setTaskForm(p => ({ ...p, category: e.target.value }))}
              className="h-8 rounded border border-border/40 bg-background px-2 text-xs">
              <option value="general">General</option>
              <option value="documents">Documents</option>
              <option value="training">Training</option>
              <option value="equipment">Equipment</option>
              <option value="accounts">Accounts</option>
            </select>
            <label className="flex items-center gap-1.5 text-xs">
              <input type="checkbox" checked={taskForm.isRequired}
                onChange={(e) => setTaskForm(p => ({ ...p, isRequired: e.target.checked }))}
                className="rounded" />
              Required
            </label>
            <Button size="sm" onClick={handleAddTask} disabled={!taskForm.title.trim() || savingTask} className="ml-auto">
              {savingTask ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add"}
            </Button>
          </div>
        </div>
      )}

      {oTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border/60 bg-card/50 p-8 text-center">
          <ListChecks className="mb-2 h-8 w-8 text-muted-foreground/40" />
          <p className="text-xs font-medium">No onboarding tasks configured</p>
          <p className="mt-1 max-w-xs text-[10px] text-muted-foreground">Add tasks like &ldquo;Upload guard card&rdquo;, &ldquo;Complete safety training&rdquo;, &ldquo;Join WhatsApp community&rdquo;.</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {oTasks.map((t: OTask, i: number) => (
            <div key={t.id} className="rounded-lg border border-border/40 px-3 py-2.5 space-y-1.5">
              {/* Row 1: Number + Title + Badges */}
              <div className="flex items-start gap-2.5">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium leading-tight">{t.title}</p>
                  {t.description && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{t.description}</p>}
                </div>
              </div>
              {/* Row 2: Badges + Actions */}
              <div className="flex items-center gap-1.5 ml-[34px]">
                <Badge variant="outline" className="text-[9px] capitalize">{t.category}</Badge>
                {t.is_required && <Badge className="text-[9px] bg-amber-500/15 text-amber-600">Required</Badge>}
                {canManage && (
                  <div className="flex items-center gap-0.5 ml-auto">
                    <button onClick={() => handleMoveTask(i, "up")} disabled={i === 0}
                      className="rounded p-1.5 text-muted-foreground/30 hover:text-primary hover:bg-primary/10 disabled:opacity-20 disabled:pointer-events-none" title="Move up">
                      <ChevronUp className="h-3 w-3" />
                    </button>
                    <button onClick={() => handleMoveTask(i, "down")} disabled={i === oTasks.length - 1}
                      className="rounded p-1.5 text-muted-foreground/30 hover:text-primary hover:bg-primary/10 disabled:opacity-20 disabled:pointer-events-none" title="Move down">
                      <ChevronDown className="h-3 w-3" />
                    </button>
                    <button onClick={() => handleDeleteTask(t.id)}
                      className="rounded p-1.5 text-muted-foreground/30 hover:text-red-500 hover:bg-red-500/10">
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
