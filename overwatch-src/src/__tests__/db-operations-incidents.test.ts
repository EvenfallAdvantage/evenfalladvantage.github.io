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
  getIncidents,
  getIncident,
  createIncident,
  updateIncident,
  getIncidentUpdates,
  addIncidentUpdate,
  deleteIncident,
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
// getIncidents()
// ---------------------------------------------------------------------------

describe("getIncidents()", () => {
  it("returns incidents with status filter", async () => {
    const incidents = [{ id: "i1", title: "Fire" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: incidents, error: null }).then(resolve)
    );

    const result = await getIncidents("comp-1", "open");

    expect(mockClient.from).toHaveBeenCalledWith("incidents");
    expect(queryBuilder.select).toHaveBeenCalledWith(
      "*, reported_user:users!incidents_reported_by_fkey(first_name, last_name), assigned_user:users!incidents_assigned_to_fkey(first_name, last_name)"
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("status", "open");
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual(incidents);
  });

  it("returns incidents without status filter", async () => {
    const incidents = [{ id: "i1" }, { id: "i2" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: incidents, error: null }).then(resolve)
    );

    const result = await getIncidents("comp-1");

    // eq should only be called with company_id, NOT status
    const eqCalls = queryBuilder.eq.mock.calls;
    expect(eqCalls).toEqual([["company_id", "comp-1"]]);
    expect(result).toEqual(incidents);
  });

  it("does not filter by status when status='all'", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getIncidents("comp-1", "all");

    const eqCalls = queryBuilder.eq.mock.calls;
    expect(eqCalls).toEqual([["company_id", "comp-1"]]);
  });

  it("does not filter by status when status is undefined", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getIncidents("comp-1", undefined);

    const eqCalls = queryBuilder.eq.mock.calls;
    expect(eqCalls).toEqual([["company_id", "comp-1"]]);
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "db failure", code: "500" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getIncidents("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("incidents", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getIncident()
// ---------------------------------------------------------------------------

describe("getIncident()", () => {
  it("returns incident data", async () => {
    const incident = { id: "i1", title: "Fire alarm" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: incident, error: null });

    const result = await getIncident("i1");

    expect(mockClient.from).toHaveBeenCalledWith("incidents");
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "i1");
    expect(queryBuilder.maybeSingle).toHaveBeenCalled();
    expect(result).toEqual(incident);
  });

  it("returns null on error", async () => {
    const dbError = { message: "not found" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: dbError });

    const result = await getIncident("i1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("incident details", dbError);
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// createIncident()
// ---------------------------------------------------------------------------

describe("createIncident()", () => {
  it("inserts with all params", async () => {
    const newIncident = { id: "i-new", title: "Theft" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: newIncident, error: null });

    const result = await createIncident("comp-1", {
      title: "Theft",
      description: "Wallet stolen",
      type: "theft",
      severity: "high",
      priority: "urgent",
      location: "Main gate",
      eventId: "evt-1",
    });

    expect(mockClient.from).toHaveBeenCalledWith("incidents");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        reported_by: "user-123",
        title: "Theft",
        description: "Wallet stolen",
        type: "theft",
        severity: "high",
        priority: "urgent",
        status: "open",
        location: "Main gate",
        event_id: "evt-1",
      })
    );
    expect(result).toEqual(newIncident);
  });

  it("uses defaults for type/severity/priority/status", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "i-def" }, error: null });

    await createIncident("comp-1", { title: "Minor issue" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.type).toBe("general");
    expect(insertArg.severity).toBe("low");
    expect(insertArg.priority).toBe("medium");
    expect(insertArg.status).toBe("open");
    expect(insertArg.description).toBeNull();
    expect(insertArg.location).toBeNull();
    expect(insertArg.event_id).toBeNull();
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(
      createIncident("comp-1", { title: "Fail" })
    ).rejects.toEqual({ message: "insert failed" });
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);

    await expect(
      createIncident("comp-1", { title: "No auth" })
    ).rejects.toThrow("Not authenticated");
  });
});

// ---------------------------------------------------------------------------
// updateIncident()
// ---------------------------------------------------------------------------

describe("updateIncident()", () => {
  it("updates incident fields", async () => {
    const updated = { id: "i1", status: "resolved" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: updated, error: null });

    const result = await updateIncident("i1", { status: "resolved" });

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
      error: { message: "update failed" },
    });

    await expect(updateIncident("i1", { status: "closed" })).rejects.toEqual({
      message: "update failed",
    });
  });
});

// ---------------------------------------------------------------------------
// getIncidentUpdates()
// ---------------------------------------------------------------------------

describe("getIncidentUpdates()", () => {
  it("returns incident updates", async () => {
    const updates = [{ id: "u1", content: "Update 1" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: updates, error: null }).then(resolve)
    );

    const result = await getIncidentUpdates("i1");

    expect(mockClient.from).toHaveBeenCalledWith("incident_updates");
    expect(queryBuilder.select).toHaveBeenCalledWith("*, users(first_name, last_name)");
    expect(queryBuilder.eq).toHaveBeenCalledWith("incident_id", "i1");
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", { ascending: true });
    expect(result).toEqual(updates);
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "read failed" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getIncidentUpdates("i1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("incident updates", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// addIncidentUpdate()
// ---------------------------------------------------------------------------

describe("addIncidentUpdate()", () => {
  it("creates with explicit type", async () => {
    const update = { id: "u-new", content: "Status changed", type: "status_change" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: update, error: null });

    const result = await addIncidentUpdate("i1", "Status changed", "status_change");

    expect(mockClient.from).toHaveBeenCalledWith("incident_updates");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        incident_id: "i1",
        user_id: "user-123",
        content: "Status changed",
        type: "status_change",
      })
    );
    expect(result).toEqual(update);
  });

  it("creates with default type 'note'", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "u2" }, error: null });

    await addIncidentUpdate("i1", "Just a note");

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.type).toBe("note");
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(addIncidentUpdate("i1", "Fail")).rejects.toEqual({
      message: "insert failed",
    });
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);

    await expect(addIncidentUpdate("i1", "No auth")).rejects.toThrow("Not authenticated");
  });
});

// ---------------------------------------------------------------------------
// deleteIncident()
// ---------------------------------------------------------------------------

describe("deleteIncident()", () => {
  it("deletes incident with no storyboard pin (simple delete)", async () => {
    // 1st call: read incident — no storyboard fields
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { storyboard_id: null, storyboard_pin_id: null },
      error: null,
    });
    // 2nd call: delete (thenable)
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deleteIncident("i1");

    // Should read the incident first
    expect(queryBuilder.select).toHaveBeenCalledWith("storyboard_id, storyboard_pin_id");
    // Should delete
    expect(queryBuilder.delete).toHaveBeenCalled();
  });

  it("deletes incident WITH storyboard_pin_id: removes pin from storyboard then deletes", async () => {
    // 1st call: read incident — has storyboard fields
    queryBuilder.maybeSingle
      .mockResolvedValueOnce({
        data: { storyboard_id: "sb-1", storyboard_pin_id: "pin-1" },
        error: null,
      })
      // 2nd call: load storyboard
      .mockResolvedValueOnce({
        data: {
          id: "sb-1",
          pins: [
            { id: "pin-1", x: 10, y: 20 },
            { id: "pin-2", x: 30, y: 40 },
          ],
        },
        error: null,
      });

    // 3rd call: update storyboard pins (thenable — from .update().eq())
    // 4th call: delete incident (thenable — from .delete().eq())
    let thenCallCount = 0;
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) => {
      thenCallCount++;
      return Promise.resolve({ data: null, error: null }).then(resolve);
    });

    await deleteIncident("i1");

    // Should have updated storyboard pins (pin-1 removed)
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pins: [{ id: "pin-2", x: 30, y: 40 }],
      })
    );
    // Should delete the incident
    expect(queryBuilder.delete).toHaveBeenCalled();
  });

  it("storyboard exists but pins array doesn't contain the pin ID — still deletes", async () => {
    // 1st call: read incident
    queryBuilder.maybeSingle
      .mockResolvedValueOnce({
        data: { storyboard_id: "sb-1", storyboard_pin_id: "pin-missing" },
        error: null,
      })
      // 2nd call: load storyboard — pin not in array
      .mockResolvedValueOnce({
        data: {
          id: "sb-1",
          pins: [{ id: "pin-other", x: 10, y: 20 }],
        },
        error: null,
      });

    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deleteIncident("i1");

    // Should still update storyboard (filter is a no-op, but update still fires)
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pins: [{ id: "pin-other", x: 10, y: 20 }],
      })
    );
    // Should delete the incident
    expect(queryBuilder.delete).toHaveBeenCalled();
  });

  it("storyboard not found — skips pin removal, still deletes", async () => {
    // 1st call: read incident
    queryBuilder.maybeSingle
      .mockResolvedValueOnce({
        data: { storyboard_id: "sb-gone", storyboard_pin_id: "pin-1" },
        error: null,
      })
      // 2nd call: load storyboard — not found
      .mockResolvedValueOnce({
        data: null,
        error: null,
      });

    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deleteIncident("i1");

    // Should NOT call update (storyboard not found)
    expect(queryBuilder.update).not.toHaveBeenCalled();
    // Should still delete the incident
    expect(queryBuilder.delete).toHaveBeenCalled();
  });

  it("throws on delete error", async () => {
    // 1st call: read incident — no storyboard
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { storyboard_id: null, storyboard_pin_id: null },
      error: null,
    });
    // delete returns error
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "delete failed" } }).then(resolve)
    );

    await expect(deleteIncident("i1")).rejects.toEqual({
      message: "delete failed",
    });
  });
});
