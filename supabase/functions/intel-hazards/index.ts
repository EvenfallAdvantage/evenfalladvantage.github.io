/**
 * Intel — natural hazards in one normalized feed (see lib.ts for sources).
 *
 *   GET /intel-hazards?kinds=warnings,quakes,fires,perimeters,tropical,volcanoes
 *        [&near=lat,lng;lat,lng&near_km=150]   optional coarse proximity filter (Site Watch)
 *
 * Response: { hazards: Hazard[], sources: { [kind]: { ok, count, stale?, error? } }, timestamp }
 * Requires a signed-in Overwatch user (deploy with verify_jwt = false; auth in code).
 * All upstreams are US-government public domain; attribution shown in the app.
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireIntelUser } from "../_shared/intel-auth.ts";
import {
  CACHE_TTL_S, EONET_VOLCANOES_URL, FIRMS_URLS, NHC_STORMS_URL, NIFC_PERIMETERS_URL, USGS_URL, WWA_URL,
  TtlCache, coneHazard, filterNear, parseNear, kmlFromKmz, kmlLongestLine, kmlPolygons, parseEonetVolcanoes, parseFirmsCsv, parseKinds,
  parseNhcStorms, parsePerimeters, parseUsgs, parseWwa, trackHazard,
  type Hazard, type HazardSource,
} from "./lib.ts";

const UA = { "User-Agent": "OverwatchIntel/1.0 (+https://www.evenfalladvantage.com)" };
const cache = new TtlCache<Hazard[]>();
const inflight = new Map<HazardSource, Promise<Hazard[]>>();

async function getJson(url: string, timeoutMs = 15_000): Promise<unknown> {
  const res = await fetch(url, { headers: { ...UA, Accept: "application/geo+json, application/json" }, signal: AbortSignal.timeout(timeoutMs) });
  if (!res.ok) throw new Error(`${new URL(url).hostname} returned ${res.status}`);
  return await res.json();
}

async function loadTropical(): Promise<Hazard[]> {
  const { storms, points } = parseNhcStorms(await getJson(NHC_STORMS_URL));
  const extra = await Promise.all(storms.map(async (s, i) => {
    const sev = points[i].severity;
    const out: Hazard[] = [];
    const kmz = async (url?: string) => {
      if (!url) return null;
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(10_000) });
      if (!res.ok) return null;
      return await kmlFromKmz(new Uint8Array(await res.arrayBuffer()));
    };
    try {
      const cone = await kmz(s.trackCone?.kmzFile);
      const h = cone ? coneHazard(s, kmlPolygons(cone), sev) : null;
      if (h) out.push(h);
    } catch (e) { console.warn("[intel-hazards] cone", s.id, e); }
    try {
      const track = await kmz(s.forecastTrack?.kmzFile);
      const h = track ? trackHazard(s, kmlLongestLine(track), sev) : null;
      if (h) out.push(h);
    } catch (e) { console.warn("[intel-hazards] track", s.id, e); }
    return out;
  }));
  return [...points, ...extra.flat()];
}

async function loadFires(): Promise<Hazard[]> {
  for (const url of FIRMS_URLS) {
    try {
      const res = await fetch(url, { headers: UA, signal: AbortSignal.timeout(15_000) });
      if (!res.ok) continue;
      const text = await res.text();
      const parsed = parseFirmsCsv(text);
      if (parsed.length) return parsed;
    } catch (e) { console.warn("[intel-hazards] firms", e); }
  }
  throw new Error("FIRMS unavailable");
}

const LOADERS: Record<HazardSource, () => Promise<Hazard[]>> = {
  warnings: async () => parseWwa(await getJson(WWA_URL, 20_000)),
  quakes: async () => parseUsgs(await getJson(USGS_URL)),
  fires: loadFires,
  perimeters: async () => parsePerimeters(await getJson(NIFC_PERIMETERS_URL, 20_000)),
  tropical: loadTropical,
  volcanoes: async () => parseEonetVolcanoes(await getJson(EONET_VOLCANOES_URL)),
};

async function load(kind: HazardSource): Promise<{ hazards: Hazard[]; stale?: boolean }> {
  const hit = cache.get(kind);
  if (hit) return { hazards: hit };
  let p = inflight.get(kind);
  if (!p) {
    p = LOADERS[kind]().finally(() => inflight.delete(kind));
    inflight.set(kind, p);
  }
  try {
    const hazards = await p;
    cache.set(kind, hazards, CACHE_TTL_S[kind] * 1000);
    return { hazards };
  } catch (e) {
    const old = cache.stale(kind);
    if (old) return { hazards: old, stale: true };
    throw e;
  }
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireIntelUser(req, corsHeaders, { limit: 30 });
  if (denied) return denied;

  const params = new URL(req.url).searchParams;
  const kinds = parseKinds(params.get("kinds"));
  const near = parseNear(params.get("near"), params.get("near_km"));
  const results = await Promise.allSettled(kinds.map((k) => load(k)));
  const hazards: Hazard[] = [];
  const sources: Record<string, { ok: boolean; count: number; stale?: boolean; error?: string }> = {};
  results.forEach((r, i) => {
    const k = kinds[i];
    if (r.status === "fulfilled") {
      const list = near ? filterNear(r.value.hazards, near) : r.value.hazards;
      hazards.push(...list);
      sources[k] = { ok: true, count: list.length, ...(r.value.stale ? { stale: true } : {}) };
    } else {
      console.warn("[intel-hazards]", k, r.reason);
      sources[k] = { ok: false, count: 0, error: "upstream unavailable" };
    }
  });

  return new Response(JSON.stringify({ hazards, sources, timestamp: new Date().toISOString() }), {
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      "Cache-Control": "private, max-age=60",
    },
  });
});
