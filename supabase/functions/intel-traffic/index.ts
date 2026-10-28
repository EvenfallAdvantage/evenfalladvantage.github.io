/**
 * Intel — Live Road Traffic Flow Tiles & Road Incidents (`intel-traffic`).
 *
 * Modes:
 * 1. `GET /functions/v1/intel-traffic?tile={z}/{x}/{y}[&style=relative0-dark]`
 *    Server-side tile proxy for TomTom Traffic Flow tiles v4 so `TOMTOM_API_KEY`
 *    stays in Edge Function / Vault secrets and is never exposed in the client bundle.
 *    Returns `image/png` with `Cache-Control: public, max-age=120, s-maxage=180`.
 *    When `TOMTOM_API_KEY` is not configured (or zoom < 5), returns a 1x1
 *    transparent PNG with `X-Traffic-Flow-Status: unconfigured`.
 *
 * 2. `GET /functions/v1/intel-traffic?bbox=west,south,east,north` (or `?near=lat,lng[,radiusKm]`)
 *    Fetches, normalizes, caches (3–5 min), and filters live road closures,
 *    crashes, construction, and road hazards from:
 *      - Caltrans CWWP2 Lane Closures (`lcs`) & Chain Controls (`cc`) across CA districts
 *      - IBI 511 Events API (`/api/v2/get/event`) for configured 511 state/provincial keys
 *        (`GA511_API_KEY`, `WI511_API_KEY`, `ID511_API_KEY`, `ONTARIO511_API_KEY`, `ALBERTA511_API_KEY`)
 *      - Iowa DOT CARS 511 ArcGIS FeatureServer
 *      - DriveBC Open511 active events
 *      - City of Austin real-time traffic incident reports
 *      - Transport for London (TfL) road disruptions
 *      - Fintraffic Digitraffic (Finland) active traffic announcements
 *      - TomTom Traffic Incidents API v5 (when `TOMTOM_API_KEY` is set in Edge env or Supabase Vault)
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { userRateLimited } from "../_shared/intel-auth.ts";
import {
  AUSTIN_BBOX,
  AUSTIN_EVENTS_URL,
  bboxesIntersect,
  type BBox,
  caltransCcUrl,
  caltransDistrictsForBBox,
  caltransLcsUrl,
  clampTomTomBBox,
  DIGITRAFFIC_BBOX,
  DIGITRAFFIC_MESSAGES_URL,
  DRIVEBC_BBOX,
  DRIVEBC_EVENTS_URL,
  FIVE11_EVENT_HOSTS,
  five11EventsUrl,
  inBBox,
  IOWA_BBOX,
  IOWA_EVENTS_URL,
  parse511Events,
  parseAustinEvents,
  parseBBoxParam,
  parseCaltransCc,
  parseCaltransLcs,
  parseDigitrafficMessages,
  parseDriveBcEvents,
  parseIowaEvents,
  parseNearParam,
  parseTileParam,
  parseTflDisruptions,
  parseTomTomIncidents,
  type RoadIncident,
  TFL_BBOX,
  TFL_DISRUPTIONS_URL,
  tomtomFlowTileUrl,
  tomtomIncidentsUrl,
  TRANSPARENT_PNG_1X1,
  TtlCache,
  dedupeIncidents,
} from "./lib.ts";

const FEED_TTL_MS = 4 * 60_000; // 4 minutes for regional DOT/511 feeds
const TOMTOM_INCIDENTS_TTL_MS = 2 * 60_000; // 2 minutes for viewport TomTom incidents
const TILE_TTL_MS = 2 * 60_000; // 2 minutes for proxied traffic flow PNG tiles
const VAULT_KEY_TTL_MS = 10 * 60_000; // 10 minutes for Vault key cache

const feedCache = new TtlCache<RoadIncident[]>(FEED_TTL_MS);
const tomtomCache = new TtlCache<RoadIncident[]>(TOMTOM_INCIDENTS_TTL_MS);
const tileCache = new TtlCache<Uint8Array>(TILE_TTL_MS);

let cachedVaultTomTomKey: { value: string; expiresAt: number } | null = null;

/**
 * Resolves `TOMTOM_API_KEY` from Edge Function env first, falling back to
 * Supabase Vault via the `service_role`-only RPC `public.get_tomtom_api_key()`.
 */
async function getTomTomApiKey(): Promise<string> {
  const envKey = (Deno.env.get("TOMTOM_API_KEY") ?? "").trim();
  if (envKey) return envKey;

  const now = Date.now();
  if (cachedVaultTomTomKey && cachedVaultTomTomKey.expiresAt > now) {
    return cachedVaultTomTomKey.value;
  }

  const supabaseUrl = (Deno.env.get("SUPABASE_URL") ?? "").replace(/\/$/, "");
  const serviceRoleKey = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "").trim();
  if (!supabaseUrl || !serviceRoleKey) return "";

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_tomtom_api_key`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
      },
      body: "{}",
      signal: AbortSignal.timeout(5_000),
    });
    if (!res.ok) {
      await res.body?.cancel();
      return "";
    }
    const data = await res.json();
    const key = typeof data === "string" ? data.trim() : "";
    cachedVaultTomTomKey = { value: key, expiresAt: now + VAULT_KEY_TTL_MS };
    return key;
  } catch (err) {
    console.warn("[intel-traffic] vault key lookup failed:", err);
    return "";
  }
}

const UA_HEADERS: Record<string, string> = {
  "User-Agent": "EvenfallOverwatch/1.0 (+https://www.evenfalladvantage.com)",
  Accept: "application/json",
};

async function fetchJson(url: string, timeoutMs = 10_000, extraHeaders?: Record<string, string>): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      headers: extraHeaders ? { ...UA_HEADERS, ...extraHeaders } : UA_HEADERS,
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) {
      await res.body?.cancel();
      return null;
    }
    return await res.json();
  } catch (err) {
    console.warn("[intel-traffic] upstream fetch error:", url.replace(/([?&]key=)[^&]+/gi, "$1***"), err);
    return null;
  }
}

async function cachedFeed(cacheKey: string, loader: () => Promise<RoadIncident[]>): Promise<RoadIncident[]> {
  const hit = feedCache.get(cacheKey);
  if (hit) return hit;
  const rows = await loader();
  feedCache.set(cacheKey, rows);
  return rows;
}

async function fetchCaltransDistrictIncidents(district: number): Promise<RoadIncident[]> {
  return cachedFeed(`caltrans-d${district}`, async () => {
    const [lcsBody, ccBody] = await Promise.all([
      fetchJson(caltransLcsUrl(district), 10_000),
      fetchJson(caltransCcUrl(district), 8_000),
    ]);
    return [
      ...parseCaltransLcs(lcsBody, district),
      ...parseCaltransCc(ccBody, district),
    ];
  });
}

async function fetchIncidentsForBBox(bbox: BBox | null, tomtomKey: string): Promise<RoadIncident[]> {
  const tasks: Array<Promise<RoadIncident[]>> = [];

  // 1. Caltrans CWWP2 districts intersecting bbox
  const districts = caltransDistrictsForBBox(bbox);
  for (const d of districts) {
    tasks.push(fetchCaltransDistrictIncidents(d));
  }

  // 2. Keyed 511 feeds (GA, WI, ID, ON, AB) when secret is set and bbox intersects
  for (const host of FIVE11_EVENT_HOSTS) {
    const key = (Deno.env.get(host.secret) ?? "").trim();
    if (!key) continue;
    if (bbox && !bboxesIntersect(bbox, host.bbox)) continue;
    tasks.push(
      cachedFeed(`511-${host.prefix}`, async () => {
        const body = await fetchJson(five11EventsUrl(host.host, key), 12_000);
        return parse511Events(body, host.id, host.prefix, host.attribution);
      }),
    );
  }

  // 3. Iowa DOT CARS 511
  if (!bbox || bboxesIntersect(bbox, IOWA_BBOX)) {
    tasks.push(
      cachedFeed("iowa-dot", async () => parseIowaEvents(await fetchJson(IOWA_EVENTS_URL, 10_000))),
    );
  }

  // 4. DriveBC Open511
  if (!bbox || bboxesIntersect(bbox, DRIVEBC_BBOX)) {
    tasks.push(
      cachedFeed("drivebc", async () => parseDriveBcEvents(await fetchJson(DRIVEBC_EVENTS_URL, 10_000))),
    );
  }

  // 5. City of Austin
  if (!bbox || bboxesIntersect(bbox, AUSTIN_BBOX)) {
    tasks.push(
      cachedFeed("austin", async () => parseAustinEvents(await fetchJson(AUSTIN_EVENTS_URL, 10_000))),
    );
  }

  // 6. Transport for London (TfL)
  if (!bbox || bboxesIntersect(bbox, TFL_BBOX)) {
    tasks.push(
      cachedFeed("tfl", async () => parseTflDisruptions(await fetchJson(TFL_DISRUPTIONS_URL, 10_000))),
    );
  }

  // 7. Fintraffic Digitraffic (Finland)
  if (!bbox || bboxesIntersect(bbox, DIGITRAFFIC_BBOX)) {
    tasks.push(
      cachedFeed("digitraffic", async () =>
        parseDigitrafficMessages(
          await fetchJson(DIGITRAFFIC_MESSAGES_URL, 10_000, { "Digitraffic-User": "EvenfallOverwatch/1.0" }),
        ),
      ),
    );
  }

  // 8. TomTom Traffic Incidents API v5 (worldwide coverage when TOMTOM_API_KEY is configured and bbox is given)
  if (tomtomKey && bbox) {
    const clamped = clampTomTomBBox(bbox, 0.85);
    const ttKey = `tt:${clamped.map((n) => n.toFixed(2)).join(",")}`;
    tasks.push(
      (async () => {
        const hit = tomtomCache.get(ttKey);
        if (hit) return hit;
        const body = await fetchJson(tomtomIncidentsUrl(clamped, tomtomKey), 10_000);
        const parsed = parseTomTomIncidents(body);
        tomtomCache.set(ttKey, parsed);
        return parsed;
      })(),
    );
  }

  const settled = await Promise.allSettled(tasks);
  const seen = new Set<string>();
  const out: RoadIncident[] = [];
  for (const res of settled) {
    if (res.status !== "fulfilled") continue;
    for (const item of res.value) {
      if (seen.has(item.id)) continue;
      if (!inBBox(item.lat, item.lng, bbox)) continue;
      seen.add(item.id);
      out.push(item);
    }
  }
  return dedupeIncidents(out);
}

async function handleTileRequest(
  req: Request,
  tileRaw: string,
  styleParam: string | null,
  corsHeaders: Record<string, string>,
): Promise<Response> {
  const tile = parseTileParam(tileRaw);
  if (!tile) {
    return new Response(JSON.stringify({ error: "Invalid tile parameter; expected z/x/y" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Basic per-IP rate limit for tile proxy (600 tiles / 60s)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "tile-anon";
  if (userRateLimited(`tile:${ip}`, 600, 60_000)) {
    return new Response("Rate limit exceeded", { status: 429, headers: corsHeaders });
  }

  const tomtomKey = await getTomTomApiKey();
  if (!tomtomKey || tile.z < 5 || tile.z > 19) {
    return new Response(TRANSPARENT_PNG_1X1, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60",
        "X-Traffic-Flow-Status": tomtomKey ? "out-of-zoom" : "unconfigured",
      },
    });
  }

  const style = styleParam || "relative0-dark";
  const cacheKey = `${style}:${tile.z}/${tile.x}/${tile.y}`;
  const cached = tileCache.get(cacheKey);
  if (cached) {
    return new Response(cached, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=120, s-maxage=180",
        "X-Traffic-Flow-Status": "ok",
      },
    });
  }

  try {
    const upstreamUrl = tomtomFlowTileUrl(tile.z, tile.x, tile.y, tomtomKey, style);
    const res = await fetch(upstreamUrl, {
      headers: { "User-Agent": UA_HEADERS["User-Agent"], Accept: "image/png,image/*;q=0.8" },
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) {
      await res.body?.cancel();
      return new Response(TRANSPARENT_PNG_1X1, {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "image/png",
          "Cache-Control": "public, max-age=30",
          "X-Traffic-Flow-Status": `upstream-${res.status}`,
        },
      });
    }
    const bytes = new Uint8Array(await res.arrayBuffer());
    tileCache.set(cacheKey, bytes);
    return new Response(bytes, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=120, s-maxage=180",
        "X-Traffic-Flow-Status": "ok",
      },
    });
  } catch (err) {
    console.warn("[intel-traffic] tile proxy error:", err);
    return new Response(TRANSPARENT_PNG_1X1, {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=30",
        "X-Traffic-Flow-Status": "error",
      },
    });
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const tileParam = searchParams.get("tile");
  if (tileParam !== null) {
    return handleTileRequest(req, tileParam, searchParams.get("style"), corsHeaders);
  }

  // Per-caller rate limit (180 requests / 60s)
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "inc-anon";
  if (userRateLimited(`inc:${ip}`, 180, 60_000)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const bboxParam = searchParams.get("bbox");
    const nearParam = searchParams.get("near");
    let bbox: BBox | null = null;
    if (bboxParam) {
      bbox = parseBBoxParam(bboxParam);
      if (!bbox) {
        return new Response(JSON.stringify({ error: "Invalid bbox parameter; expected west,south,east,north" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    } else if (nearParam) {
      bbox = parseNearParam(nearParam, searchParams.get("near_km"));
      if (!bbox) {
        return new Response(JSON.stringify({ error: "Invalid near parameter; expected lat,lng[,radiusKm]" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const limitRaw = Number(searchParams.get("limit") ?? 500);
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(Math.floor(limitRaw), 1000) : 500;
    const tomtomKey = await getTomTomApiKey();

    const allIncidents = await fetchIncidentsForBBox(bbox, tomtomKey);
    const incidents = allIncidents.slice(0, limit);

    const sources: Record<string, number> = {};
    const attrSet = new Set<string>();
    for (const inc of incidents) {
      sources[inc.source] = (sources[inc.source] ?? 0) + 1;
      if (inc.attribution) attrSet.add(inc.attribution);
    }

    return new Response(
      JSON.stringify({
        incidents,
        total: incidents.length,
        sources,
        attributions: [...attrSet],
        tomtomConfigured: Boolean(tomtomKey),
        timestamp: new Date().toISOString(),
      }),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
          "Cache-Control": "public, s-maxage=120, stale-while-revalidate=240",
        },
      },
    );
  } catch (err) {
    console.error("[intel-traffic]", err);
    return new Response(
      JSON.stringify({
        incidents: [],
        total: 0,
        sources: {},
        attributions: [],
        tomtomConfigured: false,
        timestamp: new Date().toISOString(),
        error: "Failed to fetch traffic incidents",
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
