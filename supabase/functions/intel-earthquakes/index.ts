/**
 * Intel — Earthquakes (USGS, M2.5+, last 24h)
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface UsgsFeature {
  id: string;
  geometry?: { coordinates?: number[] };
  properties?: {
    mag?: number;
    place?: string;
    time?: number;
    url?: string;
    tsunami?: number;
    type?: string;
    felt?: number | null;
    alert?: string | null;
  };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const res = await fetch(
      "https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson",
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) {
      return new Response(
        JSON.stringify({
          earthquakes: [],
          total: 0,
          timestamp: new Date().toISOString(),
          error: `USGS returned ${res.status}`,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = (await res.json()) as { features?: UsgsFeature[] };
    const earthquakes = (data.features ?? []).map((f) => {
      const coords = f.geometry?.coordinates ?? [0, 0, 0];
      const props = f.properties ?? {};
      return {
        id: f.id,
        lat: coords[1] ?? 0,
        lng: coords[0] ?? 0,
        depth: coords[2] ?? 0,
        magnitude: props.mag ?? 0,
        place: props.place ?? "",
        time: props.time ?? 0,
        url: props.url ?? "",
        tsunami: props.tsunami ?? 0,
        type: props.type ?? "earthquake",
        felt: props.felt ?? null,
        alert: props.alert ?? null,
      };
    });

    return new Response(
      JSON.stringify({
        earthquakes,
        total: earthquakes.length,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120",
        },
      },
    );
  } catch (err) {
    console.error("[intel-earthquakes]", err);
    return new Response(
      JSON.stringify({
        earthquakes: [],
        total: 0,
        timestamp: new Date().toISOString(),
        error: "Failed to fetch earthquake data",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
