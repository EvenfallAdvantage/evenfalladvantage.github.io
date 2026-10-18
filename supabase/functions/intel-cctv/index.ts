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
 * Modes:
 *   - `?bbox=w,s,e,n&zoom=z[&limit=n]` (viewport): reads the ingested
 *     cctv_cameras cache via the cctv_cameras_bbox RPC. Returns
 *     {mode:"clusters"|"points", ...} — clusters below zoom 7. West > east
 *     means the view crosses the antimeridian. Bboxes are grid-rounded and
 *     cached in-memory for 60s.
 *   - `?region=all|sg,us-ca,us-ny` (legacy, live upstream fetch) — unchanged.
 *
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireIntelUser } from "../_shared/intel-auth.ts";
import { CALTRANS_DISTRICTS, caltransUrl, parseCaltrans, parseNyc, parseSingapore, type CctvCamera, attributionFor, bboxCacheKey, parseBBoxQuery, type BBoxQuery } from "./lib.ts";
import { CCTV_ATTRIBUTION, CCTV_SOURCES, disabledSourceIds } from "../_shared/cctv/sources.ts";

/** Sources hidden on this deployment (NYC DOT until its agreement is signed). */
const DISABLED = disabledSourceIds(Deno.env.get("CCTV_ENABLE_PENDING_SOURCES"));

const BBOX_TTL_MS = 60_000;
const bboxCache = new Map<string, { at: number; body: string }>();

async function bboxBody(q: BBoxQuery): Promise<string> {
  const key = bboxCacheKey(q);
  const hit = bboxCache.get(key);
  if (hit && Date.now() - hit.at < BBOX_TTL_MS) return hit.body;
  const url = Deno.env.get("SUPABASE_URL")!;
  const sk = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const res = await fetch(`${url}/rest/v1/rpc/cctv_cameras_bbox`, {
    method: "POST",
    headers: { apikey: sk, Authorization: `Bearer ${sk}`, "Content-Type": "application/json" },
    body: JSON.stringify({ p_west: q.west, p_south: q.south, p_east: q.east, p_north: q.north, p_zoom: q.zoom, p_limit: q.limit }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`rpc ${res.status} ${(await res.text()).slice(0, 200)}`);
  const data = await res.json() as Record<string, unknown> & {
    sources?: Record<string, number>; cameras?: Array<{ source?: string }>; total?: number;
  };
  // Hide disabled sources even if their rows are still in cctv_cameras.
  // (Cluster counts come from SQL and may still include them until the rows
  // are purged — see the Phase 0 go-live checklist.)
  if (DISABLED.size) {
    if (Array.isArray(data.cameras)) {
      const before = data.cameras.length;
      data.cameras = data.cameras.filter((c) => !DISABLED.has(c.source ?? ""));
      if (typeof data.total === "number") data.total -= before - data.cameras.length;
    }
    if (data.sources) for (const id of DISABLED) delete data.sources[id];
  }
  const body = JSON.stringify({
    ...data, bbox: [q.west, q.south, q.east, q.north], zoom: q.zoom,
    attribution: attributionFor(data.sources, CCTV_ATTRIBUTION), timestamp: new Date().toISOString(),
  });
  if (bboxCache.size > 500) bboxCache.clear();
  bboxCache.set(key, { at: Date.now(), body });
  return body;
}

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
const ALL_REGION_FETCHERS: Record<string, () => Promise<CctvCamera[]>> = {
  "sg": fetchSingaporeCameras,
  "us-ca": fetchCaltransCameras,
  "us-ny": fetchNycCameras,
};
const REGION_FETCHERS: Record<string, () => Promise<CctvCamera[]>> = Object.fromEntries(
  Object.entries(ALL_REGION_FETCHERS).filter(([region]) =>
    !CCTV_SOURCES.some((s) => s.region === region && DISABLED.has(s.id))
  ),
);

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireIntelUser(req, corsHeaders, { limit: 240 });
  if (denied) return denied;

  try {
    const { searchParams } = new URL(req.url);
    const bbox = parseBBoxQuery(searchParams);
    if (bbox && "error" in bbox) {
      return new Response(JSON.stringify({ error: bbox.error }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (bbox) {
      return new Response(await bboxBody(bbox), {
        headers: { ...corsHeaders, "Content-Type": "application/json", "Cache-Control": "public, s-maxage=60, stale-while-revalidate=120" },
      });
    }
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
