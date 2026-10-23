import { assert, assertEquals } from "jsr:@std/assert@1";
import { buildInvitationEmail } from "./templates.ts";

const base = {
  firstName: "Pat",
  companyName: "Evenfall Advantage LLC",
  inviteUrl: "https://example.invalid/verify?token=x",
  inviterName: "Tester",
};

Deno.test("invitation email states the link lifetime in hours", () => {
  const r = buildInvitationEmail({ ...base, expiresInHours: 24 });
  assertEquals(r.subject, "You're invited to join Evenfall Advantage LLC on Overwatch");
  assert(r.html.includes("works once and expires in 24 hours."));
  assert(r.text.includes("works once and expires in 24 hours."));
  assert(!/days/.test(r.html + r.text));
});

Deno.test("invitation email uses the singular for one hour", () => {
  const r = buildInvitationEmail({ ...base, expiresInHours: 1 });
  assert(r.text.includes("works once and expires in 1 hour."));
});
