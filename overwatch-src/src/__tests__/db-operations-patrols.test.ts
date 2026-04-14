import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
const { client: mockClient, setMockResponse, queryBuilder } =
  createMockSupabase();

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
  getCheckpoints,
  createCheckpoint,
  deleteCheckpoint,
  getPatrolRoutes,
  createPatrolRoute,
  deletePatrolRoute,
  logPatrolScan,
  getPatrolLogs,
} from "@/lib/supabase/db-operations";
import { logDbReadError } from "@/lib/supabase/db-error";

const mockedLogDbReadError = vi.mocked(logDbReadError);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  mockEnsureInternalUser.mockResolvedValue("user-123");
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
});

// ---------------------------------------------------------------------------
// getCheckpoints()
// ---------------------------------------------------------------------------

describe("getCheckpoints()", () => {
  it("returns checkpoints data", async () => {
    const checkpoints = [{ id: "cp1", name: "Gate A" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: checkpoints, error: null }).then(resolve)
    );

    const result = await getCheckpoints("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("checkpoints");
    expect(queryBuilder.select).toHaveBeenCalledWith("*");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("is_active", true);
    expect(queryBuilder.order).toHaveBeenCalledWith("sort_order", { ascending: true });
    expect(result).toEqual(checkpoints);
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "db failure" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getCheckpoints("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("checkpoints", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createCheckpoint()
// ---------------------------------------------------------------------------

describe("createCheckpoint()", () => {
  it("creates checkpoint with all params", async () => {
    const cp = { id: "cp-new", name: "Gate B" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: cp, error: null });

    const result = await createCheckpoint("comp-1", {
      name: "Gate B",
      description: "Back entrance",
      location: "Building 2",
      eventId: "evt-1",
    });

    expect(mockClient.from).toHaveBeenCalledWith("checkpoints");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        name: "Gate B",
        description: "Back entrance",
        location: "Building 2",
        event_id: "evt-1",
        is_active: true,
      })
    );
    expect(result).toEqual(cp);
  });

  it("generates qr_code starting with 'CP-'", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "cp1" }, error: null });

    await createCheckpoint("comp-1", { name: "Gate A" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(typeof insertArg.qr_code).toBe("string");
    expect((insertArg.qr_code as string).startsWith("CP-")).toBe(true);
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(
      createCheckpoint("comp-1", { name: "Fail CP" })
    ).rejects.toEqual({ message: "insert failed" });
  });
});

// ---------------------------------------------------------------------------
// deleteCheckpoint()
// ---------------------------------------------------------------------------

describe("deleteCheckpoint()", () => {
  it("deletes checkpoint by id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deleteCheckpoint("cp1");

    expect(mockClient.from).toHaveBeenCalledWith("checkpoints");
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "cp1");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "delete failed" } }).then(resolve)
    );

    await expect(deleteCheckpoint("cp1")).rejects.toEqual({
      message: "delete failed",
    });
  });
});

// ---------------------------------------------------------------------------
// getPatrolRoutes()
// ---------------------------------------------------------------------------

describe("getPatrolRoutes()", () => {
  it("returns patrol routes data", async () => {
    const routes = [{ id: "pr1", name: "Perimeter" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: routes, error: null }).then(resolve)
    );

    const result = await getPatrolRoutes("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("patrol_routes");
    expect(queryBuilder.select).toHaveBeenCalledWith("*");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("is_active", true);
    expect(queryBuilder.order).toHaveBeenCalledWith("name");
    expect(result).toEqual(routes);
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "db failure" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getPatrolRoutes("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("patrol routes", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createPatrolRoute()
// ---------------------------------------------------------------------------

describe("createPatrolRoute()", () => {
  it("creates patrol route with all params", async () => {
    const route = { id: "pr-new", name: "Full Route" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: route, error: null });

    const result = await createPatrolRoute("comp-1", {
      name: "Full Route",
      description: "Complete perimeter",
      checkpointIds: ["cp1", "cp2"],
      frequencyMin: 30,
    });

    expect(mockClient.from).toHaveBeenCalledWith("patrol_routes");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        name: "Full Route",
        description: "Complete perimeter",
        checkpoint_ids: ["cp1", "cp2"],
        frequency_min: 30,
        is_active: true,
      })
    );
    expect(result).toEqual(route);
  });

  it("defaults frequencyMin to 60", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "pr1" }, error: null });

    await createPatrolRoute("comp-1", {
      name: "Default Route",
      checkpointIds: ["cp1"],
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.frequency_min).toBe(60);
    expect(insertArg.description).toBeNull();
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(
      createPatrolRoute("comp-1", { name: "Fail", checkpointIds: [] })
    ).rejects.toEqual({ message: "insert failed" });
  });
});

// ---------------------------------------------------------------------------
// deletePatrolRoute()
// ---------------------------------------------------------------------------

describe("deletePatrolRoute()", () => {
  it("deletes patrol route by id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deletePatrolRoute("pr1");

    expect(mockClient.from).toHaveBeenCalledWith("patrol_routes");
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "pr1");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "delete failed" } }).then(resolve)
    );

    await expect(deletePatrolRoute("pr1")).rejects.toEqual({
      message: "delete failed",
    });
  });
});

// ---------------------------------------------------------------------------
// logPatrolScan()
// ---------------------------------------------------------------------------

describe("logPatrolScan()", () => {
  it("logs scan with all params", async () => {
    const scan = { id: "scan-1" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: scan, error: null });

    const result = await logPatrolScan("comp-1", "cp1", {
      routeId: "pr1",
      notes: "All clear",
      status: "ok",
    });

    expect(mockClient.from).toHaveBeenCalledWith("patrol_logs");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        checkpoint_id: "cp1",
        user_id: "user-123",
        route_id: "pr1",
        notes: "All clear",
        status: "ok",
      })
    );
    expect(result).toEqual(scan);
  });

  it("logs scan without params — uses defaults", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "scan-2" }, error: null });

    await logPatrolScan("comp-1", "cp1");

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.route_id).toBeNull();
    expect(insertArg.notes).toBeNull();
    expect(insertArg.status).toBe("ok");
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);

    await expect(logPatrolScan("comp-1", "cp1")).rejects.toThrow("Not authenticated");
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(logPatrolScan("comp-1", "cp1")).rejects.toEqual({
      message: "insert failed",
    });
  });
});

// ---------------------------------------------------------------------------
// getPatrolLogs()
// ---------------------------------------------------------------------------

describe("getPatrolLogs()", () => {
  it("returns patrol logs data", async () => {
    const logs = [{ id: "log1", status: "ok" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: logs, error: null }).then(resolve)
    );

    const result = await getPatrolLogs("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("patrol_logs");
    expect(queryBuilder.select).toHaveBeenCalledWith(
      "*, checkpoints(name, location), users(first_name, last_name)"
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("scanned_at", { ascending: false });
    expect(queryBuilder.limit).toHaveBeenCalledWith(50);
    expect(result).toEqual(logs);
  });

  it("uses default limit of 50", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getPatrolLogs("comp-1");

    expect(queryBuilder.limit).toHaveBeenCalledWith(50);
  });

  it("uses custom limit", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getPatrolLogs("comp-1", 25);

    expect(queryBuilder.limit).toHaveBeenCalledWith(25);
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "db failure" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getPatrolLogs("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("patrol logs", dbError);
    expect(result).toEqual([]);
  });
});
