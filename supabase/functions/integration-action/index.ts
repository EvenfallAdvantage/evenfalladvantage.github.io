/**
 * integration-action (PR V0): single entry point for HQ Config actions.
 * Auth: user JWT (verify_jwt = true).
 * Body: { company_id, provider, action, input? }
 *   test        owner/admin   cheap vendor read; records last_test_at/ok; never "connected" without a pass
 *   disconnect  owner/admin   revoke at vendor (best effort), wipe Vault payload, status disconnected
 *   <adapter>   per ActionDef  "read" = managers too; "manage" = owner/admin;
 *               queued actions (send/export/...) go to integration_jobs (idempotency_key optional)
 * Every call is audited as integration.<provider>.<action>.
 */
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { getCallerIp, logAudit } from "../_shared/audit.ts";
import { clearConnection, getConnection, withFreshToken } from "../_shared/integrations/connections.ts";
import { adapterCtx, callerRole, env, jsonResponder, serviceClient } from "../_shared/integrations/http.ts";
import { safeError } from "../_shared/integrations/redact.ts";
import { getAdapter } from "../_shared/integrations/registry.ts";
import { allowed, BUILTIN_ACCESS } from "../_shared/integrations/roles.ts";
import { isProviderSlug } from "../_shared/integrations/urls.ts";

Deno.serve(async (req) => {
  const { cors, json } = jsonResponder(req);
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });

  const body = await req.json().catch(() => null) as { company_id?: string; provider?: string; action?: string; input?: Record<string, unknown>; idempotency_key?: string } | null;
  if (!body?.company_id || !isProviderSlug(body.provider) || !body.action || !/^[a-z_]{2,40}$/.test(body.action)) {
    return json(400, { error: "company_id, provider and action are required" });
  }
  const { company_id: companyId, provider, action } = body;
  const adapter = getAdapter(provider, env);
  if (!adapter) return json(404, { error: "Unknown integration" });
  const def = adapter.actions[action];
  const access = BUILTIN_ACCESS[action] ?? def?.access;
  if (!access) return json(400, { error: "Unknown action" });

  const admin = serviceClient();
  try {
    const caller = await callerRole(req, admin, companyId);
    if (!caller.authUserId) return json(401, { error: "Unauthorized" });
    const audit = (outcome: "success" | "failure" | "blocked", metadata: Record<string, unknown> = {}) =>
      logAudit(admin, { event_type: `integration.${provider}.${action}`, company_id: companyId, user_id: caller.userId, outcome, entity_type: "integration", ip_address: getCallerIp(req), metadata });
    if (!allowed(access, caller.role)) {
      await audit("blocked", { role: caller.role });
      return json(403, { error: access === "manage" ? "Only owners and admins can change integrations" : "Not allowed" });
    }

    const row = await getConnection(admin, companyId, provider);
    if (!row) return json(404, { error: "Not connected" });
    const ctx = adapterCtx("integration-action");

    if (action === "disconnect") {
      if (adapter.revoke && row.vault_secret_id) {
        try { await adapter.revoke(await withFreshToken(admin, adapter, row, ctx), ctx); } catch (e) { ctx.log("revoke failed", { error: safeError(e) }); }
      }
      await clearConnection(admin, row);
      await audit("success");
      return json(200, { ok: true, status: "disconnected" });
    }

    if (row.status === "disconnected" || row.status === "revoked") return json(409, { error: "Connect this integration first" });

    if (action === "test") {
      let result: { ok: boolean; detail?: string; externalAccountName?: string };
      try { result = await adapter.test(await withFreshToken(admin, adapter, row, ctx), ctx); }
      catch (e) { result = { ok: false, detail: safeError(e) }; }
      const patch: Record<string, unknown> = { last_test_at: new Date().toISOString(), last_test_ok: result.ok, last_error: result.ok ? null : (result.detail ?? "Test failed") };
      if (result.ok && result.externalAccountName) patch.external_account_name = result.externalAccountName;
      // A passing test heals "error"; it never promotes "pending" (vendor approval) to connected.
      if (result.ok && row.status === "error") patch.status = "connected";
      if (!result.ok && row.status === "connected") patch.status = "error";
      await admin.from("integration_connections").update(patch).eq("id", row.id);
      await audit(result.ok ? "success" : "failure", { detail: result.detail ?? null });
      return json(200, { ok: result.ok, detail: result.detail ?? null });
    }

    if (row.status !== "connected") return json(409, { error: "This integration needs attention before it can be used" });

    if (def!.queued) {
      const { data, error } = await admin.from("integration_jobs").insert({
        company_id: companyId, connection_id: row.id, provider, kind: action,
        idempotency_key: body.idempotency_key ?? null, payload: body.input ?? {}, created_by: caller.userId,
      }).select("id, status").maybeSingle();
      if (error?.code === "23505") return json(200, { ok: true, duplicate: true });
      if (error) throw error;
      await audit("success", { job_id: (data as { id: string }).id });
      return json(202, { ok: true, job: data });
    }

    const out = await def!.run(await withFreshToken(admin, adapter, row, ctx), body.input ?? {}, ctx);
    if (access === "manage") await audit("success");
    return json(200, { ok: true, result: out });
  } catch (err) {
    console.error("[integration-action]", safeError(err));
    return json(500, { error: "Action failed" });
  }
});
