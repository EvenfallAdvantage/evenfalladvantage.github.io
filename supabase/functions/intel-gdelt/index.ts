/**
 * Intel — GDELT fallback / global conflict incidents (RSS keyword-geomap).
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const RSS_FEEDS: Array<{ url: string; source: string }> = [
  { url: "https://feeds.bbci.co.uk/news/world/rss.xml", source: "BBC World" },
  { url: "https://www.aljazeera.com/xml/rss/all.xml", source: "Al Jazeera" },
  { url: "https://rss.nytimes.com/services/xml/rss/nyt/World.xml", source: "NYT World" },
];

const GEO_DICT: Record<string, [number, number]> = {
  "ukraine": [31.1656, 48.3794], "kyiv": [30.5234, 50.4501], "russia": [37.6173, 55.7558],
  "moscow": [37.6173, 55.7558], "gaza": [34.4668, 31.5017], "israel": [34.8516, 31.0461],
  "tel aviv": [34.7818, 32.0853], "palestine": [35.2332, 31.9522], "iran": [53.6880, 32.4279],
  "tehran": [51.3890, 35.6892], "syria": [38.9968, 34.8021], "lebanon": [35.8623, 33.8547],
  "beirut": [35.5018, 33.8938], "yemen": [47.5868, 15.5527], "houthi": [44.2066, 15.3694],
  "sudan": [30.2176, 12.8628], "china": [116.4074, 39.9042], "taiwan": [120.9605, 23.6978],
  "korea": [127.7669, 35.9078], "usa": [-77.0369, 38.9072], "myanmar": [95.9560, 21.9162],
  "haiti": [-72.2852, 18.9712], "somalia": [46.1996, 5.1521],
};

const CONFLICT_KEYWORDS = [
  "attack", "strike", "missile", "drone", "war", "troops", "military",
  "protest", "riot", "police", "clash", "bomb", "killed", "forces",
];

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const allEvents: Array<{
      id: string;
      lat: number;
      lng: number;
      title: string;
      source: string;
      url: string;
      type: "conflict";
    }> = [];
    let eventId = 0;

    for (const feed of RSS_FEEDS) {
      try {
        const res = await fetch(feed.url, { signal: AbortSignal.timeout(5_000) });
        if (!res.ok) continue;
        const xml = await res.text();

        const items = xml.match(/<item>([\s\S]*?)<\/item>/gi) || [];
        for (const item of items) {
          const titleMatch =
            item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/i) ||
            item.match(/<title>(.*?)<\/title>/i);
          const linkMatch = item.match(/<link>(.*?)<\/link>/i);
          const descMatch =
            item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/i) ||
            item.match(/<description>(.*?)<\/description>/i);
          if (!titleMatch || !linkMatch) continue;

          const title = titleMatch[1];
          const link = linkMatch[1];
          const desc = descMatch ? descMatch[1] : "";
          const textToSearch = `${title} ${desc}`.toLowerCase();
          if (!CONFLICT_KEYWORDS.some((kw) => textToSearch.includes(kw))) continue;

          let coords: [number, number] | null = null;
          for (const [location, point] of Object.entries(GEO_DICT)) {
            const regex = new RegExp(`\\b${location}\\b`, "i");
            if (regex.test(textToSearch)) {
              const jitterLng = (Math.random() - 0.5) * 2.0;
              const jitterLat = (Math.random() - 0.5) * 2.0;
              coords = [point[0] + jitterLng, point[1] + jitterLat];
              break;
            }
          }
          if (!coords) continue;

          allEvents.push({
            id: `osint-${feed.source.replace(/\s+/g, "")}-${eventId++}`,
            lat: coords[1],
            lng: coords[0],
            title: `[${feed.source}] ${title}`,
            source: feed.source,
            url: link,
            type: "conflict",
          });
        }
      } catch (e) {
        console.warn("[intel-gdelt] feed error:", feed.source, e);
      }
    }

    return new Response(
      JSON.stringify({
        events: allEvents,
        total: allEvents.length,
        source: "OSINT RSS Mapping",
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
    console.error("[intel-gdelt]", err);
    return new Response(
      JSON.stringify({
        events: [],
        total: 0,
        source: "",
        timestamp: new Date().toISOString(),
        error: "Failed to fetch OSINT data",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
