import { assert, assertEquals } from "jsr:@std/assert@1";
import {
  MAX_BODY_BYTES, MAX_FIELDS, applyMappings, buildLeadEmail, checkOrigin, checkScopes,
  corsHeaders, notifyRecipients, parseAllowedOrigins, validatePayload,
} from "./lib.ts";

const allowed = parseAllowedOrigins("");

Deno.test("origin: evenfalladvantage.com allowed, others rejected, no-origin = server call", () => {
  assertEquals(checkOrigin("https://www.evenfalladvantage.com", allowed), { ok: true, browser: true });
  assertEquals(checkOrigin("https://evil.example", allowed), { ok: false });
  assertEquals(checkOrigin(null, allowed), { ok: true, browser: false });
});

Deno.test("origin: extra origins via INTAKE_ALLOWED_ORIGINS, junk ignored", () => {
  const list = parseAllowedOrigins("https://acme.example, not a url ,http://localhost:3000/");
  assert(list.includes("https://acme.example"));
  assert(list.includes("http://localhost:3000"));
  assert(!list.some((o) => o.includes(" ")));
});

Deno.test("cors: Allow-Origin echoes allowed origins only (never *)", () => {
  assertEquals(corsHeaders("https://www.evenfalladvantage.com", allowed)["Access-Control-Allow-Origin"], "https://www.evenfalladvantage.com");
  assertEquals(corsHeaders("https://evil.example", allowed)["Access-Control-Allow-Origin"], undefined);
});

Deno.test("scopes: intake:write required; browser keys must be intake-only", () => {
  assertEquals(checkScopes(["intake:write"], true), { ok: true });
  assertEquals(checkScopes(["intake:write", "admin"], false), { ok: true });
  assertEquals(checkScopes(["intake:write", "admin"], true).ok, false);
  assertEquals(checkScopes(["read"], false).ok, false);
  assertEquals(checkScopes(null, false).ok, false);
});

Deno.test("validate: accepts a normal estimate-form payload", () => {
  const r = validatePayload(JSON.stringify({
    client_name: " Jane Doe ", client_email: "jane@example.com", service: "Security Consulting",
    "event-type": ["Concert", "Festival"], company_website: "",
  }));
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.honeypot, false);
    assertEquals(r.payload.client_name, "Jane Doe");
    assertEquals(r.payload["event-type"], ["Concert", "Festival"]);
    assertEquals("company_website" in r.payload, false);
  }
});

Deno.test("validate: honeypot filled -> flagged, contact not required, field not stored", () => {
  const r = validatePayload(JSON.stringify({ company_website: "http://spam", message: "buy now" }));
  assert(r.ok && r.honeypot);
  if (r.ok) assertEquals("company_website" in r.payload, false);
});

Deno.test("validate: limits and shape", () => {
  assertEquals(validatePayload("x".repeat(MAX_BODY_BYTES + 1)), { ok: false, status: 413, error: "payload_too_large" });
  assertEquals(validatePayload("[]"), { ok: false, status: 400, error: "body_must_be_object" });
  assertEquals(validatePayload("{bad"), { ok: false, status: 400, error: "invalid_json" });
  assertEquals(validatePayload("  "), { ok: false, status: 400, error: "empty_body" });
  const many: Record<string, string> = { client_email: "a@b.co" };
  for (let i = 0; i < MAX_FIELDS + 1; i++) many[`f${i}`] = "x";
  assertEquals(validatePayload(JSON.stringify(many)), { ok: false, status: 400, error: "too_many_fields" });
  assertEquals(validatePayload(JSON.stringify({ client_email: "not-an-email" })).ok, false);
  assertEquals(validatePayload(JSON.stringify({ client_name: "No contact" })), { ok: false, status: 400, error: "missing_contact" });
});

Deno.test("validate: drops nested objects, prototype keys, control chars; caps strings", () => {
  const r = validatePayload(JSON.stringify({
    client_phone: "555\u0000-0100", nested: { a: 1 }, __proto__: "x", long: "y".repeat(6000),
  }));
  assert(r.ok);
  if (r.ok) {
    assertEquals(r.payload.client_phone, "555-0100");
    assertEquals("nested" in r.payload, false);
    assertEquals(Object.prototype.hasOwnProperty.call(r.payload, "__proto__"), false);
    assertEquals((r.payload.long as string).length, 5000);
  }
});

Deno.test("mapping: canonical keys map to themselves; explicit mappings win", () => {
  const { canonical, extra } = applyMappings(
    { client_name: "Jane", "full-name": "Jane D", email: "j@x.co", service: "Training", page: "/forms/a.html" },
    [{ source_field: "email", canonical_field: "client_email" }],
  );
  assertEquals(canonical, { client_name: "Jane", client_email: "j@x.co", service: "Training" });
  assertEquals(extra, { "full-name": "Jane D", page: "/forms/a.html" });
});

Deno.test("notify: recipients come from settings.intakeNotifyEmails, validated, max 5", () => {
  assertEquals(notifyRecipients({}), []);
  assertEquals(notifyRecipients({ intakeNotifyEmails: ["Contact@EvenfallAdvantage.com", "bad", "contact@evenfalladvantage.com"] }), ["contact@evenfalladvantage.com"]);
  assertEquals(notifyRecipients({ intakeNotifyEmails: "a@x.co, b@x.co" }), ["a@x.co", "b@x.co"]);
  assertEquals(notifyRecipients({ intakeNotifyEmails: ["a@x.co", "b@x.co", "c@x.co", "d@x.co", "e@x.co", "f@x.co"] }).length, 5);
});

Deno.test("email: escapes HTML and strips newlines from the subject", () => {
  const e = buildLeadEmail({
    companyName: "Evenfall <Advantage>",
    canonical: { client_name: "Eve\r\nBcc: x@y.z", service: "<script>alert(1)</script>" },
    extra: { note: "<img src=x onerror=alert(1)>" },
    submissionId: "s-1",
    appUrl: "https://www.evenfalladvantage.com/overwatch",
  });
  assertEquals(/[\r\n]/.test(e.subject), false);
  assertEquals(e.html.includes("<script>"), false);
  assertEquals(e.html.includes("<img src=x"), false);
  assert(e.html.includes("&lt;script&gt;"));
});
