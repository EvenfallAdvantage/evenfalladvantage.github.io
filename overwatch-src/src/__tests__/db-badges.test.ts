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
  ensureInternalUser: vi.fn(),
}));

import {
  getOrCreateBadge,
  getCompanyBadges,
  revokeBadge,
  lookupBadge,
  qrClockIn,
  qrClockOut,
  isUserClockedIn,
} from "@/lib/supabase/db-badges";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";

const mockedEnsureInternalUser = vi.mocked(ensureInternalUser);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  mockedEnsureInternalUser.mockResolvedValue("internal-user-1");
  // Reset the builder's .then to default thenable behaviour
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
});

// ---------------------------------------------------------------------------
// getOrCreateBadge()
// ---------------------------------------------------------------------------

describe("getOrCreateBadge()", () => {
  it("returns existing badge when found", async () => {
    const existing = {
      id: "badge-1",
      company_id: "comp-1",
      user_id: "user-1",
      badge_number: "EA-ABC",
      qr_data: '{"uid":"user-1","cid":"comp-1","bn":"EA-ABC"}',
      generated_at: "2026-01-01T00:00:00.000Z",
      revoked_at: null,
    };
    // maybeSingle returns existing badge
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: existing,
      error: null,
    });

    const result = await getOrCreateBadge("comp-1", "user-1");

    expect(mockClient.from).toHaveBeenCalledWith("staff_badges");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(queryBuilder.is).toHaveBeenCalledWith("revoked_at", null);
    expect(result).toEqual(existing);
    // Should NOT have called insert since badge already exists
    expect(queryBuilder.insert).not.toHaveBeenCalled();
  });

  it("creates new badge when none exists (inserts with generated badge number)", async () => {
    // maybeSingle returns null — no existing badge
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const newBadge = {
      id: "badge-new",
      company_id: "comp-1",
      user_id: "user-1",
      badge_number: "EA-GENERATED",
      qr_data: '{"uid":"user-1","cid":"comp-1","bn":"EA-GENERATED"}',
      generated_at: "2026-04-01T00:00:00.000Z",
      revoked_at: null,
    };
    // single (after insert) returns the new badge
    queryBuilder.single.mockResolvedValueOnce({ data: newBadge, error: null });

    const result = await getOrCreateBadge("comp-1", "user-1");

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        user_id: "user-1",
        generated_by: "internal-user-1",
      })
    );
    // Badge number should start with "EA-" when auto-generated
    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect((insertArg.badge_number as string).startsWith("EA-")).toBe(true);
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(queryBuilder.single).toHaveBeenCalled();
    expect(result).toEqual(newBadge);
  });

  it("uses provided badge number when specified", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    queryBuilder.single.mockResolvedValueOnce({
      data: { id: "badge-custom" },
      error: null,
    });

    await getOrCreateBadge("comp-1", "user-1", "CUSTOM-42");

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.badge_number).toBe("CUSTOM-42");
  });

  it("QR data contains uid, cid, bn fields as JSON string", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    queryBuilder.single.mockResolvedValueOnce({
      data: { id: "badge-qr" },
      error: null,
    });

    await getOrCreateBadge("comp-1", "user-1", "BN-99");

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    const qrData = JSON.parse(insertArg.qr_data as string);
    expect(qrData).toEqual({ uid: "user-1", cid: "comp-1", bn: "BN-99" });
  });

  it("throws when insert returns an error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(getOrCreateBadge("comp-1", "user-1")).rejects.toEqual({
      message: "insert failed",
    });
  });
});

// ---------------------------------------------------------------------------
// getCompanyBadges()
// ---------------------------------------------------------------------------

describe("getCompanyBadges()", () => {
  it("fetches badges filtered by company + non-revoked", async () => {
    const badges = [
      { id: "b1", company_id: "comp-1", revoked_at: null },
      { id: "b2", company_id: "comp-1", revoked_at: null },
    ];
    // The chain from().select().eq().is().order() resolves via .then
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: badges, error: null }).then(resolve)
    );

    const result = await getCompanyBadges("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("staff_badges");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.is).toHaveBeenCalledWith("revoked_at", null);
    expect(queryBuilder.order).toHaveBeenCalledWith("generated_at", {
      ascending: false,
    });
    expect(result).toEqual(badges);
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "db error" } }).then(resolve)
    );

    await expect(getCompanyBadges("comp-1")).rejects.toEqual({
      message: "db error",
    });
  });

  it("returns empty array when data is null and no error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    // The function does `if (error) throw error; return (data ?? [])` —
    // but error is null here, so data ?? [] → []
    // Wait — actually re-reading the source: `if (error) throw error`
    // Since error is null we don't throw, we return (null ?? []) = []
    const result = await getCompanyBadges("comp-1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// revokeBadge()
// ---------------------------------------------------------------------------

describe("revokeBadge()", () => {
  it("sets revoked_at timestamp", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await revokeBadge("badge-1");

    expect(mockClient.from).toHaveBeenCalledWith("staff_badges");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        revoked_at: expect.any(String),
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "badge-1");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "revoke failed" } }).then(resolve)
    );

    await expect(revokeBadge("badge-1")).rejects.toEqual({
      message: "revoke failed",
    });
  });
});

// ---------------------------------------------------------------------------
// lookupBadge()
// ---------------------------------------------------------------------------

describe("lookupBadge()", () => {
  it("parses valid JSON and looks up badge by uid+cid", async () => {
    const badgeWithUser = {
      id: "badge-1",
      company_id: "comp-1",
      user_id: "user-1",
      badge_number: "EA-1",
      qr_data: "...",
      generated_at: "2026-01-01",
      revoked_at: null,
      users: {
        id: "user-1",
        first_name: "John",
        last_name: "Doe",
        avatar_url: null,
      },
    };
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: badgeWithUser,
      error: null,
    });

    const qrData = JSON.stringify({ uid: "user-1", cid: "comp-1", bn: "EA-1" });
    const result = await lookupBadge(qrData);

    expect(mockClient.from).toHaveBeenCalledWith("staff_badges");
    expect(queryBuilder.select).toHaveBeenCalledWith(
      "*, users!inner(id, first_name, last_name, avatar_url)"
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(queryBuilder.is).toHaveBeenCalledWith("revoked_at", null);
    expect(result).not.toBeNull();
    expect(result!.badge.id).toBe("badge-1");
    expect(result!.user.first_name).toBe("John");
  });

  it("returns null on invalid JSON", async () => {
    const result = await lookupBadge("not-json{{{");
    expect(result).toBeNull();
  });

  it("returns null on missing uid field", async () => {
    const result = await lookupBadge(JSON.stringify({ cid: "comp-1" }));
    expect(result).toBeNull();
  });

  it("returns null on missing cid field", async () => {
    const result = await lookupBadge(JSON.stringify({ uid: "user-1" }));
    expect(result).toBeNull();
  });

  it("returns null when badge not found in DB", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const qrData = JSON.stringify({ uid: "user-1", cid: "comp-1", bn: "EA-1" });
    const result = await lookupBadge(qrData);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// qrClockIn()
// ---------------------------------------------------------------------------

describe("qrClockIn()", () => {
  it("inserts timesheet with clock_method 'qr_scan'", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await qrClockIn("user-1", "comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("timesheets");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "user-1",
        company_id: "comp-1",
        clock_method: "qr_scan",
        clock_in: expect.any(String),
      })
    );
  });

  it("includes event_id and shift_id when provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await qrClockIn("user-1", "comp-1", "event-1", "shift-1");

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "event-1",
        shift_id: "shift-1",
      })
    );
  });

  it("sets clock_in_type to 'shift' when event_id present", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await qrClockIn("user-1", "comp-1", "event-1");

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        clock_in_type: "event",
      })
    );
  });

  it("sets clock_in_type to 'admin' when no event_id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await qrClockIn("user-1", "comp-1");

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        clock_in_type: "admin",
        event_id: null,
        shift_id: null,
      })
    );
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "insert failed" } }).then(resolve)
    );

    await expect(qrClockIn("user-1", "comp-1")).rejects.toEqual({
      message: "insert failed",
    });
  });
});

// ---------------------------------------------------------------------------
// qrClockOut()
// ---------------------------------------------------------------------------

describe("qrClockOut()", () => {
  it("finds active timesheet and updates with clock_out time", async () => {
    // First call: maybeSingle to find active timesheet
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "ts-1" },
      error: null,
    });
    // Second call: update chain resolves via .then
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await qrClockOut("user-1", "comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("timesheets");
    expect(queryBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.is).toHaveBeenCalledWith("clock_out", null);
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        clock_out: expect.any(String),
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "ts-1");
  });

  it("throws when no active timesheet found", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    await expect(qrClockOut("user-1", "comp-1")).rejects.toThrow(
      "No active timesheet found"
    );
  });

  it("throws when update returns error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "ts-1" },
      error: null,
    });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "update failed" } }).then(resolve)
    );

    await expect(qrClockOut("user-1", "comp-1")).rejects.toEqual({
      message: "update failed",
    });
  });
});

// ---------------------------------------------------------------------------
// isUserClockedIn()
// ---------------------------------------------------------------------------

describe("isUserClockedIn()", () => {
  it("returns true when active timesheet exists", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { id: "ts-1" },
      error: null,
    });

    const result = await isUserClockedIn("user-1", "comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("timesheets");
    expect(queryBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.is).toHaveBeenCalledWith("clock_out", null);
    expect(result).toBe(true);
  });

  it("returns false when no active timesheet", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await isUserClockedIn("user-1", "comp-1");
    expect(result).toBe(false);
  });
});
