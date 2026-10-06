import { describe, it, expect, vi, beforeEach, type Mock } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

// ---------------------------------------------------------------------------
// Mock Supabase client — must be before imports of modules under test
// ---------------------------------------------------------------------------
const { client: mockClient, setMockResponse, setAuthUser, queryBuilder } =
  createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import {
  ts,
  getAuthUserId,
  seedInternalUserId,
  clearInternalUserCache,
  ensureInternalUser,
  getSignedFileUrl,
  resolveStorageUrl,
} from "@/lib/supabase/db-helpers";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  setAuthUser(null);
  clearInternalUserCache();
});

// ---------------------------------------------------------------------------
// ts()
// ---------------------------------------------------------------------------

describe("ts()", () => {
  it("returns object with created_at and updated_at fields", () => {
    const result = ts();
    expect(result).toHaveProperty("created_at");
    expect(result).toHaveProperty("updated_at");
  });

  it("both fields are valid ISO date strings", () => {
    const result = ts();
    expect(new Date(result.created_at).toISOString()).toBe(result.created_at);
    expect(new Date(result.updated_at).toISOString()).toBe(result.updated_at);
  });

  it("both are approximately now (within 1 second)", () => {
    const before = Date.now();
    const result = ts();
    const after = Date.now();

    const createdMs = new Date(result.created_at).getTime();
    const updatedMs = new Date(result.updated_at).getTime();

    expect(createdMs).toBeGreaterThanOrEqual(before - 1);
    expect(createdMs).toBeLessThanOrEqual(after + 1);
    expect(updatedMs).toBeGreaterThanOrEqual(before - 1);
    expect(updatedMs).toBeLessThanOrEqual(after + 1);
  });

  it("created_at and updated_at are equal", () => {
    const result = ts();
    expect(result.created_at).toBe(result.updated_at);
  });
});

// ---------------------------------------------------------------------------
// getAuthUserId()
// ---------------------------------------------------------------------------

describe("getAuthUserId()", () => {
  it("returns user ID when authenticated", async () => {
    setAuthUser({ id: "auth-user-123" });
    const result = await getAuthUserId();
    expect(result).toBe("auth-user-123");
  });

  it("returns null when user is null", async () => {
    setAuthUser(null);
    const result = await getAuthUserId();
    expect(result).toBeNull();
  });

  it("returns null when auth.getUser returns user without id", async () => {
    setAuthUser({});
    const result = await getAuthUserId();
    // user?.id is undefined → ?? null
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// seedInternalUserId() + clearInternalUserCache()
// ---------------------------------------------------------------------------

describe("seedInternalUserId / clearInternalUserCache", () => {
  it("after seeding, ensureInternalUser returns the seeded ID without DB call", async () => {
    seedInternalUserId("seeded-id-999");
    const result = await ensureInternalUser();
    expect(result).toBe("seeded-id-999");
    // No DB query should have been made
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it("after clearing, cache is empty and ensureInternalUser queries DB", async () => {
    seedInternalUserId("seeded-id-999");
    clearInternalUserCache();

    // No auth user → ensureInternalUser returns null
    setAuthUser(null);
    const result = await ensureInternalUser();
    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ensureInternalUser()
// ---------------------------------------------------------------------------

describe("ensureInternalUser()", () => {
  it("returns cached value on second call (does not query DB again)", async () => {
    setAuthUser({ id: "auth-abc", user_metadata: { first_name: "Jane" } });
    setMockResponse({ data: { id: "internal-xyz" }, error: null });

    const first = await ensureInternalUser();
    expect(first).toBe("internal-xyz");

    // Reset mock to verify no further DB call
    vi.clearAllMocks();

    const second = await ensureInternalUser();
    expect(second).toBe("internal-xyz");
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it("when no cache: looks up user in DB by auth ID, returns internal user ID", async () => {
    setAuthUser({ id: "auth-abc", user_metadata: {} });
    setMockResponse({ data: { id: "found-user-id" }, error: null });

    const result = await ensureInternalUser();
    expect(result).toBe("found-user-id");
    expect(mockClient.from).toHaveBeenCalledWith("users");
    expect(queryBuilder.select).toHaveBeenCalledWith("id");
    expect(queryBuilder.eq).toHaveBeenCalledWith("supabase_id", "auth-abc");
  });

  it("returns null when not authenticated", async () => {
    setAuthUser(null);
    const result = await ensureInternalUser();
    expect(result).toBeNull();
  });

  it("deduplicates inflight calls (two concurrent calls = only one auth lookup)", async () => {
    clearInternalUserCache();
    setAuthUser({ id: "auth-dedup", user_metadata: {} });
    setMockResponse({ data: { id: "dedup-user" }, error: null });

    const [r1, r2] = await Promise.all([
      ensureInternalUser(),
      ensureInternalUser(),
    ]);

    expect(r1).toBe("dedup-user");
    expect(r2).toBe("dedup-user");
    // auth.getUser should only be called once due to dedup
    expect(mockClient.auth.getUser).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getSignedFileUrl()
// ---------------------------------------------------------------------------

describe("getSignedFileUrl()", () => {
  it("returns the URL as-is if it starts with http://", async () => {
    const url = "http://example.com/image.png";
    const result = await getSignedFileUrl(url);
    expect(result).toBe(url);
  });

  it("returns the URL as-is if it starts with https://", async () => {
    const url = "https://cdn.example.com/photo.jpg";
    const result = await getSignedFileUrl(url);
    expect(result).toBe(url);
  });

  it("returns path as-is if no slash is present", async () => {
    const result = await getSignedFileUrl("no-slash");
    expect(result).toBe("no-slash");
  });

  it("splits bucket/path correctly and calls storage.createSignedUrl", async () => {
    setMockResponse({ data: { signedUrl: "https://signed.url/abc" }, error: null });
    const result = await getSignedFileUrl("my-bucket/path/to/file.pdf");

    expect(mockClient.storage.from).toHaveBeenCalledWith("my-bucket");
    expect(result).toBe("https://signed.url/abc");
  });

  it("throws when signed URL fails (does not fall back to public URL)", async () => {
    // Override createSignedUrl to simulate an error
    const bucket = (mockClient.storage.from as Mock)();
    (bucket.createSignedUrl as Mock).mockResolvedValueOnce({
      data: null,
      error: { message: "Signing failed" },
    });

    // Re-mock storage.from to return the bucket with the overridden createSignedUrl
    (mockClient.storage.from as Mock).mockReturnValueOnce(bucket);

    await expect(getSignedFileUrl("my-bucket/path/to/file.pdf")).rejects.toThrow(
      "Failed to generate signed URL: Signing failed"
    );
  });

  it("uses default expiry of 3600 if not specified", async () => {
    setMockResponse({ data: { signedUrl: "https://signed.url/abc" }, error: null });
    await getSignedFileUrl("bucket/file.txt");

    const bucket = (mockClient.storage.from as Mock)();
    // The createSignedUrl was called; check the last invocation args
    expect(bucket.createSignedUrl).toHaveBeenCalledWith("file.txt", 3600);
  });

  it("uses custom expiry when specified", async () => {
    setMockResponse({ data: { signedUrl: "https://signed.url/abc" }, error: null });
    await getSignedFileUrl("bucket/file.txt", 7200);

    const bucket = (mockClient.storage.from as Mock)();
    expect(bucket.createSignedUrl).toHaveBeenCalledWith("file.txt", 7200);
  });
});

// ---------------------------------------------------------------------------
// resolveStorageUrl()
// ---------------------------------------------------------------------------

describe("resolveStorageUrl()", () => {
  it("returns null for empty input", async () => {
    expect(await resolveStorageUrl(null)).toBeNull();
    expect(await resolveStorageUrl("")).toBeNull();
  });

  it("signs legacy public URLs for buckets that are now private", async () => {
    setMockResponse({ data: { signedUrl: "https://signed.url/map" }, error: null });
    const url = "https://proj.supabase.co/storage/v1/object/public/operation-maps/co-1/ev-1/site%20map.png";
    const result = await resolveStorageUrl(url, 86400);

    expect(mockClient.storage.from).toHaveBeenCalledWith("operation-maps");
    const bucket = (mockClient.storage.from as Mock)();
    expect(bucket.createSignedUrl).toHaveBeenCalledWith("co-1/ev-1/site map.png", 86400);
    expect(result).toBe("https://signed.url/map");
  });

  it("signs legacy certification URLs", async () => {
    setMockResponse({ data: { signedUrl: "https://signed.url/cert" }, error: null });
    const result = await resolveStorageUrl("https://proj.supabase.co/storage/v1/object/public/certifications/uid/c.pdf");
    expect(mockClient.storage.from).toHaveBeenCalledWith("certifications");
    expect(result).toBe("https://signed.url/cert");
  });

  it("leaves public URLs of other buckets untouched", async () => {
    const url = "https://proj.supabase.co/storage/v1/object/public/company-logos/co-1/logo.png";
    expect(await resolveStorageUrl(url)).toBe(url);
    expect(mockClient.storage.from).not.toHaveBeenCalled();
  });

  it("signs bucket/path references", async () => {
    setMockResponse({ data: { signedUrl: "https://signed.url/doc" }, error: null });
    expect(await resolveStorageUrl("applicant-documents/co/app/x.pdf")).toBe("https://signed.url/doc");
  });

  it("returns null instead of throwing when signing fails", async () => {
    const bucket = (mockClient.storage.from as Mock)();
    (bucket.createSignedUrl as Mock).mockResolvedValueOnce({ data: null, error: { message: "nope" } });
    (mockClient.storage.from as Mock).mockReturnValueOnce(bucket);
    expect(await resolveStorageUrl("https://proj.supabase.co/storage/v1/object/public/certifications/u/c.pdf")).toBeNull();
  });
});
