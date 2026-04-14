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
  loadStoryboard,
  saveStoryboard,
  getOperationActivity,
  getEventSiteMapUrl,
} from "@/lib/supabase/db-operations";
import { logDbReadError } from "@/lib/supabase/db-error";

const mockedLogDbReadError = vi.mocked(logDbReadError);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
});

// ---------------------------------------------------------------------------
// loadStoryboard()
// ---------------------------------------------------------------------------

describe("loadStoryboard()", () => {
  it("returns storyboard data", async () => {
    const storyboard = { id: "sb-1", pins: [{ id: "p1" }] };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: storyboard, error: null });

    const result = await loadStoryboard("evt-1");

    expect(mockClient.from).toHaveBeenCalledWith("storyboards");
    expect(queryBuilder.select).toHaveBeenCalledWith("*");
    expect(queryBuilder.eq).toHaveBeenCalledWith("event_id", "evt-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(queryBuilder.limit).toHaveBeenCalledWith(1);
    expect(queryBuilder.maybeSingle).toHaveBeenCalled();
    expect(result).toEqual(storyboard);
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "load failed" },
    });

    await expect(loadStoryboard("evt-1")).rejects.toEqual({
      message: "load failed",
    });
  });

  it("returns null when no storyboard exists", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await loadStoryboard("evt-1");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// saveStoryboard()
// ---------------------------------------------------------------------------

describe("saveStoryboard()", () => {
  it("updates by known storyboardId — skips lookup", async () => {
    const updated = { id: "sb-1", pins: [{ id: "p1" }] };
    queryBuilder.single.mockResolvedValueOnce({ data: updated, error: null });

    const result = await saveStoryboard("comp-1", "evt-1", [{ id: "p1" }], "sb-1");

    // Should NOT have done a lookup query for existing storyboard
    // It goes directly to update path
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pins: [{ id: "p1" }],
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "sb-1");
    expect(result).toEqual(updated);
  });

  it("updates by lookup — no storyboardId provided, existing found", async () => {
    // 1st call: lookup existing storyboard (maybeSingle)
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "sb-existing" },
      error: null,
    });
    // 2nd call: update (single)
    const updated = { id: "sb-existing", pins: [{ id: "p2" }] };
    queryBuilder.single.mockResolvedValueOnce({ data: updated, error: null });

    const result = await saveStoryboard("comp-1", "evt-1", [{ id: "p2" }]);

    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        pins: [{ id: "p2" }],
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "sb-existing");
    expect(result).toEqual(updated);
  });

  it("creates new storyboard — no storyboardId, no existing found", async () => {
    // 1st call: lookup existing (maybeSingle) — not found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // 2nd call: insert (single)
    const created = { id: "sb-new", pins: [{ id: "p3" }] };
    queryBuilder.single.mockResolvedValueOnce({ data: created, error: null });

    const result = await saveStoryboard("comp-1", "evt-1", [{ id: "p3" }], undefined, "user-456");

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        event_id: "evt-1",
        pins: [{ id: "p3" }],
        created_by: "user-456",
      })
    );
    expect(result).toEqual(created);
  });

  it("throws custom error when insert returns null data", async () => {
    // 1st call: lookup existing — not found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // 2nd call: insert returns no error but null data
    queryBuilder.single.mockResolvedValueOnce({ data: null, error: null });

    await expect(
      saveStoryboard("comp-1", "evt-1", [{ id: "p4" }])
    ).rejects.toThrow("Storyboard insert returned no data");
  });

  it("throws on update error", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: "update failed" },
    });

    await expect(
      saveStoryboard("comp-1", "evt-1", [{ id: "p5" }], "sb-1")
    ).rejects.toEqual({ message: "update failed" });
  });
});

// ---------------------------------------------------------------------------
// getOperationActivity()
// ---------------------------------------------------------------------------

describe("getOperationActivity()", () => {
  it("merges all 3 sources and sorts by timestamp desc", async () => {
    // 1st query: timesheets
    queryBuilder.then = vi.fn()
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({
          data: [{
            id: "ts-1",
            clock_in: "2026-01-01T10:00:00Z",
            clock_out: "2026-01-01T18:00:00Z",
            users: { first_name: "Alice", last_name: "Smith" },
          }],
          error: null,
        }).then(resolve)
      )
      // 2nd query: form_submissions
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({
          data: [{
            id: "fs-1",
            created_at: "2026-01-01T12:00:00Z",
            users: { first_name: "Bob", last_name: "Jones" },
            forms: { name: "Daily Report" },
            data: { field: "value" },
          }],
          error: null,
        }).then(resolve)
      )
      // 3rd query: incidents
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({
          data: [{
            id: "inc-1",
            created_at: "2026-01-01T14:00:00Z",
            reported_user: { first_name: "Charlie", last_name: "Brown" },
            title: "Breach",
            severity: "high",
            status: "open",
          }],
          error: null,
        }).then(resolve)
      );

    const result = await getOperationActivity("evt-1");

    // Should have 4 items: clock_in, clock_out, report, incident
    expect(result).toHaveLength(4);
    // Sorted by timestamp desc: 18:00, 14:00, 12:00, 10:00
    expect(result[0].type).toBe("clock_out");
    expect(result[0].timestamp).toBe("2026-01-01T18:00:00Z");
    expect(result[1].type).toBe("incident");
    expect(result[1].timestamp).toBe("2026-01-01T14:00:00Z");
    expect(result[2].type).toBe("report");
    expect(result[2].timestamp).toBe("2026-01-01T12:00:00Z");
    expect(result[3].type).toBe("clock_in");
    expect(result[3].timestamp).toBe("2026-01-01T10:00:00Z");
  });

  it("returns only timesheet items when others are empty", async () => {
    queryBuilder.then = vi.fn()
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({
          data: [{
            id: "ts-1",
            clock_in: "2026-01-01T09:00:00Z",
            clock_out: null,
            users: { first_name: "Dan", last_name: "Lee" },
          }],
          error: null,
        }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      );

    const result = await getOperationActivity("evt-1");

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("clock_in");
    expect(result[0].userName).toBe("Dan Lee");
  });

  it("timesheet with clock_out produces 2 items", async () => {
    queryBuilder.then = vi.fn()
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({
          data: [{
            id: "ts-1",
            clock_in: "2026-01-01T08:00:00Z",
            clock_out: "2026-01-01T16:00:00Z",
            users: { first_name: "Eve", last_name: "Adams" },
          }],
          error: null,
        }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      );

    const result = await getOperationActivity("evt-1");

    expect(result).toHaveLength(2);
    const types = result.map((i) => i.type);
    expect(types).toContain("clock_in");
    expect(types).toContain("clock_out");
  });

  it("timesheet without clock_out produces 1 item", async () => {
    queryBuilder.then = vi.fn()
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({
          data: [{
            id: "ts-1",
            clock_in: "2026-01-01T08:00:00Z",
            clock_out: null,
            users: { first_name: "Frank", last_name: "Wu" },
          }],
          error: null,
        }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      );

    const result = await getOperationActivity("evt-1");

    expect(result).toHaveLength(1);
    expect(result[0].type).toBe("clock_in");
    expect(result[0].detail).toBe("Clocked in");
  });

  it("user name falls back to 'Unknown' when users join is null", async () => {
    queryBuilder.then = vi.fn()
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({
          data: [{
            id: "ts-1",
            clock_in: "2026-01-01T08:00:00Z",
            clock_out: null,
            users: null,
          }],
          error: null,
        }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      );

    const result = await getOperationActivity("evt-1");

    expect(result[0].userName).toBe("Unknown");
  });

  it("form name falls back to 'Field Report' when forms join is null", async () => {
    queryBuilder.then = vi.fn()
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({
          data: [{
            id: "fs-1",
            created_at: "2026-01-01T12:00:00Z",
            users: { first_name: "Grace", last_name: "Kim" },
            forms: null,
            data: {},
          }],
          error: null,
        }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      );

    const result = await getOperationActivity("evt-1");

    expect(result).toHaveLength(1);
    expect(result[0].detail).toBe("Field Report");
  });

  it("returns [] when all sources are empty", async () => {
    queryBuilder.then = vi.fn()
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: [], error: null }).then(resolve)
      );

    const result = await getOperationActivity("evt-1");

    expect(result).toEqual([]);
  });

  it("handles null data from queries (uses ?? [])", async () => {
    queryBuilder.then = vi.fn()
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      )
      .mockImplementationOnce((resolve: (v: unknown) => void) =>
        Promise.resolve({ data: null, error: null }).then(resolve)
      );

    const result = await getOperationActivity("evt-1");

    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getEventSiteMapUrl()
// ---------------------------------------------------------------------------

describe("getEventSiteMapUrl()", () => {
  it("returns site map URL", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { site_map_url: "https://example.com/map.png" },
      error: null,
    });

    const result = await getEventSiteMapUrl("evt-1");

    expect(mockClient.from).toHaveBeenCalledWith("events");
    expect(queryBuilder.select).toHaveBeenCalledWith("site_map_url");
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "evt-1");
    expect(result).toBe("https://example.com/map.png");
  });

  it("returns null on error", async () => {
    const dbError = { message: "read failed" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: dbError });

    const result = await getEventSiteMapUrl("evt-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("site map URL", dbError);
    expect(result).toBeNull();
  });

  it("returns null when data has no site_map_url", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { site_map_url: null },
      error: null,
    });

    const result = await getEventSiteMapUrl("evt-1");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// TODO: getSiteMapBounds, saveSiteMapBounds, clearSiteMapBounds
// Skipped — requires localStorage mocking which adds complexity.
// ---------------------------------------------------------------------------
