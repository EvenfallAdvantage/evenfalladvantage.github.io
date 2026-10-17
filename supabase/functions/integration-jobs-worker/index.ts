/**
 * integration-jobs-worker (PR V0)
 * Auth: verify_jwt = false; requires x-integrations-cron-secret (pg_cron every minute).
 * Claims due jobs with SKIP LOCKED (integration_claim_jobs), runs adapter.jobs[kind],
 * retries with backoff (1m, 5m, 15m, 1h, 4h, 12h), marks dead after max_attempts.
 */
import "jsr:@supabase/functions-js@2/edge-runtime.d.ts";
import { logAudit } from "../_shared/audit.ts";
import { jobOutcome, nextRunAt } from "../_shared/integrations/backoff.ts";
import { CONNECTION_COLUMNS, withFreshToken } from "../_shared/integrations/connections.ts";
import { adapterCtx, env, isCronCall, serviceClient } from "../_shared/integrations/http.ts";
import { safeError } from "../_shared/integrations/redact.ts";
import { getAdapter } from "../_shared/integrations/registry.ts";
import { VendorError, type ConnectionRow } from "../_shared/integrations/types.ts";

interface JobRow { id: string; company_id: string; connection_id: string | null; provider: string; kind: string; payload: Record<string, unknown>; attempts: number; max_attempts: number }
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return json(405, { error: "Method not allowed" });
  if (!isCronCall(req)) return json(401, { error: "Unauthorized" });
  const admin = serviceClient();
  const ctx = adapterCtx("integration-jobs-worker");
  const { data: jobs, error } = await admin.rpc("integration_claim_jobs", { p_limit: 10 });
  if (error) return json(500, { error: "claim failed" });

  let ok = 0, failed = 0;
  for (const job of (jobs ?? []) as JobRow[]) {
    const adapter = getAdapter(job.provider, env);
    const run = adapter?.jobs?.[job.kind];
    try {
      if (!adapter || !run) throw new VendorError(`no handler for ${job.provider}.${job.kind}`, undefined, false);
      const { data: row } = await admin.from("integration_connections").select(CONNECTION_COLUMNS).eq("id", job.connection_id).maybeSingle();
      const conn = row as ConnectionRow | null;
      if (!conn || conn.status !== "connected") throw new VendorError("connection not active", undefined, true);
      const result = await run(await withFreshToken(admin, adapter, conn, ctx), job.payload, ctx);
      await admin.from("integration_jobs").update({ status: "succeeded", result: result ?? {}, locked_at: null, last_error: null }).eq("id", job.id);
      await admin.from("integration_connections").update({ last_sync_at: new Date().toISOString() }).eq("id", conn.id);
      await logAudit(admin, { event_type: `integration.${job.provider}.${job.kind}`, company_id: job.company_id, outcome: "success", entity_type: "integration_job", entity_id: job.id });
      ok++;
    } catch (err) {
      const retryable = err instanceof VendorError ? err.retryable : true;
      const status = jobOutcome(job.attempts, job.max_attempts, retryable);
      await admin.from("integration_jobs").update({
        status, locked_at: null, last_error: safeError(err), next_run_at: nextRunAt(job.attempts, new Date()).toISOString(),
      }).eq("id", job.id);
      if (status === "dead") {
        await logAudit(admin, { event_type: `integration.${job.provider}.${job.kind}`, company_id: job.company_id, outcome: "failure", entity_type: "integration_job", entity_id: job.id, metadata: { error: safeError(err) } });
      }
      failed++;
    }
  }
  return json(200, { ok: true, succeeded: ok, failed });
});
