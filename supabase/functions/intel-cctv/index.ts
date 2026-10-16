/**
 * Intel — CCTV camera aggregator.
 *
 * **GATED PENDING LEGAL REVIEW.** This function is wired but the
 * `cctv` layer in INTEL_LAYER_FLAGS is disabled until commercial-use review
 * completes for the upstream sources. The function still returns the
 * advertised JSON shape for callers; the gating is enforced client-side by
 * the layer toggle in the UI.
 *
 * Sources (free, keyless open data):
 *   - Singapore LTA traffic-images (data.gov.sg v1)
 *   - Caltrans CWWP2, districts 1–12 (path /data/d7/…/cctvStatusD07.json)
 *   - NYC DOT traffic webcams (webcams.nyctmc.org)
 *
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { CALTRANS_DISTRICTS, caltransUrl, parseCaltrans, parseNyc, parseSingapore, type CctvCamera } from "./lib.ts";

const UA = { "User-Agent": "EvenfallOverwatch/1.0 (+https://www.evenfalladvantage.com)", Accept: "application/json" };

async function getJson(url: string, timeoutMs: number): Promise<unknown | null> {
  const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) { console.warn("[intel-cctv]", url, res.status); return null; }
  return await res.json();
}

async function fetchSingaporeCameras(): Promise<CctvCamera[]> {
  try { return parseSingapore(await getJson("https://api.data.gov.sg/v1/transport/traffic-images", 10_000)); }
  catch (e) { console.warn("[intel-cctv] singapore error:", e); return []; }
}

async function fetchCaltransCameras(): Promise<CctvCamera[]> {
  const results = await Promise.allSettled(
    CALTRANS_DISTRICTS.map(async (d) => parseCaltrans(await getJson(caltransUrl(d), 10_000), d)),
  );
  return results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
}

async function fetchNycCameras(): Promise<CctvCamera[]> {
  try { return parseNyc(await getJson("https://webcams.nyctmc.org/api/cameras", 10_000)); }
  catch (e) { console.warn("[intel-cctv] nyc error:", e); return []; }
}

// FL-511 removed: its open endpoint now 404s and the v2 API requires a key
// (FL511_API_KEY). See PR notes for other keyed 511 feeds.
const REGION_FETCHERS: Record<string, () => Promise<CctvCamera[]>> = {
  "sg": fetchSingaporeCameras,
  "us-ca": fetchCaltransCameras,
  "us-ny": fetchNycCameras,
};

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { searchParams } = new URL(req.url);
    const regionParam = searchParams.get("region");

    let regionsToFetch: string[];
    if (regionParam === "all" || !regionParam) {
      regionsToFetch = Object.keys(REGION_FETCHERS);
    } else {
      regionsToFetch = regionParam.split(",").filter((r) => r in REGION_FETCHERS);
    }

    const results = await Promise.allSettled(
      regionsToFetch.map((r) => REGION_FETCHERS[r]()),
    );

    const allCameras: CctvCamera[] = [];
    const sources: Record<string, number> = {};

    for (const result of results) {
      if (result.status === "fulfilled") {
        for (const cam of result.value) {
          allCameras.push(cam);
          sources[cam.source] = (sources[cam.source] ?? 0) + 1;
        }
      }
    }

    return new Response(
      JSON.stringify({
        cameras: allCameras,
        total: allCameras.length,
        sources,
        regions: regionsToFetch,
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
    console.error("[intel-cctv]", err);
    return new Response(
      JSON.stringify({
        cameras: [], total: 0, sources: {}, regions: [],
        timestamp: new Date().toISOString(),
        error: "Failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
