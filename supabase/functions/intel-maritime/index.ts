/**
 * Intel — Maritime (static ports + chokepoints).
 * Live AIS ship positions are intentionally NOT included here (the Osiris
 * upstream uses a persistent WebSocket which requires a long-lived process
 * and an aisstream.io commercial key — both gated until Phase E ships a
 * side worker that writes to Supabase Realtime).
 *
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import ports from "../_shared/intel-data/maritime-ports.json" with { type: "json" };
import chokepoints from "../_shared/intel-data/maritime-chokepoints.json" with { type: "json" };

Deno.serve((req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  return new Response(
    JSON.stringify({
      ports,
      chokepoints,
      ships: [],
      total_ports: (ports as unknown[]).length,
      total_chokepoints: (chokepoints as unknown[]).length,
      total_ships: 0,
      ais_live: false,
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
