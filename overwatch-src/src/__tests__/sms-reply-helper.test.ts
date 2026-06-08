import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

const { client: mockClient } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

vi.mock("@/lib/supabase/db-error", () => ({
  logDbReadError: vi.fn(),
}));

vi.mock("@/lib/supabase/db-helpers", () => ({
  ts: () => ({ created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }),
  ensureInternalUser: vi.fn(),
}));

vi.mock("@/lib/supabase/db-incidents", () => ({
  createIncidentEnhanced: vi.fn(),
}));

import { replyToReporterViaSms } from "@/lib/supabase/db-public-reports";

describe("replyToReporterViaSms()", () => {
  const originalEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const fetchSpy = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    (global as { fetch: unknown }).fetch = fetchSpy;
  });

  function setSession(session: { access_token: string } | null) {
    (mockClient.auth as { getSession: ReturnType<typeof vi.fn> }).getSession = vi
      .fn()
      .mockResolvedValue({ data: { session }, error: null });
  }

  it("returns error when no session", async () => {
    setSession(null);
    const result = await replyToReporterViaSms("sub-1", "hi");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/signed in/i);
  });

  it("returns error when env URL missing", async () => {
    setSession({ access_token: "tok" });
    process.env.NEXT_PUBLIC_SUPABASE_URL = "";
    const result = await replyToReporterViaSms("sub-1", "hi");
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/Supabase URL/);
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  });

  it("POSTs to sms-reply-to-reporter and returns ok on success", async () => {
    setSession({ access_token: "tok" });
    fetchSpy.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: true }),
    });

    const result = await replyToReporterViaSms("sub-1", "hi");

    expect(result.ok).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://example.supabase.co/functions/v1/sms-reply-to-reporter",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Bearer tok",
          "Content-Type": "application/json",
        }),
        body: JSON.stringify({ submission_id: "sub-1", body: "hi" }),
      }),
    );
  });

  it("returns error from non-OK response", async () => {
    setSession({ access_token: "tok" });
    fetchSpy.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: "Rate limit exceeded" }),
    });

    const result = await replyToReporterViaSms("sub-1", "hi");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("Rate limit exceeded");
  });

  it("returns generic error on fetch failure", async () => {
    setSession({ access_token: "tok" });
    fetchSpy.mockRejectedValueOnce(new Error("network down"));

    const result = await replyToReporterViaSms("sub-1", "hi");
    expect(result.ok).toBe(false);
    expect(result.error).toBe("network down");
  });

  afterAll();
  function afterAll() {
    if (originalEnv !== undefined) {
      process.env.NEXT_PUBLIC_SUPABASE_URL = originalEnv;
    }
  }
});
