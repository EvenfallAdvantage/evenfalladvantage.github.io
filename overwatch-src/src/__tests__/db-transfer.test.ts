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

import { transferIncident } from "@/lib/supabase/db-incidents";
import { transferTask } from "@/lib/supabase/db-tasks";

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  mockEnsureInternalUser.mockResolvedValue("user-123");
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve),
  );
});

// ---------------------------------------------------------------------------
// transferIncident()
// ---------------------------------------------------------------------------

describe("transferIncident()", () => {
  it("updates team_id and writes an audit row", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "inc-1", team_id: "team-2" },
      error: null,
    });
    // The audit log insert resolves via then()
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    );

    const result = await transferIncident("inc-1", "team-2", {
      fromTeamName: "Alpha",
      toTeamName: "Bravo",
      note: "Following up on lead",
    });

    // Update happens on incidents table
    expect(mockClient.from).toHaveBeenCalledWith("incidents");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: "team-2" }),
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "inc-1");

    // Insert happens on incident_updates table
    expect(mockClient.from).toHaveBeenCalledWith("incident_updates");
    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.incident_id).toBe("inc-1");
    expect(insertArg.user_id).toBe("user-123");
    expect(insertArg.type).toBe("transfer");
    expect(insertArg.content).toBe("Transferred from Alpha to Bravo - Following up on lead");

    expect(result).toEqual({ id: "inc-1", team_id: "team-2" });
  });

  it("uses canonical content even without note", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "inc-1", team_id: "team-2" },
      error: null,
    });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    );

    await transferIncident("inc-1", "team-2", { fromTeamName: "Alpha", toTeamName: "Bravo" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.content).toBe("Transferred from Alpha to Bravo");
  });

  it("supports release (toTeamId=null)", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "inc-1", team_id: null },
      error: null,
    });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    );

    await transferIncident("inc-1", null, { fromTeamName: "Alpha" });

    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: null }),
    );
    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.content).toBe("Transferred from Alpha to (unassigned)");
  });

  it("falls back to generic team names when omitted", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "inc-1", team_id: "team-2" },
      error: null,
    });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    );

    await transferIncident("inc-1", "team-2");

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.content).toBe("Transferred from (unassigned) to (team)");
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);
    await expect(transferIncident("inc-1", "team-2")).rejects.toThrow("Not authenticated");
  });

  it("throws on update error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "denied" },
    });
    await expect(transferIncident("inc-1", "team-2")).rejects.toEqual({ message: "denied" });
  });

  it("returns incident even if audit log insert fails", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "inc-1", team_id: "team-2" },
      error: null,
    });
    // Audit log insert fails
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "log failed" } }).then(resolve),
    );

    const result = await transferIncident("inc-1", "team-2");
    expect(result).toEqual({ id: "inc-1", team_id: "team-2" });
  });
});

// ---------------------------------------------------------------------------
// transferTask()
// ---------------------------------------------------------------------------

const TASK_ROW = {
  id: "task-1",
  company_id: "comp-1",
  team_id: "team-2",
  incident_id: null,
  parent_task_id: null,
  title: "Patrol the perimeter",
  description: null,
  status: "todo" as const,
  priority: "medium" as const,
  created_by: "user-1",
  assigned_to: null,
  due_at: null,
  completed_at: null,
  sort_order: 0,
  recurrence: null,
  custom_fields: {},
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

describe("transferTask()", () => {
  it("updates team_id and writes an audit row", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: TASK_ROW, error: null });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    );

    const result = await transferTask("task-1", "team-2", {
      fromTeamName: "Alpha",
      toTeamName: "Bravo",
      note: "Capacity issue",
    });

    expect(mockClient.from).toHaveBeenCalledWith("tasks");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: "team-2" }),
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "task-1");

    expect(mockClient.from).toHaveBeenCalledWith("task_comments");
    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.task_id).toBe("task-1");
    expect(insertArg.user_id).toBe("user-123");
    expect(insertArg.type).toBe("transfer");
    expect(insertArg.content).toBe("Transferred from Alpha to Bravo - Capacity issue");

    expect(result?.id).toBe("task-1");
    expect(result?.teamId).toBe("team-2");
  });

  it("supports release (toTeamId=null)", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { ...TASK_ROW, team_id: null },
      error: null,
    });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    );

    await transferTask("task-1", null, { fromTeamName: "Alpha" });

    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ team_id: null }),
    );
    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.content).toBe("Transferred from Alpha to (unassigned)");
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);
    await expect(transferTask("task-1", "team-2")).rejects.toThrow("Not authenticated");
  });

  it("throws on update error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "denied" },
    });
    await expect(transferTask("task-1", "team-2")).rejects.toEqual({ message: "denied" });
  });
});
