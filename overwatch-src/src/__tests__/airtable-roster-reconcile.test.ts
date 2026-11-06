import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "../../supabase/migrations");
const mig = readFileSync(join(dir, "20261106223000_airtable_roster_reconcile.sql"), "utf8");
const rollback = readFileSync(join(dir, "rollback/20261106223000_airtable_roster_reconcile.rollback.sql"), "utf8");
const apply = mig.slice(mig.indexOf("FUNCTION public.apply_airtable_roster_sync"));

describe("Airtable roster reconciliation migration", () => {
  it("is an additive security-definer function with a locked search path", () => {
    expect(mig).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_airtable_roster_sync/);
    expect(mig).toMatch(/CREATE OR REPLACE FUNCTION public\.airtable_roster_email_owners/);
    expect(apply).toMatch(/SECURITY DEFINER/);
    expect(apply).toMatch(/SET search_path = ''/);
    expect(apply).toMatch(/auth\.uid\(\) IS NULL/);
    expect(apply).toMatch(/cm\.status = 'active'/);
    expect(apply).toMatch(/v_role NOT IN \('owner', 'admin', 'manager'\)/);
    expect(apply).toMatch(/assert_mfa_for_company\(p_company_id\)/);
    expect(apply).toMatch(/roster_base_id/);
    expect(apply).toMatch(/purpose = 'roster'/);
    expect(apply).toMatch(/confirmed_at IS NOT NULL/);
    expect(mig).toMatch(/REVOKE ALL ON FUNCTION public\.apply_airtable_roster_sync\(uuid, text, text, jsonb\) FROM PUBLIC, anon/);
    expect(mig).toMatch(/GRANT EXECUTE ON FUNCTION public\.apply_airtable_roster_sync\(uuid, text, text, jsonb\) TO authenticated/);
    expect(mig).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.apply_airtable_roster_sync[\s\S]*TO anon/);
    expect(mig).toMatch(/REVOKE ALL ON FUNCTION public\.airtable_roster_email_owners\(text\[\]\) FROM PUBLIC, anon, authenticated/);
    expect(mig).toMatch(/GRANT EXECUTE ON FUNCTION public\.airtable_roster_email_owners\(text\[\]\) TO service_role/);
  });

  it("deletes the company membership and the Airtable link, not the account", () => {
    expect(apply).toMatch(/DELETE FROM public\.company_memberships/);
    expect(apply).toMatch(/DELETE FROM public\.employee_external_ids/);
    expect(apply).toMatch(/provider = 'airtable'/);
    expect(apply).toMatch(/role::text NOT IN \('owner', 'admin', 'manager'\)/);
    expect(apply).not.toMatch(/DELETE FROM public\.users/);
    expect(apply).not.toMatch(/DELETE FROM auth\.users/);
    expect(apply).toMatch(/unique_violation/);
    expect(apply).toMatch(/Could not reuse the existing account for this email/);
    expect(apply).toMatch(/'failed'/);
    expect(apply).toMatch(/EXCEPTION WHEN OTHERS THEN/);
    expect(apply).not.toMatch(/upsert/i);
    expect(mig).toMatch(/cardinality\(p_emails\) > 1000/);
    expect(mig).toMatch(/jsonb_array_length\(p_plan->'creates'\), 0\) > 1000/);
    expect(apply).toMatch(/IF v_fail_create = 0 AND v_fail_attach = 0 AND v_fail_link = 0 AND v_fail_update = 0 THEN/);
    expect(apply).toMatch(/successful rows commit when the function returns/);
    expect(apply).not.toMatch(/the whole sync rolls back/);
    expect(apply).not.toMatch(/No roster changes were saved/);
    const protectedRaise = apply.indexOf("Airtable cannot change an owner, admin, or manager");
    const rowHandler = apply.indexOf("EXCEPTION WHEN OTHERS THEN");
    expect(protectedRaise).toBeGreaterThan(0);
    expect(rowHandler).toBeGreaterThan(protectedRaise);
    expect(apply).not.toMatch(/SET status = 'active'/);
    expect(apply).not.toMatch(/SET role =/);
    expect(apply).not.toMatch(/SET email =/);
  });

  it("rechecks the exact membership user and company on every write", () => {
    expect(apply).toMatch(/cm\.company_id = p_company_id AND cm\.user_id = v_user_id/);
    expect(apply).toMatch(/v_member_user IS DISTINCT FROM \(v_item->>'user_id'\)::uuid/);
    expect(apply).toMatch(/Airtable cannot remove an owner, admin, or manager/);
    expect(apply).toMatch(/Airtable cannot change role, status, or email/);
  });

  it("rolls back by dropping only the new functions", () => {
    expect(rollback).toMatch(/DROP FUNCTION IF EXISTS public\.apply_airtable_roster_sync\(uuid, text, text, jsonb\)/);
    expect(rollback).toMatch(/DROP FUNCTION IF EXISTS public\.airtable_roster_email_owners\(text\[\]\)/);
    expect(rollback).not.toMatch(/DROP TABLE/);
    expect(rollback).not.toMatch(/DELETE FROM/);
  });
});
