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
  createIntakeShare,
  getEventShares,
  lookupIntakeShare,
  markShareSubmitted,
  deleteIntakeShare,
} from "@/lib/supabase/db-intake-shares";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";

const mockedEnsureInternalUser = vi.mocked(ensureInternalUser);

// ---------------------------------------------------------------------------
// Setup
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
// createIntakeShare()
// ---------------------------------------------------------------------------

describe("createIntakeShare()", () => {
  it("inserts share record with authenticated user as created_by", async () => {
    const shareData = {
      id: "share-1",
      event_id: "event-1",
      company_id: "comp-1",
      token: "tok-abc",
      client_name: null,
      client_email: null,
      submitted_at: null,
      created_by: "internal-user-1",
      created_at: "2026-04-01T00:00:00.000Z",
    };
    queryBuilder.single.mockResolvedValueOnce({ data: shareData, error: null });

    const result = await createIntakeShare("event-1", "comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("intake_shares");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "event-1",
        company_id: "comp-1",
        created_by: "internal-user-1",
      })
    );
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(queryBuilder.single).toHaveBeenCalled();
    expect(result).toEqual(shareData);
  });

  it("returns created share data", async () => {
    const shareData = {
      id: "share-2",
      event_id: "event-1",
      company_id: "comp-1",
      token: "tok-xyz",
      created_by: "internal-user-1",
    };
    queryBuilder.single.mockResolvedValueOnce({ data: shareData, error: null });

    const result = await createIntakeShare("event-1", "comp-1");
    expect(result).toEqual(shareData);
  });

  it("throws when insert fails", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(createIntakeShare("event-1", "comp-1")).rejects.toEqual({
      message: "insert failed",
    });
  });
});

// ---------------------------------------------------------------------------
// getEventShares()
// ---------------------------------------------------------------------------

describe("getEventShares()", () => {
  it("fetches shares ordered by created_at desc", async () => {
    const shares = [
      { id: "share-2", event_id: "event-1" },
      { id: "share-1", event_id: "event-1" },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: shares, error: null }).then(resolve)
    );

    const result = await getEventShares("event-1");

    expect(mockClient.from).toHaveBeenCalledWith("intake_shares");
    expect(queryBuilder.eq).toHaveBeenCalledWith("event_id", "event-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(result).toEqual(shares);
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "db error" } }).then(resolve)
    );

    await expect(getEventShares("event-1")).rejects.toEqual({
      message: "db error",
    });
  });

  it("returns empty array when data is null and no error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const result = await getEventShares("event-1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// lookupIntakeShare()
// ---------------------------------------------------------------------------

describe("lookupIntakeShare()", () => {
  it("returns share + event + company data on success", async () => {
    const share = {
      id: "share-1",
      event_id: "event-1",
      company_id: "comp-1",
      token: "tok-abc",
    };
    const event = {
      id: "event-1",
      name: "Concert Security",
      location: "LA",
      start_date: "2026-05-01",
    };
    const company = {
      id: "comp-1",
      name: "Acme Security",
      logo_url: null,
      brand_color: "#000000",
    };

    // First maybeSingle: share lookup
    queryBuilder.maybeSingle
      .mockResolvedValueOnce({ data: share, error: null })
      // Second maybeSingle: event lookup
      .mockResolvedValueOnce({ data: event, error: null })
      // Third maybeSingle: company lookup
      .mockResolvedValueOnce({ data: company, error: null });

    const result = await lookupIntakeShare("tok-abc");

    expect(mockClient.from).toHaveBeenCalledWith("intake_shares");
    expect(mockClient.from).toHaveBeenCalledWith("events");
    expect(mockClient.from).toHaveBeenCalledWith("companies");
    expect(queryBuilder.eq).toHaveBeenCalledWith("token", "tok-abc");
    expect(result).not.toBeNull();
    expect(result!.share).toEqual(share);
    expect(result!.event).toEqual(event);
    expect(result!.company).toEqual(company);
  });

  it("returns null when token not found", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await lookupIntakeShare("bad-token");
    expect(result).toBeNull();
  });

  it("returns null when share lookup has error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "not found" },
    });

    const result = await lookupIntakeShare("tok-err");
    expect(result).toBeNull();
  });

  it("returns null when event not found", async () => {
    const share = { id: "share-1", event_id: "event-1", company_id: "comp-1" };
    queryBuilder.maybeSingle
      .mockResolvedValueOnce({ data: share, error: null })
      .mockResolvedValueOnce({ data: null, error: null }) // event not found
      .mockResolvedValueOnce({
        data: { id: "comp-1", name: "Acme", logo_url: null, brand_color: "#000" },
        error: null,
      });

    const result = await lookupIntakeShare("tok-abc");
    expect(result).toBeNull();
  });

  it("returns null when company not found", async () => {
    const share = { id: "share-1", event_id: "event-1", company_id: "comp-1" };
    queryBuilder.maybeSingle
      .mockResolvedValueOnce({ data: share, error: null })
      .mockResolvedValueOnce({
        data: { id: "event-1", name: "Event", location: null, start_date: null },
        error: null,
      })
      .mockResolvedValueOnce({ data: null, error: null }); // company not found

    const result = await lookupIntakeShare("tok-abc");
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// markShareSubmitted()
// ---------------------------------------------------------------------------

describe("markShareSubmitted()", () => {
  it("updates submitted_at, client_name, client_email", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await markShareSubmitted("tok-abc", "Jane Doe", "jane@example.com");

    expect(mockClient.from).toHaveBeenCalledWith("intake_shares");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        client_name: "Jane Doe",
        client_email: "jane@example.com",
        submitted_at: expect.any(String),
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("token", "tok-abc");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "update failed" } }).then(resolve)
    );

    await expect(
      markShareSubmitted("tok-abc", "Jane", "jane@example.com")
    ).rejects.toEqual({ message: "update failed" });
  });
});

// ---------------------------------------------------------------------------
// deleteIntakeShare()
// ---------------------------------------------------------------------------

describe("deleteIntakeShare()", () => {
  it("deletes by ID", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deleteIntakeShare("share-1");

    expect(mockClient.from).toHaveBeenCalledWith("intake_shares");
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "share-1");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "delete failed" } }).then(resolve)
    );

    await expect(deleteIntakeShare("share-1")).rejects.toEqual({
      message: "delete failed",
    });
  });
});
