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

// db-incidents is used inside promotePublicReportToIncident.
vi.mock("@/lib/supabase/db-incidents", () => ({
  createIncidentEnhanced: vi.fn(),
}));

import {
  generateReportSlug,
  getPublicReportLinks,
  createPublicReportLink,
  updatePublicReportLink,
  deletePublicReportLink,
  getPublicReportLinkBySlug,
  submitPublicReport,
  getPublicReportSubmissions,
  setPublicReportSubmissionStatus,
  promotePublicReportToIncident,
  type PublicReportSubmission,
} from "@/lib/supabase/db-public-reports";
import { createIncidentEnhanced } from "@/lib/supabase/db-incidents";

const mockedCreateIncidentEnhanced = vi.mocked(createIncidentEnhanced);

const LINK_ROW = {
  id: "link-1",
  company_id: "comp-1",
  team_id: "team-1",
  slug: "abcd1234efgh5678",
  label: "Stadium West Gate",
  default_type: null,
  is_active: true,
  created_by: "user-1",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const SUBMISSION_ROW = {
  id: "sub-1",
  link_id: "link-1",
  company_id: "comp-1",
  reporter_name: "Anon",
  reporter_phone: "+15555550100",
  reporter_email: null,
  body: "Saw a fight near gate 4",
  location: "Gate 4",
  location_lat: 40.123,
  location_lng: -74.456,
  media: [],
  status: "new" as const,
  incident_id: null,
  triaged_by: null,
  triaged_at: null,
  created_at: "2026-01-01T00:00:00.000Z",
};

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  mockEnsureInternalUser.mockResolvedValue("user-123");
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve),
  );
});

// ---------------------------------------------------------------------------
// generateReportSlug
// ---------------------------------------------------------------------------

describe("generateReportSlug()", () => {
  it("returns a 16-character lowercase alphanumeric slug", () => {
    const slug = generateReportSlug();
    expect(slug).toMatch(/^[a-z2-9]{16}$/);
  });

  it("avoids ambiguous characters", () => {
    for (let i = 0; i < 200; i++) {
      const slug = generateReportSlug();
      expect(slug).not.toMatch(/[01ilo]/);
    }
  });

  it("produces different slugs on repeated calls", () => {
    const slugs = new Set<string>();
    for (let i = 0; i < 50; i++) slugs.add(generateReportSlug());
    // No collisions in 50 calls.
    expect(slugs.size).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// Links
// ---------------------------------------------------------------------------

describe("getPublicReportLinks()", () => {
  it("returns mapped links ordered by created_at desc", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [LINK_ROW], error: null }).then(resolve),
    );

    const result = await getPublicReportLinks("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("public_report_links");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(result).toEqual([
      {
        id: "link-1",
        companyId: "comp-1",
        teamId: "team-1",
        slug: "abcd1234efgh5678",
        label: "Stadium West Gate",
        defaultType: null,
        isActive: true,
        createdById: "user-1",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-01-01T00:00:00.000Z",
      },
    ]);
  });

  it("returns [] on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve),
    );

    const result = await getPublicReportLinks("comp-1");
    expect(result).toEqual([]);
  });
});

describe("createPublicReportLink()", () => {
  it("inserts with generated slug and returns mapped link", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: LINK_ROW, error: null });

    const result = await createPublicReportLink("comp-1", {
      label: "Stadium West Gate",
      teamId: "team-1",
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.company_id).toBe("comp-1");
    expect(insertArg.team_id).toBe("team-1");
    expect(insertArg.label).toBe("Stadium West Gate");
    expect(insertArg.is_active).toBe(true);
    expect(insertArg.slug).toMatch(/^[a-z2-9]{16}$/);
    expect(result?.id).toBe("link-1");
  });

  it("defaults isActive to true when omitted", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: LINK_ROW, error: null });

    await createPublicReportLink("comp-1", { label: "X" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.is_active).toBe(true);
    expect(insertArg.team_id).toBeNull();
    expect(insertArg.default_type).toBeNull();
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);
    await expect(createPublicReportLink("comp-1", { label: "X" })).rejects.toThrow("Not authenticated");
  });

  it("throws on insert error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "denied" } });
    await expect(createPublicReportLink("comp-1", { label: "X" })).rejects.toEqual({ message: "denied" });
  });
});

describe("updatePublicReportLink()", () => {
  it("only updates provided fields", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { ...LINK_ROW, is_active: false },
      error: null,
    });

    await updatePublicReportLink("link-1", { isActive: false });

    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "link-1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.is_active).toBe(false);
    expect(updateArg).not.toHaveProperty("label");
    expect(updateArg.updated_at).toBeDefined();
  });
});

describe("deletePublicReportLink()", () => {
  it("deletes and returns true on success", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    );

    const ok = await deletePublicReportLink("link-1");
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "link-1");
    expect(ok).toBe(true);
  });

  it("returns false on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "denied" } }).then(resolve),
    );

    const ok = await deletePublicReportLink("link-1");
    expect(ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Anonymous lookup + submission
// ---------------------------------------------------------------------------

describe("getPublicReportLinkBySlug()", () => {
  it("looks up by slug + is_active=true", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: LINK_ROW, error: null });

    const result = await getPublicReportLinkBySlug("abcd1234efgh5678");

    expect(queryBuilder.eq).toHaveBeenCalledWith("slug", "abcd1234efgh5678");
    expect(queryBuilder.eq).toHaveBeenCalledWith("is_active", true);
    expect(result?.slug).toBe("abcd1234efgh5678");
  });

  it("returns null on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "boom" } });
    const result = await getPublicReportLinkBySlug("x");
    expect(result).toBeNull();
  });
});

describe("submitPublicReport()", () => {
  it("inserts with status='new' and supplied fields", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: SUBMISSION_ROW, error: null });

    await submitPublicReport("link-1", "comp-1", {
      body: "Help",
      reporterPhone: "+15555550100",
      location: "Gate 4",
      locationLat: 40,
      locationLng: -74,
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.link_id).toBe("link-1");
    expect(insertArg.company_id).toBe("comp-1");
    expect(insertArg.body).toBe("Help");
    expect(insertArg.reporter_phone).toBe("+15555550100");
    expect(insertArg.status).toBe("new");
    expect(insertArg.media).toEqual([]);
  });

  it("supports media array", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: SUBMISSION_ROW, error: null });
    await submitPublicReport("link-1", "comp-1", {
      body: "Help",
      media: [{ path: "uploads/a.jpg", mime: "image/jpeg" }],
    });
    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.media).toEqual([{ path: "uploads/a.jpg", mime: "image/jpeg" }]);
  });
});

// ---------------------------------------------------------------------------
// Triage
// ---------------------------------------------------------------------------

describe("getPublicReportSubmissions()", () => {
  it("filters by status when provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [SUBMISSION_ROW], error: null }).then(resolve),
    );

    await getPublicReportSubmissions("comp-1", { status: "new" });

    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("status", "new");
  });
});

describe("setPublicReportSubmissionStatus()", () => {
  it("updates status + triage metadata", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { ...SUBMISSION_ROW, status: "dismissed" },
      error: null,
    });

    await setPublicReportSubmissionStatus("sub-1", "dismissed");

    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "sub-1");
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.status).toBe("dismissed");
    expect(updateArg.triaged_by).toBe("user-123");
    expect(updateArg.triaged_at).toBeDefined();
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);
    await expect(setPublicReportSubmissionStatus("sub-1", "dismissed")).rejects.toThrow("Not authenticated");
  });
});

describe("promotePublicReportToIncident()", () => {
  const submission: PublicReportSubmission = {
    id: "sub-1",
    linkId: "link-1",
    companyId: "comp-1",
    reporterName: null,
    reporterPhone: null,
    reporterEmail: null,
    body: "Body content",
    location: "Gate 4",
    locationLat: null,
    locationLng: null,
    media: [],
    status: "new",
    incidentId: null,
    triagedById: null,
    triagedAt: null,
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  it("creates an incident with source='public' and updates the submission", async () => {
    mockedCreateIncidentEnhanced.mockResolvedValueOnce({ id: "inc-1" });
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: { ...SUBMISSION_ROW, status: "promoted", incident_id: "inc-1" },
      error: null,
    });

    const result = await promotePublicReportToIncident(submission, { teamId: "team-1" });

    expect(mockedCreateIncidentEnhanced).toHaveBeenCalledWith(
      "comp-1",
      expect.objectContaining({
        description: "Body content",
        location: "Gate 4",
        source: "public",
        teamId: "team-1",
      }),
    );
    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.status).toBe("promoted");
    expect(updateArg.incident_id).toBe("inc-1");
    expect(result?.incidentId).toBe("inc-1");
  });

  it("truncates long bodies into title", async () => {
    mockedCreateIncidentEnhanced.mockResolvedValueOnce({ id: "inc-2" });
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: SUBMISSION_ROW, error: null });

    const longBody = "x".repeat(200);
    await promotePublicReportToIncident({ ...submission, body: longBody });

    const incArg = mockedCreateIncidentEnhanced.mock.calls[0][1];
    expect(incArg.title.length).toBeLessThanOrEqual(80);
    expect(incArg.title.endsWith("...")).toBe(true);
  });

  it("returns null when incident creation fails", async () => {
    mockedCreateIncidentEnhanced.mockResolvedValueOnce(null);
    const result = await promotePublicReportToIncident(submission);
    expect(result).toBeNull();
  });

  it("throws when unauthenticated", async () => {
    mockEnsureInternalUser.mockResolvedValueOnce(null);
    await expect(promotePublicReportToIncident(submission)).rejects.toThrow("Not authenticated");
  });
});
