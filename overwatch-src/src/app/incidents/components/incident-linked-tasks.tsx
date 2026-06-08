"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ListChecks, Plus, CheckCircle2, Circle, ExternalLink, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { getTasksForIncident, createTask } from "@/lib/supabase/db";
import type { Task } from "@/lib/supabase/db-tasks";
import { logger } from "@/lib/logger";

interface IncidentLinkedTasksProps {
  incidentId: string;
  companyId: string;
  defaultTeamId?: string | null;
  canCreate: boolean;
}

export function IncidentLinkedTasks({
  incidentId,
  companyId,
  defaultTeamId,
  canCreate,
}: IncidentLinkedTasksProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getTasksForIncident(incidentId);
      setTasks(data);
    } catch (e) {
      logger.swallow("incident-linked-tasks:load", e, "warn");
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => { void load(); }, [load]);

  async function handleQuickAdd() {
    if (!quickTitle.trim()) return;
    setCreating(true);
    try {
      await createTask(companyId, {
        title: quickTitle.trim(),
        incidentId,
        teamId: defaultTeamId ?? null,
        priority: "medium",
      });
      toast.success("Task created");
      setQuickTitle("");
      setShowQuickAdd(false);
      await load();
    } catch (e) {
      logger.swallow("incident-linked-tasks:create", e, "warn");
      toast.error("Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  if (loading) {
    return (
      <div>
        <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
          <ListChecks className="h-3 w-3" /> Linked Tasks
        </h4>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div>
      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
        <ListChecks className="h-3 w-3" /> Linked Tasks
        {tasks.length > 0 && (
          <span className="text-[10px] text-muted-foreground/70">({tasks.length})</span>
        )}
        {canCreate && !showQuickAdd && (
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-6 text-xs gap-1"
            onClick={() => setShowQuickAdd(true)}
          >
            <Plus className="h-3 w-3" /> Add task
          </Button>
        )}
      </h4>

      <div className="space-y-1.5">
        {tasks.length === 0 && !showQuickAdd ? (
          <p className="text-xs text-muted-foreground italic">No tasks linked to this incident.</p>
        ) : (
          tasks.map((t) => (
            <div key={t.id} className="flex items-center gap-2 text-sm px-2 py-1.5 rounded bg-muted/30">
              {t.status === "done" ? (
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0" />
              ) : (
                <Circle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className={`flex-1 min-w-0 truncate ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                {t.title}
              </span>
              <Badge variant="outline" className="text-[10px]">
                {t.status}
              </Badge>
              <Badge variant="outline" className="text-[10px]">
                {t.priority}
              </Badge>
              <Link
                href="/tasks"
                className="text-muted-foreground hover:text-foreground"
                aria-label="Open in tasks"
              >
                <ExternalLink className="h-3 w-3" />
              </Link>
            </div>
          ))
        )}

        {showQuickAdd && canCreate && (
          <div className="flex gap-2 items-center">
            <input
              type="text"
              value={quickTitle}
              onChange={(e) => setQuickTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleQuickAdd();
                if (e.key === "Escape") {
                  setShowQuickAdd(false);
                  setQuickTitle("");
                }
              }}
              placeholder="Task title..."
              className="flex-1 h-8 rounded-md border border-input bg-background px-2 text-sm"
              autoFocus
            />
            <Button size="sm" onClick={handleQuickAdd} disabled={creating || !quickTitle.trim()} className="h-8">
              {creating ? <Loader2 className="h-3 w-3 animate-spin" /> : <Plus className="h-3 w-3" />}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setShowQuickAdd(false);
                setQuickTitle("");
              }}
              className="h-8"
            >
              Cancel
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
