/**
 * Intel — Critical infrastructure (nuclear power plants, curated static list).
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import nuclearFacilities from "../_shared/intel-data/nuclear-facilities.json" with { type: "json" };

Deno.serve((req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  return new Response(
    JSON.stringify({
      infrastructure: nuclearFacilities,
      total: (nuclearFacilities as unknown[]).length,
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
