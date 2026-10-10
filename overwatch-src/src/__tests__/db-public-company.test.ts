import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

const { client: mockClient, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import { getPublicCompany } from "@/lib/supabase/db-public-company";

const row = {
  id: "comp-1", name: "Acme", slug: "acme", logo_url: null,
  brand_color: "#000", accent_color: null, website_url: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getPublicCompany()", () => {
  it("uses the get_public_company RPC by id (no direct companies read)", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: [row], error: null });
    const result = await getPublicCompany({ id: "comp-1" });
    expect(mockClient.rpc).toHaveBeenCalledWith("get_public_company", { p_company_id: "comp-1", p_slug: null });
    expect(mockClient.from).not.toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it("looks up by slug", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: [row], error: null });
    await getPublicCompany({ slug: "acme" });
    expect(mockClient.rpc).toHaveBeenCalledWith("get_public_company", { p_company_id: null, p_slug: "acme" });
  });

  it("returns null when the RPC finds nothing", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: [], error: null });
    expect(await getPublicCompany({ slug: "nope" })).toBeNull();
  });

  it("falls back to the table only when the RPC is not deployed yet", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: { code: "PGRST202", message: "missing" } });
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: row, error: null });
    const result = await getPublicCompany({ id: "comp-1" });
    expect(mockClient.from).toHaveBeenCalledWith("companies");
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "comp-1");
    expect(result).toEqual(row);
  });

  it("returns null on other RPC errors without touching the table", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: { code: "42501", message: "denied" } });
    expect(await getPublicCompany({ id: "comp-1" })).toBeNull();
    expect(mockClient.from).not.toHaveBeenCalled();
  });
});
