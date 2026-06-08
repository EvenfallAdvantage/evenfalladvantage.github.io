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
  createIncidentEnhanced,
  assignIncidentToTeam,
  setIncidentStatus,
  getIncidentsByTeam,
  getIncidentsFiltered,
} from "@/lib/supabase/db-incidents";
import { logDbReadError } from "@/lib/supabase/db-error";

const mockedLogDbReadError = vi.mocked(logDbReadError);

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  mockEnsureInternalUser.mockResolvedValue("user-123");
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
});

// ---------------------------------------------------------------------------
// createIncidentEnhanced()
// ---------------------------------------------------------------------------

describe("createIncidentEnhanced()", () => {
  it("inserts with all enhanced params", async () => {
    const newIncident = { id: "i-new", title: "Custom incident" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: newIncident, error: null });

    const result = await createIncidentEnhanced("comp-1", {
      title: "Custom incident",
      description: "Body",
      type: "security-breach",
      severity: "high",
      priority: "urgent",
      location: "Gate A",
      eventId: "evt-1",
      teamId: "team-1",
      dueAt: "2026-02-01T00:00:00.000Z",
      customFields: { witnesses: 2, weapon: "knife" },
      source: "public",
    });

    expect(mockClient.from).toHaveBeenCalledWith("incidents");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        reported_by: "user-123",
        title: "Custom incident",
        description: "Body",
        type: "security-breach",
        severity: "high",
        priority: "urgent",
        status: "open",
        location: "Gate A",
        event_id: "evt-1",
        team_id: "team-1",
        due_at: "2026-02-01T00:00:00.000Z",
        custom_fields: { witnesses: 2, weapon: "knife" },
        source: "public",
      })
    );
    expect(result).toEqual(newIncident);
  });

  it("applies defaults for enhanced fields", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "i-def" }, error: null });

    await createIncidentEnhanced("comp-1", { title: "Simple" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.type).toBe("general");
    expect(insertArg.severity).toBe("low");
    expect(insertArg.priority).toBe("medium");
    expect(insertArg.status).toBe("open");
    expect(insertArg.description).toBeNull();
    expect(insertArg.location).toBeNull();
    expect(insertArg.event_id).toBeNull();
    expect(insertArg.team_id).toBeNull();
    expect(insertArg.due_at).toBeNull();
    expect(insertArg.custom_fields).toEqual({});
    expect(insertArg.source).toBe("internal");
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);

    await expect(
      createIncidentEnhanced("comp-1", { title: "No auth" })
    ).rejects.toThrow("Not authenticated");
  });

  it("throws on insert error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(
      createIncidentEnhanced("comp-1", { title: "Fail" })
    ).rejects.toEqual({ message: "insert failed" });
  });
});

// ---------------------------------------------------------------------------
// assignIncidentToTeam()
// ---------------------------------------------------------------------------

describe("assignIncidentToTeam()", () => {
  it("updates the team_id and bumps updated_at", async () => {
    const updated = { id: "i1", team_id: "team-1" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: updated, error: null });

    const result = await assignIncidentToTeam("i1", "team-1");

    expect(mockClient.from).toHaveBeenCalledWith("incidents");
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "i1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.team_id).toBe("team-1");
    expect(updateArg.updated_at).toBeDefined();
    expect(result).toEqual(updated);
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "denied" },
    });

    await expect(assignIncidentToTeam("i1", "team-1")).rejects.toEqual({
      message: "denied",
    });
  });
});

// ---------------------------------------------------------------------------
// setIncidentStatus()
// ---------------------------------------------------------------------------

describe("setIncidentStatus()", () => {
  it("updates the status and bumps updated_at", async () => {
    const updated = { id: "i1", status: "resolved" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: updated, error: null });

    const result = await setIncidentStatus("i1", "resolved");

    expect(mockClient.from).toHaveBeenCalledWith("incidents");
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "i1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.status).toBe("resolved");
    expect(updateArg.updated_at).toBeDefined();
    expect(result).toEqual(updated);
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "denied" },
    });

    await expect(setIncidentStatus("i1", "resolved")).rejects.toEqual({
      message: "denied",
    });
  });
});

// ---------------------------------------------------------------------------
// getIncidentsByTeam()
// ---------------------------------------------------------------------------

describe("getIncidentsByTeam()", () => {
  it("returns incidents filtered by company and team", async () => {
    const incidents = [{ id: "i1" }, { id: "i2" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: incidents, error: null }).then(resolve)
    );

    const result = await getIncidentsByTeam("comp-1", "team-1");

    expect(mockClient.from).toHaveBeenCalledWith("incidents");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("team_id", "team-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual(incidents);
  });

  it("returns [] and logs on read error", async () => {
    const dbError = { message: "boom" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getIncidentsByTeam("comp-1", "team-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("incidents by team", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getIncidentsFiltered()
// ---------------------------------------------------------------------------

describe("getIncidentsFiltered()", () => {
  it("filters by company only when no filters provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getIncidentsFiltered("comp-1", {});

    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    // Should not call eq on any other field
    const eqCalls = queryBuilder.eq.mock.calls;
    expect(eqCalls).toEqual([["company_id", "comp-1"]]);
  });

  it("applies all filters when provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getIncidentsFiltered("comp-1", {
      status: "open",
      priority: "high",
      teamId: "team-1",
      type: "security-breach",
      assignedTo: "user-456",
      from: "2026-01-01",
      to: "2026-12-31",
    });

    const eqCalls = queryBuilder.eq.mock.calls;
    expect(eqCalls).toContainEqual(["company_id", "comp-1"]);
    expect(eqCalls).toContainEqual(["status", "open"]);
    expect(eqCalls).toContainEqual(["priority", "high"]);
    expect(eqCalls).toContainEqual(["team_id", "team-1"]);
    expect(eqCalls).toContainEqual(["type", "security-breach"]);
    expect(eqCalls).toContainEqual(["assigned_to", "user-456"]);

    expect(queryBuilder.gte).toHaveBeenCalledWith("created_at", "2026-01-01");
    expect(queryBuilder.lte).toHaveBeenCalledWith("created_at", "2026-12-31");
  });

  it("returns [] and logs on read error", async () => {
    const dbError = { message: "boom" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getIncidentsFiltered("comp-1", {});

    expect(mockedLogDbReadError).toHaveBeenCalledWith("incidents filtered", dbError);
    expect(result).toEqual([]);
  });

  it("returns data on success", async () => {
    const incidents = [{ id: "i1", title: "T" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: incidents, error: null }).then(resolve)
    );

    const result = await getIncidentsFiltered("comp-1", { status: "open" });

    expect(result).toEqual(incidents);
  });
});
