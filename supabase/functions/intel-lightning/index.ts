/**
 * RETIRED (Phase 0 licensing): this function used to relay Blitzortung /
 * LightningMaps.org strikes. Their terms prohibit commercial use, use for
 * storm warnings and direct server access, so it no longer contacts them.
 *
 * The map now draws NOAA/NWS nowCOAST lightning strike density directly from
 * NOAA's public WMS (see overwatch-src/src/lib/map/basemap-sources.ts).
 * Kept only so old clients get a clean 410 instead of a 404; safe to delete
 * from the project once every client has updated.
 */
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

Deno.serve((req: Request) => {
  const cors = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  return new Response(
    JSON.stringify({ type: "FeatureCollection", features: [], error: "intel-lightning retired; lightning now comes from NOAA nowCOAST" }),
    { status: 410, headers: { ...cors, "Content-Type": "application/json" } },
  );
});
