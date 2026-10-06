import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

const { client: mockClient, setMockResponse, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({
  createClient: () => mockClient,
}));

vi.mock("@/lib/supabase/db-helpers", () => ({
  ts: () => ({ created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }),
  ensureInternalUser: vi.fn().mockResolvedValue("user-123"),
}));

vi.mock("@/lib/supabase/db-error", () => ({
  logDbReadError: vi.fn(),
}));

import { reorderOnboardingTasks } from "@/lib/supabase/db-onboarding";

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
    Promise.resolve({ data: null, error: null }).then(resolve)
  );
});

describe("reorderOnboardingTasks", () => {
  it("upserts with company_id on every row (RLS needs it on the INSERT path)", async () => {
    await reorderOnboardingTasks("comp-1", [
      { id: "t1", sort_order: 0 },
      { id: "t2", sort_order: 1 },
    ]);

    expect(mockClient.from).toHaveBeenCalledWith("onboarding_tasks");
    expect(queryBuilder.upsert).toHaveBeenCalledWith(
      [
        { id: "t1", company_id: "comp-1", sort_order: 0 },
        { id: "t2", company_id: "comp-1", sort_order: 1 },
      ],
      { onConflict: "id" },
    );
  });

  it("does not upsert id+sort_order alone (the 2026-10-06 failure mode)", async () => {
    await reorderOnboardingTasks("comp-9", [{ id: "t9", sort_order: 3 }]);
    const [rows] = queryBuilder.upsert.mock.calls[0];
    expect(rows).toHaveLength(1);
    expect(rows[0]).toEqual({ id: "t9", company_id: "comp-9", sort_order: 3 });
    expect(rows[0]).not.toEqual({ id: "t9", sort_order: 3 });
  });

  it("throws when supabase returns an error", async () => {
    setMockResponse({ data: null, error: { message: "new row violates row-level security policy", code: "42501" } });
    queryBuilder.then = vi.fn((resolve: (v: unknown) => void) =>
      Promise.resolve({ data: null, error: { message: "new row violates row-level security policy", code: "42501" } }).then(resolve)
    );
    // Terminal: upsert returns a thenable in our mock via chain; make upsert resolve the error.
    queryBuilder.upsert.mockReturnValueOnce(Promise.resolve({
      data: null,
      error: { message: "new row violates row-level security policy", code: "42501" },
    }));

    await expect(
      reorderOnboardingTasks("comp-1", [{ id: "t1", sort_order: 0 }]),
    ).rejects.toMatchObject({ code: "42501" });
  });
});
