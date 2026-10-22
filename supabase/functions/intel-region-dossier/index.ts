/**
 * Intel — Region dossier (right-click on map → country brief).
 * Reverse-geocode (Photon, lang=en) + parallel Wikidata country facts and the
 * Wikipedia summary for the place clicked (Wikidata nearby lookup). All sources are free and keyless; see lib.ts.
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireIntelUser } from "../_shared/intel-auth.ts";
import {
  articleNear, countrySparql, type LocationInfo, nearbyPlacesSparql, parseCountry, parseNearby,
  parsePhoton, type PhotonResponse, pickPlace, titleCandidates, trimExtract, UA, type WikidataResponse,
} from "./lib.ts";

interface WikiSummary {
  title?: string; type?: string; extract?: string; thumbnail?: { source?: string };
  coordinates?: { lat?: number; lon?: number };
}

async function getJson<T>(label: string, url: string, ms: number): Promise<T | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(ms),
      headers: { "User-Agent": UA, Accept: "application/json" },
    });
    if (!res.ok) {
      console.warn(`[intel-region-dossier] ${label} HTTP ${res.status}`);
      return null;
    }
    return (await res.json()) as T;
  } catch (e) {
    console.warn(`[intel-region-dossier] ${label} error:`, e instanceof Error ? e.message : e);
    return null;
  }
}

// Nominatim intentionally not used: it 403s from Supabase egress (see lib.ts).
async function reverseGeocode(lat: number, lng: number): Promise<LocationInfo | null> {
  return parsePhoton(await getJson<PhotonResponse>(
    "photon",
    `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1&lang=en`,
    6_000,
  ));
}

const wikiSummary = (title: string) => getJson<WikiSummary>(
  "wikipedia",
  `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, "_"))}?redirect=true`,
  5_000,
);

/**
 * Article for the clicked place:
 *  1. exact title candidates (city, "city, state", …) accepted only if the article's
 *     coordinates are within 30 km of the click — cheap (~0.1 s each), covers most clicks;
 *  2. otherwise (ambiguous / no coords) a small Wikidata nearby query (3 km, 15 rows, 3.5 s);
 *  3. country article as the last resort.
 */
async function placeSummary(lat: number, lng: number, city: string | undefined, state: string | undefined, country: string): Promise<WikiSummary | null> {
  for (const t of titleCandidates(city, state)) {
    const w = await wikiSummary(t);
    if (articleNear(w, lat, lng)) return w;
  }
  const hits = parseNearby(await getJson<WikidataResponse>(
    "wikidata-nearby",
    `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(nearbyPlacesSparql(lat, lng))}`,
    3_500,
  ));
  const place = pickPlace(hits, city);
  if (place) {
    const w = await wikiSummary(place.title);
    if (w?.extract) return w;
  }
  if (!country) return null;
  const w = await wikiSummary(country);
  return w?.extract ? w : null;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireIntelUser(req, corsHeaders, { limit: 30 });
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const lat = parseFloat(searchParams.get("lat") ?? "0");
  const lng = parseFloat(searchParams.get("lng") ?? "0");
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return new Response(JSON.stringify({ error: "Invalid lat/lng" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const loc = await reverseGeocode(lat, lng);
    const locationInfo: LocationInfo = loc ?? {};
    const countryCode = loc?.country_code ?? "";
    const countryName = loc?.country ?? "";

    const [facts, wiki] = await Promise.all([
      /^[A-Z]{2}$/.test(countryCode)
        ? getJson<WikidataResponse>(
            "wikidata",
            `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(countrySparql(countryCode))}`,
            7_000,
          ).then((d) => parseCountry(d, countryCode, countryName))
        : Promise.resolve(null),
      loc ? placeSummary(lat, lng, locationInfo.city, locationInfo.state, countryName) : Promise.resolve(null),
    ]);

    const countryData = facts?.country ?? null;
    const headOfState = facts?.head_of_state ?? null;
    const empty = !loc;

    return new Response(
      JSON.stringify({
        coordinates: { lat, lng },
        location: locationInfo,
        country: countryData,
        head_of_state: headOfState,
        wikipedia: wiki
          ? {
              title: wiki.title,
              extract: trimExtract(wiki.extract),
              thumbnail: wiki.thumbnail?.source,
            }
          : null,
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          // Don't let a CDN pin an empty answer (e.g. geocoder outage) for an hour.
          "Cache-Control": empty ? "no-store" : "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      },
    );
  } catch (err) {
    console.error("[intel-region-dossier]", err);
    return new Response(
      JSON.stringify({ error: "Failed to fetch region data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
