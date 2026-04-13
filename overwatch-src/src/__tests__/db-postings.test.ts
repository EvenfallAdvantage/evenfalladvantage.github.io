import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
const { client: mockClient, setMockResponse, setAuthUser, queryBuilder } =
  createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

// Mock ensureInternalUser from db-helpers (used by createJobPosting)
vi.mock("@/lib/supabase/db-helpers", () => ({
  ensureInternalUser: vi.fn(),
  ts: () => {
    const now = new Date().toISOString();
    return { created_at: now, updated_at: now };
  },
}));

import {
  generateJobFeedXML,
  getPostingApplicantCounts,
  createJobPosting,
  publishPosting,
  closePosting,
  getActivePostingsBySlug,
  type JobPosting,
} from "@/lib/supabase/db-postings";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";

const mockedEnsureInternalUser = vi.mocked(ensureInternalUser);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePosting(overrides: Partial<JobPosting> = {}): JobPosting {
  return {
    id: "post-1",
    company_id: "comp-1",
    title: "Security Guard",
    department: null,
    location: null,
    employment_type: null,
    description_html: "<p>Great opportunity</p>",
    requirements: null,
    compensation_range: null,
    show_compensation: false,
    status: "active",
    external_ids: {},
    created_by: null,
    published_at: "2026-01-15T00:00:00.000Z",
    closed_at: null,
    created_at: "2026-01-10T00:00:00.000Z",
    updated_at: "2026-01-10T00:00:00.000Z",
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  setAuthUser(null);
  mockedEnsureInternalUser.mockResolvedValue(null);
});

// ---------------------------------------------------------------------------
// generateJobFeedXML()
// ---------------------------------------------------------------------------

describe("generateJobFeedXML()", () => {
  const company = { name: "Evenfall Security", slug: "evenfall" };
  const baseUrl = "https://example.com";

  it("generates valid XML with correct structure", () => {
    const posting = makePosting();
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<source>");
    expect(xml).toContain("</source>");
    expect(xml).toContain("<job>");
    expect(xml).toContain("</job>");
  });

  it("wraps description in CDATA", () => {
    const posting = makePosting({ description_html: "<p>Job description</p>" });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).toContain("<description><![CDATA[Job description]]></description>");
  });

  it("includes required fields (title, description, company)", () => {
    const posting = makePosting({ title: "Night Watch" });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).toContain("<title><![CDATA[Night Watch]]></title>");
    expect(xml).toContain("<company><![CDATA[Evenfall Security]]></company>");
    expect(xml).toContain("<description>");
  });

  it("handles empty postings array (returns XML with empty channel)", () => {
    const xml = generateJobFeedXML([], company, baseUrl);

    expect(xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(xml).toContain("<source>");
    expect(xml).toContain("<publisher>Evenfall Security</publisher>");
    expect(xml).not.toContain("<job>");
  });

  it("wraps title in CDATA to handle special characters", () => {
    const posting = makePosting({ title: "Guard & Patrol <Night>" });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).toContain("<title><![CDATA[Guard & Patrol <Night>]]></title>");
  });

  it("includes compensation when show_compensation is true", () => {
    const posting = makePosting({
      compensation_range: "$50k - $60k",
      show_compensation: true,
    });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).toContain("<salary><![CDATA[$50k - $60k]]></salary>");
  });

  it("omits compensation when show_compensation is false", () => {
    const posting = makePosting({
      compensation_range: "$50k - $60k",
      show_compensation: false,
    });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).not.toContain("<salary>");
  });

  it("omits compensation when compensation_range is null even if show_compensation is true", () => {
    const posting = makePosting({
      compensation_range: null,
      show_compensation: true,
    });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).not.toContain("<salary>");
  });

  it("includes location when present", () => {
    const posting = makePosting({ location: "Los Angeles, CA" });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).toContain("<city><![CDATA[Los Angeles, CA]]></city>");
  });

  it("omits location when null", () => {
    const posting = makePosting({ location: null });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).not.toContain("<city>");
  });

  it("includes job type when present", () => {
    const posting = makePosting({ employment_type: "full-time" });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).toContain("<jobtype>full-time</jobtype>");
  });

  it("omits job type when null", () => {
    const posting = makePosting({ employment_type: null });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).not.toContain("<jobtype>");
  });

  it("generates correct job URLs with base URL + posting ID", () => {
    const posting = makePosting({ id: "abc-123" });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).toContain(
      "<url>https://example.com/overwatch/careers/evenfall/abc-123</url>"
    );
  });

  it("includes publisher URL in source", () => {
    const xml = generateJobFeedXML([makePosting()], company, baseUrl);

    expect(xml).toContain(
      "<publisherurl>https://example.com/overwatch/careers/evenfall</publisherurl>"
    );
  });

  it("uses published_at for date, falling back to created_at", () => {
    const withPublished = makePosting({
      published_at: "2026-03-01T00:00:00.000Z",
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const xml1 = generateJobFeedXML([withPublished], company, baseUrl);
    expect(xml1).toContain("<date>2026-03-01T00:00:00.000Z</date>");

    const withoutPublished = makePosting({
      published_at: null,
      created_at: "2026-01-01T00:00:00.000Z",
    });
    const xml2 = generateJobFeedXML([withoutPublished], company, baseUrl);
    expect(xml2).toContain("<date>2026-01-01T00:00:00.000Z</date>");
  });

  it("strips HTML tags from description", () => {
    const posting = makePosting({
      description_html: "<h1>Title</h1><p>Body with <strong>bold</strong></p>",
    });
    const xml = generateJobFeedXML([posting], company, baseUrl);

    expect(xml).toContain("<description><![CDATA[TitleBody with bold]]></description>");
  });
});

// ---------------------------------------------------------------------------
// getPostingApplicantCounts()
// ---------------------------------------------------------------------------

describe("getPostingApplicantCounts()", () => {
  it("aggregates rows into Record<string, number>", async () => {
    setMockResponse({
      data: [
        { posting_id: "post-1" },
        { posting_id: "post-1" },
        { posting_id: "post-2" },
      ],
      error: null,
    });

    const counts = await getPostingApplicantCounts("comp-1");
    expect(counts).toEqual({ "post-1": 2, "post-2": 1 });
    expect(mockClient.from).toHaveBeenCalledWith("applicants");
  });

  it("returns empty object when no data", async () => {
    setMockResponse({ data: [], error: null });
    const counts = await getPostingApplicantCounts("comp-1");
    expect(counts).toEqual({});
  });

  it("returns empty object on error", async () => {
    setMockResponse({ data: null, error: { message: "db error" } });
    const counts = await getPostingApplicantCounts("comp-1");
    expect(counts).toEqual({});
  });

  it("counts correctly with multiple applicants per posting", async () => {
    setMockResponse({
      data: [
        { posting_id: "a" },
        { posting_id: "a" },
        { posting_id: "a" },
        { posting_id: "b" },
        { posting_id: "b" },
        { posting_id: "c" },
      ],
      error: null,
    });

    const counts = await getPostingApplicantCounts("comp-1");
    expect(counts).toEqual({ a: 3, b: 2, c: 1 });
  });
});

// ---------------------------------------------------------------------------
// createJobPosting()
// ---------------------------------------------------------------------------

describe("createJobPosting()", () => {
  it("calls insert with correct params including created_by from auth", async () => {
    mockedEnsureInternalUser.mockResolvedValue("internal-user-1");
    const postingData = {
      id: "new-post",
      company_id: "comp-1",
      title: "Guard",
      description_html: "<p>Desc</p>",
      created_by: "internal-user-1",
    };
    setMockResponse({ data: postingData, error: null });

    await createJobPosting("comp-1", {
      title: "Guard",
      description_html: "<p>Desc</p>",
    });

    expect(mockClient.from).toHaveBeenCalledWith("job_postings");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        company_id: "comp-1",
        title: "Guard",
        description_html: "<p>Desc</p>",
        created_by: "internal-user-1",
      })
    );
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(queryBuilder.single).toHaveBeenCalled();
  });

  it("returns created posting data", async () => {
    mockedEnsureInternalUser.mockResolvedValue("user-1");
    const postingData = makePosting({ id: "created-id" });
    setMockResponse({ data: postingData, error: null });

    const result = await createJobPosting("comp-1", {
      title: "Guard",
      description_html: "<p>Desc</p>",
    });

    expect(result).toEqual(postingData);
  });

  it("throws when DB returns an error", async () => {
    mockedEnsureInternalUser.mockResolvedValue("user-1");
    setMockResponse({ data: null, error: { message: "insert failed" } });

    await expect(
      createJobPosting("comp-1", {
        title: "Guard",
        description_html: "<p>Desc</p>",
      })
    ).rejects.toEqual({ message: "insert failed" });
  });
});

// ---------------------------------------------------------------------------
// publishPosting()
// ---------------------------------------------------------------------------

describe("publishPosting()", () => {
  it("sets status to 'active' and published_at to now", async () => {
    setMockResponse({ data: null, error: null });
    await publishPosting("post-1");

    expect(mockClient.from).toHaveBeenCalledWith("job_postings");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "active",
        published_at: expect.any(String),
        updated_at: expect.any(String),
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "post-1");
  });

  it("throws on error", async () => {
    setMockResponse({ data: null, error: { message: "publish failed" } });

    // The update chain returns queryBuilder → eq returns queryBuilder →
    // queryBuilder resolves via .then, which returns { data, error }.
    // But publishPosting does not call .single() — it relies on the
    // promise resolution of the chain. Let's check actual behavior.
    // Actually, the chain `update().eq()` — eq returns `this` which is thenable.
    // The await resolves via the builder's `.then`, which calls terminal().
    await expect(publishPosting("post-1")).rejects.toEqual({
      message: "publish failed",
    });
  });
});

// ---------------------------------------------------------------------------
// closePosting()
// ---------------------------------------------------------------------------

describe("closePosting()", () => {
  it("sets status to 'closed' and closed_at to now", async () => {
    setMockResponse({ data: null, error: null });
    await closePosting("post-1");

    expect(mockClient.from).toHaveBeenCalledWith("job_postings");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "closed",
        closed_at: expect.any(String),
        updated_at: expect.any(String),
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "post-1");
  });

  it("throws on error", async () => {
    setMockResponse({ data: null, error: { message: "close failed" } });
    await expect(closePosting("post-1")).rejects.toEqual({
      message: "close failed",
    });
  });
});

// ---------------------------------------------------------------------------
// getActivePostingsBySlug()
// ---------------------------------------------------------------------------

describe("getActivePostingsBySlug()", () => {
  it("looks up company by slug then queries postings", async () => {
    // The mock returns the same response for all queries, so we need to
    // set up sequential responses. Since our mock uses a single shared
    // response, we'll use mockImplementation on maybeSingle and then.

    // First call: company lookup via maybeSingle
    const companyData = {
      id: "comp-1",
      name: "Acme",
      logo_url: null,
      brand_color: "#000",
      slug: "acme",
    };

    // For the company lookup (maybeSingle)
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: companyData,
      error: null,
    });

    // For the postings query (thenable resolution)
    const postingsData = [makePosting()];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: postingsData, error: null }).then(resolve)
    );

    const result = await getActivePostingsBySlug("acme");

    expect(mockClient.from).toHaveBeenCalledWith("companies");
    expect(queryBuilder.eq).toHaveBeenCalledWith("slug", "acme");
    expect(result).not.toBeNull();
    expect(result!.company).toEqual(companyData);
    expect(result!.postings).toEqual(postingsData);
  });

  it("returns null when company not found", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const result = await getActivePostingsBySlug("nonexistent");
    expect(result).toBeNull();
  });

  it("returns empty postings array when no active postings", async () => {
    const companyData = {
      id: "comp-1",
      name: "Acme",
      logo_url: null,
      brand_color: "#000",
      slug: "acme",
    };

    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: companyData,
      error: null,
    });

    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    const result = await getActivePostingsBySlug("acme");
    expect(result).not.toBeNull();
    expect(result!.postings).toEqual([]);
  });
});
