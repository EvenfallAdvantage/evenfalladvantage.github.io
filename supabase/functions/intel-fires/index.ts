/**
 * Intel — Active Fires (NASA FIRMS VIIRS/MODIS + EONET volcanoes).
 * Attribution required: "NASA FIRMS" / "NASA EONET".
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface IntelFire {
  lat: number;
  lng: number;
  brightness: number;
  confidence: string;
  date: string;
  time: string;
  frp: number;
  type: "fire" | "volcano";
  title?: string;
}

const FIRMS_SOURCES: Array<{ url: string; label: string }> = [
  {
    url: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_Global_24h.csv",
    label: "NASA-FIRMS (VIIRS)",
  },
  {
    url: "https://firms.modaps.eosdis.nasa.gov/data/active_fire/modis-c6.1/csv/MODIS_C6_1_Global_24h.csv",
    label: "NASA-FIRMS (MODIS)",
  },
];

function parseFirmsCsv(csv: string): IntelFire[] {
  const lines = csv.trim().split("\n");
  if (lines.length < 2) return [];
  const header = lines[0].split(",");
  const latIdx = header.indexOf("latitude");
  const lngIdx = header.indexOf("longitude");
  const brightIdx =
    header.indexOf("bright_ti4") !== -1 ? header.indexOf("bright_ti4") : header.indexOf("brightness");
  const confIdx = header.indexOf("confidence");
  const dateIdx = header.indexOf("acq_date");
  const timeIdx = header.indexOf("acq_time");
  const frpIdx = header.indexOf("frp");

  const fires: IntelFire[] = [];
  const maxPoints = 2000;
  const step = lines.length > maxPoints ? Math.ceil(lines.length / maxPoints) : 1;

  for (let i = 1; i < lines.length; i += step) {
    const cols = lines[i].split(",");
    const lat = parseFloat(cols[latIdx]);
    const lng = parseFloat(cols[lngIdx]);
    if (isNaN(lat) || isNaN(lng)) continue;
    fires.push({
      lat: Math.round(lat * 1000) / 1000,
      lng: Math.round(lng * 1000) / 1000,
      brightness: parseFloat(cols[brightIdx]) || 0,
      confidence: cols[confIdx] || "unknown",
      date: cols[dateIdx] || "",
      time: cols[timeIdx] || "",
      frp: parseFloat(cols[frpIdx]) || 0,
      type: "fire",
    });
  }
  return fires;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    let fires: IntelFire[] = [];
    let source = "";

    for (const { url, label } of FIRMS_SOURCES) {
      try {
        const res = await fetch(url, {
          signal: AbortSignal.timeout(15_000),
          headers: { "User-Agent": "OverwatchIntel/1.0 (+evenfalladvantage.com)" },
        });
        if (res.ok) {
          const text = await res.text();
          if (text && text.includes("latitude") && text.length > 200) {
            const parsed = parseFirmsCsv(text);
            if (parsed.length > 0) {
              fires = parsed;
              source = label;
              break;
            }
          }
        }
      } catch (e) {
        console.warn("[intel-fires] firms error:", e);
      }
    }

    try {
      const volcRes = await fetch(
        "https://eonet.gsfc.nasa.gov/api/v3/events?status=open&category=volcanoes&limit=50",
        { signal: AbortSignal.timeout(10_000) },
      );
      if (volcRes.ok) {
        const volcData = (await volcRes.json()) as {
          events?: Array<{
            title: string;
            geometry?: Array<{ coordinates?: number[]; date?: string }>;
          }>;
        };
        const volcanoes: IntelFire[] = (volcData.events ?? [])
          .map((e): IntelFire | null => {
            const geo = e.geometry?.[e.geometry.length - 1];
            if (!geo?.coordinates) return null;
            return {
              lat: geo.coordinates[1] ?? 0,
              lng: geo.coordinates[0] ?? 0,
              brightness: 500,
              confidence: "high",
              date: geo.date?.split("T")[0] ?? "",
              time: "",
              frp: 100,
              title: `[VOLCANO] ${e.title}`,
              type: "volcano",
            };
          })
          .filter((v): v is IntelFire => v !== null);
        fires = [...fires, ...volcanoes];
        if (!source) source = "NASA-EONET";
      }
    } catch (e) {
      console.warn("[intel-fires] eonet error:", e);
    }

    return new Response(
      JSON.stringify({
        fires,
        total: fires.length,
        source: source || "unknown",
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=600, stale-while-revalidate=1200",
        },
      },
    );
  } catch (err) {
    console.error("[intel-fires]", err);
    return new Response(
      JSON.stringify({
        fires: [],
        total: 0,
        source: "",
        timestamp: new Date().toISOString(),
        error: "Failed to fetch fire data",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
