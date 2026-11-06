/**
 * airtable-proxy is retired.
 * Airtable is OAuth-only through integration-oauth-* and integration-action.
 * This function does not read stored credentials or company configuration.
 * Existing personal-access-token rows are left in place for the company to retire.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve((req) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return new Response(JSON.stringify({
    error: "Airtable personal access tokens are no longer accepted. Connect Airtable with OAuth in HQ Config.",
  }), { status: 410, headers: { ...cors, "Content-Type": "application/json" } });
});
