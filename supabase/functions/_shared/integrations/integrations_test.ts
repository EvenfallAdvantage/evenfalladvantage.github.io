import { assert, assertEquals, assertMatch, assertRejects } from "jsr:@std/assert@1";
import { jobOutcome, nextRunAt, refreshDue } from "./backoff.ts";
import { hmacSha256Hex, pkcePair, timingSafeEqual } from "./crypto.ts";
import { mockAdapter, MOCK_BASE } from "./mock.ts";
import { checkState } from "./oauth-state.ts";
import { redactPayload, safeError } from "./redact.ts";
import { getAdapter } from "./registry.ts";
import { allowed, canManage, canRead } from "./roles.ts";
import type { AdapterCtx, LiveConnection } from "./types.ts";
import { appRedirect, oauthCallbackUrl, providerFromPath, webhookUrl } from "./urls.ts";
import { retryDelayMs, vendorFetch } from "./vendor-fetch.ts";
import { handleWebhookRequest, type WebhookStore } from "./webhook-core.ts";

const rec = JSON.parse(await Deno.readTextFile(new URL("./fixtures/mock-recorded.json", import.meta.url)));
const reply = (k: string) => {
  const r = rec[k];
  return new Response(JSON.stringify(r.body), { status: r.status, headers: { "Content-Type": "application/json", ...(r.headers ?? {}) } });
};
const envOf = (o: Record<string, string>) => (n: string) => o[n];
const NOW = new Date("2026-10-10T17:00:00Z");

function ctxWith(routes: (url: string, init?: RequestInit) => Response, calls: string[] = []): AdapterCtx {
  return {
    fetch: (url, init) => { calls.push(`${init?.method ?? "GET"} ${url.replace(MOCK_BASE, "")}`); return Promise.resolve(routes(url, init)); },
    env: envOf({}), now: () => NOW, log: () => {},
  };
}
const conn = (secrets: Record<string, unknown> = { access_token: "at_1" }): LiveConnection => ({
  id: "c1", company_id: "co1", provider: "mock", status: "connected", auth_type: "oauth_code", vault_secret_id: "v1",
  access_expires_at: null, external_account_id: "acct_42", settings: {}, secrets,
});

Deno.test("urls: custom domain when set, Supabase fallback otherwise, never http", () => {
  const sb = { SUPABASE_URL: "https://nneueuvyeohwnspbwfub.supabase.co" };
  assertEquals(oauthCallbackUrl("gusto", envOf(sb)), "https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/integration-oauth-callback/gusto");
  assertEquals(webhookUrl("checkr", envOf(sb)), "https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/integration-webhook/checkr");
  const custom = { ...sb, INTEGRATIONS_PUBLIC_BASE: "https://api.evenfalladvantage.com/integrations/" };
  assertEquals(oauthCallbackUrl("gusto", envOf(custom)), "https://api.evenfalladvantage.com/integrations/oauth/callback/gusto");
  assertEquals(webhookUrl("checkr", envOf(custom)), "https://api.evenfalladvantage.com/integrations/webhook/checkr");
  assertEquals(webhookUrl("checkr", envOf({ ...sb, INTEGRATIONS_PUBLIC_BASE: "http://api.evenfalladvantage.com" })), "https://nneueuvyeohwnspbwfub.supabase.co/functions/v1/integration-webhook/checkr");
  assertEquals(providerFromPath("https://x.supabase.co/functions/v1/integration-webhook/quickbooks"), "quickbooks");
  assertEquals(providerFromPath("https://api.evenfalladvantage.com/integrations/webhook/Bad-Name"), null);
});

Deno.test("urls: post-OAuth redirect only to same-app relative paths", () => {
  const env = envOf({ OVERWATCH_APP_URL: "https://www.evenfalladvantage.com/overwatch" });
  assertEquals(appRedirect(env, "mock", "ok", "/admin/settings"), "https://www.evenfalladvantage.com/overwatch/admin/settings?integration=mock&result=ok#hq-integrations");
  for (const evil of ["//evil.com", "https://evil.com", "/x?y=1", "javascript:alert(1)"]) {
    assert(appRedirect(env, "mock", "ok", evil).startsWith("https://www.evenfalladvantage.com/overwatch/admin/settings?"));
  }
});

Deno.test("crypto: PKCE S256, constant-time compare rejects empty", async () => {
  const { verifier, challenge } = await pkcePair();
  assert(verifier.length >= 43);
  assertMatch(challenge, /^[A-Za-z0-9_-]{43}$/);
  assert(timingSafeEqual("abc", "abc"));
  assert(!timingSafeEqual("abc", "abd"));
  assert(!timingSafeEqual("", ""));
  assert(!timingSafeEqual(null, "x"));
});

Deno.test("oauth state: missing / wrong provider / used / expired are rejected", () => {
  const row = { state: "s".repeat(43), company_id: "co1", provider: "mock", user_id: "u1", code_verifier: "v", redirect_after: null, expires_at: "2026-10-10T17:05:00Z", used_at: null };
  assertEquals(checkState(row, "mock", NOW), { ok: true });
  assertEquals(checkState(null, "mock", NOW), { ok: false, reason: "missing" });
  assertEquals(checkState(row, "gusto", NOW), { ok: false, reason: "provider_mismatch" });
  assertEquals(checkState({ ...row, used_at: "2026-10-10T16:59:00Z" }, "mock", NOW), { ok: false, reason: "used" });
  assertEquals(checkState({ ...row, expires_at: "2026-10-10T16:59:59Z" }, "mock", NOW), { ok: false, reason: "expired" });
});

Deno.test("roles: owner/admin manage, manager read-only, others nothing", () => {
  assert(canManage("owner") && canManage("admin") && !canManage("manager") && !canManage("lead"));
  assert(canRead("manager") && !canRead("staff") && !canRead(null));
  assert(allowed("read", "manager") && !allowed("manage", "manager"));
});

Deno.test("registry: mock adapter only with INTEGRATIONS_ENABLE_MOCK=true; unknown = null", () => {
  assertEquals(getAdapter("mock", envOf({})), null);
  assertEquals(getAdapter("mock", envOf({ INTEGRATIONS_ENABLE_MOCK: "true" }))?.provider, "mock");
  assertEquals(getAdapter("gusto", envOf({})), null);
  assertEquals(getAdapter("__proto__", envOf({})), null);
});

Deno.test("mock adapter: authorize URL carries state + PKCE", () => {
  const u = new URL(mockAdapter.authorizeUrl!({ state: "st", redirectUri: "https://r/cb", codeChallenge: "ch", env: envOf({}) }));
  assertEquals(u.searchParams.get("state"), "st");
  assertEquals(u.searchParams.get("code_challenge_method"), "S256");
  assertEquals(u.searchParams.get("redirect_uri"), "https://r/cb");
});

Deno.test("mock adapter: code exchange + single-use refresh replay recorded responses", async () => {
  const calls: string[] = [];
  const ctx = ctxWith((_u, init) => reply(String(init?.body).includes("refresh_token=") ? "POST /oauth/token refresh_token" : "POST /oauth/token authorization_code"), calls);
  const t = await mockAdapter.exchangeCode!({ code: "c", redirectUri: "https://r/cb", verifier: "v", query: new URLSearchParams() }, ctx);
  assertEquals([t.access_token, t.refresh_token, t.externalAccountId, t.externalAccountName], ["at_1", "rt_1", "acct_42", "Acme Security LLC"]);
  assertEquals(t.expires_at, "2026-10-10T19:00:00.000Z");
  const r = await mockAdapter.refresh!({ access_token: "at_1", refresh_token: "rt_1" }, ctx);
  assertEquals([r.access_token, r.refresh_token], ["at_2", "rt_2"]);
  assertEquals(calls, ["POST /oauth/token", "POST /oauth/token"]);
});

Deno.test("mock adapter: test() ok vs revoked credentials", async () => {
  assertEquals(await mockAdapter.test(conn(), ctxWith(() => reply("GET /v1/me ok"))), { ok: true, externalAccountName: "Acme Security LLC" });
  assertEquals((await mockAdapter.test(conn(), ctxWith(() => reply("GET /v1/me revoked")))).ok, false);
});

Deno.test("vendorFetch: retries 429 honouring Retry-After, then succeeds", async () => {
  let n = 0;
  const slept: number[] = [];
  const res = await vendorFetch(`${MOCK_BASE}/v1/messages`, {
    method: "POST", sleep: (ms) => { slept.push(ms); return Promise.resolve(); },
    fetchImpl: () => Promise.resolve(reply(n++ === 0 ? "POST /v1/messages 429" : "POST /v1/messages ok")),
  });
  assertEquals(res.status, 201);
  assertEquals(slept, [0]);
  assertEquals(retryDelayMs(3, null), 2000);
  await assertRejects(() => vendorFetch("https://x", { retries: 1, sleep: () => Promise.resolve(), fetchImpl: () => Promise.reject(new Error("down")) }));
});

Deno.test("backoff + refresh window", () => {
  const r = () => 0.5; // no jitter
  assertEquals(nextRunAt(1, NOW, r).getTime() - NOW.getTime(), 60_000);
  assertEquals(nextRunAt(4, NOW, r).getTime() - NOW.getTime(), 3_600_000);
  assertEquals(nextRunAt(99, NOW, r).getTime() - NOW.getTime(), 720 * 60_000);
  assertEquals(jobOutcome(2, 6, true), "failed");
  assertEquals(jobOutcome(6, 6, true), "dead");
  assertEquals(jobOutcome(1, 6, false), "dead");
  assert(refreshDue("2026-10-10T17:10:00Z", NOW));
  assert(!refreshDue("2026-10-10T18:00:00Z", NOW));
  assert(!refreshDue(null, NOW));
});

Deno.test("redaction: secrets/PII keys stripped, errors scrubbed", () => {
  const out = redactPayload(rec.webhook) as { data: { employee: Record<string, unknown> } };
  assertEquals(out.data.employee.ssn, "[redacted]");
  assertEquals(out.data.employee.id, "e1");
  assertEquals(safeError(new Error(`401 Bearer abc.def for joe@x.com key opaque_${"z".repeat(40)}`)), "401 Bearer [redacted] for [email] key [redacted]");
});

// ── webhook pipeline ──
function memStore() {
  const events = new Map<string, unknown>();
  const audits: string[] = [];
  const touched: string[] = [];
  const store: WebhookStore = {
    findConnection: (_p, acct) => Promise.resolve(acct === "acct_42" ? conn() : null),
    insertEvent: (e) => {
      const k = `${e.provider}:${e.eventId}`;
      if (events.has(k)) return Promise.resolve({ inserted: false });
      events.set(k, e.payload);
      return Promise.resolve({ inserted: true, id: "ev1" });
    },
    touchConnection: (id) => { touched.push(id); return Promise.resolve(); },
    audit: (e) => { audits.push(e.outcome); return Promise.resolve(); },
  };
  return { store, events, audits, touched };
}
const SECRET = "whsec_test";
const webhookEnv = envOf({ MOCK_WEBHOOK_SECRET: SECRET });
async function signedReq(body: string, sig?: string) {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (sig !== undefined) headers["x-mock-signature"] = sig;
  else headers["x-mock-signature"] = await hmacSha256Hex(SECRET, body);
  return new Request("https://x/functions/v1/integration-webhook/mock", { method: "POST", body, headers });
}

Deno.test("webhook: valid signature stored once (redacted), duplicate is 200 no-op", async () => {
  const m = memStore();
  const body = JSON.stringify(rec.webhook);
  const r1 = await handleWebhookRequest(await signedReq(body), mockAdapter, "mock", m.store, webhookEnv);
  assertEquals(r1.response.status, 200);
  assertEquals(r1.process?.eventId, "evt_100");
  assertEquals(m.touched, ["c1"]);
  assertEquals(((m.events.get("mock:evt_100") as typeof rec.webhook).data.employee.ssn), "[redacted]");
  const r2 = await handleWebhookRequest(await signedReq(body), mockAdapter, "mock", m.store, webhookEnv);
  assertEquals(await r2.response.json(), { ok: true, duplicate: true });
  assertEquals(r2.process, undefined);
});

Deno.test("webhook: FAIL-CLOSED on missing/bad signature or missing secret", async () => {
  const body = JSON.stringify(rec.webhook);
  for (const [req, env] of [
    [await signedReq(body, ""), webhookEnv],
    [await signedReq(body, "deadbeef"), webhookEnv],
    [await signedReq(body), envOf({})],
    [new Request("https://x/w/mock", { method: "POST", body }), webhookEnv],
  ] as const) {
    const m = memStore();
    const r = await handleWebhookRequest(req, mockAdapter, "mock", m.store, env);
    assertEquals(r.response.status, 401);
    assertEquals(m.events.size, 0);
  }
});

Deno.test("webhook: unknown provider 404, GET without handshake 405, oversize 413", async () => {
  const m = memStore();
  assertEquals((await handleWebhookRequest(new Request("https://x/w/zzz", { method: "POST", body: "{}" }), null, "zzz", m.store, webhookEnv)).response.status, 404);
  assertEquals((await handleWebhookRequest(new Request("https://x/w/mock"), mockAdapter, "mock", m.store, webhookEnv)).response.status, 405);
  const big = "x".repeat(600 * 1024);
  assertEquals((await handleWebhookRequest(await signedReq(big), mockAdapter, "mock", m.store, webhookEnv)).response.status, 413);
});

Deno.test("mock jobs: send replays recorded vendor response", async () => {
  const out = await mockAdapter.jobs!.send(conn(), { to: "x" }, ctxWith(() => reply("POST /v1/messages ok")));
  assertEquals(out, { id: "msg_1" });
});
