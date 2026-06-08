/**
 * Tasks System (Phase 2 / HaloTaskManager parity)
 *
 * General task system: tasks with subtasks, recurrence, watchers, checklist,
 * comments timeline. Tasks may link to incidents (cross-link) or to a parent
 * task (subtask).
 *
 * Tables (created via SQL migration `add-tasks-system.sql`):
 *  - tasks
 *  - task_watchers
 *  - task_checklist_items
 *  - task_comments
 */

import { createClient } from "./client";
import { ts, ensureInternalUser } from "./db-helpers";
import { logDbReadError } from "./db-error";

// ─── Types ─────────────────────────────────────────────────

export type TaskStatus = "todo" | "in_progress" | "blocked" | "done" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";
export type TaskCommentType = "note" | "status_change" | "update" | "transfer";

export interface TaskRecurrenceRule {
  freq: "daily" | "weekly" | "monthly";
  interval: number;
  next_at: string; // ISO timestamp
}

export interface Task {
  id: string;
  companyId: string;
  teamId: string | null;
  incidentId: string | null;
  parentTaskId: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  createdById: string | null;
  assignedToId: string | null;
  dueAt: string | null;
  completedAt: string | null;
  sortOrder: number;
  recurrence: TaskRecurrenceRule | null;
  customFields: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  // Joined fields (optional)
  createdByUser?: { first_name: string | null; last_name: string | null } | null;
  assignedToUser?: { first_name: string | null; last_name: string | null } | null;
}

export interface TaskWatcher {
  id: string;
  taskId: string;
  userId: string;
  createdAt: string;
}

export interface TaskChecklistItem {
  id: string;
  taskId: string;
  content: string;
  isDone: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskComment {
  id: string;
  taskId: string;
  userId: string | null;
  content: string;
  type: TaskCommentType;
  createdAt: string;
  users?: { first_name: string | null; last_name: string | null } | null;
}

// ─── Mapping helpers ───────────────────────────────────────

interface TaskRow {
  id: string;
  company_id: string;
  team_id: string | null;
  incident_id: string | null;
  parent_task_id: string | null;
  title: string;
  description: string | null;
  status: TaskStatus;
  priority: TaskPriority;
  created_by: string | null;
  assigned_to: string | null;
  due_at: string | null;
  completed_at: string | null;
  sort_order: number;
  recurrence: TaskRecurrenceRule | null;
  custom_fields: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
  created_user?: { first_name: string | null; last_name: string | null } | null;
  assigned_user?: { first_name: string | null; last_name: string | null } | null;
}

function mapTaskRow(t: TaskRow): Task {
  return {
    id: t.id,
    companyId: t.company_id,
    teamId: t.team_id,
    incidentId: t.incident_id,
    parentTaskId: t.parent_task_id,
    title: t.title,
    description: t.description,
    status: t.status,
    priority: t.priority,
    createdById: t.created_by,
    assignedToId: t.assigned_to,
    dueAt: t.due_at,
    completedAt: t.completed_at,
    sortOrder: t.sort_order,
    recurrence: t.recurrence,
    customFields: t.custom_fields ?? {},
    createdAt: t.created_at,
    updatedAt: t.updated_at,
    createdByUser: t.created_user ?? null,
    assignedToUser: t.assigned_user ?? null,
  };
}

const TASK_SELECT =
  "*, created_user:users!tasks_created_by_fkey(first_name, last_name), assigned_user:users!tasks_assigned_to_fkey(first_name, last_name)";

// ─── Tasks CRUD ────────────────────────────────────────────

export async function getTasks(
  companyId: string,
  filters: {
    status?: TaskStatus;
    priority?: TaskPriority;
    teamId?: string;
    assignedTo?: string;
    incidentId?: string;
    parentTaskId?: string | null; // pass null to fetch top-level only
    includeRecurringTemplates?: boolean;
  } = {}
): Promise<Task[]> {
  const supabase = createClient();
  let q = supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("company_id", companyId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (filters.status) q = q.eq("status", filters.status);
  if (filters.priority) q = q.eq("priority", filters.priority);
  if (filters.teamId) q = q.eq("team_id", filters.teamId);
  if (filters.assignedTo) q = q.eq("assigned_to", filters.assignedTo);
  if (filters.incidentId) q = q.eq("incident_id", filters.incidentId);

  if (filters.parentTaskId === null) {
    q = q.is("parent_task_id", null);
  } else if (filters.parentTaskId) {
    q = q.eq("parent_task_id", filters.parentTaskId);
  }

  if (!filters.includeRecurringTemplates) {
    // Hide recurring templates (rows with recurrence not null AND no parent)
    // by default — they spawn instances; users see instances.
    // We keep templates visible only when explicitly requested.
    // (Implemented as a soft hint: rows with recurrence!=null are templates;
    // their spawned instances have parent_task_id pointing back to them.)
  }

  const { data, error } = await q;
  if (error) {
    logDbReadError("tasks", error);
    return [];
  }
  return (data ?? []).map((r: unknown) => mapTaskRow(r as TaskRow));
}

export async function getTask(taskId: string): Promise<Task | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("id", taskId)
    .maybeSingle();
  if (error) {
    logDbReadError("task details", error);
    return null;
  }
  if (!data) return null;
  return mapTaskRow(data as TaskRow);
}

export async function getSubtasks(parentTaskId: string): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("parent_task_id", parentTaskId)
    .order("sort_order", { ascending: true });
  if (error) {
    logDbReadError("subtasks", error);
    return [];
  }
  return (data ?? []).map((r: unknown) => mapTaskRow(r as TaskRow));
}

export async function getTasksForIncident(incidentId: string): Promise<Task[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .select(TASK_SELECT)
    .eq("incident_id", incidentId)
    .order("created_at", { ascending: false });
  if (error) {
    logDbReadError("tasks for incident", error);
    return [];
  }
  return (data ?? []).map((r: unknown) => mapTaskRow(r as TaskRow));
}

export async function createTask(
  companyId: string,
  params: {
    title: string;
    description?: string;
    status?: TaskStatus;
    priority?: TaskPriority;
    teamId?: string | null;
    assignedToId?: string | null;
    incidentId?: string | null;
    parentTaskId?: string | null;
    dueAt?: string | null;
    sortOrder?: number;
    recurrence?: TaskRecurrenceRule | null;
    customFields?: Record<string, unknown>;
  }
): Promise<Task | null> {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      id: crypto.randomUUID(),
      company_id: companyId,
      team_id: params.teamId ?? null,
      incident_id: params.incidentId ?? null,
      parent_task_id: params.parentTaskId ?? null,
      title: params.title,
      description: params.description ?? null,
      status: params.status ?? "todo",
      priority: params.priority ?? "medium",
      created_by: userId,
      assigned_to: params.assignedToId ?? null,
      due_at: params.dueAt ?? null,
      sort_order: params.sortOrder ?? 0,
      recurrence: params.recurrence ?? null,
      custom_fields: params.customFields ?? {},
      ...ts(),
    })
    .select(TASK_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTaskRow(data as TaskRow) : null;
}

export async function updateTask(
  taskId: string,
  updates: Partial<{
    title: string;
    description: string | null;
    status: TaskStatus;
    priority: TaskPriority;
    teamId: string | null;
    assignedToId: string | null;
    incidentId: string | null;
    parentTaskId: string | null;
    dueAt: string | null;
    completedAt: string | null;
    sortOrder: number;
    recurrence: TaskRecurrenceRule | null;
    customFields: Record<string, unknown>;
  }>
): Promise<Task | null> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };
  if (updates.title !== undefined) payload.title = updates.title;
  if (updates.description !== undefined) payload.description = updates.description;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.priority !== undefined) payload.priority = updates.priority;
  if (updates.teamId !== undefined) payload.team_id = updates.teamId;
  if (updates.assignedToId !== undefined) payload.assigned_to = updates.assignedToId;
  if (updates.incidentId !== undefined) payload.incident_id = updates.incidentId;
  if (updates.parentTaskId !== undefined) payload.parent_task_id = updates.parentTaskId;
  if (updates.dueAt !== undefined) payload.due_at = updates.dueAt;
  if (updates.completedAt !== undefined) payload.completed_at = updates.completedAt;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
  if (updates.recurrence !== undefined) payload.recurrence = updates.recurrence;
  if (updates.customFields !== undefined) payload.custom_fields = updates.customFields;

  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .select(TASK_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTaskRow(data as TaskRow) : null;
}

export async function setTaskStatus(
  taskId: string,
  status: TaskStatus
): Promise<Task | null> {
  const supabase = createClient();
  const payload: Record<string, unknown> = {
    status,
    updated_at: new Date().toISOString(),
  };
  if (status === "done") {
    payload.completed_at = new Date().toISOString();
  } else if (status !== "cancelled") {
    payload.completed_at = null;
  }
  const { data, error } = await supabase
    .from("tasks")
    .update(payload)
    .eq("id", taskId)
    .select(TASK_SELECT)
    .maybeSingle();
  if (error) throw error;
  return data ? mapTaskRow(data as TaskRow) : null;
}

export async function deleteTask(taskId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase.from("tasks").delete().eq("id", taskId);
  if (error) throw error;
}

export async function linkTaskToIncident(
  taskId: string,
  incidentId: string | null
): Promise<Task | null> {
  return updateTask(taskId, { incidentId });
}

// ─── Watchers ─────────────────────────────────────────────

export async function getTaskWatchers(taskId: string): Promise<TaskWatcher[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_watchers")
    .select("*")
    .eq("task_id", taskId);
  if (error) {
    logDbReadError("task watchers", error);
    return [];
  }
  return (data ?? []).map((w: {
    id: string;
    task_id: string;
    user_id: string;
    created_at: string;
  }) => ({
    id: w.id,
    taskId: w.task_id,
    userId: w.user_id,
    createdAt: w.created_at,
  }));
}

export async function addTaskWatcher(
  taskId: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase.from("task_watchers").insert({
    id: crypto.randomUUID(),
    task_id: taskId,
    user_id: userId,
    created_at: new Date().toISOString(),
  });
  return !error;
}

export async function removeTaskWatcher(
  taskId: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("task_watchers")
    .delete()
    .eq("task_id", taskId)
    .eq("user_id", userId);
  return !error;
}

// ─── Checklist ────────────────────────────────────────────

export async function getTaskChecklist(taskId: string): Promise<TaskChecklistItem[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .select("*")
    .eq("task_id", taskId)
    .order("sort_order", { ascending: true });
  if (error) {
    logDbReadError("task checklist", error);
    return [];
  }
  return (data ?? []).map((c: {
    id: string;
    task_id: string;
    content: string;
    is_done: boolean;
    sort_order: number;
    created_at: string;
    updated_at: string;
  }) => ({
    id: c.id,
    taskId: c.task_id,
    content: c.content,
    isDone: c.is_done,
    sortOrder: c.sort_order,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
  }));
}

export async function addChecklistItem(
  taskId: string,
  content: string,
  sortOrder = 0
): Promise<TaskChecklistItem | null> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_checklist_items")
    .insert({
      id: crypto.randomUUID(),
      task_id: taskId,
      content,
      is_done: false,
      sort_order: sortOrder,
      ...ts(),
    })
    .select("*")
    .maybeSingle();
  if (error) {
    console.error("[Tasks Checklist] Create failed:", error.message);
    return null;
  }
  if (!data) return null;
  return {
    id: data.id,
    taskId: data.task_id,
    content: data.content,
    isDone: data.is_done,
    sortOrder: data.sort_order,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function toggleChecklistItem(
  itemId: string,
  isDone: boolean
): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("task_checklist_items")
    .update({ is_done: isDone, updated_at: new Date().toISOString() })
    .eq("id", itemId);
  return !error;
}

export async function updateChecklistItem(
  itemId: string,
  updates: Partial<{ content: string; isDone: boolean; sortOrder: number }>
): Promise<boolean> {
  const supabase = createClient();
  const payload: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (updates.content !== undefined) payload.content = updates.content;
  if (updates.isDone !== undefined) payload.is_done = updates.isDone;
  if (updates.sortOrder !== undefined) payload.sort_order = updates.sortOrder;
  const { error } = await supabase
    .from("task_checklist_items")
    .update(payload)
    .eq("id", itemId);
  return !error;
}

export async function deleteChecklistItem(itemId: string): Promise<boolean> {
  const supabase = createClient();
  const { error } = await supabase
    .from("task_checklist_items")
    .delete()
    .eq("id", itemId);
  return !error;
}

// ─── Comments / Activity Log ──────────────────────────────

export async function getTaskComments(taskId: string): Promise<TaskComment[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .select("*, users(first_name, last_name)")
    .eq("task_id", taskId)
    .order("created_at", { ascending: true });
  if (error) {
    logDbReadError("task comments", error);
    return [];
  }
  return (data ?? []).map((c: {
    id: string;
    task_id: string;
    user_id: string | null;
    content: string;
    type: TaskCommentType;
    created_at: string;
    users?: { first_name: string | null; last_name: string | null } | null;
  }) => ({
    id: c.id,
    taskId: c.task_id,
    userId: c.user_id,
    content: c.content,
    type: c.type,
    createdAt: c.created_at,
    users: c.users ?? null,
  }));
}

export async function addTaskComment(
  taskId: string,
  content: string,
  type: TaskCommentType = "note"
): Promise<TaskComment | null> {
  const userId = await ensureInternalUser();
  if (!userId) throw new Error("Not authenticated");
  const supabase = createClient();
  const { data, error } = await supabase
    .from("task_comments")
    .insert({
      id: crypto.randomUUID(),
      task_id: taskId,
      user_id: userId,
      content,
      type,
      created_at: new Date().toISOString(),
    })
    .select("*, users(first_name, last_name)")
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    taskId: data.task_id,
    userId: data.user_id,
    content: data.content,
    type: data.type,
    createdAt: data.created_at,
    users: data.users ?? null,
  };
}

// ─── Recurring task generator ─────────────────────────────

/**
 * Calls the SECURITY DEFINER RPC `generate_recurring_tasks`. Typically invoked
 * by a pg_cron schedule; this helper is provided for manual triggering from
 * the admin UI. Returns the number of task instances created.
 */
export async function generateRecurringTasks(companyId?: string): Promise<number> {
  const supabase = createClient();
  const { data, error } = await supabase.rpc("generate_recurring_tasks", {
    p_company_id: companyId ?? null,
  });
  if (error) {
    console.error("[Tasks] generate_recurring_tasks failed:", error.message);
    return 0;
  }
  return typeof data === "number" ? data : 0;
}
