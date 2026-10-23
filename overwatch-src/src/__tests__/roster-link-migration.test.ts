import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { expiredLinkMessage } from "@/lib/auth/link-messages";

const dir = join(__dirname, "../../supabase/migrations");
const mig = readFileSync(join(dir, "20261023050000_roster_link_verified_email.sql"), "utf8");
const rb = readFileSync(join(dir, "rollback/20261023050000_roster_link_verified_email.rollback.sql"), "utf8");
const accept = mig.slice(mig.indexOf("FUNCTION public.accept_roster_invitation"), mig.indexOf("FUNCTION public.join_company_by_code"));
const join_ = mig.slice(mig.indexOf("FUNCTION public.join_company_by_code"));

describe("20261023050000 roster link by verified email", () => {
  it("accept_roster_invitation requires a confirmed auth email and an unlinked caller", () => {
    expect(accept).toMatch(/AND email_confirmed_at IS NOT NULL/);
    expect(accept).toMatch(/IF NOT EXISTS \(SELECT 1 FROM public\.users WHERE supabase_id = v_caller_supabase_id\)/);
    expect(accept).toMatch(/SECURITY DEFINER/);
    expect(accept).toMatch(/SET search_path TO ''/);
  });

  it("join_company_by_code links by verified auth email, identity from auth.uid()", () => {
    expect(join_).toMatch(/v_uid := auth\.uid\(\)::text/);
    expect(join_).toMatch(/email_confirmed_at IS NOT NULL\)\s+INTO v_auth_email, v_confirmed/);
    expect(join_).toMatch(/IF NOT v_confirmed THEN\s+RETURN jsonb_build_object\('error'/);
    expect(join_).toMatch(/UPDATE public\.users SET supabase_id = v_uid/);
    // p_email is never used to pick the row to claim
    expect(join_).not.toMatch(/lower\(email\) = lower\(p_email\)/);
  });

  it("keeps #45 role rules: new memberships are staff, existing ones untouched", () => {
    expect(join_).toMatch(/v_user\.id, v_company\.id, 'staff', 'active'/);
    expect(join_).not.toMatch(/UPDATE public\.company_memberships/);
  });

  it("grants only to authenticated/service_role and has a rollback", () => {
    expect(mig).toMatch(/REVOKE ALL ON FUNCTION public\.accept_roster_invitation\(\) FROM PUBLIC, anon/);
    expect(mig).toMatch(/REVOKE ALL ON FUNCTION public\.join_company_by_code\(text,text,text,text,text,text\) FROM PUBLIC, anon/);
    expect(mig).not.toMatch(/TO anon/);
    expect(rb).toMatch(/CREATE OR REPLACE FUNCTION public\.accept_roster_invitation/);
    expect(rb).not.toMatch(/email_confirmed_at IS NOT NULL\)\s+INTO v_auth_email/);
  });
});

describe("expiredLinkMessage", () => {
  it("tells invitees to ask for a resend, reset users to request a new link", () => {
    expect(expiredLinkMessage(true)).toMatch(/Ask your company admin to resend/);
    expect(expiredLinkMessage(false)).toMatch(/request a new one/);
  });
});
