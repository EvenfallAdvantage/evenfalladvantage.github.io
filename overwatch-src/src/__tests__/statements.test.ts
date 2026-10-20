import { describe, it, expect } from "vitest";
import { canonicalStatement, statementSha256, validateDraft, roleLabel } from "@/lib/statements/statement";
import { createHash } from "node:crypto";

const base = { person_role: "witness", full_name: "Jo Witness", phone: "", email: "", address: "", statement: "I saw it clearly", declined: false };

describe("statements", () => {
  it("fingerprint matches the DB trigger's canonical form", async () => {
    expect(canonicalStatement(base)).toBe("Jo Witness\nwitness\nI saw it clearly\nfalse");
    expect(await statementSha256(base)).toBe(createHash("sha256").update("Jo Witness\nwitness\nI saw it clearly\nfalse").digest("hex"));
  });
  it("validates drafts", () => {
    expect(validateDraft({ ...base, full_name: " " }, "sig")).toMatch(/name/);
    expect(validateDraft({ ...base, statement: "" }, "sig")).toMatch(/statement/);
    expect(validateDraft(base, null)).toMatch(/sign/);
    expect(validateDraft({ ...base, email: "nope" }, "sig")).toMatch(/Email/);
    expect(validateDraft({ ...base, statement: "", declined: true }, null)).toBeNull();
    expect(validateDraft(base, "sig")).toBeNull();
    expect(roleLabel("reporting_party")).toBe("Reporting party");
  });
});
