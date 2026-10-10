/**
 * integration-webhook/<provider> (PR V0). Replaces the undeployed
 * webhook-checkr and webhook-fillout (both failed OPEN).
 * Auth: verify_jwt = false; every request must pass the adapter's
 *       signature check (fail-closed, constant-time) or gets 401.
 * Dedupes on (provider, external_event_id), stores a redacted copy in
 * integration_events, answers 200 fast, then processes in the background.
 */
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { logAudit } from "../_shared/audit.ts";
import { CONNECTION_COLUMNS, loadLive } from "../_shared/integrations/connections.ts";
import { adapterCtx, env, serviceClient } from "../_shared/integrations/http.ts";
import { safeError } from "../_shared/integrations/redact.ts";
import { getAdapter } from "../_shared/integrations/registry.ts";
import type { ConnectionRow } from "../_shared/integrations/types.ts";
import { providerFromPath } from "../_shared/integrations/urls.ts";
import { handleWebhookRequest, type WebhookStore } from "../_shared/integrations/webhook-core.ts";

Deno.serve(async (req) => {
  const provider = providerFromPath(req.url);
  if (!provider) return new Response("Not found", { status: 404 });
  const admin = serviceClient();
  const adapter = getAdapter(provider, env);

  const store: WebhookStore = {
    async findConnection(p, externalAccountId) {
      if (!externalAccountId) return null;
      const { data } = await admin.from("integration_connections").select(CONNECTION_COLUMNS)
        .eq("provider", p).eq("external_account_id", externalAccountId).neq("status", "disconnected").limit(1).maybeSingle();
      return data ? await loadLive(admin, data as ConnectionRow) : null;
    },
    async insertEvent(e) {
      const { data, error } = await admin.from("integration_events").insert({
        provider: e.provider, company_id: e.companyId, connection_id: e.connectionId,
        external_event_id: e.eventId, type: e.type, signature_ok: true, payload: e.payload,
      }).select("id").maybeSingle();
      if (error?.code === "23505") return { inserted: false };
      if (error) throw error;
      return { inserted: true, id: (data as { id: string }).id };
    },
    async touchConnection(id) {
      await admin.from("integration_connections").update({ last_webhook_at: new Date().toISOString() }).eq("id", id);
    },
    async audit(e) {
      if (!e.companyId) return; // audit_logs.company_id is NOT NULL
      await logAudit(admin, { event_type: `integration.${provider}.webhook`, company_id: e.companyId, outcome: e.outcome, entity_type: "integration", metadata: e.metadata });
    },
  };

  try {
    const result = await handleWebhookRequest(req, adapter, provider, store, env);
    if (result.process && adapter?.handleWebhook) {
      const p = result.process;
      const work = (async () => {
        const patch: Record<string, unknown> = { processed_at: new Date().toISOString(), attempts: 1 };
        try { await adapter.handleWebhook!({ type: p.type, payload: p.payload }, p.conn, adapterCtx("integration-webhook")); }
        catch (err) { patch.error = safeError(err); patch.processed_at = null; }
        await admin.from("integration_events").update(patch).eq("provider", provider).eq("external_event_id", p.eventId);
      })();
      const rt = (globalThis as unknown as { EdgeRuntime?: { waitUntil(p: Promise<unknown>): void } }).EdgeRuntime;
      if (rt?.waitUntil) rt.waitUntil(work); else await work;
    }
    return result.response;
  } catch (err) {
    console.error("[integration-webhook]", safeError(err));
    return new Response(JSON.stringify({ error: "temporary failure" }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
