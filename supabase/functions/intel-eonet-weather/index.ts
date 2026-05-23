/**
 * Intel — Severe Weather Events (NASA EONET, open status).
 * Skips wildfires (handled by intel-fires) and earthquakes (intel-earthquakes).
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface EonetGeometry { type: string; coordinates?: number[]; date?: string; }
interface EonetEvent {
  id: string;
  title: string;
  geometry?: EonetGeometry[];
  categories?: Array<{ id: string; title?: string }>;
  sources?: Array<{ url?: string }>;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const res = await fetch(
      "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=100",
      { signal: AbortSignal.timeout(10_000) },
    );
    if (!res.ok) throw new Error(`NASA EONET returned ${res.status}`);
    const data = (await res.json()) as { events?: EonetEvent[] };

    const events: Array<{
      id: string;
      title: string;
      category: string;
      type: string;
      icon: "alert" | "cyclone" | "volcano" | "ice";
      severity: "low" | "medium" | "high";
      lat: number;
      lng: number;
      date: string;
      source: string;
    }> = [];

    for (const event of data.events ?? []) {
      const geom = event.geometry && event.geometry.length > 0
        ? event.geometry[event.geometry.length - 1]
        : null;
      if (!geom || geom.type !== "Point" || !geom.coordinates) continue;
      const category = event.categories?.[0]?.id ?? "unknown";
      if (category === "wildfires" || category === "earthquakes") continue;

      let typeLabel = "Event";
      let icon: "alert" | "cyclone" | "volcano" | "ice" = "alert";
      let severity: "low" | "medium" | "high" = "low";

      if (category === "severeStorms") { typeLabel = "Severe Storm"; icon = "cyclone"; severity = "high"; }
      else if (category === "volcanoes") { typeLabel = "Volcano Eruption"; icon = "volcano"; severity = "high"; }
      else if (category === "seaIce") { typeLabel = "Iceberg / Sea Ice"; icon = "ice"; severity = "medium"; }
      else { typeLabel = event.categories?.[0]?.title ?? "Anomaly"; }

      events.push({
        id: event.id,
        title: event.title,
        category,
        type: typeLabel,
        icon,
        severity,
        lat: geom.coordinates[1] ?? 0,
        lng: geom.coordinates[0] ?? 0,
        date: geom.date ?? "",
        source: event.sources?.[0]?.url ?? "NASA EONET",
      });
    }

    return new Response(
      JSON.stringify({ events, total: events.length, timestamp: new Date().toISOString() }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1800",
        },
      },
    );
  } catch (err) {
    console.error("[intel-eonet-weather]", err);
    return new Response(
      JSON.stringify({
        events: [],
        total: 0,
        timestamp: new Date().toISOString(),
        error: "Failed to fetch NASA EONET data",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
