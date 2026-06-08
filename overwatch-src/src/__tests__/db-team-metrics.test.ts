import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
const { client: mockClient, setMockResponse, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

vi.mock("@/lib/supabase/db-error", () => ({
  logDbReadError: vi.fn(),
}));

import { getTeamMetrics, getAllTeamMetrics } from "@/lib/supabase/db-analytics";

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ count: 0, data: null, error: null }).then(resolve),
  );
});

// ---------------------------------------------------------------------------
// getTeamMetrics()
// ---------------------------------------------------------------------------

describe("getTeamMetrics()", () => {
  it("scopes every query to company + team", async () => {
    // All seven parallel queries resolve as the default.
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ count: 0, data: null, error: null }).then(resolve),
    );

    await getTeamMetrics("comp-1", "team-1");

    // Every count query filters by company_id=comp-1 (six of them) plus the
    // incidents-join sub-query filters by incidents.company_id=comp-1 (1).
    const eqCalls = queryBuilder.eq.mock.calls;
    const companyFilters = eqCalls.filter((c) => c[0] === "company_id" && c[1] === "comp-1");
    expect(companyFilters.length).toBeGreaterThanOrEqual(6);

    // Team filter applied to incidents (3), tasks (3), incidents (joined, 1).
    const teamFilters = eqCalls.filter((c) => c[0] === "team_id" && c[1] === "team-1");
    const joinTeamFilters = eqCalls.filter((c) => c[0] === "incidents.team_id" && c[1] === "team-1");
    expect(teamFilters.length + joinTeamFilters.length).toBeGreaterThanOrEqual(7);
  });

  it("returns aggregated counts in TeamMetrics shape", async () => {
    // Resolve each call sequentially with a different count.
    const counts = [12, 5, 2, 30, 11, 1, 4];
    let i = 0;
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) => {
      const c = counts[i++] ?? 0;
      return Promise.resolve({ count: c, data: null, error: null }).then(resolve);
    });

    const result = await getTeamMetrics("comp-1", "team-1");

    expect(result).toEqual({
      teamId: "team-1",
      incidentsTotal: 12,
      incidentsOpen: 5,
      incidentsOverdue: 2,
      tasksTotal: 30,
      tasksOpen: 11,
      tasksOverdue: 1,
      recentTransfersIn: 4,
      recentTransfersOut: 0,
    });
  });

  it("treats null counts as zero", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ count: null, data: null, error: null }).then(resolve),
    );

    const result = await getTeamMetrics("comp-1", "team-1");

    expect(result.incidentsTotal).toBe(0);
    expect(result.incidentsOpen).toBe(0);
    expect(result.tasksTotal).toBe(0);
    expect(result.tasksOpen).toBe(0);
    expect(result.recentTransfersIn).toBe(0);
  });

  it("filters open incidents by excluding resolved/closed", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ count: 0, data: null, error: null }).then(resolve),
    );

    await getTeamMetrics("comp-1", "team-1");

    const notCalls = queryBuilder.not.mock.calls;
    expect(notCalls).toContainEqual(["status", "in", "(resolved,closed)"]);
  });

  it("filters open tasks by todo/in_progress/blocked", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ count: 0, data: null, error: null }).then(resolve),
    );

    await getTeamMetrics("comp-1", "team-1");

    const inCalls = queryBuilder.in.mock.calls;
    expect(inCalls).toContainEqual(["status", ["todo", "in_progress", "blocked"]]);
  });

  it("filters overdue with lt(due_at, now)", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ count: 0, data: null, error: null }).then(resolve),
    );

    await getTeamMetrics("comp-1", "team-1");

    const ltCalls = queryBuilder.lt.mock.calls;
    const overdueCalls = ltCalls.filter((c) => c[0] === "due_at");
    expect(overdueCalls.length).toBeGreaterThanOrEqual(2);
  });
});

// ---------------------------------------------------------------------------
// getAllTeamMetrics()
// ---------------------------------------------------------------------------

describe("getAllTeamMetrics()", () => {
  it("returns empty array when no teams", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );

    const result = await getAllTeamMetrics("comp-1");
    expect(result).toEqual([]);
  });

  it("returns empty array on read error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve),
    );

    const result = await getAllTeamMetrics("comp-1");
    expect(result).toEqual([]);
  });

  it("filters archived teams out", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );

    await getAllTeamMetrics("comp-1");

    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("is_archived", false);
  });
});
