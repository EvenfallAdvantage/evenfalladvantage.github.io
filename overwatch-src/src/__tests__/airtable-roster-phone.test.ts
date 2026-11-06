import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const dir = join(__dirname, "../../supabase/migrations");
const mig = readFileSync(join(dir, "20261106234500_airtable_roster_phone_conflict.sql"), "utf8");
const rollback = readFileSync(join(dir, "rollback/20261106234500_airtable_roster_phone_conflict.rollback.sql"), "utf8");
const apply = mig.slice(mig.indexOf("FUNCTION public.apply_airtable_roster_sync"));
const phoneFn = mig.slice(
  mig.indexOf("FUNCTION public.airtable_roster_phone_to_store"),
  mig.indexOf("FUNCTION public.airtable_roster_failure_text"),
);

describe("Airtable roster phone conflict migration", () => {
  it("keeps phone conflicts inside the row and does not touch other accounts", () => {
    expect(mig).not.toMatch(/UPDATE public\.users SET phone = NULL/);
    expect(mig).not.toMatch(/DELETE FROM public\.users/);
    expect(mig).not.toMatch(/DELETE FROM auth\.users/);
    expect(mig).not.toMatch(/DROP INDEX[\s\S]*users_phone_key/);
    expect(mig).not.toMatch(/DROP CONSTRAINT[\s\S]*users_phone_key/);
    expect(phoneFn).toMatch(/pg_try_advisory_xact_lock/);
    expect(phoneFn).not.toMatch(/(?<!try_)pg_advisory_xact_lock\(/);
    const lockAt = phoneFn.indexOf("pg_try_advisory_xact_lock");
    const existsAt = phoneFn.indexOf("IF EXISTS");
    expect(lockAt).toBeGreaterThan(0);
    expect(existsAt).toBeGreaterThan(lockAt);
    expect(phoneFn).toMatch(/RETURN NULL/);
    expect(phoneFn).not.toMatch(/UPDATE public\.users/);
    expect(apply).toMatch(/users_phone_key/);
    const phoneGuard = apply.indexOf("users_phone_key");
    const emailReuse = apply.indexOf("Could not reuse the existing account for this email");
    expect(phoneGuard).toBeGreaterThan(0);
    expect(emailReuse).toBeGreaterThan(phoneGuard);
    expect(apply).toMatch(/Do not copy this row's phone onto the reused account/);
    expect(apply).toMatch(/phone = coalesce\(v_phone, phone\)/);
    expect(apply).not.toMatch(/left\(SQLERRM/);
    expect(apply).toMatch(/EXCEPTION WHEN OTHERS THEN/);
    expect(apply).toMatch(/IF v_fail_create = 0 AND v_fail_attach = 0 AND v_fail_link = 0 AND v_fail_update = 0 THEN/);
    expect(apply).toMatch(/ORDER BY 1/);
    expect(apply).toMatch(/pg_try_advisory_xact_lock/);
    const sortedLock = apply.indexOf("ORDER BY 1");
    const firstRowLock = apply.indexOf("FOR UPDATE;");
    expect(sortedLock).toBeGreaterThan(0);
    expect(firstRowLock).toBeGreaterThan(sortedLock);
    expect(apply).toMatch(/Airtable cannot remove an owner, admin, or manager/);
    expect(apply).toMatch(/role::text NOT IN \('owner', 'admin', 'manager'\)/);
  });

  it("does not expose the helpers or the other account", () => {
    expect(mig).toMatch(/REVOKE ALL ON FUNCTION public\.airtable_roster_phone_to_store\(uuid, text\) FROM PUBLIC, anon, authenticated/);
    expect(mig).toMatch(/REVOKE ALL ON FUNCTION public\.airtable_roster_failure_text\(text, text\) FROM PUBLIC, anon, authenticated/);
    expect(mig).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.airtable_roster_phone_to_store/);
    expect(mig).not.toMatch(/GRANT EXECUTE ON FUNCTION public\.airtable_roster_failure_text/);
    expect(phoneFn).not.toMatch(/RETURN u\.id/);
    expect(phoneFn).not.toMatch(/u\.email/);
    expect(mig).toMatch(/Accounts are not matched or merged by phone/);
  });

  it("rolls back to the previous function without deleting accounts", () => {
    expect(rollback).toMatch(/DROP FUNCTION IF EXISTS public\.airtable_roster_phone_to_store\(uuid, text\)/);
    expect(rollback).toMatch(/DROP FUNCTION IF EXISTS public\.airtable_roster_failure_text\(text, text\)/);
    expect(rollback).toMatch(/CREATE OR REPLACE FUNCTION public\.apply_airtable_roster_sync/);
    const restored = rollback.slice(rollback.indexOf("CREATE OR REPLACE FUNCTION public.apply_airtable_roster_sync"));
    expect(restored).not.toMatch(/airtable_roster_phone_to_store/);
    expect(restored).toMatch(/DELETE FROM public\.company_memberships/);
    expect(rollback).not.toMatch(/DELETE FROM public\.users/);
    expect(rollback).not.toMatch(/DELETE FROM auth\.users/);
    expect(rollback).not.toMatch(/UPDATE public\.users SET phone = NULL/);
  });
});
