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

vi.mock("@/lib/supabase/db-helpers", () => ({
  ts: () => ({ created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }),
  ensureInternalUser: vi.fn(),
}));

vi.mock("@/lib/supabase/db-error", () => ({
  logDbReadError: vi.fn(),
}));

import {
  getUserShifts,
  getUpcomingEvents,
  getEventShifts,
  createShift,
  assignShift,
  getConflictingShifts,
  deleteShift,
} from "@/lib/supabase/db-operations";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";
import { logDbReadError } from "@/lib/supabase/db-error";

const mockedEnsureInternalUser = vi.mocked(ensureInternalUser);
const mockedLogDbReadError = vi.mocked(logDbReadError);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  mockedEnsureInternalUser.mockResolvedValue("internal-user-1");
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
});

// ---------------------------------------------------------------------------
// getUserShifts()
// ---------------------------------------------------------------------------

describe("getUserShifts()", () => {
  it("returns shifts for authenticated user", async () => {
    const shifts = [
      { id: "s1", event_id: "e1" },
      { id: "s2", event_id: "e2" },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: shifts, error: null }).then(resolve)
    );

    const result = await getUserShifts("comp-1");

    expect(mockedEnsureInternalUser).toHaveBeenCalled();
    expect(mockClient.from).toHaveBeenCalledWith("shifts");
    expect(queryBuilder.select).toHaveBeenCalledWith(
      "*, events!inner(id, name, location, company_id, ops_guide, timezone)"
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("assigned_user_id", "internal-user-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("events.company_id", "comp-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("start_time", { ascending: true });
    expect(result).toEqual(shifts);
  });

  it("returns [] when user is null (ensureInternalUser returns null)", async () => {
    mockedEnsureInternalUser.mockResolvedValueOnce(null);

    const result = await getUserShifts("comp-1");

    expect(result).toEqual([]);
    // Should not have called from() since we returned early
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "shifts error", code: "500" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getUserShifts("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("shifts", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getUpcomingEvents()
// ---------------------------------------------------------------------------

describe("getUpcomingEvents()", () => {
  it("returns upcoming events", async () => {
    const events = [{ id: "e1", name: "Future Event" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: events, error: null }).then(resolve)
    );

    const result = await getUpcomingEvents("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("events");
    expect(queryBuilder.select).toHaveBeenCalledWith("*");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.gte).toHaveBeenCalledWith("end_date", expect.any(String));
    expect(queryBuilder.order).toHaveBeenCalledWith("start_date", { ascending: true });
    expect(queryBuilder.limit).toHaveBeenCalledWith(20);
    expect(result).toEqual(events);
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "upcoming error" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getUpcomingEvents("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("upcoming events", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getEventShifts()
// ---------------------------------------------------------------------------

describe("getEventShifts()", () => {
  it("returns shifts for an event", async () => {
    const shifts = [{ id: "s1", role: "guard" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: shifts, error: null }).then(resolve)
    );

    const result = await getEventShifts("event-1");

    expect(mockClient.from).toHaveBeenCalledWith("shifts");
    expect(queryBuilder.select).toHaveBeenCalledWith("*, users(first_name, last_name)");
    expect(queryBuilder.eq).toHaveBeenCalledWith("event_id", "event-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("start_time", { ascending: true });
    expect(result).toEqual(shifts);
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "event shifts error" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getEventShifts("event-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("event shifts", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createShift()
// ---------------------------------------------------------------------------

describe("createShift()", () => {
  it("creates shift with assignedUserId — status 'confirmed'", async () => {
    const shift = { id: "s-new", status: "confirmed" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: shift, error: null });

    const result = await createShift({
      eventId: "event-1",
      role: "guard",
      startTime: "2026-06-01T08:00:00Z",
      endTime: "2026-06-01T16:00:00Z",
      assignedUserId: "user-1",
    });

    expect(mockClient.from).toHaveBeenCalledWith("shifts");
    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.event_id).toBe("event-1");
    expect(insertArg.role).toBe("guard");
    expect(insertArg.start_time).toBe("2026-06-01T08:00:00Z");
    expect(insertArg.end_time).toBe("2026-06-01T16:00:00Z");
    expect(insertArg.assigned_user_id).toBe("user-1");
    expect(insertArg.status).toBe("confirmed");
    expect(queryBuilder.select).toHaveBeenCalledWith("*, users(first_name, last_name)");
    expect(result).toEqual(shift);
  });

  it("creates shift without assignedUserId — status 'open'", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "s-open" }, error: null });

    await createShift({
      eventId: "event-1",
      startTime: "2026-06-01T08:00:00Z",
      endTime: "2026-06-01T16:00:00Z",
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.assigned_user_id).toBeNull();
    expect(insertArg.status).toBe("open");
    expect(insertArg.role).toBeNull();
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "shift insert failed" },
    });

    await expect(
      createShift({
        eventId: "event-1",
        startTime: "2026-06-01T08:00:00Z",
        endTime: "2026-06-01T16:00:00Z",
      })
    ).rejects.toEqual({ message: "shift insert failed" });
  });
});

// ---------------------------------------------------------------------------
// assignShift()
// ---------------------------------------------------------------------------

describe("assignShift()", () => {
  it("assigns user to shift — status 'confirmed'", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await assignShift("shift-1", "user-1");

    expect(mockClient.from).toHaveBeenCalledWith("shifts");
    expect(queryBuilder.update).toHaveBeenCalledWith({
      assigned_user_id: "user-1",
      status: "confirmed",
    });
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "shift-1");
  });

  it("unassigns user (null) — status 'open'", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await assignShift("shift-1", null);

    expect(queryBuilder.update).toHaveBeenCalledWith({
      assigned_user_id: null,
      status: "open",
    });
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "assign failed" } }).then(resolve)
    );

    await expect(assignShift("shift-1", "user-1")).rejects.toEqual({
      message: "assign failed",
    });
  });
});

// ---------------------------------------------------------------------------
// getConflictingShifts()
// ---------------------------------------------------------------------------

describe("getConflictingShifts()", () => {
  it("returns conflicting shifts", async () => {
    const conflicts = [{ id: "s-conflict", start_time: "2026-06-01T10:00:00Z" }];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: conflicts, error: null }).then(resolve)
    );

    const result = await getConflictingShifts(
      "user-1",
      "2026-06-01T08:00:00Z",
      "2026-06-01T16:00:00Z"
    );

    expect(mockClient.from).toHaveBeenCalledWith("shifts");
    expect(queryBuilder.select).toHaveBeenCalledWith("*, events(id, name)");
    expect(queryBuilder.eq).toHaveBeenCalledWith("assigned_user_id", "user-1");
    expect(queryBuilder.lt).toHaveBeenCalledWith("start_time", "2026-06-01T16:00:00Z");
    expect(queryBuilder.gt).toHaveBeenCalledWith("end_time", "2026-06-01T08:00:00Z");
    expect(result).toEqual(conflicts);
  });

  it("calls .neq when excludeShiftId is provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getConflictingShifts(
      "user-1",
      "2026-06-01T08:00:00Z",
      "2026-06-01T16:00:00Z",
      "exclude-shift-1"
    );

    expect(queryBuilder.neq).toHaveBeenCalledWith("id", "exclude-shift-1");
  });

  it("does NOT call .neq when excludeShiftId is not provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await getConflictingShifts(
      "user-1",
      "2026-06-01T08:00:00Z",
      "2026-06-01T16:00:00Z"
    );

    expect(queryBuilder.neq).not.toHaveBeenCalled();
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "conflict query error" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getConflictingShifts(
      "user-1",
      "2026-06-01T08:00:00Z",
      "2026-06-01T16:00:00Z"
    );

    expect(mockedLogDbReadError).toHaveBeenCalledWith("conflicting shifts", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// deleteShift()
// ---------------------------------------------------------------------------

describe("deleteShift()", () => {
  it("deletes shift by id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deleteShift("shift-1");

    expect(mockClient.from).toHaveBeenCalledWith("shifts");
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "shift-1");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "delete shift failed" } }).then(resolve)
    );

    await expect(deleteShift("shift-1")).rejects.toEqual({
      message: "delete shift failed",
    });
  });
});
