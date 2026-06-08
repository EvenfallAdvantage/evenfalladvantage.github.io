"use client";

import { useEffect, useState, useCallback } from "react";
import {
  X,
  CheckCircle2,
  Circle,
  Plus,
  Trash2,
  Send,
  Eye,
  User,
  Users,
  Clock,
  AlertTriangle,
  Loader2,
  MessageSquare,
  ListChecks,
} from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { timeAgo } from "@/lib/utils";
import { logger } from "@/lib/logger";
import {
  getTask,
  updateTask,
  setTaskStatus,
  getTaskChecklist,
  addChecklistItem,
  toggleChecklistItem,
  deleteChecklistItem,
  getTaskComments,
  addTaskComment,
  getTaskWatchers,
  addTaskWatcher,
  removeTaskWatcher,
  getSubtasks,
} from "@/lib/supabase/db";
import type {
  Task,
  TaskStatus,
  TaskPriority,
  TaskChecklistItem,
  TaskComment,
  TaskWatcher,
} from "@/lib/supabase/db-tasks";
import type { Team } from "@/lib/supabase/db-teams";
import { useAuthStore } from "@/stores/auth-store";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

interface TaskDetailModalProps {
  taskId: string;
  activeCompanyId: string;
  members: Member[];
  teams: Team[];
  onClose: () => void;
  onChanged: () => void;
}

export function TaskDetailModal({
  taskId,
  activeCompanyId: _activeCompanyId,
  members,
  teams,
  onClose,
  onChanged,
}: TaskDetailModalProps) {
  const currentUserId = useAuthStore((s) => s.user?.id) ?? null;

  const [task, setTask] = useState<Task | null>(null);
  const [checklist, setChecklist] = useState<TaskChecklistItem[]>([]);
  const [comments, setComments] = useState<TaskComment[]>([]);
  const [watchers, setWatchers] = useState<TaskWatcher[]>([]);
  const [subtasks, setSubtasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  const [newChecklistItem, setNewChecklistItem] = useState("");
  const [newComment, setNewComment] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [t, cl, cm, ws, subs] = await Promise.all([
        getTask(taskId),
        getTaskChecklist(taskId),
        getTaskComments(taskId),
        getTaskWatchers(taskId),
        getSubtasks(taskId),
      ]);
      setTask(t);
      setChecklist(cl);
      setComments(cm);
      setWatchers(ws);
      setSubtasks(subs);
    } catch (e) {
      logger.swallow("task-detail:load", e, "warn");
      toast.error("Failed to load task");
    } finally {
      setLoading(false);
    }
  }, [taskId]);

  useEffect(() => { void load(); }, [load]);

  const refreshComments = async () => {
    const cm = await getTaskComments(taskId);
    setComments(cm);
  };

  const handleFieldChange = async (
    updates: Partial<{
      title: string;
      description: string | null;
      teamId: string | null;
      assignedToId: string | null;
      priority: TaskPriority;
      dueAt: string | null;
    }>,
    logMessage?: string
  ) => {
    setBusy(true);
    try {
      const updated = await updateTask(taskId, updates);
      if (updated) setTask(updated);
      if (logMessage) {
        await addTaskComment(taskId, logMessage, "update");
        await refreshComments();
      }
      onChanged();
    } catch (e) {
      logger.swallow("task-detail:update", e, "warn");
      toast.error("Failed to update task");
    } finally {
      setBusy(false);
    }
  };

  const handleStatusChange = async (status: TaskStatus) => {
    setBusy(true);
    try {
      const updated = await setTaskStatus(taskId, status);
      if (updated) setTask(updated);
      await addTaskComment(taskId, `Status -> ${status}`, "status_change");
      await refreshComments();
      onChanged();
    } catch (e) {
      logger.swallow("task-detail:status", e, "warn");
      toast.error("Failed to update status");
    } finally {
      setBusy(false);
    }
  };

  const handleAddChecklistItem = async () => {
    if (!newChecklistItem.trim()) return;
    try {
      const item = await addChecklistItem(taskId, newChecklistItem.trim(), checklist.length);
      if (item) setChecklist((prev) => [...prev, item]);
      setNewChecklistItem("");
    } catch (e) {
      logger.swallow("task-detail:checklist-add", e, "warn");
      toast.error("Failed to add item");
    }
  };

  const handleToggleChecklistItem = async (item: TaskChecklistItem) => {
    const next = !item.isDone;
    setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, isDone: next } : c)));
    const ok = await toggleChecklistItem(item.id, next);
    if (!ok) {
      // Revert
      setChecklist((prev) => prev.map((c) => (c.id === item.id ? { ...c, isDone: !next } : c)));
      toast.error("Failed to update item");
    }
  };

  const handleDeleteChecklistItem = async (item: TaskChecklistItem) => {
    const ok = await deleteChecklistItem(item.id);
    if (ok) {
      setChecklist((prev) => prev.filter((c) => c.id !== item.id));
    } else {
      toast.error("Failed to delete item");
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;
    try {
      const cm = await addTaskComment(taskId, newComment.trim(), "note");
      if (cm) setComments((prev) => [...prev, cm]);
      setNewComment("");
    } catch (e) {
      logger.swallow("task-detail:comment-add", e, "warn");
      toast.error("Failed to add comment");
    }
  };

  const isWatching = currentUserId && watchers.some((w) => w.userId === currentUserId);

  const handleToggleWatch = async () => {
    if (!currentUserId) return;
    if (isWatching) {
      const ok = await removeTaskWatcher(taskId, currentUserId);
      if (ok) setWatchers((prev) => prev.filter((w) => w.userId !== currentUserId));
    } else {
      const ok = await addTaskWatcher(taskId, currentUserId);
      if (ok) {
        const ws = await getTaskWatchers(taskId);
        setWatchers(ws);
      }
    }
  };

  const team = task?.teamId ? teams.find((t) => t.id === task.teamId) : null;
  const assignee = task?.assignedToId
    ? members.find((m: Member) => m.users?.id === task.assignedToId)
    : null;
  const isOverdue =
    task?.dueAt &&
    new Date(task.dueAt) < new Date() &&
    task.status !== "done" &&
    task.status !== "cancelled";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">Task details</DialogTitle>
        {loading || !task ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <input
                  type="text"
                  value={task.title}
                  onChange={(e) => setTask({ ...task, title: e.target.value })}
                  onBlur={() => {
                    if (task.title.trim()) {
                      void handleFieldChange({ title: task.title.trim() }, `Title updated`);
                    }
                  }}
                  className="w-full text-xl font-bold bg-transparent border-0 outline-none focus:bg-muted/30 rounded px-1 -mx-1"
                  aria-label="Task title"
                />
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  {team && (
                    <Badge
                      variant="outline"
                      style={{ backgroundColor: `${team.color}20`, borderColor: team.color, color: team.color }}
                    >
                      <Users className="h-3 w-3 mr-1" /> {team.name}
                    </Badge>
                  )}
                  {task.incidentId && (
                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 border-amber-500/30">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Linked to incident
                    </Badge>
                  )}
                  {task.parentTaskId && (
                    <Badge variant="outline" className="bg-purple-500/10 text-purple-700 border-purple-500/30">
                      Subtask
                    </Badge>
                  )}
                  {isOverdue && (
                    <Badge variant="outline" className="bg-red-500/10 text-red-700 border-red-500/30">
                      <AlertTriangle className="h-3 w-3 mr-1" /> Overdue
                    </Badge>
                  )}
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>

            {/* Action bar */}
            <div className="flex flex-wrap items-center gap-2 border-t border-b border-border/40 py-3">
              <select
                value={task.status}
                onChange={(e) => void handleStatusChange(e.target.value as TaskStatus)}
                disabled={busy}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium"
                aria-label="Status"
              >
                <option value="todo">Todo</option>
                <option value="in_progress">In Progress</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done</option>
                <option value="cancelled">Cancelled</option>
              </select>

              <select
                value={task.priority}
                onChange={(e) => void handleFieldChange({ priority: e.target.value as TaskPriority }, `Priority set to ${e.target.value}`)}
                disabled={busy}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                aria-label="Priority"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>

              {teams.length > 0 && (
                <select
                  value={task.teamId ?? ""}
                  onChange={(e) => {
                    const tid = e.target.value || null;
                    const teamName = teams.find((t) => t.id === tid)?.name;
                    void handleFieldChange(
                      { teamId: tid },
                      tid ? `Assigned to team ${teamName}` : "Team cleared"
                    );
                  }}
                  disabled={busy}
                  className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                  aria-label="Team"
                >
                  <option value="">No team</option>
                  {teams.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              )}

              <select
                value={task.assignedToId ?? ""}
                onChange={(e) => {
                  const uid = e.target.value || null;
                  const m = members.find((mm: Member) => mm.users?.id === uid);
                  const name = m?.users ? `${m.users.first_name ?? ""} ${m.users.last_name ?? ""}`.trim() : "user";
                  void handleFieldChange({ assignedToId: uid }, uid ? `Assigned to ${name}` : "Assignment cleared");
                }}
                disabled={busy}
                className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                aria-label="Assignee"
              >
                <option value="">Unassigned</option>
                {members.map((m: Member) => (
                  <option key={m.users?.id} value={m.users?.id}>
                    {m.users?.first_name} {m.users?.last_name}
                  </option>
                ))}
              </select>

              <Button
                variant={isWatching ? "secondary" : "outline"}
                size="sm"
                onClick={handleToggleWatch}
                className="h-8 text-xs gap-1.5 ml-auto"
              >
                <Eye className="h-3.5 w-3.5" />
                {isWatching ? "Watching" : "Watch"}
                {watchers.length > 0 && (
                  <span className="ml-1 text-[10px] text-muted-foreground">({watchers.length})</span>
                )}
              </Button>
            </div>

            {/* Description */}
            <div>
              <label htmlFor="task-detail-desc" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                Description
              </label>
              <textarea
                id="task-detail-desc"
                value={task.description ?? ""}
                onChange={(e) => setTask({ ...task, description: e.target.value })}
                onBlur={() => void handleFieldChange({ description: task.description })}
                placeholder="Add a description..."
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm min-h-[80px]"
              />
            </div>

            {/* Due date */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label htmlFor="task-detail-due" className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1 block">
                  Due Date
                </label>
                <Input
                  id="task-detail-due"
                  type="datetime-local"
                  value={task.dueAt ? new Date(task.dueAt).toISOString().slice(0, 16) : ""}
                  onChange={(e) => {
                    const v = e.target.value ? new Date(e.target.value).toISOString() : null;
                    void handleFieldChange({ dueAt: v });
                  }}
                  className="h-9 text-sm"
                />
              </div>
              {assignee?.users && (
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-1">Assignee</p>
                  <div className="flex items-center gap-2 text-sm h-9">
                    <User className="h-3.5 w-3.5 text-muted-foreground" />
                    {assignee.users.first_name} {assignee.users.last_name}
                  </div>
                </div>
              )}
            </div>

            {/* Checklist */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <ListChecks className="h-3 w-3" /> Checklist
                {checklist.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/70">
                    ({checklist.filter((c) => c.isDone).length}/{checklist.length})
                  </span>
                )}
              </h4>
              <div className="space-y-1.5">
                {checklist.map((c) => (
                  <div key={c.id} className="flex items-center gap-2 text-sm">
                    <button
                      type="button"
                      onClick={() => void handleToggleChecklistItem(c)}
                      aria-label={c.isDone ? "Mark not done" : "Mark done"}
                    >
                      {c.isDone ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      )}
                    </button>
                    <span className={`flex-1 ${c.isDone ? "line-through text-muted-foreground" : ""}`}>
                      {c.content}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 h-7 w-7 p-0"
                      onClick={() => void handleDeleteChecklistItem(c)}
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-2">
                <Input
                  placeholder="Add checklist item..."
                  value={newChecklistItem}
                  onChange={(e) => setNewChecklistItem(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddChecklistItem()}
                  className="h-8 text-sm"
                />
                <Button size="sm" onClick={handleAddChecklistItem} disabled={!newChecklistItem.trim()} className="h-8">
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            {/* Subtasks (read-only list) */}
            {subtasks.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                  Subtasks ({subtasks.length})
                </h4>
                <div className="space-y-1">
                  {subtasks.map((s) => (
                    <div key={s.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded bg-muted/30">
                      <Circle className="h-3 w-3 text-muted-foreground" />
                      <span className={s.status === "done" ? "line-through text-muted-foreground" : ""}>{s.title}</span>
                      <Badge variant="outline" className="text-[10px] ml-auto">
                        {s.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Activity Timeline */}
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                <MessageSquare className="h-3 w-3" /> Activity
              </h4>
              <div className="space-y-2">
                {comments.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">No activity yet</p>
                ) : (
                  comments.map((u) => {
                    const isSystem = u.type === "status_change" || u.type === "update" || u.type === "transfer";
                    return (
                      <div key={u.id} className="flex items-start gap-2 text-sm">
                        <div
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold mt-0.5 ${
                            isSystem ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"
                          }`}
                        >
                          {isSystem ? "·" : `${u.users?.first_name?.[0] ?? ""}${u.users?.last_name?.[0] ?? ""}`}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium text-xs">
                            {isSystem ? "System" : `${u.users?.first_name ?? ""} ${u.users?.last_name ?? ""}`.trim() || "Unknown"}
                          </span>
                          <span className="text-[10px] text-muted-foreground ml-2">{timeAgo(u.createdAt)}</span>
                          {isSystem ? (
                            <p className="text-xs italic text-muted-foreground mt-0.5">{u.content}</p>
                          ) : (
                            <p className="text-xs mt-0.5 text-foreground/80">{u.content}</p>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
              <div className="flex gap-2 mt-3">
                <Input
                  placeholder="Add a comment..."
                  className="text-sm h-9"
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleAddComment()}
                />
                <Button size="sm" onClick={handleAddComment} disabled={!newComment.trim()} className="h-9">
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>

            <div className="text-[10px] text-muted-foreground flex items-center gap-2 pt-2 border-t">
              <Clock className="h-3 w-3" /> Created {timeAgo(task.createdAt)}
              {task.completedAt && <> · Completed {timeAgo(task.completedAt)}</>}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
