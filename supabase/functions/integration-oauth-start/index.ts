/**
 * integration-oauth-start (PR V0)
 * Auth: user JWT (verify_jwt = true); caller must be owner/admin of company_id.
 * Body: { company_id, provider, redirect_after? }
 * Stores a single-use state (+ PKCE verifier) for 10 minutes, marks the
 * connection "pending" (unless already connected), audits, returns { url }.
 */
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { logAudit, getCallerIp } from "../_shared/audit.ts";
import { pkcePair, randomToken } from "../_shared/integrations/crypto.ts";
import { adapterCtx, callerRole, env, jsonResponder, serviceClient } from "../_shared/integrations/http.ts";
import { getAdapter } from "../_shared/integrations/registry.ts";
import { canManage } from "../_shared/integrations/roles.ts";
import { isProviderSlug, oauthCallbackUrl } from "../_shared/integrations/urls.ts";
import { getConnection } from "../_shared/integrations/connections.ts";

Deno.serve(async (req) => {
  const { cors, json } = jsonResponder(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  try {
    const body = await req.json().catch(() => null) as { company_id?: string; provider?: string; redirect_after?: string } | null;
    if (!body?.company_id || !isProviderSlug(body.provider)) return json(400, { error: "company_id and provider are required" });
    const adapter = getAdapter(body.provider, env);
    if (!adapter || adapter.authType !== "oauth_code" || !adapter.authorizeUrl) return json(400, { error: "This provider does not use OAuth" });

    const admin = serviceClient();
    const caller = await callerRole(req, admin, body.company_id);
    if (!caller.authUserId) return json(401, { error: "Unauthorized" });
    if (!canManage(caller.role)) {
      await logAudit(admin, { event_type: `integration.${body.provider}.connect`, company_id: body.company_id, user_id: caller.userId, outcome: "blocked", entity_type: "integration", ip_address: getCallerIp(req) });
      return json(403, { error: "Only owners and admins can connect integrations" });
    }
    if (adapter.isConfigured && !adapter.isConfigured(env)) {
      return json(503, { error: "This integration isn't configured on the platform yet" });
    }

    const state = randomToken(32);
    const { verifier, challenge } = await pkcePair();
    const { error: stErr } = await admin.from("integration_oauth_states").insert({
      state, company_id: body.company_id, provider: body.provider, user_id: caller.userId,
      code_verifier: verifier, redirect_after: body.redirect_after ?? null,
    });
    if (stErr) throw stErr;

    const existing = await getConnection(admin, body.company_id, body.provider);
    if (!existing || existing.status !== "connected") {
      const { error } = await admin.from("integration_connections").upsert({
        company_id: body.company_id, provider: body.provider, auth_type: adapter.authType, status: "pending",
      }, { onConflict: "company_id,provider" });
      if (error?.code === "23505") return json(409, { error: "Disconnect your current payroll provider first (one per company)" });
      if (error) throw error;
    }

    const url = adapter.authorizeUrl({ state, redirectUri: oauthCallbackUrl(body.provider, env), codeChallenge: challenge, env });
    await logAudit(admin, { event_type: `integration.${body.provider}.connect_start`, company_id: body.company_id, user_id: caller.userId, outcome: "success", entity_type: "integration", ip_address: getCallerIp(req) });
    adapterCtx("integration-oauth-start").log("started", { provider: body.provider });
    return json(200, { url });
  } catch (err) {
    console.error("[integration-oauth-start]", err instanceof Error ? err.message : err);
    return json(500, { error: "Could not start the connection" });
  }
});
