/**
 * Intel — Conflict zones (curated static OSINT list).
 * Extracted from Osiris's OsirisMap.tsx hard-coded list (MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireIntelUser } from "../_shared/intel-auth.ts";
import conflictZones from "../_shared/intel-data/conflict-zones.json" with { type: "json" };

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireIntelUser(req, corsHeaders);
  if (denied) return denied;

  return new Response(
    JSON.stringify({
      zones: conflictZones,
      total: (conflictZones as unknown[]).length,
      timestamp: new Date().toISOString(),
    }),
    {
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
        "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=172800",
      },
    },
  );
});
