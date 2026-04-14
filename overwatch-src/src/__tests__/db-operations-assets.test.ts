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
  getAssets,
  createAsset,
  checkoutAsset,
  checkinAsset,
  getAssetByQrCode,
  deleteAsset,
} from "@/lib/supabase/db-operations";
import { ensureInternalUser } from "@/lib/supabase/db-helpers";
import { logDbReadError } from "@/lib/supabase/db-error";

const mockedEnsureInternalUser = vi.mocked(ensureInternalUser);
const mockedLogDbReadError = vi.mocked(logDbReadError);

// ---------------------------------------------------------------------------
// Helpers
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
// getAssets()
// ---------------------------------------------------------------------------

describe("getAssets()", () => {
  it("returns assets data", async () => {
    const assets = [
      { id: "a1", name: "Radio" },
      { id: "a2", name: "Vest" },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: assets, error: null }).then(resolve)
    );

    const result = await getAssets("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("assets");
    expect(queryBuilder.select).toHaveBeenCalledWith("*, users(first_name, last_name)");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("name", { ascending: true });
    expect(result).toEqual(assets);
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "assets error" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getAssets("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("assets", dbError);
    expect(result).toEqual([]);
  });

  it("returns [] when data is null and no error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const result = await getAssets("comp-1");
    expect(result).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// createAsset()
// ---------------------------------------------------------------------------

describe("createAsset()", () => {
  it("creates asset with all params", async () => {
    const newAsset = { id: "a-new", name: "Body Cam" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: newAsset, error: null });

    const result = await createAsset({
      companyId: "comp-1",
      name: "Body Cam",
      assetType: "camera",
      serialNumber: "SN-12345",
    });

    expect(mockClient.from).toHaveBeenCalledWith("assets");
    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.company_id).toBe("comp-1");
    expect(insertArg.name).toBe("Body Cam");
    expect(insertArg.asset_type).toBe("camera");
    expect(insertArg.serial_number).toBe("SN-12345");
    expect(insertArg.id).toBeDefined();
    expect(queryBuilder.select).toHaveBeenCalled();
    expect(queryBuilder.maybeSingle).toHaveBeenCalled();
    expect(result).toEqual(newAsset);
  });

  it("creates asset with minimal params — defaults to null for optional fields", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "a-min" }, error: null });

    await createAsset({
      companyId: "comp-1",
      name: "Flashlight",
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.asset_type).toBeNull();
    expect(insertArg.serial_number).toBeNull();
  });

  it("generates QR code starting with 'ASSET-'", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "a-qr" }, error: null });

    await createAsset({
      companyId: "comp-1",
      name: "Radio",
    });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect((insertArg.qr_code as string).startsWith("ASSET-")).toBe(true);
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "asset insert failed" },
    });

    await expect(
      createAsset({ companyId: "comp-1", name: "Fail Asset" })
    ).rejects.toEqual({ message: "asset insert failed" });
  });
});

// ---------------------------------------------------------------------------
// checkoutAsset()
// ---------------------------------------------------------------------------

describe("checkoutAsset()", () => {
  it("updates asset status and inserts checkout log", async () => {
    const updatedAsset = { id: "a1", status: "checked_out", current_holder_id: "internal-user-1" };
    // First: asset update via maybeSingle
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: updatedAsset, error: null });
    // Second: asset_logs insert via .then
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const result = await checkoutAsset("a1");

    expect(mockedEnsureInternalUser).toHaveBeenCalled();
    expect(mockClient.from).toHaveBeenCalledWith("assets");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "checked_out",
        current_holder_id: "internal-user-1",
        updated_at: expect.any(String),
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "a1");
    expect(queryBuilder.select).toHaveBeenCalledWith("*, users(first_name, last_name)");
    // Verify log insertion
    expect(mockClient.from).toHaveBeenCalledWith("asset_logs");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "a1",
        user_id: "internal-user-1",
        action: "checkout",
      })
    );
    expect(result).toEqual(updatedAsset);
  });

  it("throws when unauthenticated (ensureInternalUser returns null)", async () => {
    mockedEnsureInternalUser.mockResolvedValueOnce(null);

    await expect(checkoutAsset("a1")).rejects.toThrow("Not authenticated");
  });

  it("throws on DB error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "checkout failed" },
    });

    await expect(checkoutAsset("a1")).rejects.toEqual({
      message: "checkout failed",
    });
  });
});

// ---------------------------------------------------------------------------
// checkinAsset()
// ---------------------------------------------------------------------------

describe("checkinAsset()", () => {
  it("updates asset status and inserts checkin log", async () => {
    const updatedAsset = { id: "a1", status: "available", current_holder_id: null };
    // First: asset update via maybeSingle
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: updatedAsset, error: null });
    // Second: asset_logs insert via .then
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const result = await checkinAsset("a1");

    expect(mockedEnsureInternalUser).toHaveBeenCalled();
    expect(mockClient.from).toHaveBeenCalledWith("assets");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "available",
        current_holder_id: null,
        updated_at: expect.any(String),
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "a1");
    // Verify log insertion
    expect(mockClient.from).toHaveBeenCalledWith("asset_logs");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        asset_id: "a1",
        user_id: "internal-user-1",
        action: "checkin",
      })
    );
    expect(result).toEqual(updatedAsset);
  });

  it("throws when unauthenticated (ensureInternalUser returns null)", async () => {
    mockedEnsureInternalUser.mockResolvedValueOnce(null);

    await expect(checkinAsset("a1")).rejects.toThrow("Not authenticated");
  });

  it("throws on DB error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "checkin failed" },
    });

    await expect(checkinAsset("a1")).rejects.toEqual({
      message: "checkin failed",
    });
  });
});

// ---------------------------------------------------------------------------
// getAssetByQrCode()
// ---------------------------------------------------------------------------

describe("getAssetByQrCode()", () => {
  it("returns asset found by qr_code", async () => {
    const asset = { id: "a1", name: "Radio", qr_code: "ASSET-123" };
    // First maybeSingle: found by qr_code
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: asset, error: null });

    const result = await getAssetByQrCode("comp-1", "ASSET-123");

    expect(mockClient.from).toHaveBeenCalledWith("assets");
    expect(queryBuilder.select).toHaveBeenCalledWith("*, users(first_name, last_name)");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("qr_code", "ASSET-123");
    expect(result).toEqual(asset);
  });

  it("falls back to serial_number when qr_code not found", async () => {
    // First maybeSingle: qr_code not found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Second maybeSingle: found by serial_number
    const asset = { id: "a2", name: "Vest", serial_number: "SN-999" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: asset, error: null });

    const result = await getAssetByQrCode("comp-1", "SN-999");

    expect(queryBuilder.eq).toHaveBeenCalledWith("serial_number", "SN-999");
    expect(result).toEqual(asset);
  });

  it("returns null when neither qr_code nor serial_number found", async () => {
    // Both lookups return null
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getAssetByQrCode("comp-1", "UNKNOWN-CODE");

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// deleteAsset()
// ---------------------------------------------------------------------------

describe("deleteAsset()", () => {
  it("deletes asset by id", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    await deleteAsset("a1");

    expect(mockClient.from).toHaveBeenCalledWith("assets");
    expect(queryBuilder.delete).toHaveBeenCalled();
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "a1");
  });

  it("throws on error", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "delete asset failed" } }).then(resolve)
    );

    await expect(deleteAsset("a1")).rejects.toEqual({
      message: "delete asset failed",
    });
  });
});
