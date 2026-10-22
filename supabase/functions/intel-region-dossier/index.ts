/**
 * Intel — Region dossier (right-click on map → country brief).
 * Reverse-geocode (Nominatim → Photon fallback) + parallel Wikidata country facts
 * and Wikipedia summary. All sources are free and keyless; see lib.ts.
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireIntelUser } from "../_shared/intel-auth.ts";
import {
  countrySparql, type LocationInfo, type NominatimResponse, parseCountry, parseNominatim,
  parsePhoton, type PhotonResponse, UA, type WikidataResponse,
} from "./lib.ts";

interface WikiSummary { title?: string; extract?: string; thumbnail?: { source?: string }; }

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

async function reverseGeocode(lat: number, lng: number): Promise<LocationInfo | null> {
  const nom = parseNominatim(await getJson<NominatimResponse>(
    "nominatim",
    `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=10&addressdetails=1&accept-language=en`,
    6_000,
  ));
  if (nom) return nom;
  return parsePhoton(await getJson<PhotonResponse>(
    "photon",
    `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}&limit=1&lang=en`,
    6_000,
  ));
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

    const [facts, wikiSummary] = await Promise.all([
      /^[A-Z]{2}$/.test(countryCode)
        ? getJson<WikidataResponse>(
            "wikidata",
            `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(countrySparql(countryCode))}`,
            7_000,
          ).then((d) => parseCountry(d, countryCode, countryName))
        : Promise.resolve(null),
      (async (): Promise<WikiSummary | null> => {
        for (const q of [locationInfo.city, countryName]) {
          if (!q) continue;
          const w = await getJson<WikiSummary>(
            "wikipedia",
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}?redirect=true`,
            5_000,
          );
          if (w?.extract) return w;
        }
        return null;
      })(),
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
        wikipedia: wikiSummary
          ? {
              title: wikiSummary.title,
              extract: wikiSummary.extract?.substring(0, 500),
              thumbnail: wikiSummary.thumbnail?.source,
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
