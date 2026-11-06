import { afterEach, describe, expect, it, vi } from "vitest";

const getUser = vi.fn();
const getSession = vi.fn();
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({ auth: { getUser, getSession } }),
}));

import { runIntegrationAction } from "@/lib/supabase/db-integrations";

const fetchMock = vi.fn();

afterEach(() => {
  vi.clearAllMocks();
  delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
});

describe("integration action request", () => {
  it("sends the user bearer and the public apikey to the configured functions endpoint", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co/";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_public_test";
    getUser.mockResolvedValue({ data: { user: { id: "auth-user" } }, error: null });
    getSession.mockResolvedValue({ data: { session: { access_token: "user.access.token" } } });
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ ok: true, result: { bases: [] } }), { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await runIntegrationAction("company-1", "airtable", "list_bases");

    expect(getUser).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://example.supabase.co/functions/v1/integration-action");
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer user.access.token");
    expect(headers.apikey).toBe("sb_publishable_public_test");
    expect(headers.Authorization).not.toContain("sb_publishable_public_test");
    expect(JSON.parse(String(init.body))).toEqual({
      company_id: "company-1",
      provider: "airtable",
      action: "list_bases",
      input: {},
    });
  });

  it("does not call the function when the session cannot be refreshed", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "sb_publishable_public_test";
    getUser.mockResolvedValue({ data: { user: null }, error: new Error("expired") });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    await expect(runIntegrationAction("company-1", "airtable", "list_bases")).rejects.toThrow("Not signed in");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
