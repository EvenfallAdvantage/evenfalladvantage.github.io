import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

const { client: mockClient, setMockResponse, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

import {
  getAuditLogs,
  getSecurityStats,
  recordFailedAttempt,
  clearLoginAttempts,
  checkLoginAttempts,
} from "@/lib/security/audit";

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: [], error: null }).then(resolve),
  );
});

// ---------------------------------------------------------------------------
// getAuditLogs()
// ---------------------------------------------------------------------------

describe("getAuditLogs()", () => {
  it("scopes by company and orders by created_at desc with default limit", async () => {
    const rows = [
      { id: "a1", event_type: "auth.login.success", outcome: "success", created_at: "2026-01-10T00:00:00Z" },
    ];
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: rows, error: null }).then(resolve),
    );

    const result = await getAuditLogs("comp-1");

    expect(mockClient.from).toHaveBeenCalledWith("audit_logs");
    expect(queryBuilder.eq).toHaveBeenCalledWith("company_id", "comp-1");
    expect(queryBuilder.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(queryBuilder.limit).toHaveBeenCalledWith(50);
    expect(result).toEqual(rows);
  });

  it("applies eventType filter when provided", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );

    await getAuditLogs("comp-1", { eventType: "auth.login.failed" });

    expect(queryBuilder.eq).toHaveBeenCalledWith("event_type", "auth.login.failed");
  });

  it("respects custom limit and offset", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: [], error: null }).then(resolve),
    );

    await getAuditLogs("comp-1", { limit: 25, offset: 50 });

    expect(queryBuilder.limit).toHaveBeenCalledWith(25);
    expect(queryBuilder.range).toHaveBeenCalledWith(50, 74);
  });

  it("throws on error (caller decides whether to swallow)", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "boom" } }).then(resolve),
    );

    await expect(getAuditLogs("comp-1")).rejects.toEqual({ message: "boom" });
  });
});

// ---------------------------------------------------------------------------
// getSecurityStats()
// ---------------------------------------------------------------------------

describe("getSecurityStats()", () => {
  it("aggregates row counts from three audit_logs queries", async () => {
    const responses = [
      Array.from({ length: 42 }, (_, i) => ({ id: `e${i}` })),
      Array.from({ length: 7 }, (_, i) => ({ id: `f${i}` })),
      Array.from({ length: 3 }, (_, i) => ({ id: `l${i}` })),
    ];
    let i = 0;
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) => {
      const data = responses[i++] ?? [];
      return Promise.resolve({ data, error: null }).then(resolve);
    });

    const result = await getSecurityStats("comp-1");

    expect(result).toEqual({
      events24h: 42,
      failedLogins7d: 7,
      lockouts7d: 3,
    });
  });

  it("returns zeros on missing data", async () => {
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: null }).then(resolve),
    );

    const result = await getSecurityStats("comp-1");
    expect(result).toEqual({ events24h: 0, failedLogins7d: 0, lockouts7d: 0 });
  });
});

// ---------------------------------------------------------------------------
// Login-attempt rate limit
// ---------------------------------------------------------------------------

describe("login attempt tracking", () => {
  it("records and clears attempts in sessionStorage", async () => {
    const mockStorage: Record<string, string> = {};
    const sessionStorageMock = {
      getItem: (k: string) => mockStorage[k] ?? null,
      setItem: (k: string, v: string) => {
        mockStorage[k] = v;
      },
      removeItem: (k: string) => {
        delete mockStorage[k];
      },
      clear: () => {
        Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
      },
      length: 0,
      key: () => null,
    };
    vi.stubGlobal("sessionStorage", sessionStorageMock);

    recordFailedAttempt("user@example.com");
    recordFailedAttempt("user@example.com");
    const first = await checkLoginAttempts("user@example.com");
    expect(first.allowed).toBe(true);
    expect(first.attemptsRemaining).toBe(3);

    // Lock after 5 attempts.
    recordFailedAttempt("user@example.com");
    recordFailedAttempt("user@example.com");
    recordFailedAttempt("user@example.com");
    const locked = await checkLoginAttempts("user@example.com");
    expect(locked.allowed).toBe(false);
    expect(locked.attemptsRemaining).toBe(0);

    clearLoginAttempts("user@example.com");
    const cleared = await checkLoginAttempts("user@example.com");
    expect(cleared.allowed).toBe(true);
    expect(cleared.attemptsRemaining).toBe(5);

    vi.unstubAllGlobals();
  });

  it("returns allowed when sessionStorage missing", async () => {
    vi.stubGlobal("sessionStorage", undefined as unknown as Storage);
    const result = await checkLoginAttempts("user@example.com");
    expect(result.allowed).toBe(true);
    expect(result.attemptsRemaining).toBe(5);
    vi.unstubAllGlobals();
  });
});
