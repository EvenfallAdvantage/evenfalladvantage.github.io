import { describe, it, expect, vi, beforeEach } from "vitest";
import { createMockSupabase } from "./helpers/mock-supabase";

// Reorders must be plain UPDATEs, never `{ id, sort_order }` upserts: Postgres
// runs the INSERT side of ON CONFLICT first, where RLS sees a null company_id /
// module_id and NOT NULL columns (title, name) fail with 23502. Seen live on
// 2026-10-06 (onboarding_tasks at 13:58 PT) and confirmed in a rolled-back probe.

const { client: mockClient, setMockResponse, queryBuilder } = createMockSupabase();

vi.mock("@/lib/supabase/client", () => ({ createClient: () => mockClient }));
vi.mock("@/lib/supabase/db-helpers", () => ({
  ts: () => ({ created_at: "2026-01-01T00:00:00.000Z", updated_at: "2026-01-01T00:00:00.000Z" }),
  ensureInternalUser: vi.fn().mockResolvedValue("user-123"),
}));
vi.mock("@/lib/supabase/db-error", () => ({ logDbReadError: vi.fn() }));

import { reorderOnboardingTasks } from "@/lib/supabase/db-onboarding";
import { updateKBFolderOrder } from "@/lib/supabase/db-content";
import { reorderModuleSlides } from "@/lib/supabase/db-training";

const RLS_ERROR = { message: "new row violates row-level security policy", code: "42501" };

function resolveWith(res: { data: unknown; error: unknown }) {
  queryBuilder.then = vi.fn((resolve: (v: unknown) => void) => Promise.resolve(res).then(resolve));
}

beforeEach(() => {
  vi.clearAllMocks();
  setMockResponse({ data: null, error: null });
  resolveWith({ data: null, error: null });
});

describe("reorderOnboardingTasks", () => {
  it("updates sort_order per task, scoped by id and company_id, with no upsert", async () => {
    await reorderOnboardingTasks("comp-1", [
      { id: "t1", sort_order: 0 },
      { id: "t2", sort_order: 1 },
    ]);
    expect(mockClient.from).toHaveBeenCalledWith("onboarding_tasks");
    expect(queryBuilder.upsert).not.toHaveBeenCalled();
    expect(queryBuilder.update.mock.calls).toEqual([[{ sort_order: 0 }], [{ sort_order: 1 }]]);
    expect(queryBuilder.eq.mock.calls).toEqual([
      ["id", "t1"], ["company_id", "comp-1"],
      ["id", "t2"], ["company_id", "comp-1"],
    ]);
  });

  it("throws the database error", async () => {
    resolveWith({ data: null, error: RLS_ERROR });
    await expect(reorderOnboardingTasks("comp-1", [{ id: "t1", sort_order: 0 }])).rejects.toMatchObject({ code: "42501" });
  });
});

describe("updateKBFolderOrder", () => {
  it("updates sort_order per folder, scoped by id and company_id, with no upsert", async () => {
    await updateKBFolderOrder("comp-7", [
      { id: "f1", sort_order: 1 },
      { id: "f2", sort_order: 0 },
    ]);
    expect(mockClient.from).toHaveBeenCalledWith("kb_folders");
    expect(queryBuilder.upsert).not.toHaveBeenCalled();
    expect(queryBuilder.update.mock.calls).toEqual([[{ sort_order: 1 }], [{ sort_order: 0 }]]);
    expect(queryBuilder.eq.mock.calls).toEqual([
      ["id", "f1"], ["company_id", "comp-7"],
      ["id", "f2"], ["company_id", "comp-7"],
    ]);
  });

  it("throws the database error", async () => {
    resolveWith({ data: null, error: RLS_ERROR });
    await expect(updateKBFolderOrder("comp-7", [{ id: "f1", sort_order: 0 }])).rejects.toMatchObject({ code: "42501" });
  });
});

describe("reorderModuleSlides", () => {
  it("updates sort_order + updated_at per slide by id, with no upsert", async () => {
    await reorderModuleSlides([
      { id: "s1", sortOrder: 1 },
      { id: "s2", sortOrder: 0 },
    ]);
    expect(mockClient.from).toHaveBeenCalledWith("module_slides");
    expect(queryBuilder.upsert).not.toHaveBeenCalled();
    const patches = queryBuilder.update.mock.calls.map((c: unknown[]) => c[0] as Record<string, unknown>);
    expect(patches.map((p) => p.sort_order)).toEqual([1, 0]);
    expect(patches.every((p) => typeof p.updated_at === "string")).toBe(true);
    expect(patches.every((p) => !("title" in p) && !("module_id" in p))).toBe(true);
    expect(queryBuilder.eq.mock.calls).toEqual([["id", "s1"], ["id", "s2"]]);
  });

  it("throws the database error", async () => {
    resolveWith({ data: null, error: RLS_ERROR });
    await expect(reorderModuleSlides([{ id: "s1", sortOrder: 0 }])).rejects.toMatchObject({ code: "42501" });
  });
});
