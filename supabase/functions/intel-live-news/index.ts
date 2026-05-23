/**
 * Intel — Live news broadcasters (24/7 YouTube + external).
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import feeds from "../_shared/intel-data/live-news-channels.json" with { type: "json" };

Deno.serve((req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  return new Response(
    JSON.stringify({
      feeds,
      total: (feeds as unknown[]).length,
      categories: ["mainstream", "government", "finance", "conflict", "state"],
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
