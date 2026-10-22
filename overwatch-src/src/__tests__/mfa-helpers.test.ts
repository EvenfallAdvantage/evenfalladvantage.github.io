import { describe, expect, it } from "vitest";
import { cleanCode, mfaRequiredFor, REQUIRE_MFA_ADMINS_KEY } from "@/lib/security/mfa";

describe("mfa helpers", () => {
  it("cleanCode keeps 6 digits", () => {
    expect(cleanCode(" 12 34-56 7")).toBe("123456");
    expect(cleanCode("abc")).toBe("");
  });
  it("requires 2FA only for owner/admin when the company setting is on", () => {
    const on = { [REQUIRE_MFA_ADMINS_KEY]: true };
    expect(mfaRequiredFor("owner", on)).toBe(true);
    expect(mfaRequiredFor("admin", on)).toBe(true);
    expect(mfaRequiredFor("manager", on)).toBe(false);
    expect(mfaRequiredFor("staff", on)).toBe(false);
    expect(mfaRequiredFor("owner", {})).toBe(false);
    expect(mfaRequiredFor("owner", null)).toBe(false);
  });
});
