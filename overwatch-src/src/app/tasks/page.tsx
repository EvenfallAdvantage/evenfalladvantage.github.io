"use client";

import { useEffect, useState, useCallback } from "react";
import { hasMinRole, type CompanyRole } from "@/lib/permissions";
import { ListChecks, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ListSkeleton } from "@/components/loading-skeleton";
import { useAuthStore } from "@/stores/auth-store";
import { usePageHeader } from "@/stores/page-header-store";
import { getTasks, getCompanyMembers, getTeams } from "@/lib/supabase/db";
import type { Task } from "@/lib/supabase/db-tasks";
import type { Team } from "@/lib/supabase/db-teams";
import { logger } from "@/lib/logger";

import { TaskCreateForm } from "./components/task-create-form";
import { TaskList } from "./components/task-list";
import { TaskFilters } from "./components/task-filters";
import { TaskDetailModal } from "./components/task-detail-modal";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Member = any;

export default function TasksPage() {
  const { activeCompanyId } = useAuthStore();
  const activeCompany = useAuthStore((s) => s.getActiveCompany());
  const isAdmin = activeCompany && hasMinRole(activeCompany.role as CompanyRole, "manager");
  const currentUserId = useAuthStore((s) => s.user?.id) ?? null;

  const setHeader = usePageHeader((s) => s.setHeader);
  const clearHeader = usePageHeader((s) => s.clearHeader);

  const [tasks, setTasks] = useState<Task[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [detailTaskId, setDetailTaskId] = useState<string | null>(null);

  // Filters
  const [scope, setScope] = useState<"mine" | "team" | "all">("mine");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    if (!activeCompanyId) return;
    setLoading(true);
    try {
      const [tasksData, membersData, teamsData] = await Promise.all([
        getTasks(activeCompanyId, { parentTaskId: null }),
        getCompanyMembers(activeCompanyId),
        getTeams(activeCompanyId),
      ]);
      setTasks(tasksData);
      setMembers(membersData);
      setTeams(teamsData);
    } catch (e) {
      logger.swallow("tasks:load", e, "warn");
    } finally {
      setLoading(false);
    }
  }, [activeCompanyId]);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    setHeader(
      "TASKS",
      "Operational tasks and assignments",
      <ListChecks className="h-5 w-5" />,
      <Button onClick={() => setShowCreate(!showCreate)} className="gap-2 w-full sm:w-auto">
        <Plus className="h-4 w-4" /> New Task
      </Button>
    );
    return () => clearHeader();
  }, [setHeader, clearHeader, showCreate]);

  // Apply scope + filters in-memory (data set is small per page; server-side
  // filtering is available via getTasks if performance becomes a concern).
  const filtered = tasks.filter((t) => {
    if (scope === "mine" && t.assignedToId !== currentUserId) return false;
    if (scope === "team") {
      if (!t.teamId) return false;
    }
    if (statusFilter !== "all" && t.status !== statusFilter) return false;
    if (priorityFilter !== "all" && t.priority !== priorityFilter) return false;
    if (teamFilter !== "all" && t.teamId !== teamFilter) return false;
    if (search) {
      const term = search.toLowerCase();
      const hit =
        t.title.toLowerCase().includes(term) ||
        (t.description?.toLowerCase().includes(term) ?? false);
      if (!hit) return false;
    }
    return true;
  });

  if (loading) {
    return (
      <div className="space-y-4">
        <ListSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {showCreate && activeCompanyId && (
        <TaskCreateForm
          activeCompanyId={activeCompanyId}
          members={members}
          teams={teams}
          onCreated={() => {
            setShowCreate(false);
            void load();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      <TaskFilters
        scope={scope}
        onScopeChange={setScope}
        statusFilter={statusFilter}
        onStatusChange={setStatusFilter}
        priorityFilter={priorityFilter}
        onPriorityChange={setPriorityFilter}
        teamFilter={teamFilter}
        onTeamChange={setTeamFilter}
        search={search}
        onSearchChange={setSearch}
        teams={teams}
        counts={{
          total: tasks.length,
          open: tasks.filter((t) => t.status === "todo" || t.status === "in_progress").length,
          overdue: tasks.filter(
            (t) =>
              t.dueAt && new Date(t.dueAt) < new Date() && t.status !== "done" && t.status !== "cancelled"
          ).length,
        }}
      />

      {activeCompanyId && (
        <TaskList
          tasks={filtered}
          members={members}
          teams={teams}
          isAdmin={!!isAdmin}
          onOpenDetail={setDetailTaskId}
          onReload={() => void load()}
        />
      )}

      {detailTaskId && activeCompanyId && (
        <TaskDetailModal
          taskId={detailTaskId}
          activeCompanyId={activeCompanyId}
          members={members}
          teams={teams}
          onClose={() => setDetailTaskId(null)}
          onChanged={() => void load()}
        />
      )}
    </div>
  );
}
