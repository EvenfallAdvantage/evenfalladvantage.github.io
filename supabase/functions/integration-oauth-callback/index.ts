/**
 * integration-oauth-callback/<provider> (PR V0)
 * Auth: public (verify_jwt = false); trust comes from the single-use state.
 * Reached directly or via the custom domain proxy:
 *   https://api.evenfalladvantage.com/integrations/oauth/callback/<provider>
 * Exchanges the code (with PKCE verifier), stores tokens in Vault, sets the
 * connection connected (or the adapter's initialStatus, e.g. pending for
 * Checkr until credentialed), audits, and 302s back to HQ Config.
 */
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { logAudit } from "../_shared/audit.ts";
import { saveConnection } from "../_shared/integrations/connections.ts";
import { adapterCtx, env, serviceClient } from "../_shared/integrations/http.ts";
import { checkState, type OAuthStateRow } from "../_shared/integrations/oauth-state.ts";
import { safeError } from "../_shared/integrations/redact.ts";
import { getAdapter } from "../_shared/integrations/registry.ts";
import { appRedirect, oauthCallbackUrl, providerFromPath } from "../_shared/integrations/urls.ts";

const redirect = (to: string) => new Response(null, { status: 302, headers: { Location: to, "Cache-Control": "no-store" } });

Deno.serve(async (req) => {
  const provider = providerFromPath(req.url);
  if (req.method !== "GET" || !provider) return new Response("Not found", { status: 404 });
  const q = new URL(req.url).searchParams;
  const adapter = getAdapter(provider, env);
  if (!adapter?.exchangeCode) return redirect(appRedirect(env, provider, "error", null, "unsupported"));

  const admin = serviceClient();
  const stateParam = q.get("state") ?? "";
  // Claim the state atomically: only an unused row is updated.
  const { data: claimed } = stateParam.length >= 32
    ? await admin.from("integration_oauth_states").update({ used_at: new Date().toISOString() })
        .eq("state", stateParam).is("used_at", null).select("*").maybeSingle()
    : { data: null };
  const row = claimed as OAuthStateRow | null;
  const check = checkState(row ? { ...row, used_at: null } : null, provider, new Date());
  if (!check.ok || !row) return redirect(appRedirect(env, provider, "error", null, check.ok ? "missing" : check.reason));

  const audit = (outcome: "success" | "failure", metadata: Record<string, unknown>) =>
    logAudit(admin, { event_type: `integration.${provider}.connect`, company_id: row.company_id, user_id: row.user_id, outcome, entity_type: "integration", metadata });

  if (q.get("error") || !q.get("code")) {
    await admin.from("integration_connections").update({ status: "disconnected", last_error: "Connection was cancelled at the vendor" })
      .eq("company_id", row.company_id).eq("provider", provider).eq("status", "pending");
    await audit("failure", { reason: "vendor_denied" });
    return redirect(appRedirect(env, provider, "error", row.redirect_after, "denied"));
  }

  try {
    const ctx = adapterCtx("integration-oauth-callback");
    const tokens = await adapter.exchangeCode({ code: q.get("code")!, redirectUri: oauthCallbackUrl(provider, env), verifier: row.code_verifier ?? undefined, query: q }, ctx);
    const { externalAccountId, externalAccountName, initialStatus, ...secrets } = tokens;
    await saveConnection(admin, {
      companyId: row.company_id, provider, authType: adapter.authType, status: initialStatus ?? "connected",
      secrets, externalAccountId: externalAccountId ?? null, externalAccountName: externalAccountName ?? null, connectedBy: row.user_id,
    });
    await audit("success", { status: initialStatus ?? "connected" });
    return redirect(appRedirect(env, provider, "ok", row.redirect_after));
  } catch (err) {
    const msg = safeError(err);
    await admin.from("integration_connections").update({ status: "error", last_error: `Connect failed: ${msg}` })
      .eq("company_id", row.company_id).eq("provider", provider);
    await audit("failure", { error: msg });
    return redirect(appRedirect(env, provider, "error", row.redirect_after, "exchange_failed"));
  }
});
