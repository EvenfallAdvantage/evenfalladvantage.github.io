import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------
const { client: mockClient, setMockResponse, queryBuilder, setAuthUser } =
  createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

const mockGetAuthUserId = vi.fn<() => Promise<string | null>>().mockResolvedValue("auth-123");
const mockEnsureInternalUser = vi.fn().mockResolvedValue("internal-123");

vi.mock("@/lib/supabase/db-helpers", () => ({
  ts: () => ({ created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }),
  getAuthUserId: (...args: unknown[]) => mockGetAuthUserId(...(args as [])),
  ensureInternalUser: (...args: unknown[]) => mockEnsureInternalUser(...(args as [])),
}));

vi.mock("@/lib/supabase/db-error", () => ({
  logDbReadError: vi.fn(),
}));

import {
  upsertUser,
  fetchUserProfile,
  createCompany,
  findCompanyByJoinCode,
  createMembership,
  createCompanyWithOwner,
  joinCompanyByCode,
  updateMemberRole,
  removeMember,
  uploadAvatar,
  uploadCompanyLogo,
  updateUserProfile,
  getCompanyMembers,
  getCompanyDetails,
  updateCompany,
  updateCompanySettings,
  registerUserInDB,
} from "@/lib/supabase/db-users";
import { logDbReadError } from "@/lib/supabase/db-error";

const mockedLogDbReadError = vi.mocked(logDbReadError);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  mockGetAuthUserId.mockResolvedValue("auth-123");
  mockEnsureInternalUser.mockResolvedValue("internal-123");
  setAuthUser(null);
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
});

// ===========================================================================
// upsertUser()
// ===========================================================================

describe("upsertUser()", () => {
  const baseData = {
    supabaseId: "auth-123",
    email: "test@example.com",
    phone: "+15551234567",
    firstName: "John",
    lastName: "Doe",
    avatarUrl: "https://example.com/avatar.jpg",
  };

  it("updates existing user — only non-empty fields", async () => {
    const existing = { id: "user-1", supabase_id: "auth-123", first_name: "Old", last_name: "Name" };
    const updated = { ...existing, first_name: "John", last_name: "Doe" };

    // First call: select existing user → found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: existing, error: null });
    // Second call: update → success
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: updated, error: null });

    const result = await upsertUser(baseData);

    expect(mockClient.from).toHaveBeenCalledWith("users");
    expect(queryBuilder.eq).toHaveBeenCalledWith("supabase_id", "auth-123");
    expect(queryBuilder.update).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "test@example.com",
        phone: "+15551234567",
        first_name: "John",
        last_name: "Doe",
        avatar_url: "https://example.com/avatar.jpg",
      })
    );
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "user-1");
    expect(result).toEqual(updated);
  });

  it("existing user — skips empty firstName/lastName in update", async () => {
    const existing = { id: "user-1", supabase_id: "auth-123" };
    const updated = { ...existing };

    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: existing, error: null });
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: updated, error: null });

    await upsertUser({ ...baseData, firstName: "", lastName: "  ", email: null, phone: null, avatarUrl: null });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).not.toHaveProperty("first_name");
    expect(updateArg).not.toHaveProperty("last_name");
    expect(updateArg).not.toHaveProperty("email");
    expect(updateArg).not.toHaveProperty("phone");
    expect(updateArg).not.toHaveProperty("avatar_url");
    expect(updateArg).toHaveProperty("updated_at");
  });

  it("existing user — returns existing on update conflict", async () => {
    const existing = { id: "user-1", supabase_id: "auth-123" };

    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: existing, error: null });
    // Update throws (conflict)
    queryBuilder.maybeSingle.mockRejectedValueOnce({ code: "23505", message: "conflict" });

    const result = await upsertUser(baseData);
    expect(result).toEqual(existing);
  });

  it("existing user — returns existing when update returns null data", async () => {
    const existing = { id: "user-1", supabase_id: "auth-123" };

    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: existing, error: null });
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await upsertUser(baseData);
    expect(result).toEqual(existing);
  });

  it("creates new user when no existing user found", async () => {
    const created = { id: "new-user", supabase_id: "auth-123", first_name: "John" };

    queryBuilder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })   // select → not found
      .mockResolvedValueOnce({ data: created, error: null }); // insert → success

    const result = await upsertUser(baseData);

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        supabase_id: "auth-123",
        email: "test@example.com",
        phone: "+15551234567",
        first_name: "John",
        last_name: "Doe",
        avatar_url: "https://example.com/avatar.jpg",
      })
    );
    expect(result).toEqual(created);
  });

  it("new user — sets phone to null when phone is empty string", async () => {
    queryBuilder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: { id: "new" }, error: null });

    await upsertUser({ ...baseData, phone: "" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.phone).toBeNull();
  });

  it("new user — retries without phone on users_phone_key conflict", async () => {
    const retried = { id: "retry-user", phone: null };

    queryBuilder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })   // select → not found
      .mockResolvedValueOnce({ data: null, error: { message: "duplicate key violates unique constraint \"users_phone_key\"", code: "23505" } }) // insert → phone conflict
      .mockResolvedValueOnce({ data: retried, error: null }); // retry insert → success

    const result = await upsertUser(baseData);

    // Second insert should have phone: null
    const retryInsert = queryBuilder.insert.mock.calls[1][0] as Record<string, unknown>;
    expect(retryInsert.phone).toBeNull();
    expect(result).toEqual(retried);
  });

  it("new user — throws on retry phone-key error", async () => {
    queryBuilder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "users_phone_key", code: "23505" } })
      .mockResolvedValueOnce({ data: null, error: { message: "second failure", code: "500" } });

    await expect(upsertUser(baseData)).rejects.toEqual({ message: "second failure", code: "500" });
  });

  it("new user — throws on non-phone-key insert error", async () => {
    queryBuilder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: { message: "some other error", code: "500" } });

    await expect(upsertUser(baseData)).rejects.toEqual({ message: "some other error", code: "500" });
  });
});

// ===========================================================================
// fetchUserProfile()
// ===========================================================================

describe("fetchUserProfile()", () => {
  it("returns null when not authenticated", async () => {
    mockGetAuthUserId.mockResolvedValueOnce(null);
    const result = await fetchUserProfile();
    expect(result).toBeNull();
  });

  it("uses knownAuthId when provided", async () => {
    const user = { id: "user-1", supabase_id: "known-id" };
    const memberships = [{ id: "m1", role: "owner" }];

    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: user, error: null });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: memberships, error: null }).then(resolve)
    );

    const result = await fetchUserProfile("known-id");

    expect(queryBuilder.eq).toHaveBeenCalledWith("supabase_id", "known-id");
    expect(result).toEqual({ user, memberships });
    // Should NOT have called getAuthUserId since knownAuthId provided
    expect(mockGetAuthUserId).not.toHaveBeenCalled();
  });

  it("returns user with memberships when user exists", async () => {
    const user = { id: "user-1", supabase_id: "auth-123" };
    const memberships = [{ id: "m1", role: "owner", companies: { name: "ACME" } }];

    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: user, error: null });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: memberships, error: null }).then(resolve)
    );

    const result = await fetchUserProfile();

    expect(result).toEqual({ user, memberships });
    expect(queryBuilder.eq).toHaveBeenCalledWith("user_id", "user-1");
  });

  it("returns empty memberships array when membership query returns null", async () => {
    const user = { id: "user-1", supabase_id: "auth-123" };

    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: user, error: null });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const result = await fetchUserProfile();
    expect(result).toEqual({ user, memberships: [] });
  });

  it("auto-creates user from auth metadata when user not found in DB", async () => {
    const authUser = {
      id: "auth-123",
      email: "test@example.com",
      phone: "+15551234567",
      user_metadata: { first_name: "Jane", last_name: "Doe", phone: "+15557654321" },
    };
    const created = { id: "new-user", supabase_id: "auth-123" };

    // First select → not found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // auth.getUser
    setAuthUser(authUser);
    // insert → success
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: created, error: null });
    // memberships query
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    const result = await fetchUserProfile();

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        supabase_id: "auth-123",
        email: "test@example.com",
        phone: "+15551234567",
        first_name: "Jane",
        last_name: "Doe",
      })
    );
    expect(result).toEqual({ user: created, memberships: [] });
  });

  it("auto-create — uses metadata phone when auth phone is missing", async () => {
    const authUser = {
      id: "auth-123",
      email: "test@example.com",
      phone: null,
      user_metadata: { first_name: "Jane", last_name: "Doe", phone: "+15559999999" },
    };
    const created = { id: "new-user", supabase_id: "auth-123" };

    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    setAuthUser(authUser);
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: created, error: null });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    await fetchUserProfile();

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.phone).toBe("+15559999999");
  });

  it("auto-create — returns null when auth.getUser returns no user", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    setAuthUser(null);

    const result = await fetchUserProfile();
    expect(result).toBeNull();
  });

  it("auto-create — handles race condition (insert fails, retry select succeeds)", async () => {
    const authUser = {
      id: "auth-123",
      email: "test@example.com",
      user_metadata: {},
    };
    const retryUser = { id: "race-user", supabase_id: "auth-123" };

    // First select → not found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    setAuthUser(authUser);
    // Insert → error (race condition)
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: { message: "duplicate key", code: "23505" } });
    // Retry select → found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: retryUser, error: null });
    // Memberships
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    const result = await fetchUserProfile();
    expect(result).toEqual({ user: retryUser, memberships: [] });
  });

  it("auto-create — handles phone-key conflict on insert (retries without phone)", async () => {
    const authUser = {
      id: "auth-123",
      email: "test@example.com",
      phone: "+15551234567",
      user_metadata: { first_name: "Jane", last_name: "Doe" },
    };
    const retried = { id: "phone-retry-user", supabase_id: "auth-123" };

    // First select → not found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    setAuthUser(authUser);
    // Insert → phone_key error
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "users_phone_key conflict", code: "23505" },
    });
    // Retry select (race condition check) → not found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Retry insert without phone → success
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: retried, error: null });
    // Memberships
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve)
    );

    const result = await fetchUserProfile();

    // Second insert should have phone: null
    const retryInsert = queryBuilder.insert.mock.calls[1][0] as Record<string, unknown>;
    expect(retryInsert.phone).toBeNull();
    expect(result).toEqual({ user: retried, memberships: [] });
  });

  it("auto-create — returns null when insert fails with non-phone error and retry select fails", async () => {
    const authUser = {
      id: "auth-123",
      email: "test@example.com",
      user_metadata: {},
    };

    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    setAuthUser(authUser);
    // Insert → error
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "some error", code: "500" },
    });
    // Retry select → also not found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await fetchUserProfile();
    expect(result).toBeNull();
  });

  it("auto-create — returns null when created is null (no error)", async () => {
    const authUser = {
      id: "auth-123",
      email: "test@example.com",
      user_metadata: {},
    };

    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    setAuthUser(authUser);
    // Insert → returns null data, no error
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await fetchUserProfile();
    expect(result).toBeNull();
  });

  it("auto-create — phone-key retry returns null when second insert fails", async () => {
    const authUser = {
      id: "auth-123",
      email: "test@example.com",
      phone: "+15551234567",
      user_metadata: {},
    };

    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    setAuthUser(authUser);
    // Insert → phone_key error
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "users_phone_key conflict", code: "23505" },
    });
    // Retry select → not found
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
    // Retry insert without phone → also fails (returns null)
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await fetchUserProfile();
    expect(result).toBeNull();
  });
});

// ===========================================================================
// createCompany()
// ===========================================================================

describe("createCompany()", () => {
  it("creates a company with slug from name", async () => {
    const company = { id: "comp-1", name: "My Company", slug: "my-company" };
    queryBuilder.single.mockResolvedValueOnce({ data: company, error: null });

    const result = await createCompany({ name: "My Company" });

    expect(mockClient.from).toHaveBeenCalledWith("companies");
    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "My Company",
        slug: "my-company",
        brand_color: "#1d3451",
        accent_color: "#d59b3c",
        timezone: "America/Los_Angeles",
        settings: {},
      })
    );
    expect(result).toEqual(company);
  });

  it("generates slug with special chars stripped", async () => {
    const company = { id: "comp-1", slug: "acme-inc" };
    queryBuilder.single.mockResolvedValueOnce({ data: company, error: null });

    await createCompany({ name: "ACME Inc." });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.slug).toBe("acme-inc");
  });

  it("uses provided brand and accent colors", async () => {
    queryBuilder.single.mockResolvedValueOnce({ data: { id: "comp-1" }, error: null });

    await createCompany({ name: "Colorful", brandColor: "#ff0000", accentColor: "#00ff00" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.brand_color).toBe("#ff0000");
    expect(insertArg.accent_color).toBe("#00ff00");
  });

  it("handles duplicate slug (23505) — returns existing company", async () => {
    const existing = { id: "comp-existing", slug: "my-company" };

    queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: "duplicate slug", code: "23505" },
    });
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: existing, error: null });

    const result = await createCompany({ name: "My Company" });

    expect(queryBuilder.eq).toHaveBeenCalledWith("slug", "my-company");
    expect(result).toEqual(existing);
  });

  it("throws on duplicate slug when existing not found", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: "duplicate slug", code: "23505" },
    });
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    await expect(createCompany({ name: "Ghost" })).rejects.toEqual({
      message: "duplicate slug",
      code: "23505",
    });
  });

  it("throws on non-23505 insert error", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: "db failure", code: "500" },
    });

    await expect(createCompany({ name: "Fail" })).rejects.toEqual({
      message: "db failure",
      code: "500",
    });
  });
});

// ===========================================================================
// findCompanyByJoinCode()
// ===========================================================================

describe("findCompanyByJoinCode()", () => {
  it("returns company for valid code (uppercased and trimmed)", async () => {
    const company = { id: "comp-1", join_code: "ABC123" };
    queryBuilder.single.mockResolvedValueOnce({ data: company, error: null });

    const result = await findCompanyByJoinCode("  abc123 ");

    expect(queryBuilder.eq).toHaveBeenCalledWith("join_code", "ABC123");
    expect(result).toEqual(company);
  });

  it("returns null on error (not found)", async () => {
    queryBuilder.single.mockResolvedValueOnce({
      data: null,
      error: { message: "not found", code: "PGRST116" },
    });

    const result = await findCompanyByJoinCode("XXXXXX");
    expect(result).toBeNull();
  });
});

// ===========================================================================
// createMembership()
// ===========================================================================

describe("createMembership()", () => {
  it("creates membership with defaults", async () => {
    const membership = { id: "m1", user_id: "u1", company_id: "c1", role: "staff" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: membership, error: null });

    const result = await createMembership({ userId: "u1", companyId: "c1" });

    expect(queryBuilder.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: "u1",
        company_id: "c1",
        role: "staff",
        status: "active",
        work_preferences: [],
        notification_days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      })
    );
    expect(result).toEqual(membership);
  });

  it("uses provided role", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "m1" }, error: null });

    await createMembership({ userId: "u1", companyId: "c1", role: "owner" });

    const insertArg = queryBuilder.insert.mock.calls[0][0] as Record<string, unknown>;
    expect(insertArg.role).toBe("owner");
  });

  it("handles duplicate (23505) — returns existing membership", async () => {
    const existing = { id: "m-existing", user_id: "u1", company_id: "c1" };

    queryBuilder.maybeSingle
      .mockResolvedValueOnce({ data: null, error: { message: "duplicate", code: "23505" } })
      .mockResolvedValueOnce({ data: existing, error: null });

    const result = await createMembership({ userId: "u1", companyId: "c1" });

    expect(queryBuilder.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "c1");
    expect(result).toEqual(existing);
  });

  it("throws on non-23505 error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "db error", code: "500" },
    });

    await expect(createMembership({ userId: "u1", companyId: "c1" })).rejects.toEqual({
      message: "db error",
      code: "500",
    });
  });
});

// ===========================================================================
// createCompanyWithOwner()
// ===========================================================================

describe("createCompanyWithOwner()", () => {
  const params = {
    companyName: "ACME Corp",
    supabaseId: "auth-123",
    email: "test@example.com",
    phone: "+15551234567",
    firstName: "John",
    lastName: "Doe",
  };

  it("calls rpc with correct params and returns data", async () => {
    const rpcResult = {
      user: { id: "u1" },
      company: { id: "c1" },
      membership: { id: "m1" },
    };
    mockClient.rpc.mockResolvedValueOnce({ data: rpcResult, error: null });

    const result = await createCompanyWithOwner(params);

    expect(mockClient.rpc).toHaveBeenCalledWith("create_company_with_owner", {
      p_company_name: "ACME Corp",
      p_supabase_id: "auth-123",
      p_email: "test@example.com",
      p_phone: "+15551234567",
      p_first_name: "John",
      p_last_name: "Doe",
    });
    expect(result).toEqual(rpcResult);
  });

  it("defaults optional params", async () => {
    const rpcResult = { user: {}, company: {}, membership: {} };
    mockClient.rpc.mockResolvedValueOnce({ data: rpcResult, error: null });

    await createCompanyWithOwner({ companyName: "Test", supabaseId: "auth-456" });

    expect(mockClient.rpc).toHaveBeenCalledWith("create_company_with_owner", {
      p_company_name: "Test",
      p_supabase_id: "auth-456",
      p_email: null,
      p_phone: null,
      p_first_name: "",
      p_last_name: "",
    });
  });

  it("retries without phone on users_phone_key error", async () => {
    const retryResult = {
      user: { id: "u-retry" },
      company: { id: "c-retry" },
      membership: { id: "m-retry" },
    };

    mockClient.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "users_phone_key conflict" } })
      .mockResolvedValueOnce({ data: retryResult, error: null });

    const result = await createCompanyWithOwner(params);

    expect(mockClient.rpc).toHaveBeenCalledTimes(2);
    // Second call should have p_phone: null
    expect(mockClient.rpc.mock.calls[1][1]).toEqual(
      expect.objectContaining({ p_phone: null })
    );
    expect(result).toEqual(retryResult);
  });

  it("throws when retry also fails", async () => {
    mockClient.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "users_phone_key conflict" } })
      .mockResolvedValueOnce({ data: null, error: { message: "retry failed" } });

    await expect(createCompanyWithOwner(params)).rejects.toThrow("retry failed");
  });

  it("throws when retry returns null data", async () => {
    mockClient.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "users_phone_key conflict" } })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(createCompanyWithOwner(params)).rejects.toThrow("Failed to create company");
  });

  it("throws on non-phone-key error", async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "something else went wrong" },
    });

    await expect(createCompanyWithOwner(params)).rejects.toThrow("something else went wrong");
  });

  it("throws when data is null (no error)", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(createCompanyWithOwner(params)).rejects.toThrow("Failed to create company");
  });
});

// ===========================================================================
// registerUserInDB()
// ===========================================================================

describe("registerUserInDB()", () => {
  it("delegates to createCompanyWithOwner", async () => {
    const rpcResult = { user: { id: "u1" }, company: { id: "c1" }, membership: { id: "m1" } };
    mockClient.rpc.mockResolvedValueOnce({ data: rpcResult, error: null });

    const result = await registerUserInDB({
      supabaseId: "auth-123",
      email: "test@example.com",
      firstName: "John",
      lastName: "Doe",
      companyName: "ACME",
    });

    expect(mockClient.rpc).toHaveBeenCalledWith("create_company_with_owner", expect.objectContaining({
      p_company_name: "ACME",
      p_supabase_id: "auth-123",
    }));
    expect(result).toEqual(rpcResult);
  });
});

// ===========================================================================
// joinCompanyByCode()
// ===========================================================================

describe("joinCompanyByCode()", () => {
  const params = {
    supabaseId: "auth-123",
    email: "test@example.com",
    phone: "+15551234567",
    firstName: "John",
    lastName: "Doe",
    joinCode: "ABC123",
  };

  it("calls rpc with correct params and returns data", async () => {
    const rpcResult = {
      user: { id: "u1" },
      company: { id: "c1" },
      membership: { id: "m1" },
    };
    mockClient.rpc.mockResolvedValueOnce({ data: rpcResult, error: null });

    const result = await joinCompanyByCode(params);

    expect(mockClient.rpc).toHaveBeenCalledWith("join_company_by_code", {
      p_join_code: "ABC123",
      p_supabase_id: "auth-123",
      p_email: "test@example.com",
      p_phone: "+15551234567",
      p_first_name: "John",
      p_last_name: "Doe",
    });
    expect(result).toEqual(rpcResult);
  });

  it("maps 'Invalid company code' error message", async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "Invalid company code — no matching company" },
    });

    await expect(joinCompanyByCode(params)).rejects.toThrow("Invalid company code");
  });

  it("retries without phone on users_phone_key error", async () => {
    const retryResult = {
      user: { id: "u-retry" },
      company: { id: "c-retry" },
      membership: { id: "m-retry" },
    };

    mockClient.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "users_phone_key conflict" } })
      .mockResolvedValueOnce({ data: retryResult, error: null });

    const result = await joinCompanyByCode(params);

    expect(mockClient.rpc).toHaveBeenCalledTimes(2);
    expect(mockClient.rpc.mock.calls[1][1]).toEqual(
      expect.objectContaining({ p_phone: null })
    );
    expect(result).toEqual(retryResult);
  });

  it("throws when phone-key retry also fails", async () => {
    mockClient.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "users_phone_key conflict" } })
      .mockResolvedValueOnce({ data: null, error: { message: "retry failed" } });

    await expect(joinCompanyByCode(params)).rejects.toThrow("retry failed");
  });

  it("throws when retry returns null data", async () => {
    mockClient.rpc
      .mockResolvedValueOnce({ data: null, error: { message: "users_phone_key conflict" } })
      .mockResolvedValueOnce({ data: null, error: null });

    await expect(joinCompanyByCode(params)).rejects.toThrow("Failed to join company");
  });

  it("throws on generic error", async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "unexpected error" },
    });

    await expect(joinCompanyByCode(params)).rejects.toThrow("unexpected error");
  });

  it("throws when data is null (no error)", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    await expect(joinCompanyByCode(params)).rejects.toThrow("Failed to join company");
  });

  it("uses empty string for phone when phone is falsy", async () => {
    const rpcResult = { user: {}, company: {}, membership: {} };
    mockClient.rpc.mockResolvedValueOnce({ data: rpcResult, error: null });

    await joinCompanyByCode({ ...params, phone: "" });

    expect(mockClient.rpc).toHaveBeenCalledWith("join_company_by_code",
      expect.objectContaining({ p_phone: null })
    );
  });
});

// ===========================================================================
// updateMemberRole()
// ===========================================================================

describe("updateMemberRole()", () => {
  it("calls rpc with correct params", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: { success: true }, error: null });

    const result = await updateMemberRole("m1", "admin");

    expect(mockClient.rpc).toHaveBeenCalledWith("update_member_role", {
      p_membership_id: "m1",
      p_new_role: "admin",
    });
    expect(result).toEqual({ success: true });
  });

  it("throws on error", async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "role update failed" },
    });

    await expect(updateMemberRole("m1", "admin")).rejects.toThrow("role update failed");
  });

  it("throws with default message when error.message is empty", async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "" },
    });

    await expect(updateMemberRole("m1", "admin")).rejects.toThrow("Failed to update role");
  });
});

// ===========================================================================
// removeMember()
// ===========================================================================

describe("removeMember()", () => {
  it("calls rpc with correct params", async () => {
    mockClient.rpc.mockResolvedValueOnce({ data: null, error: null });

    await removeMember("m1");

    expect(mockClient.rpc).toHaveBeenCalledWith("remove_company_member", {
      p_membership_id: "m1",
    });
  });

  it("throws on error", async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "remove failed" },
    });

    await expect(removeMember("m1")).rejects.toThrow("remove failed");
  });

  it("throws with default message when error.message is empty", async () => {
    mockClient.rpc.mockResolvedValueOnce({
      data: null,
      error: { message: "" },
    });

    await expect(removeMember("m1")).rejects.toThrow("Failed to remove member");
  });
});

// ===========================================================================
// uploadAvatar()
// ===========================================================================

describe("uploadAvatar()", () => {
  const createMockFile = (type: string, size: number, name = "avatar.jpg") =>
    new File(["x".repeat(size)], name, { type });

  it("uploads avatar and updates profile", async () => {
    mockGetAuthUserId.mockResolvedValueOnce("auth-123");
    mockEnsureInternalUser.mockResolvedValueOnce("internal-123");

    const file = createMockFile("image/jpeg", 1024, "photo.jpg");

    // Storage upload → success
    const storageBucket = mockClient.storage.from("avatars");
    storageBucket.upload.mockResolvedValueOnce({ data: {}, error: null });
    storageBucket.getPublicUrl.mockReturnValueOnce({
      data: { publicUrl: "https://storage.example.com/avatars/auth-123/avatar.jpg" },
    });

    // updateUserProfile internals: ensureInternalUser + getAuthUserId + update
    mockGetAuthUserId.mockResolvedValueOnce("auth-123");
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "u1", avatar_url: "https://storage.example.com/avatars/auth-123/avatar.jpg" }, error: null });

    const result = await uploadAvatar(file);

    expect(mockClient.storage.from).toHaveBeenCalledWith("avatars");
    expect(storageBucket.upload).toHaveBeenCalledWith(
      expect.stringContaining("auth-123/avatar-"),
      file,
      { cacheControl: "3600", upsert: true }
    );
    expect(result).toBe("https://storage.example.com/avatars/auth-123/avatar.jpg");
  });

  it("throws for invalid file type", async () => {
    mockGetAuthUserId.mockResolvedValueOnce("auth-123");
    const file = createMockFile("application/pdf", 1024, "doc.pdf");

    await expect(uploadAvatar(file)).rejects.toThrow("Only JPEG, PNG, WebP, and GIF images are allowed");
  });

  it("throws for oversized file", async () => {
    mockGetAuthUserId.mockResolvedValueOnce("auth-123");
    const file = createMockFile("image/png", 6 * 1024 * 1024, "huge.png");

    await expect(uploadAvatar(file)).rejects.toThrow("Image must be under 5MB");
  });

  it("throws when not authenticated", async () => {
    mockGetAuthUserId.mockResolvedValueOnce(null);
    const file = createMockFile("image/jpeg", 1024);

    await expect(uploadAvatar(file)).rejects.toThrow("Not authenticated");
  });

  it("throws on upload error", async () => {
    mockGetAuthUserId.mockResolvedValueOnce("auth-123");
    const file = createMockFile("image/jpeg", 1024);

    const storageBucket = mockClient.storage.from("avatars");
    storageBucket.upload.mockResolvedValueOnce({
      data: null,
      error: { message: "upload failed" },
    });

    await expect(uploadAvatar(file)).rejects.toEqual({ message: "upload failed" });
  });
});

// ===========================================================================
// uploadCompanyLogo()
// ===========================================================================

describe("uploadCompanyLogo()", () => {
  const createMockFile = (type: string, size: number, name = "logo.png") =>
    new File(["x".repeat(size)], name, { type });

  it("uploads logo and returns public URL", async () => {
    mockGetAuthUserId.mockResolvedValueOnce("auth-123");
    const file = createMockFile("image/png", 1024, "logo.png");

    const storageBucket = mockClient.storage.from("company-logos");
    storageBucket.upload.mockResolvedValueOnce({ data: {}, error: null });
    storageBucket.getPublicUrl.mockReturnValueOnce({
      data: { publicUrl: "https://storage.example.com/company-logos/c1/logo.png" },
    });

    const result = await uploadCompanyLogo(file, "c1");

    expect(mockClient.storage.from).toHaveBeenCalledWith("company-logos");
    expect(result).toBe("https://storage.example.com/company-logos/c1/logo.png");
  });

  it("allows SVG images", async () => {
    mockGetAuthUserId.mockResolvedValueOnce("auth-123");
    const file = createMockFile("image/svg+xml", 1024, "logo.svg");

    const storageBucket = mockClient.storage.from("company-logos");
    storageBucket.upload.mockResolvedValueOnce({ data: {}, error: null });
    storageBucket.getPublicUrl.mockReturnValueOnce({
      data: { publicUrl: "https://storage.example.com/logo.svg" },
    });

    const result = await uploadCompanyLogo(file, "c1");
    expect(result).toBe("https://storage.example.com/logo.svg");
  });

  it("throws for invalid file type", async () => {
    mockGetAuthUserId.mockResolvedValueOnce("auth-123");
    const file = createMockFile("text/plain", 1024, "file.txt");

    await expect(uploadCompanyLogo(file, "c1")).rejects.toThrow("Only JPEG, PNG, WebP, GIF, and SVG images are allowed");
  });

  it("throws for oversized file", async () => {
    mockGetAuthUserId.mockResolvedValueOnce("auth-123");
    const file = createMockFile("image/png", 6 * 1024 * 1024, "huge.png");

    await expect(uploadCompanyLogo(file, "c1")).rejects.toThrow("Image must be under 5MB");
  });

  it("throws when not authenticated", async () => {
    mockGetAuthUserId.mockResolvedValueOnce(null);
    const file = createMockFile("image/png", 1024);

    await expect(uploadCompanyLogo(file, "c1")).rejects.toThrow("Not authenticated");
  });
});

// ===========================================================================
// updateUserProfile()
// ===========================================================================

describe("updateUserProfile()", () => {
  it("maps update fields to DB columns", async () => {
    const updated = { id: "u1", first_name: "Jane", last_name: "Smith" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: updated, error: null });

    const result = await updateUserProfile({
      firstName: "Jane",
      lastName: "Smith",
      phone: "+15551234567",
      avatarUrl: "https://example.com/avatar.jpg",
    });

    expect(queryBuilder.update).toHaveBeenCalledWith({
      first_name: "Jane",
      last_name: "Smith",
      phone: "+15551234567",
      avatar_url: "https://example.com/avatar.jpg",
    });
    expect(queryBuilder.eq).toHaveBeenCalledWith("supabase_id", "auth-123");
    expect(result).toEqual(updated);
  });

  it("trims phone and sets null if empty", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "u1" }, error: null });

    await updateUserProfile({ phone: "  " });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.phone).toBeNull();
  });

  it("trims phone value", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "u1" }, error: null });

    await updateUserProfile({ phone: "  +15551234567  " });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg.phone).toBe("+15551234567");
  });

  it("throws when not authenticated", async () => {
    mockGetAuthUserId.mockResolvedValueOnce(null);

    await expect(updateUserProfile({ firstName: "Test" })).rejects.toThrow("Not authenticated");
  });

  it("throws on DB error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "update failed" },
    });

    await expect(updateUserProfile({ firstName: "Fail" })).rejects.toEqual({
      message: "update failed",
    });
  });

  it("only includes defined fields in payload", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "u1" }, error: null });

    await updateUserProfile({ firstName: "Only" });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).toHaveProperty("first_name", "Only");
    expect(updateArg).not.toHaveProperty("last_name");
    expect(updateArg).not.toHaveProperty("phone");
    expect(updateArg).not.toHaveProperty("avatar_url");
  });
});

// ===========================================================================
// getCompanyMembers()
// ===========================================================================

describe("getCompanyMembers()", () => {
  it("returns members data", async () => {
    const members = [
      { id: "m1", role: "owner", users: { first_name: "John" } },
      { id: "m2", role: "staff", users: { first_name: "Jane" } },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: members, error: null }).then(resolve)
    );

    const result = await getCompanyMembers("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("company_memberships");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.eq).toHaveBeenCalledWith("status", "active");
    expect(queryBuilder.order).toHaveBeenCalledWith("role", { ascending: true });
    expect(result).toEqual(members);
  });

  it("returns [] when data is null", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve)
    );

    const result = await getCompanyMembers("comp-1");
    expect(result).toEqual([]);
  });

  it("calls logDbReadError on error and returns []", async () => {
    const dbError = { message: "db failure", code: "500" };
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: dbError }).then(resolve)
    );

    const result = await getCompanyMembers("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("company members", dbError);
    expect(result).toEqual([]);
  });
});

// ===========================================================================
// getCompanyDetails()
// ===========================================================================

describe("getCompanyDetails()", () => {
  it("returns company data", async () => {
    const company = { id: "comp-1", name: "ACME", slug: "acme" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: company, error: null });

    const result = await getCompanyDetails("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("companies");
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "comp-1");
    expect(result).toEqual(company);
  });

  it("returns null on error and logs", async () => {
    const dbError = { message: "db failure", code: "500" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: dbError });

    const result = await getCompanyDetails("comp-1");

    expect(mockedLogDbReadError).toHaveBeenCalledWith("company details", dbError);
    expect(result).toBeNull();
  });

  it("returns null when no company found", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

    const result = await getCompanyDetails("nonexistent");
    expect(result).toBeNull();
  });
});

// ===========================================================================
// updateCompany()
// ===========================================================================

describe("updateCompany()", () => {
  it("maps all fields to DB columns", async () => {
    const updated = { id: "comp-1", name: "New Name" };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: updated, error: null });

    const result = await updateCompany("comp-1", {
      name: "New Name",
      brandColor: "#ff0000",
      accentColor: "#00ff00",
      timezone: "US/Eastern",
      logoUrl: "https://example.com/logo.png",
      websiteUrl: "https://example.com",
    });

    expect(queryBuilder.update).toHaveBeenCalledWith({
      name: "New Name",
      brand_color: "#ff0000",
      accent_color: "#00ff00",
      timezone: "US/Eastern",
      logo_url: "https://example.com/logo.png",
      website_url: "https://example.com",
    });
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "comp-1");
    expect(result).toEqual(updated);
  });

  it("only includes defined fields", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: { id: "comp-1" }, error: null });

    await updateCompany("comp-1", { name: "Only Name" });

    const updateArg = queryBuilder.update.mock.calls[0][0] as Record<string, unknown>;
    expect(updateArg).toHaveProperty("name", "Only Name");
    expect(updateArg).not.toHaveProperty("brand_color");
    expect(updateArg).not.toHaveProperty("accent_color");
    expect(updateArg).not.toHaveProperty("timezone");
    expect(updateArg).not.toHaveProperty("logo_url");
    expect(updateArg).not.toHaveProperty("website_url");
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "update failed" },
    });

    await expect(updateCompany("comp-1", { name: "Fail" })).rejects.toEqual({
      message: "update failed",
    });
  });
});

// ===========================================================================
// updateCompanySettings()
// ===========================================================================

describe("updateCompanySettings()", () => {
  it("updates settings object", async () => {
    const settings = { theme: "dark", notifications: true };
    const updated = { id: "comp-1", settings };
    queryBuilder.maybeSingle.mockResolvedValueOnce({ data: updated, error: null });

    const result = await updateCompanySettings("comp-1", settings);

    expect(queryBuilder.update).toHaveBeenCalledWith({ settings });
    expect(queryBuilder.eq).toHaveBeenCalledWith("id", "comp-1");
    expect(result).toEqual(updated);
  });

  it("throws on error", async () => {
    queryBuilder.maybeSingle.mockResolvedValueOnce({
      data: null,
      error: { message: "settings update failed" },
    });

    await expect(updateCompanySettings("comp-1", {})).rejects.toEqual({
      message: "settings update failed",
    });
  });
});
