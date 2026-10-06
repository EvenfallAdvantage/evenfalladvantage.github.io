import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

const { client: mockClient, setMockResponse, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import { getIntakeByToken, submitIntakeData, createIntakeToken } from "@/lib/supabase/db-client-intake";

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
});

const MISSING_RPC = { code: "PGRST202", message: "Could not find the function" };

describe("getIntakeByToken()", () => {
  it("uses the get_intake_by_token RPC", async () => {
    const row = { id: "i1", token: "t".repeat(16), status: "active", companies: { name: "Acme" } };
    mockClient.rpc.mockResolvedValueOnce({ data: row, error: null });

    const result = await getIntakeByToken("t".repeat(16));

    expect(mockClient.rpc).toHaveBeenCalledWith("get_intake_by_token", { p_token: "t".repeat(16) });
    expect(mockClient.from).not.toHaveBeenCalled();
    expect(result).toEqual(row);
  });

  it("returns null for an unknown token", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: null });
    expect(await getIntakeByToken("nope")).toBeNull();
  });

  it("falls back to the table when the RPC is not deployed yet", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: MISSING_RPC });
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "legacy" }, error: null });

    const result = await getIntakeByToken("abc");

    expect(mockClient.from).toHaveBeenCalledWith("client_intake_tokens");
    expect(result).toEqual({ id: "legacy" });
  });

  it("throws other RPC errors without falling back", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: { code: "XX000", message: "boom" } });
    await expect(getIntakeByToken("abc")).rejects.toEqual({ code: "XX000", message: "boom" });
    expect(mockClient.from).not.toHaveBeenCalled();
  });
});

describe("submitIntakeData()", () => {
  const payload = { clientName: "Pat", clientEmail: "pat@x.co", data: { venue: "Hall" } };

  it("uses the submit_intake_by_token RPC", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: { id: "i1", status: "submitted" }, error: null });

    await submitIntakeData("tok", payload);

    expect(mockClient.rpc).toHaveBeenCalledWith("submit_intake_by_token", {
      p_token: "tok", p_client_name: "Pat", p_client_email: "pat@x.co", p_data: { venue: "Hall" },
    });
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it("throws when the link is no longer active (RPC returns null)", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: null });
    await expect(submitIntakeData("tok", payload)).rejects.toThrow(/no longer active/);
  });

  it("falls back to the table update when the RPC is missing", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: MISSING_RPC });
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "i1" }, error: null });

    await submitIntakeData("tok", payload);

    expect(queryBuilder.update).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("token", "tok");
  });
});

describe("createIntakeToken()", () => {
  it("creates 32-character tokens", async () => {
    queryBuilder.single.mockResolvedValueOnce({ data: { id: "x" }, error: null });
    await createIntakeToken({ companyId: "c1", createdBy: "u1" });
    const inserted = queryBuilder.insert.mock.calls[0][0] as { token: string };
    expect(inserted.token).toMatch(/^[0-9a-f]{32}$/);
  });
});
