"use client";

import {
  CheckCircle2,
  Circle,
  Clock,
  User,
  Users,
  AlertTriangle,
  Trash2,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { setTaskStatus, deleteTask } from "@/lib/supabase/db";
import { useConfirmDialog } from "@/hooks/use-confirm-dialog";
import { logger } from "@/lib/logger";
import { timeAgo } from "@/lib/utils";
import type { Task, TaskStatus, TaskPriority } from "@/lib/supabase/db-tasks";
import type { Team } from "@/lib/supabase/db-teams";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

interface TaskListProps {
  tasks: Task[];
  members: Member[];
  teams: Team[];
  isAdmin: boolean;
  onOpenDetail: (taskId: string) => void;
  onReload: () => void;
}

const PRIORITY_STYLES: Record<TaskPriority, string> = {
  low: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  medium: "bg-yellow-500/10 text-yellow-700 border-yellow-500/30",
  high: "bg-orange-500/10 text-orange-700 border-orange-500/30",
  urgent: "bg-red-500/10 text-red-700 border-red-500/30",
};

const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "Todo",
  in_progress: "In Progress",
  blocked: "Blocked",
  done: "Done",
  cancelled: "Cancelled",
};

const STATUS_STYLES: Record<TaskStatus, string> = {
  todo: "bg-slate-500/10 text-slate-700 border-slate-500/30",
  in_progress: "bg-blue-500/10 text-blue-700 border-blue-500/30",
  blocked: "bg-amber-500/10 text-amber-700 border-amber-500/30",
  done: "bg-green-500/10 text-green-700 border-green-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

export function TaskList({
  tasks,
  members,
  teams,
  isAdmin,
  onOpenDetail,
  onReload,
}: TaskListProps) {
  const { confirm, ConfirmDialog } = useConfirmDialog();

  async function handleToggleDone(t: Task) {
    const next: TaskStatus = t.status === "done" ? "todo" : "done";
    try {
      await setTaskStatus(t.id, next);
      onReload();
    } catch (e) {
      logger.swallow("task-list:toggle-done", e, "warn");
      toast.error("Failed to update task");
    }
  }

  async function handleDelete(t: Task) {
    const ok = await confirm({
      description: `Delete task "${t.title}"?`,
      variant: "destructive",
      confirmLabel: "Delete",
    });
    if (!ok) return;
    try {
      await deleteTask(t.id);
      toast.success("Task deleted");
      onReload();
    } catch (e) {
      logger.swallow("task-list:delete", e, "warn");
      toast.error("Failed to delete task");
    }
  }

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <CheckCircle2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
        <p>No tasks match your filters</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-2">
        {tasks.map((t) => {
          const assignee = members.find((m: Member) => m.users?.id === t.assignedToId);
          const team = teams.find((tm) => tm.id === t.teamId);
          const isOverdue =
            t.dueAt && new Date(t.dueAt) < new Date() && t.status !== "done" && t.status !== "cancelled";
          return (
            <Card key={t.id} className="overflow-hidden hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 p-3">
                <button
                  type="button"
                  onClick={() => handleToggleDone(t)}
                  className="mt-0.5 shrink-0"
                  aria-label={t.status === "done" ? "Mark not done" : "Mark done"}
                >
                  {t.status === "done" ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground hover:text-foreground" />
                  )}
                </button>

                <button
                  type="button"
                  className="flex-1 min-w-0 text-left"
                  onClick={() => onOpenDetail(t.id)}
                >
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`font-semibold text-sm ${t.status === "done" ? "line-through text-muted-foreground" : ""}`}>
                      {t.title}
                    </span>
                    <Badge variant="outline" className={`text-[10px] ${STATUS_STYLES[t.status]}`}>
                      {STATUS_LABEL[t.status]}
                    </Badge>
                    <Badge variant="outline" className={`text-[10px] ${PRIORITY_STYLES[t.priority]}`}>
                      {t.priority}
                    </Badge>
                    {team && (
                      <Badge
                        variant="outline"
                        className="text-[10px]"
                        style={{ backgroundColor: `${team.color}20`, borderColor: team.color, color: team.color }}
                      >
                        <Users className="h-3 w-3 mr-1 inline" /> {team.name}
                      </Badge>
                    )}
                    {isOverdue && (
                      <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-700 border-red-500/30">
                        <AlertTriangle className="h-3 w-3 mr-1 inline" /> Overdue
                      </Badge>
                    )}
                  </div>

                  {t.description && (
                    <p className="text-xs text-muted-foreground line-clamp-1 mb-1">{t.description}</p>
                  )}

                  <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                    {assignee?.users && (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {assignee.users.first_name} {assignee.users.last_name}
                      </span>
                    )}
                    {t.dueAt && (
                      <span className={`flex items-center gap-1 ${isOverdue ? "text-red-600" : ""}`}>
                        <Clock className="h-3 w-3" />
                        Due {new Date(t.dueAt).toLocaleDateString()}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3 opacity-60" />
                      {timeAgo(t.createdAt)}
                    </span>
                  </div>
                </button>

                <div className="flex items-center gap-1 shrink-0">
                  {isAdmin && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500"
                      onClick={() => handleDelete(t)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => onOpenDetail(t.id)}>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>
      <ConfirmDialog />
    </>
  );
}
