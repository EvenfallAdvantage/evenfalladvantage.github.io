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
  getEvents,
  createEvent,
  updateEvent,
  updateEventStatus,
  deleteEvent,
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
// getEvents()
// ---------------------------------------------------------------------------

describe("getEvents()", () => {
  it("returns events data", async () => {
    const events = [
      { id: "e1", name: "Event 1" },
      { id: "e2", name: "Event 2" },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: events, error: null }).then(resolve)
    );

    const result = await getEvents("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("events");
    expect(queryBuilder.select).toHaveBeenCalledWith("*, clients(name)");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("start_date", { ascending: true });
    expect(result).toEqual(events);
  });

  it("returns [] when data is null", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const result = await getEvents("comp-1");
    expect(result).toEqual([]);
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "db failure", code: "500" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getEvents("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("events", dbError);
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createEvent()
// ---------------------------------------------------------------------------

describe("createEvent()", () => {
  it("inserts with all params", async () => {
    const newEvent = { id: "e-new", name: "Full Event" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: newEvent, error: null });

    const result = await createEvent({
      id: "custom-id",
      companyId: "comp-1",
      name: "Full Event",
      description: "A description",
      location: "NYC",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
      opsGuide: { step: 1 },
      engagementType: "corporate",
      venueType: "indoor",
      estimatedAttendance: "500",
      riskLevel: "high",
      tlpStep: "execute_mission",
      siteMapUrl: "https://example.com/map.png",
      locationLat: 40.7128,
      locationLng: -74.006,
    });

    expect(mockClient.from).toHaveBeenCalledWith("events");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: "custom-id",
        company_id: "comp-1",
        name: "Full Event",
        description: "A description",
        location: "NYC",
        start_date: "2026-06-01",
        end_date: "2026-06-02",
        ops_guide: { step: 1 },
        status: "draft",
        engagement_type: "corporate",
        venue_type: "indoor",
        estimated_attendance: "500",
        risk_level: "high",
        tlp_step: "execute_mission",
        site_map_url: "https://example.com/map.png",
        location_lat: 40.7128,
        location_lng: -74.006,
      })
    );
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(queryBuilder.maybeSingle).toHaveBeenCalled();
    expect(result).toEqual(newEvent);
  });

  it("inserts with minimal params — defaults status to 'draft' and tlpStep to 'receive_mission'", async () => {
    const newEvent = { id: "e-min", name: "Min Event" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: newEvent, error: null });

    await createEvent({
      companyId: "comp-1",
      name: "Min Event",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.status).toBe("draft");
    expect(insertArg.tlp_step).toBe("receive_mission");
    expect(insertArg.description).toBeNull();
    expect(insertArg.location).toBeNull();
    expect(insertArg.ops_guide).toBeNull();
    expect(insertArg.engagement_type).toBeNull();
    expect(insertArg.venue_type).toBeNull();
    expect(insertArg.estimated_attendance).toBeNull();
    expect(insertArg.risk_level).toBeNull();
    expect(insertArg.site_map_url).toBeNull();
    expect(insertArg.location_lat).toBeNull();
    expect(insertArg.location_lng).toBeNull();
    // id should be auto-generated (UUID)
    expect(insertArg.id).toBeDefined();
    expect(typeof insertArg.id).toBe("string");
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(
      createEvent({
        companyId: "comp-1",
        name: "Fail Event",
        startDate: "2026-06-01",
        endDate: "2026-06-02",
      })
    ).rejects.toEqual({ message: "insert failed" });
  });

  it("handles optional id param — uses provided id instead of generating one", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "my-id" }, error: null });

    await createEvent({
      id: "my-id",
      companyId: "comp-1",
      name: "Custom ID Event",
      startDate: "2026-06-01",
      endDate: "2026-06-02",
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.id).toBe("my-id");
  });
});

// ---------------------------------------------------------------------------
// updateEvent()
// ---------------------------------------------------------------------------

describe("updateEvent()", () => {
  it("updates a single field", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "e1", name: "New Name" },
      error: null,
    });

    const result = await updateEvent("e1", { name: "New Name" });

    expect(mockClient.from).toHaveBeenCalledWith("events");
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "e1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.name).toBe("New Name");
    expect(updateArg.updated_at).toBeDefined();
    expect(result).toEqual({ id: "e1", name: "New Name" });
  });

  it("updates all fields", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "e1" }, error: null });

    await updateEvent("e1", {
      name: "Updated",
      description: "Desc",
      location: "LA",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
      status: "active",
      opsGuide: { key: "val" },
    });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.name).toBe("Updated");
    expect(updateArg.description).toBe("Desc");
    expect(updateArg.location).toBe("LA");
    expect(updateArg.start_date).toBe("2026-07-01");
    expect(updateArg.end_date).toBe("2026-07-02");
    expect(updateArg.status).toBe("active");
    expect(updateArg.ops_guide).toEqual({ key: "val" });
    expect(updateArg.updated_at).toBeDefined();
  });

  it("sends only updated_at when no fields provided (empty updates)", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "e1" }, error: null });

    await updateEvent("e1", {});

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    // Only updated_at should be present
    expect(Object.keys(updateArg)).toEqual(["updated_at"]);
  });

  it("does NOT include undefined fields in the update payload", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "e1" }, error: null });

    await updateEvent("e1", { name: "Only Name" });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).toHaveProperty("name");
    expect(updateArg).toHaveProperty("updated_at");
    // These undefined fields should NOT be in the payload
    expect(updateArg).not.toHaveProperty("description");
    expect(updateArg).not.toHaveProperty("location");
    expect(updateArg).not.toHaveProperty("start_date");
    expect(updateArg).not.toHaveProperty("end_date");
    expect(updateArg).not.toHaveProperty("status");
    expect(updateArg).not.toHaveProperty("ops_guide");
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "update failed" },
    });

    await expect(updateEvent("e1", { name: "Fail" })).rejects.toEqual({
      message: "update failed",
    });
  });
});

// ---------------------------------------------------------------------------
// updateEventStatus()
// ---------------------------------------------------------------------------

describe("updateEventStatus()", () => {
  it("updates event status", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "e1", status: "active" },
      error: null,
    });

    const result = await updateEventStatus("e1", "active");

    expect(mockClient.from).toHaveBeenCalledWith("events");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({ status: "active", updated_at: expect.any(String) })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "e1");
    expect(result).toEqual({ id: "e1", status: "active" });
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "status update failed" },
    });

    await expect(updateEventStatus("e1", "active")).rejects.toEqual({
      message: "status update failed",
    });
  });
});

// ---------------------------------------------------------------------------
// deleteEvent()
// ---------------------------------------------------------------------------

describe("deleteEvent()", () => {
  it("deletes event by id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deleteEvent("e1");

    expect(mockClient.from).toHaveBeenCalledWith("events");
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "e1");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "delete failed" } }).then(resolve)
    );

    await expect(deleteEvent("e1")).rejects.toEqual({
      message: "delete failed",
    });
  });
});
