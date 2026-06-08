import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
const { client: mockClient, setMockResponse, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

const mockEnsureInternalUser = vi.fn();
vi.mock("@/lib/supabase/db-helpers", () => ({
  ts: () => ({ created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }),
  ensureInternalUser: (...args: unknown[]) => mockEnsureInternalUser(...args),
}));

vi.mock("@/lib/supabase/db-error", () => ({
  logDbReadError: vi.fn(),
}));

import {
  getTasks,
  getTask,
  getSubtasks,
  getTasksForIncident,
  createTask,
  updateTask,
  setTaskStatus,
  deleteTask,
  linkTaskToIncident,
  getTaskWatchers,
  addTaskWatcher,
  removeTaskWatcher,
  getTaskChecklist,
  addChecklistItem,
  toggleChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  getTaskComments,
  addTaskComment,
  generateRecurringTasks,
} from "@/lib/supabase/db-tasks";
import { logDbReadError } from "@/lib/supabase/db-error";

const mockedLogDbReadError = vi.mocked(logDbReadError);

const TASK_ROW = {
  id: "task-1",
  company_id: "comp-1",
  team_id: "team-1",
  incident_id: null,
  parent_task_id: null,
  title: "Patrol the perimeter",
  description: "Check all entry points",
  status: "todo" as const,
  priority: "high" as const,
  created_by: "user-1",
  assigned_to: "user-2",
  due_at: "2026-02-01T00:00:00.000Z",
  completed_at: null,
  sort_order: 0,
  recurrence: null,
  custom_fields: { tag: "evening" },
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  mockEnsureInternalUser.mockResolvedValue("user-123");
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
});

// ---------------------------------------------------------------------------
// getTasks()
// ---------------------------------------------------------------------------

describe("getTasks()", () => {
  it("returns mapped tasks scoped to company", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [TASK_ROW], error: null }).then(resolve)
    );

    const result = await getTasks("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("tasks");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "task-1",
      companyId: "comp-1",
      teamId: "team-1",
      title: "Patrol the perimeter",
      status: "todo",
      priority: "high",
      assignedToId: "user-2",
      customFields: { tag: "evening" },
    });
  });

  it("applies all filters when provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getTasks("comp-1", {
      status: "in_progress",
      priority: "urgent",
      teamId: "team-1",
      assignedTo: "user-2",
      incidentId: "inc-1",
    });

    const eqCalls = queryBuilder.eq.mock.calls;
    expect(eqCalls).toContainEqual(["company_id", "comp-1"]);
    expect(eqCalls).toContainEqual(["status", "in_progress"]);
    expect(eqCalls).toContainEqual(["priority", "urgent"]);
    expect(eqCalls).toContainEqual(["team_id", "team-1"]);
    expect(eqCalls).toContainEqual(["assigned_to", "user-2"]);
    expect(eqCalls).toContainEqual(["incident_id", "inc-1"]);
  });

  it("filters top-level tasks when parentTaskId is null", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getTasks("comp-1", { parentTaskId: null });

    expect(queryBuilder.is).toHaveBeenCalledWith("parent_task_id", null);
  });

  it("filters subtasks when parentTaskId is provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getTasks("comp-1", { parentTaskId: "parent-1" });

    expect(queryBuilder.eq).toHaveBeenCalledWith("parent_task_id", "parent-1");
  });

  it("returns [] and logs on error", async () => {
    const dbError = { message: "boom" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getTasks("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("tasks", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getTask()
// ---------------------------------------------------------------------------

describe("getTask()", () => {
  it("returns a single mapped task", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TASK_ROW, error: null });

    const result = await getTask("task-1");

    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "task-1");
    expect(result?.id).toBe("task-1");
    expect(result?.title).toBe("Patrol the perimeter");
  });

  it("returns null on error", async () => {
    const dbError = { message: "not found" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: dbError });

    const result = await getTask("task-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("task details", dbError);
    expect(result).toBeNull();
  });

  it("returns null when no data", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getTask("task-1");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getSubtasks() / getTasksForIncident()
// ---------------------------------------------------------------------------

describe("getSubtasks()", () => {
  it("filters by parent_task_id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [TASK_ROW], error: null }).then(resolve)
    );

    const result = await getSubtasks("parent-1");

    expect(queryBuilder.eq).toHaveBeenCalledWith("parent_task_id", "parent-1");
    expect(result).toHaveLength(1);
  });

  it("returns [] on error", async () => {
    const dbError = { message: "boom" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getSubtasks("parent-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("subtasks", dbError);
    expect(result).toEqual([]);
  });
});

describe("getTasksForIncident()", () => {
  it("filters by incident_id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [TASK_ROW], error: null }).then(resolve)
    );

    const result = await getTasksForIncident("inc-1");

    expect(queryBuilder.eq).toHaveBeenCalledWith("incident_id", "inc-1");
    expect(result).toHaveLength(1);
  });
});

// ---------------------------------------------------------------------------
// createTask()
// ---------------------------------------------------------------------------

describe("createTask()", () => {
  it("inserts with all params", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TASK_ROW, error: null });

    await createTask("comp-1", {
      title: "Patrol the perimeter",
      description: "Check all entry points",
      status: "in_progress",
      priority: "high",
      teamId: "team-1",
      assignedToId: "user-2",
      incidentId: "inc-1",
      parentTaskId: "parent-1",
      dueAt: "2026-02-01T00:00:00.000Z",
      sortOrder: 5,
      recurrence: { freq: "daily", interval: 1, next_at: "2026-02-01T00:00:00.000Z" },
      customFields: { tag: "evening" },
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg).toMatchObject({
      company_id: "comp-1",
      team_id: "team-1",
      incident_id: "inc-1",
      parent_task_id: "parent-1",
      title: "Patrol the perimeter",
      description: "Check all entry points",
      status: "in_progress",
      priority: "high",
      created_by: "user-123",
      assigned_to: "user-2",
      due_at: "2026-02-01T00:00:00.000Z",
      sort_order: 5,
      custom_fields: { tag: "evening" },
    });
  });

  it("applies sensible defaults", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TASK_ROW, error: null });

    await createTask("comp-1", { title: "Quick task" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.status).toBe("todo");
    expect(insertArg.priority).toBe("medium");
    expect(insertArg.team_id).toBeNull();
    expect(insertArg.incident_id).toBeNull();
    expect(insertArg.parent_task_id).toBeNull();
    expect(insertArg.assigned_to).toBeNull();
    expect(insertArg.due_at).toBeNull();
    expect(insertArg.recurrence).toBeNull();
    expect(insertArg.custom_fields).toEqual({});
    expect(insertArg.sort_order).toBe(0);
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);

    await expect(createTask("comp-1", { title: "X" })).rejects.toThrow("Not authenticated");
  });

  it("throws on insert error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "fail" },
    });

    await expect(createTask("comp-1", { title: "X" })).rejects.toEqual({
      message: "fail",
    });
  });
});

// ---------------------------------------------------------------------------
// updateTask()
// ---------------------------------------------------------------------------

describe("updateTask()", () => {
  it("only includes provided fields", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TASK_ROW, error: null });

    await updateTask("task-1", { title: "New title" });

    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "task-1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.title).toBe("New title");
    expect(updateArg.updated_at).toBeDefined();
    expect(updateArg).not.toHaveProperty("description");
    expect(updateArg).not.toHaveProperty("status");
  });

  it("allows clearing nullable fields by passing null", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TASK_ROW, error: null });

    await updateTask("task-1", { teamId: null, incidentId: null, dueAt: null });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.team_id).toBeNull();
    expect(updateArg.incident_id).toBeNull();
    expect(updateArg.due_at).toBeNull();
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "denied" },
    });

    await expect(updateTask("task-1", { title: "X" })).rejects.toEqual({
      message: "denied",
    });
  });
});

// ---------------------------------------------------------------------------
// setTaskStatus()
// ---------------------------------------------------------------------------

describe("setTaskStatus()", () => {
  it("sets completed_at when status becomes done", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { ...TASK_ROW, status: "done" },
      error: null,
    });

    await setTaskStatus("task-1", "done");

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.status).toBe("done");
    expect(updateArg.completed_at).toBeDefined();
    expect(updateArg.completed_at).not.toBeNull();
  });

  it("clears completed_at when moving back to todo", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TASK_ROW, error: null });

    await setTaskStatus("task-1", "todo");

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.status).toBe("todo");
    expect(updateArg.completed_at).toBeNull();
  });

  it("does not touch completed_at when cancelling", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TASK_ROW, error: null });

    await setTaskStatus("task-1", "cancelled");

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.status).toBe("cancelled");
    expect(updateArg).not.toHaveProperty("completed_at");
  });
});

// ---------------------------------------------------------------------------
// deleteTask() / linkTaskToIncident()
// ---------------------------------------------------------------------------

describe("deleteTask()", () => {
  it("deletes by id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deleteTask("task-1");

    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "task-1");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "denied" } }).then(resolve)
    );

    await expect(deleteTask("task-1")).rejects.toEqual({ message: "denied" });
  });
});

describe("linkTaskToIncident()", () => {
  it("delegates to updateTask with incidentId", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { ...TASK_ROW, incident_id: "inc-1" },
      error: null,
    });

    await linkTaskToIncident("task-1", "inc-1");

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.incident_id).toBe("inc-1");
  });

  it("can unlink by passing null", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TASK_ROW, error: null });

    await linkTaskToIncident("task-1", null);

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.incident_id).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Watchers
// ---------------------------------------------------------------------------

describe("getTaskWatchers()", () => {
  it("returns mapped watchers", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({
        data: [{ id: "w1", task_id: "task-1", user_id: "user-1", created_at: "2026-01-01" }],
        error: null,
      }).then(resolve)
    );

    const result = await getTaskWatchers("task-1");

    expect(mockClient.from).toHaveBeenCalledWith("task_watchers");
    expect(queryBuilder.eq).toHaveBeenCalledWith("task_id", "task-1");
    expect(result).toEqual([{ id: "w1", taskId: "task-1", userId: "user-1", createdAt: "2026-01-01" }]);
  });

  it("returns [] on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve)
    );

    const result = await getTaskWatchers("task-1");
    expect(result).toEqual([]);
  });
});

describe("addTaskWatcher()", () => {
  it("inserts and returns true on success", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const ok = await addTaskWatcher("task-1", "user-1");

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({ task_id: "task-1", user_id: "user-1" })
    );
    expect(ok).toBe(true);
  });

  it("returns false on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "denied" } }).then(resolve)
    );

    const ok = await addTaskWatcher("task-1", "user-1");
    expect(ok).toBe(false);
  });
});

describe("removeTaskWatcher()", () => {
  it("deletes by task+user", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await removeTaskWatcher("task-1", "user-1");

    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("task_id", "task-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
  });
});

// ---------------------------------------------------------------------------
// Checklist
// ---------------------------------------------------------------------------

describe("getTaskChecklist()", () => {
  it("returns mapped items ordered by sort_order", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({
        data: [
          {
            id: "c1",
            task_id: "task-1",
            content: "Step 1",
            is_done: false,
            sort_order: 0,
            created_at: "2026-01-01",
            updated_at: "2026-01-01",
          },
        ],
        error: null,
      }).then(resolve)
    );

    const result = await getTaskChecklist("task-1");

    expect(queryBuilder.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(result).toEqual([
      {
        id: "c1",
        taskId: "task-1",
        content: "Step 1",
        isDone: false,
        sortOrder: 0,
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      },
    ]);
  });
});

describe("addChecklistItem()", () => {
  it("inserts and returns mapped item", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "c1",
        task_id: "task-1",
        content: "New step",
        is_done: false,
        sort_order: 2,
        created_at: "2026-01-01",
        updated_at: "2026-01-01",
      },
      error: null,
    });

    const result = await addChecklistItem("task-1", "New step", 2);

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.task_id).toBe("task-1");
    expect(insertArg.content).toBe("New step");
    expect(insertArg.is_done).toBe(false);
    expect(insertArg.sort_order).toBe(2);
    expect(result?.content).toBe("New step");
  });

  it("returns null on insert error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "fail" },
    });

    const result = await addChecklistItem("task-1", "X");
    expect(result).toBeNull();
  });
});

describe("toggleChecklistItem()", () => {
  it("updates is_done by item id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const ok = await toggleChecklistItem("c1", true);

    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "c1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.is_done).toBe(true);
    expect(updateArg.updated_at).toBeDefined();
    expect(ok).toBe(true);
  });
});

describe("updateChecklistItem()", () => {
  it("only includes provided fields", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await updateChecklistItem("c1", { content: "Updated content" });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.content).toBe("Updated content");
    expect(updateArg).not.toHaveProperty("is_done");
    expect(updateArg).not.toHaveProperty("sort_order");
  });
});

describe("deleteChecklistItem()", () => {
  it("deletes by id and returns true on success", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const ok = await deleteChecklistItem("c1");

    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "c1");
    expect(ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe("getTaskComments()", () => {
  it("returns comments with user info ordered ascending", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({
        data: [
          {
            id: "cm1",
            task_id: "task-1",
            user_id: "user-1",
            content: "Started work",
            type: "note",
            created_at: "2026-01-01",
            users: { first_name: "John", last_name: "Doe" },
          },
        ],
        error: null,
      }).then(resolve)
    );

    const result = await getTaskComments("task-1");

    expect(queryBuilder.select).toHaveBeenCalledWith("*, users(first_name, last_name)");
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "cm1",
      taskId: "task-1",
      userId: "user-1",
      content: "Started work",
      type: "note",
      users: { first_name: "John", last_name: "Doe" },
    });
  });

  it("returns [] on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve)
    );

    const result = await getTaskComments("task-1");
    expect(result).toEqual([]);
  });
});

describe("addTaskComment()", () => {
  it("inserts with default type 'note'", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "cm1",
        task_id: "task-1",
        user_id: "user-123",
        content: "Hello",
        type: "note",
        created_at: "2026-01-01",
        users: null,
      },
      error: null,
    });

    await addTaskComment("task-1", "Hello");

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.task_id).toBe("task-1");
    expect(insertArg.user_id).toBe("user-123");
    expect(insertArg.content).toBe("Hello");
    expect(insertArg.type).toBe("note");
  });

  it("inserts with explicit type", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: {
        id: "cm1",
        task_id: "task-1",
        user_id: "user-123",
        content: "Status -> in_progress",
        type: "status_change",
        created_at: "2026-01-01",
        users: null,
      },
      error: null,
    });

    await addTaskComment("task-1", "Status -> in_progress", "status_change");

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.type).toBe("status_change");
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);

    await expect(addTaskComment("task-1", "X")).rejects.toThrow("Not authenticated");
  });
});

// ---------------------------------------------------------------------------
// generateRecurringTasks (RPC)
// ---------------------------------------------------------------------------

describe("generateRecurringTasks()", () => {
  it("invokes RPC and returns count", async () => {
    setMockResponse({ data: 3, error: null });

    const count = await generateRecurringTasks("comp-1");

    expect(mockClient.rpc).toHaveBeenCalledWith("generate_recurring_tasks", {
      p_company_id: "comp-1",
    });
    expect(count).toBe(3);
  });

  it("passes null when companyId omitted", async () => {
    setMockResponse({ data: 0, error: null });

    await generateRecurringTasks();

    expect(mockClient.rpc).toHaveBeenCalledWith("generate_recurring_tasks", {
      p_company_id: null,
    });
  });

  it("returns 0 on error", async () => {
    setMockResponse({ data: null, error: { message: "fail" } });

    const count = await generateRecurringTasks("comp-1");
    expect(count).toBe(0);
  });
});
