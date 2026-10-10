import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const dir = join(__dirname, "../../supabase/migrations");
const mig = readFileSync(join(dir, "20261010170000_companies_errorlogs_radio_rls.sql"), "utf8");
const rollback = readFileSync(join(dir, "rollback/20261010170000_companies_errorlogs_radio_rls.rollback.sql"), "utf8");

describe("20261010170000 permission-gap migration", () => {
  it("restricts companies SELECT to members", () => {
    expect(mig).toMatch(/CREATE POLICY companies_select ON public\.companies\s+FOR SELECT TO authenticated\s+USING \(public\.is_company_member\(id\)\)/);
  });

  it("limits error_logs reads to owner/admin", () => {
    expect(mig).toMatch(/"Company admins can view error logs"[\s\S]*?USING \(public\.is_company_owner_admin\(company_id\)\)/);
  });

  it("lets only owner/admin change the radio state", () => {
    const fn = mig.slice(mig.indexOf("FUNCTION public.set_company_radio_state"));
    expect(fn).toMatch(/IF NOT public\.is_company_owner_admin\(p_company_id\) THEN/);
    expect(fn).not.toMatch(/my_company_role\(p_company_id\) IS NULL/);
  });

  it("exposes only branding columns from get_public_company", () => {
    const ret = /RETURNS TABLE \(([^)]*)\)/.exec(mig)![1];
    expect(ret).not.toMatch(/settings|pay_rate|bill_rate|radio_state|join_code/);
  });

  it("rollback restores the previous policies", () => {
    expect(rollback).toMatch(/companies_select[\s\S]*USING \(true\)/);
    expect(rollback).toMatch(/is_company_member\(company_id\)/);
    expect(rollback).toMatch(/my_company_role\(p_company_id\) IS NULL/);
  });
});
