"use client";

import { useState } from "react";
import { X, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { createTask } from "@/lib/supabase/db";
import { logger } from "@/lib/logger";
import type { Team } from "@/lib/supabase/db-teams";
import type { TaskStatus, TaskPriority, TaskRecurrenceRule } from "@/lib/supabase/db-tasks";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

interface TaskCreateFormProps {
  activeCompanyId: string;
  members: Member[];
  teams: Team[];
  defaultIncidentId?: string;
  onCreated: () => void;
  onCancel: () => void;
}

export function TaskCreateForm({
  activeCompanyId,
  members,
  teams,
  defaultIncidentId,
  onCreated,
  onCancel,
}: TaskCreateFormProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<TaskStatus>("todo");
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [teamId, setTeamId] = useState<string>("");
  const [assignedToId, setAssignedToId] = useState<string>("");
  const [dueAt, setDueAt] = useState("");
  const [recurring, setRecurring] = useState(false);
  const [recurFreq, setRecurFreq] = useState<"daily" | "weekly" | "monthly">("daily");
  const [recurInterval, setRecurInterval] = useState("1");
  const [creating, setCreating] = useState(false);

  async function handleCreate() {
    if (!title.trim()) {
      toast.error("Title is required");
      return;
    }
    setCreating(true);
    try {
      let recurrence: TaskRecurrenceRule | null = null;
      if (recurring && dueAt) {
        recurrence = {
          freq: recurFreq,
          interval: Math.max(1, parseInt(recurInterval, 10) || 1),
          next_at: new Date(dueAt).toISOString(),
        };
      }
      await createTask(activeCompanyId, {
        title: title.trim(),
        description: description.trim() || undefined,
        status,
        priority,
        teamId: teamId || null,
        assignedToId: assignedToId || null,
        incidentId: defaultIncidentId ?? null,
        dueAt: dueAt ? new Date(dueAt).toISOString() : null,
        recurrence,
      });
      toast.success("Task created");
      onCreated();
    } catch (e) {
      logger.swallow("task-create:submit", e, "warn");
      toast.error("Failed to create task");
    } finally {
      setCreating(false);
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">New Task</CardTitle>
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <label htmlFor="task-title" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
            Title <span className="text-red-500">*</span>
          </label>
          <Input
            id="task-title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Patrol the perimeter"
          />
        </div>

        <div>
          <label htmlFor="task-description" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
            Description
          </label>
          <textarea
            id="task-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Optional details..."
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="task-status" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
              Status
            </label>
            <select
              id="task-status"
              value={status}
              onChange={(e) => setStatus(e.target.value as TaskStatus)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="todo">Todo</option>
              <option value="in_progress">In Progress</option>
              <option value="blocked">Blocked</option>
              <option value="done">Done</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label htmlFor="task-priority" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
              Priority
            </label>
            <select
              id="task-priority"
              value={priority}
              onChange={(e) => setPriority(e.target.value as TaskPriority)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="urgent">Urgent</option>
            </select>
          </div>

          {teams.length > 0 && (
            <div>
              <label htmlFor="task-team" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Team
              </label>
              <select
                id="task-team"
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label htmlFor="task-assigned" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
              Assign To
            </label>
            <select
              id="task-assigned"
              value={assignedToId}
              onChange={(e) => setAssignedToId(e.target.value)}
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">Unassigned</option>
              {members.map((m: Member) => (
                <option key={m.users?.id} value={m.users?.id}>
                  {m.users?.first_name} {m.users?.last_name}
                </option>
              ))}
            </select>
          </div>

          <div className="sm:col-span-2">
            <label htmlFor="task-due" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
              Due Date
            </label>
            <Input
              id="task-due"
              type="datetime-local"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
            />
          </div>
        </div>

        {/* Recurrence */}
        <div className="rounded-md border border-border/40 bg-muted/20 p-3 space-y-2">
          <label className="flex items-center gap-2 text-sm font-medium">
            <input
              type="checkbox"
              checked={recurring}
              onChange={(e) => setRecurring(e.target.checked)}
              className="rounded"
            />
            Recurring task
          </label>
          {recurring && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="task-recur-freq" className="text-xs text-muted-foreground mb-1 block">Frequency</label>
                <select
                  id="task-recur-freq"
                  value={recurFreq}
                  onChange={(e) => setRecurFreq(e.target.value as "daily" | "weekly" | "monthly")}
                  className="w-full h-8 rounded-md border border-input bg-background px-2 text-sm"
                >
                  <option value="daily">Daily</option>
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                </select>
              </div>
              <div>
                <label htmlFor="task-recur-interval" className="text-xs text-muted-foreground mb-1 block">Every N</label>
                <Input
                  id="task-recur-interval"
                  type="number"
                  min="1"
                  value={recurInterval}
                  onChange={(e) => setRecurInterval(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              {!dueAt && (
                <p className="col-span-2 text-xs text-amber-600">Set a due date to use as the first recurrence anchor.</p>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={creating}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleCreate} disabled={creating || !title.trim()} className="gap-1.5">
            {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Create Task
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
