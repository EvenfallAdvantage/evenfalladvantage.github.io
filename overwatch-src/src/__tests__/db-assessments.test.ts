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
  saveSiteAssessment,
  getCompanyAssessments,
  getAssessment,
  getUnlinkedAssessments,
  linkAssessmentToEvent,
  deleteAssessment,
} from "@/lib/supabase/db-assessments";
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
// saveSiteAssessment()
// ---------------------------------------------------------------------------

describe("saveSiteAssessment()", () => {
  const baseAssessment = {
    client_name: "Client Corp",
    address: "123 Main St",
    lat: 34.05,
    lng: -118.24,
    data: { hazards: ["fire"], notes: "Looks good" },
    risk_score: 3,
    risk_level: "medium",
  };

  it("updates existing when assessment has an id field", async () => {
    const existing = { id: "assess-1", ...baseAssessment, company_id: "comp-1" };
    queryBuilder.single.mockResolvedValueOnce({ data: existing, error: null });

    const result = await saveSiteAssessment("comp-1", {
      id: "assess-1",
      ...baseAssessment,
    });

    expect(mockClient.from).toHaveBeenCalledWith("site_assessments");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        client_name: "Client Corp",
        data: baseAssessment.data,
        created_by: "internal-user-1",
        updated_at: expect.any(String),
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "assess-1");
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(queryBuilder.single).toHaveBeenCalled();
    expect(result).toEqual(existing);
  });

  it("inserts new when assessment has no id field", async () => {
    const newAssessment = { id: "assess-new", ...baseAssessment, company_id: "comp-1" };
    queryBuilder.single.mockResolvedValueOnce({
      data: newAssessment,
      error: null,
    });

    const result = await saveSiteAssessment("comp-1", baseAssessment);

    expect(mockClient.from).toHaveBeenCalledWith("site_assessments");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        created_by: "internal-user-1",
        data: baseAssessment.data,
      })
    );
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(queryBuilder.single).toHaveBeenCalled();
    expect(result).toEqual(newAssessment);
  });

  it("includes company_id and created_by in insert", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: { id: "assess-new" },
      error: null,
    });

    await saveSiteAssessment("comp-1", { data: { notes: "test" } });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.company_id).toBe("comp-1");
    expect(insertArg.created_by).toBe("internal-user-1");
  });

  it("sets null for optional fields when not provided", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: { id: "assess-new" },
      error: null,
    });

    await saveSiteAssessment("comp-1", { data: {} });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.event_id).toBeNull();
    expect(insertArg.client_name).toBeNull();
    expect(insertArg.address).toBeNull();
    expect(insertArg.lat).toBeNull();
    expect(insertArg.lng).toBeNull();
    expect(insertArg.risk_score).toBeNull();
    expect(insertArg.risk_level).toBeNull();
    expect(insertArg.pdf_url).toBeNull();
  });

  it("throws when insert returns an error", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: "insert failed" },
    });

    await expect(
      saveSiteAssessment("comp-1", { data: {} })
    ).rejects.toEqual({ message: "insert failed" });
  });

  it("throws when update returns an error", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: "update failed" },
    });

    await expect(
      saveSiteAssessment("comp-1", { id: "assess-1", data: {} })
    ).rejects.toEqual({ message: "update failed" });
  });
});

// ---------------------------------------------------------------------------
// getCompanyAssessments()
// ---------------------------------------------------------------------------

describe("getCompanyAssessments()", () => {
  it("fetches ordered by created_at desc", async () => {
    const assessments = [
      { id: "a2", created_at: "2026-04-02" },
      { id: "a1", created_at: "2026-04-01" },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: assessments, error: null }).then(resolve)
    );

    const result = await getCompanyAssessments("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("site_assessments");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(result).toEqual(assessments);
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "db error" } }).then(resolve)
    );

    await expect(getCompanyAssessments("comp-1")).rejects.toEqual({
      message: "db error",
    });
  });

  it("returns empty array when data is null and no error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const result = await getCompanyAssessments("comp-1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getAssessment()
// ---------------------------------------------------------------------------

describe("getAssessment()", () => {
  it("returns single assessment by ID", async () => {
    const assessment = {
      id: "assess-1",
      company_id: "comp-1",
      data: { notes: "ok" },
    };
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: assessment,
      error: null,
    });

    const result = await getAssessment("assess-1");

    expect(mockClient.from).toHaveBeenCalledWith("site_assessments");
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "assess-1");
    expect(queryBuilder.maybeSingle).toHaveBeenCalled();
    expect(result).toEqual(assessment);
  });

  it("returns null when not found", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await getAssessment("nonexistent");
    expect(result).toBeNull();
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "db error" },
    });

    await expect(getAssessment("assess-1")).rejects.toEqual({
      message: "db error",
    });
  });
});

// ---------------------------------------------------------------------------
// getUnlinkedAssessments()
// ---------------------------------------------------------------------------

describe("getUnlinkedAssessments()", () => {
  it("filters where event_id IS NULL", async () => {
    const unlinked = [
      { id: "a1", event_id: null },
      { id: "a2", event_id: null },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: unlinked, error: null }).then(resolve)
    );

    const result = await getUnlinkedAssessments("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("site_assessments");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.is).toHaveBeenCalledWith("event_id", null);
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", {
      ascending: false,
    });
    expect(result).toEqual(unlinked);
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "db error" } }).then(resolve)
    );

    await expect(getUnlinkedAssessments("comp-1")).rejects.toEqual({
      message: "db error",
    });
  });

  it("returns empty array when data is null and no error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const result = await getUnlinkedAssessments("comp-1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// linkAssessmentToEvent()
// ---------------------------------------------------------------------------

describe("linkAssessmentToEvent()", () => {
  it("updates event_id and updated_at", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await linkAssessmentToEvent("assess-1", "event-1");

    expect(mockClient.from).toHaveBeenCalledWith("site_assessments");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        event_id: "event-1",
        updated_at: expect.any(String),
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "assess-1");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "link failed" } }).then(resolve)
    );

    await expect(linkAssessmentToEvent("assess-1", "event-1")).rejects.toEqual(
      { message: "link failed" }
    );
  });
});

// ---------------------------------------------------------------------------
// deleteAssessment()
// ---------------------------------------------------------------------------

describe("deleteAssessment()", () => {
  it("deletes by ID", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deleteAssessment("assess-1");

    expect(mockClient.from).toHaveBeenCalledWith("site_assessments");
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "assess-1");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "delete failed" } }).then(resolve)
    );

    await expect(deleteAssessment("assess-1")).rejects.toEqual({
      message: "delete failed",
    });
  });
});
