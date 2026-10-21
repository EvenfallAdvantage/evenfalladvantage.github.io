import { describe, it, expect, vi } from "vitest";
const calls: { table: string; col?: string; vals?: unknown }[] = [];
let rows: unknown = [{ timesheet_id: "a" }, { timesheet_id: "b" }];
let single: unknown = { id: "s1", timesheet_id: "a", summary: "Quiet", signed_name: "ZZ Guard", signed_at: "2026-10-21T04:40:58Z" };
function client() { return ({
  from: (table: string) => ({
    select: () => ({
      in: async (col: string, vals: unknown) => { calls.push({ table, col, vals }); return { data: rows, error: null }; },
      eq: () => ({ maybeSingle: async () => ({ data: single, error: null }) }),
    }),
  }) }); }
vi.mock("@/lib/supabase/client", () => ({ createClient: () => client() }));
vi.mock("../lib/supabase/client", () => ({ createClient: () => client() }));
import { getSignedTimesheetIds, getDarSignoff } from "@/lib/supabase/db-dar";

describe("getSignedTimesheetIds", () => {
  it("returns an empty set without querying for no ids", async () => {
    expect((await getSignedTimesheetIds([])).size).toBe(0);
    expect(calls).toHaveLength(0);
  });
  it("queries dar_signoffs once and returns the signed ids", async () => {
    const s = await getSignedTimesheetIds(["a", "b", "c"]);
    expect([...s].sort()).toEqual(["a", "b"]);
    expect(calls[0]).toMatchObject({ table: "dar_signoffs", col: "timesheet_id", vals: ["a", "b", "c"] });
  });
  it("returns an empty set when RLS hides everything", async () => {
    rows = null;
    expect((await getSignedTimesheetIds(["a"])).size).toBe(0);
  });
});
describe("getDarSignoff", () => {
  it("maps the row", async () => {
    expect(await getDarSignoff("a")).toEqual({ id: "s1", timesheetId: "a", summary: "Quiet", signedName: "ZZ Guard", signedAt: "2026-10-21T04:40:58Z" });
    single = null;
    expect(await getDarSignoff("a")).toBeNull();
  });
});
