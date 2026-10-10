/**
 * integration-token-refresh (PR V0). Replaces the undeployed oauth-refresh.
 * Auth: verify_jwt = false; requires x-integrations-cron-secret
 *       (pg_cron every 10 min, see migration 20261011000100).
 * Refreshes connected tokens expiring within 15 min, one refresher per
 * connection (lease lock), and flips a connection to "error" after 3
 * consecutive failures (audited, visible as "Needs attention").
 */
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { logAudit } from "../_shared/audit.ts";
import { CONNECTION_COLUMNS, refreshConnection } from "../_shared/integrations/connections.ts";
import { adapterCtx, env, isCronCall, serviceClient } from "../_shared/integrations/http.ts";
import { getAdapter } from "../_shared/integrations/registry.ts";
import type { ConnectionRow } from "../_shared/integrations/types.ts";

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!isCronCall(req)) return json(401, { error: "Unauthorized" });
  const admin = serviceClient();
  const ctx = adapterCtx("integration-token-refresh");
  const horizon = new Date(Date.now() + 15 * 60_000).toISOString();
  const { data, error } = await admin.from("integration_connections").select(CONNECTION_COLUMNS)
    .in("status", ["connected", "error"]).not("access_expires_at", "is", null).lte("access_expires_at", horizon).limit(100);
  if (error) return json(500, { error: "query failed" });

  const tally: Record<string, number> = {};
  for (const row of (data ?? []) as ConnectionRow[]) {
    const adapter = getAdapter(row.provider, env);
    if (!adapter) { tally.skipped = (tally.skipped ?? 0) + 1; continue; }
    const r = await refreshConnection(admin, adapter, row, ctx);
    tally[r] = (tally[r] ?? 0) + 1;
    if (r === "failed") {
      await logAudit(admin, { event_type: `integration.${row.provider}.refresh`, company_id: row.company_id, outcome: "failure", entity_type: "integration", entity_id: row.id, metadata: { failures: (row.refresh_failures ?? 0) + 1 } });
    }
  }
  return json(200, { ok: true, ...tally });
});
