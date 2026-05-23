/**
 * Intel — Region dossier (right-click on map → country brief).
 * Reverse-geocode + parallel fetch of RestCountries, Wikipedia, Wikidata HoS.
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

interface NominatimAddress {
  country?: string;
  country_code?: string;
  city?: string;
  town?: string;
  village?: string;
  state?: string;
  region?: string;
}
interface NominatimResponse { address?: NominatimAddress; display_name?: string; }
interface RestCountry {
  name?: { common?: string; official?: string };
  capital?: string[];
  population?: number;
  area?: number;
  region?: string;
  subregion?: string;
  languages?: Record<string, string>;
  currencies?: Record<string, { name?: string; symbol?: string }>;
  flag?: string;
  flags?: { svg?: string };
  timezones?: string[];
}
interface WikiSummary { title?: string; extract?: string; thumbnail?: { source?: string }; }
interface WikidataBinding {
  leader?: { value?: string };
  leaderLabel?: { value?: string };
  positionLabel?: { value?: string };
}
interface WikidataResponse { results?: { bindings?: WikidataBinding[] }; }

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

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
    const geoRes = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=5&addressdetails=1`,
      {
        signal: AbortSignal.timeout(8_000),
        headers: { "User-Agent": "OverwatchIntel/1.0 (+evenfalladvantage.com)" },
      },
    );

    let countryName = "";
    let countryCode = "";
    let locationInfo: {
      city?: string; state?: string; country?: string;
      country_code?: string; display_name?: string;
    } = {};

    if (geoRes.ok) {
      const geoData = (await geoRes.json()) as NominatimResponse;
      const addr = geoData.address ?? {};
      countryName = addr.country ?? "";
      countryCode = (addr.country_code ?? "").toUpperCase();
      locationInfo = {
        city: addr.city ?? addr.town ?? addr.village ?? "",
        state: addr.state ?? addr.region ?? "",
        country: countryName,
        country_code: countryCode,
        display_name: geoData.display_name,
      };
    }

    const [countryResult, wikiResult, hosResult] = await Promise.allSettled([
      (async (): Promise<RestCountry | null> => {
        if (!countryCode) return null;
        try {
          const res = await fetch(
            `https://restcountries.com/v3.1/alpha/${countryCode}?fields=name,capital,population,area,region,subregion,languages,currencies,flag,flags,timezones`,
            { signal: AbortSignal.timeout(5_000) },
          );
          if (res.ok) return (await res.json()) as RestCountry;
        } catch (e) {
          console.warn("[intel-region-dossier] restcountries error:", e);
        }
        return null;
      })(),
      (async (): Promise<WikiSummary | null> => {
        const wikiQuery = locationInfo.city || countryName;
        if (!wikiQuery) return null;
        try {
          const res = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(wikiQuery)}`,
            { signal: AbortSignal.timeout(5_000) },
          );
          if (res.ok) return (await res.json()) as WikiSummary;
        } catch (e) {
          console.warn("[intel-region-dossier] wikipedia error:", e);
        }
        return null;
      })(),
      (async (): Promise<{ name?: string; position?: string } | null> => {
        if (!countryName) return null;
        try {
          const safe = countryName.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
          const sparql = `SELECT ?leader ?leaderLabel ?positionLabel WHERE {
            ?country wdt:P31 wd:Q6256;
                     rdfs:label "${safe}"@en;
                     wdt:P6 ?leader.
            OPTIONAL { ?leader wdt:P39 ?position. }
            SERVICE wikibase:label { bd:serviceParam wikibase:language "en". }
          } LIMIT 1`;
          const res = await fetch(
            `https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(sparql)}`,
            {
              signal: AbortSignal.timeout(5_000),
              headers: { "User-Agent": "OverwatchIntel/1.0 (+evenfalladvantage.com)" },
            },
          );
          if (res.ok) {
            const wd = (await res.json()) as WikidataResponse;
            const binding = wd.results?.bindings?.[0];
            if (binding) {
              return {
                name: binding.leaderLabel?.value,
                position: binding.positionLabel?.value ?? "Head of State",
              };
            }
          }
        } catch (e) {
          console.warn("[intel-region-dossier] wikidata error:", e);
        }
        return null;
      })(),
    ]);

    const countryData = countryResult.status === "fulfilled" ? countryResult.value : null;
    const wikiSummary = wikiResult.status === "fulfilled" ? wikiResult.value : null;
    const headOfState = hosResult.status === "fulfilled" ? hosResult.value : null;

    return new Response(
      JSON.stringify({
        coordinates: { lat, lng },
        location: locationInfo,
        country: countryData
          ? {
              name: countryData.name?.common ?? "",
              official_name: countryData.name?.official ?? "",
              capital: countryData.capital?.[0] ?? "",
              population: countryData.population ?? 0,
              area: countryData.area ?? 0,
              region: countryData.region ?? "",
              subregion: countryData.subregion ?? "",
              languages: countryData.languages ? Object.values(countryData.languages) : [],
              currencies: countryData.currencies
                ? Object.entries(countryData.currencies).map(
                    ([code, info]) => `${info.name ?? code} (${info.symbol ?? code})`,
                  )
                : [],
              flag: countryData.flag ?? "",
              flag_url: countryData.flags?.svg ?? "",
              timezones: countryData.timezones ?? [],
            }
          : null,
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
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
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
