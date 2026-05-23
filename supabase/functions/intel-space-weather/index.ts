/**
 * Intel — Space Weather (NOAA SWPC).
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface KpRow { kp_index?: number | string; Kp?: number | string; time_tag?: string; }
interface AlertRow { product_id?: string; issue_datetime?: string; message?: string; }
interface FlareRow { max_class?: string; begin_time?: string; max_time?: string; end_time?: string; }

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const [kpRes, alertsRes, flareRes] = await Promise.allSettled([
      fetch("https://services.swpc.noaa.gov/json/planetary_k_index_1m.json", {
        signal: AbortSignal.timeout(8_000),
      }).then((r) => r.json() as Promise<KpRow[]>),
      fetch("https://services.swpc.noaa.gov/json/alerts.json", {
        signal: AbortSignal.timeout(8_000),
      }).then((r) => r.json() as Promise<AlertRow[]>),
      fetch("https://services.swpc.noaa.gov/json/goes/primary/xray-flares-latest.json", {
        signal: AbortSignal.timeout(8_000),
      }).then((r) => r.json() as Promise<FlareRow[]>),
    ]);

    let kpIndex = 0;
    let kpTimestamp = "";
    if (kpRes.status === "fulfilled" && Array.isArray(kpRes.value) && kpRes.value.length > 0) {
      const latest = kpRes.value[kpRes.value.length - 1];
      kpIndex = parseFloat(String(latest.kp_index ?? latest.Kp ?? 0));
      kpTimestamp = latest.time_tag ?? "";
    }

    let stormLevel = "Quiet";
    let stormColor = "#00E676";
    if (kpIndex >= 8) { stormLevel = "Extreme (G5)"; stormColor = "#FF1744"; }
    else if (kpIndex >= 7) { stormLevel = "Severe (G4)"; stormColor = "#FF3D3D"; }
    else if (kpIndex >= 6) { stormLevel = "Strong (G3)"; stormColor = "#FF9500"; }
    else if (kpIndex >= 5) { stormLevel = "Moderate (G2)"; stormColor = "#FFD700"; }
    else if (kpIndex >= 4) { stormLevel = "Minor (G1)"; stormColor = "#FFD700"; }
    else if (kpIndex >= 3) { stormLevel = "Unsettled"; stormColor = "#D4AF37"; }

    const alerts: Array<{ id: string; issue_datetime: string; message: string }> = [];
    if (alertsRes.status === "fulfilled" && Array.isArray(alertsRes.value)) {
      for (const alert of alertsRes.value.slice(0, 10)) {
        alerts.push({
          id: alert.product_id ?? `alert-${Date.now()}`,
          issue_datetime: alert.issue_datetime ?? "",
          message: (alert.message ?? "").substring(0, 200),
        });
      }
    }

    const flares: Array<{ class: string; begin: string; peak: string; end: string }> = [];
    if (flareRes.status === "fulfilled" && Array.isArray(flareRes.value)) {
      for (const flare of flareRes.value.slice(0, 5)) {
        if (!flare.max_class) continue;
        flares.push({
          class: flare.max_class,
          begin: flare.begin_time ?? "",
          peak: flare.max_time ?? "",
          end: flare.end_time ?? "",
        });
      }
    }

    return new Response(
      JSON.stringify({
        kp_index: kpIndex,
        storm_level: stormLevel,
        storm_color: stormColor,
        kp_timestamp: kpTimestamp,
        alerts,
        solar_flares: flares,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      },
    );
  } catch (err) {
    console.error("[intel-space-weather]", err);
    return new Response(
      JSON.stringify({
        kp_index: 0,
        storm_level: "Unknown",
        storm_color: "#555555",
        kp_timestamp: "",
        alerts: [],
        solar_flares: [],
        timestamp: new Date().toISOString(),
        error: "Failed to fetch space weather data",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
