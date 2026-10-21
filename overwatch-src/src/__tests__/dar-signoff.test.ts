import { describe, it, expect, vi } from "vitest";
let insertResult: { error: { code: string; message?: string } | null } = { error: null };
const inserted: unknown[] = [];
vi.mock("@/lib/supabase/client", () => ({ createClient: () => ({ from: () => ({ insert: async (row: unknown) => { inserted.push(row); return insertResult; } }) }) }));
vi.mock("../lib/supabase/client", () => ({ createClient: () => ({ from: () => ({ insert: async (row: unknown) => { inserted.push(row); return insertResult; } }) }) }));
import { signDAR, darSummaryLines, type DailyActivityReport } from "@/lib/supabase/db-dar";

const base = { companyId: "c", timesheetId: "t", userId: "u", summary: "  Quiet  ", signedName: " ZZ Guard ", report: null };
describe("signDAR", () => {
  it("inserts a trimmed row", async () => {
    expect(await signDAR(base)).toEqual({ ok: true });
    expect(inserted[0]).toMatchObject({ company_id: "c", timesheet_id: "t", user_id: "u", summary: "Quiet", signed_name: "ZZ Guard" });
  });
  it("maps duplicate and missing-table errors", async () => {
    insertResult = { error: { code: "23505" } };
    expect(await signDAR(base)).toEqual({ ok: false, reason: "already_signed" });
    insertResult = { error: { code: "PGRST205" } };
    expect(await signDAR(base)).toEqual({ ok: false, reason: "not_enabled" });
  });
});
describe("darSummaryLines", () => {
  it("pluralises", () => {
    const r = { totalHours: 8, patrolCount: 1, incidentCount: 2, breakMinutes: 30 } as DailyActivityReport;
    expect(darSummaryLines(r)).toEqual(["8.0 h on duty", "1 checkpoint scan", "2 incidents filed", "30 min break"]);
  });
});
