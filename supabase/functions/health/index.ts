/**
 * Public backend health check: GET /functions/v1/health
 * No JWT (uptime monitors call it). Returns only up/down + latency per
 * component, never error text. 200 when ok, 503 when degraded/down.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";
import { overallStatus, timed } from "./lib.ts";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const headers = {
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
  // Public, read-only, no credentials: any origin may read it (status page, monitors).
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "apikey, authorization, content-type, x-client-info",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers });
  if (req.method !== "GET" && req.method !== "HEAD") return new Response(null, { status: 405, headers });

  const [database, auth, storage] = await Promise.all([
    timed(async () => !(await admin.from("companies").select("id", { head: true }).limit(1)).error),
    timed(async () => (await fetch(`${URL_}/auth/v1/health`, { headers: { apikey: ANON || SERVICE } })).ok),
    timed(async () => !(await admin.storage.listBuckets()).error),
  ]);
  const checks = { database, auth, storage };
  const status = overallStatus(checks);
  const body = JSON.stringify({ status, checks, checked_at: new Date().toISOString() });
  return new Response(req.method === "HEAD" ? null : body, { status: status === "ok" ? 200 : 503, headers });
});
