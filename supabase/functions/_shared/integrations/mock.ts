/**
 * Mock adapter: exercises every framework path (OAuth code + PKCE, refresh,
 * test, signed webhooks, queued jobs) against a fake vendor. Registered only
 * when INTEGRATIONS_ENABLE_MOCK=true, so it never appears in production UI.
 * Tests replay recorded responses from fixtures/mock-*.json.
 */
import { hmacSha256Hex, timingSafeEqual } from "./crypto.ts";
import { vendorJson } from "./vendor-fetch.ts";
import { VendorError, type VendorAdapter } from "./types.ts";

export const MOCK_BASE = "https://mock-vendor.invalid";

interface MockTokenResponse { access_token: string; refresh_token: string; expires_in: number; account: { id: string; name: string } }

const expiry = (now: Date, s: number) => new Date(now.getTime() + s * 1000).toISOString();

export const mockAdapter: VendorAdapter = {
  provider: "mock",
  label: "Mock vendor",
  authType: "oauth_code",
  scopes: ["read", "write"],
  authorizeUrl({ state, redirectUri, codeChallenge, env }) {
    const q = new URLSearchParams({
      response_type: "code",
      client_id: env("MOCK_CLIENT_ID") ?? "mock-client",
      redirect_uri: redirectUri,
      scope: "read write",
      state,
    });
    if (codeChallenge) { q.set("code_challenge", codeChallenge); q.set("code_challenge_method", "S256"); }
    return `${MOCK_BASE}/oauth/authorize?${q}`;
  },
  async exchangeCode({ code, redirectUri, verifier }, ctx) {
    const r = await vendorJson<MockTokenResponse>(`${MOCK_BASE}/oauth/token`, {
      method: "POST",
      fetchImpl: ctx.fetch,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri, code_verifier: verifier ?? "" }).toString(),
    });
    return {
      access_token: r.access_token,
      refresh_token: r.refresh_token,
      expires_at: expiry(ctx.now(), r.expires_in),
      externalAccountId: r.account.id,
      externalAccountName: r.account.name,
    };
  },
  async refresh(tokens, ctx) {
    if (!tokens.refresh_token) throw new VendorError("no refresh token", 400);
    const r = await vendorJson<MockTokenResponse>(`${MOCK_BASE}/oauth/token`, {
      method: "POST",
      fetchImpl: ctx.fetch,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: tokens.refresh_token }).toString(),
    });
    // Single-use refresh tokens (Gusto-style): the new one replaces the old.
    return { ...tokens, access_token: r.access_token, refresh_token: r.refresh_token, expires_at: expiry(ctx.now(), r.expires_in) };
  },
  async test(conn, ctx) {
    try {
      const me = await vendorJson<{ account: { id: string; name: string } }>(`${MOCK_BASE}/v1/me`, {
        fetchImpl: ctx.fetch,
        headers: { Authorization: `Bearer ${conn.secrets.access_token ?? ""}` },
      });
      return { ok: true, externalAccountName: me.account.name };
    } catch (e) {
      if (e instanceof VendorError && (e.status === 401 || e.status === 403)) return { ok: false, detail: "Credentials were rejected" };
      throw e;
    }
  },
  webhookNeedsConnection: false,
  async verifyWebhook({ rawBody, headers, env }) {
    const key = env("MOCK_WEBHOOK_SECRET");
    const sig = headers.get("x-mock-signature");
    if (!key || !sig) return false; // fail closed
    return timingSafeEqual(sig, await hmacSha256Hex(key, rawBody));
  },
  identifyWebhook(payload) {
    const p = payload as { id?: string; type?: string; account_id?: string };
    if (!p?.id) throw new VendorError("event id missing", 400);
    return { eventId: String(p.id), type: p.type ?? null, externalAccountId: p.account_id ?? null };
  },
  handleWebhook(event, _conn, ctx) {
    ctx.log("mock webhook handled", { type: event.type });
    return Promise.resolve();
  },
  actions: {
    status: { access: "read", run: (conn) => Promise.resolve({ status: conn.status }) },
    send: { access: "manage", queued: true, run: () => Promise.resolve({ queued: true }) },
    export: { access: "manage", queued: true, run: () => Promise.resolve({ queued: true }) },
  },
  jobs: {
    async send(conn, payload, ctx) {
      return await vendorJson(`${MOCK_BASE}/v1/messages`, {
        method: "POST",
        fetchImpl: ctx.fetch,
        headers: { Authorization: `Bearer ${conn.secrets.access_token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
    async export(conn, payload, ctx) {
      return await vendorJson(`${MOCK_BASE}/v1/exports`, {
        method: "POST",
        fetchImpl: ctx.fetch,
        headers: { Authorization: `Bearer ${conn.secrets.access_token ?? ""}`, "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    },
  },
};
