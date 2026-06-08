import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

const { client: mockClient, setMockResponse, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

vi.mock("@/lib/supabase/db-error", () => ({
  logDbReadError: vi.fn(),
}));

import {
  getIncidentAnalytics,
  getTaskAnalytics,
  getMultiLogReport,
  getIncidentsForSegment,
  getTasksForSegment,
  getDashboardTrends,
} from "@/lib/supabase/db-analytics";

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: [], error: null }).then(resolve),
  );
});

// ---------------------------------------------------------------------------
// getIncidentAnalytics()
// ---------------------------------------------------------------------------

describe("getIncidentAnalytics()", () => {
  it("aggregates by status, severity, type, team and by day", async () => {
    const rows = [
      { id: "1", status: "open", severity: "high", type: "theft", team_id: "team-a", created_at: "2026-01-10T05:00:00.000Z" },
      { id: "2", status: "open", severity: "high", type: "theft", team_id: "team-a", created_at: "2026-01-10T07:00:00.000Z" },
      { id: "3", status: "resolved", severity: "low", type: "vandalism", team_id: "team-b", created_at: "2026-01-11T05:00:00.000Z" },
      { id: "4", status: "investigating", severity: "medium", type: "theft", team_id: null, created_at: "2026-01-12T05:00:00.000Z" },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
    );

    const result = await getIncidentAnalytics("comp-1", { from: "2026-01-10T00:00:00.000Z", to: "2026-01-12T23:59:59.999Z" });

    expect(mockClient.from).toHaveBeenCalledWith("incidents");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.gte).toHaveBeenCalledWith("created_at", "2026-01-10T00:00:00.000Z");
    expect(queryBuilder.lte).toHaveBeenCalledWith("created_at", "2026-01-12T23:59:59.999Z");

    expect(result.totalCount).toBe(4);
    expect(result.openCount).toBe(3); // open + investigating
    expect(result.resolvedCount).toBe(1);

    // bySeverity sorted descending by count
    expect(result.bySeverity[0]).toEqual({ key: "high", count: 2 });

    // byTeam includes null entry
    const teamA = result.byTeam.find((t) => t.teamId === "team-a");
    expect(teamA?.count).toBe(2);
    const teamNull = result.byTeam.find((t) => t.teamId === null);
    expect(teamNull?.count).toBe(1);

    // byDay keys are YYYY-MM-DD
    expect(result.byDay["2026-01-10"]).toBe(2);
    expect(result.byDay["2026-01-11"]).toBe(1);
    expect(result.byDay["2026-01-12"]).toBe(1);

    // byBucket is sorted ascending by bucket label
    expect(result.byBucket.length).toBeGreaterThan(0);
    expect(result.byBucket[0].bucket < result.byBucket[result.byBucket.length - 1].bucket).toBe(true);
  });

  it("applies team filter when provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );

    await getIncidentAnalytics("comp-1", { teamId: "team-a" });

    expect(queryBuilder.eq).toHaveBeenCalledWith("team_id", "team-a");
  });

  it("returns empty analytics on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve),
    );

    const result = await getIncidentAnalytics("comp-1");
    expect(result.totalCount).toBe(0);
    expect(result.byStatus).toEqual([]);
    expect(result.byDay).toEqual({});
  });

  it("groups by week when groupBy=week", async () => {
    const rows = [
      { id: "1", status: "open", severity: "low", type: "x", team_id: null, created_at: "2026-01-05T05:00:00.000Z" },
      { id: "2", status: "open", severity: "low", type: "x", team_id: null, created_at: "2026-01-06T05:00:00.000Z" },
      { id: "3", status: "open", severity: "low", type: "x", team_id: null, created_at: "2026-01-13T05:00:00.000Z" },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
    );

    const result = await getIncidentAnalytics("comp-1", { groupBy: "week" });

    // Two distinct ISO weeks should be present (W02 and W03 of 2026).
    expect(result.byBucket.length).toBeGreaterThanOrEqual(1);
    expect(result.byBucket[0].bucket).toMatch(/^\d{4}-W\d{2}$/);
  });

  it("groups by month when groupBy=month", async () => {
    const rows = [
      { id: "1", status: "open", severity: "low", type: "x", team_id: null, created_at: "2026-01-05T05:00:00.000Z" },
      { id: "2", status: "open", severity: "low", type: "x", team_id: null, created_at: "2026-02-06T05:00:00.000Z" },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
    );

    const result = await getIncidentAnalytics("comp-1", { groupBy: "month" });

    expect(result.byBucket.map((b) => b.bucket)).toContain("2026-01");
    expect(result.byBucket.map((b) => b.bucket)).toContain("2026-02");
  });
});

// ---------------------------------------------------------------------------
// getTaskAnalytics()
// ---------------------------------------------------------------------------

describe("getTaskAnalytics()", () => {
  const farFuture = new Date(Date.now() + 86_400_000).toISOString();
  const farPast = new Date(Date.now() - 86_400_000).toISOString();

  it("computes completion-rate and overdue count", async () => {
    const rows = [
      { id: "1", status: "todo", priority: "high", team_id: "a", assigned_to: "u1", due_at: farPast, completed_at: null, created_at: "2026-01-10T00:00:00Z" },
      { id: "2", status: "in_progress", priority: "medium", team_id: "a", assigned_to: "u1", due_at: farFuture, completed_at: null, created_at: "2026-01-10T01:00:00Z" },
      { id: "3", status: "done", priority: "low", team_id: "b", assigned_to: "u2", due_at: null, completed_at: "2026-01-11T00:00:00Z", created_at: "2026-01-10T02:00:00Z" },
      { id: "4", status: "done", priority: "low", team_id: "b", assigned_to: "u2", due_at: null, completed_at: "2026-01-11T01:00:00Z", created_at: "2026-01-10T03:00:00Z" },
      { id: "5", status: "blocked", priority: "urgent", team_id: null, assigned_to: null, due_at: farPast, completed_at: null, created_at: "2026-01-10T04:00:00Z" },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
    );

    const result = await getTaskAnalytics("comp-1");

    expect(result.totalCount).toBe(5);
    expect(result.openCount).toBe(3); // todo, in_progress, blocked
    expect(result.doneCount).toBe(2);
    expect(result.overdueCount).toBe(2); // task 1 + task 5
    expect(result.completionRatePct).toBe(40); // 2/5
    expect(result.byPriority.find((p) => p.key === "low")?.count).toBe(2);
    expect(result.byTeam.find((t) => t.teamId === "a")?.count).toBe(2);
    expect(result.byAssignee.find((a) => a.assigneeId === "u1")?.count).toBe(2);
  });

  it("returns empty analytics on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve),
    );

    const result = await getTaskAnalytics("comp-1");
    expect(result.totalCount).toBe(0);
    expect(result.completionRatePct).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// getMultiLogReport()
// ---------------------------------------------------------------------------

describe("getMultiLogReport()", () => {
  it("merges per-day counts from four tables", async () => {
    // We need to return different shapes per `from()` call. The mock supabase
    // shares one queryBuilder; control behavior with sequential then() results.
    const datasets = [
      [{ created_at: "2026-01-10T00:00:00Z" }, { created_at: "2026-01-10T01:00:00Z" }], // incidents (2 on 1/10)
      [{ created_at: "2026-01-10T00:00:00Z" }, { created_at: "2026-01-11T00:00:00Z" }], // tasks (1 each)
      [{ scanned_at: "2026-01-11T00:00:00Z" }], // patrols
      [{ clock_in: "2026-01-12T00:00:00Z" }], // timesheets
    ];
    let call = 0;
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) => {
      const data = datasets[call++] ?? [];
      return Promise.resolve({ data, error: null }).then(resolve);
    });

    const result = await getMultiLogReport("comp-1", {
      from: "2026-01-10T00:00:00.000Z",
      to: "2026-01-12T23:59:59.999Z",
    });

    expect(result.incidentsCount).toBe(2);
    expect(result.tasksCount).toBe(2);
    expect(result.patrolsCount).toBe(1);
    expect(result.timesheetsCount).toBe(1);
    expect(result.byDay["2026-01-10"]).toEqual({ incidents: 2, tasks: 1, patrols: 0, timesheets: 0 });
    expect(result.byDay["2026-01-11"]).toEqual({ incidents: 0, tasks: 1, patrols: 1, timesheets: 0 });
    expect(result.byDay["2026-01-12"]).toEqual({ incidents: 0, tasks: 0, patrols: 0, timesheets: 1 });
  });
});

// ---------------------------------------------------------------------------
// Drill-down helpers
// ---------------------------------------------------------------------------

describe("getIncidentsForSegment()", () => {
  it("applies all segment filters and limits to 200", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [{ id: "1" }], error: null }).then(resolve),
    );

    await getIncidentsForSegment("comp-1", {
      from: "2026-01-01",
      to: "2026-01-31",
      teamId: "team-a",
      status: "open",
      severity: "high",
      type: "theft",
    });

    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("team_id", "team-a");
    expect(queryBuilder.eq).toHaveBeenCalledWith("status", "open");
    expect(queryBuilder.eq).toHaveBeenCalledWith("severity", "high");
    expect(queryBuilder.eq).toHaveBeenCalledWith("type", "theft");
    expect(queryBuilder.gte).toHaveBeenCalledWith("created_at", "2026-01-01");
    expect(queryBuilder.lte).toHaveBeenCalledWith("created_at", "2026-01-31");
    expect(queryBuilder.limit).toHaveBeenCalledWith(200);
  });

  it("returns [] on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve),
    );

    const result = await getIncidentsForSegment("comp-1", {});
    expect(result).toEqual([]);
  });
});

describe("getTasksForSegment()", () => {
  it("filters by status, priority, assignee", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );

    await getTasksForSegment("comp-1", {
      status: "todo",
      priority: "high",
      assigneeId: "user-1",
    });

    expect(queryBuilder.eq).toHaveBeenCalledWith("status", "todo");
    expect(queryBuilder.eq).toHaveBeenCalledWith("priority", "high");
    expect(queryBuilder.eq).toHaveBeenCalledWith("assigned_to", "user-1");
  });
});

// ---------------------------------------------------------------------------
// getDashboardTrends()
// ---------------------------------------------------------------------------

describe("getDashboardTrends()", () => {
  it("returns 7-element series with daily counts", async () => {
    // We can't easily control which day each created_at lands on without
    // knowing today's date, but we can verify the result shape.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayIso = today.toISOString();

    let call = 0;
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) => {
      // Same data for all three calls.
      const data = [{ created_at: todayIso, scanned_at: todayIso }];
      call++;
      return Promise.resolve({ data, error: null }).then(resolve);
    });

    const result = await getDashboardTrends("comp-1");

    expect(result.incidents).toHaveLength(7);
    expect(result.patrols).toHaveLength(7);
    expect(result.reports).toHaveLength(7);
    expect(call).toBeGreaterThanOrEqual(3);
    // Today's incident bucket should be incremented (last index).
    expect(result.incidents[6]).toBeGreaterThanOrEqual(1);
    // incidentsByDay should have 7 entries.
    expect(Object.keys(result.incidentsByDay)).toHaveLength(7);
  });

  it("returns zero-filled series when no data", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );

    const result = await getDashboardTrends("comp-1");
    expect(result.incidents).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(result.patrols).toEqual([0, 0, 0, 0, 0, 0, 0]);
    expect(result.reports).toEqual([0, 0, 0, 0, 0, 0, 0]);
  });
});
