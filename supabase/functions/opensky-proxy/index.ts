// Aircraft proxy (name kept as opensky-proxy so the client is unchanged).
//
// OpenSky blocks Supabase/cloud egress (every call timed out), so this now
// reads the free, keyless community ADS-B aggregators and returns OpenSky's
// /states/all shape: { time, states: [...], source }.
//   source: adsb.lol (https://api.adsb.lol, data ODbL 1.0, free keyless API)
// adsb.fi was removed as a fallback: its open-data terms are personal /
// non-commercial use only.
// Requires a signed-in user (see _shared/intel-auth.ts), 60 req/min/user.
// airplanes.live was evaluated but now requires registration (403).
//
// Usage: GET /opensky-proxy?lamin=38&lamax=42&lomin=-80&lomax=-75 (max 10° per axis)
//        GET /opensky-proxy?trace=<icao hex>  → last 24 h of positions (adsb.lol trace, ODbL)

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'
import { requireIntelUser } from '../_shared/intel-auth.ts';
import { cacheKey, extractAircraft, normalizeTrace, parseBBox, parseTraceParam, toOpenSkyStates, TRACE_MAX_BYTES, traceUrl, upstreamUrls } from './lib.ts'

const CACHE_TTL_MS = 10_000;
const CACHE_MAX = 64;
const UPSTREAM_TIMEOUT_MS = 6_000;
const cache = new Map<string, { body: string; ts: number }>();

function json(body: unknown, corsHeaders: Record<string, string>, extra: Record<string, string> = {}, status = 200) {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=10', ...extra },
  });
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const denied = await requireIntelUser(req, corsHeaders, { limit: 60 });
  if (denied) return denied;

  const params = new URL(req.url).searchParams;
  if (params.has('trace')) return handleTrace(params, corsHeaders);

  const bbox = parseBBox(params);
  if ('error' in bbox) return json({ error: bbox.error, states: [] }, corsHeaders, {}, 400);

  const key = cacheKey(bbox);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.ts < CACHE_TTL_MS) return json(hit.body, corsHeaders, { 'X-Cache': 'HIT' });

  const errors: string[] = [];
  for (const up of upstreamUrls(bbox)) {
    try {
      const res = await fetch(up.url, {
        headers: { Accept: 'application/json', 'User-Agent': 'EvenfallOverwatch/1.0 (+https://www.evenfalladvantage.com)' },
        signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
      });
      if (!res.ok) { errors.push(`${up.name} ${res.status}`); continue; }
      const aircraft = extractAircraft(await res.json());
      if (!aircraft) { errors.push(`${up.name} bad body`); continue; }
      const now = Math.floor(Date.now() / 1000);
      const body = JSON.stringify({ time: now, states: toOpenSkyStates(aircraft, bbox, now), source: up.name });
      if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
      cache.set(key, { body, ts: Date.now() });
      return json(body, corsHeaders, { 'X-Cache': 'MISS', 'X-Upstream': up.name });
    } catch (err) {
      errors.push(`${up.name} ${err instanceof Error ? err.name : 'error'}`);
    }
  }

  console.error('[opensky-proxy] all upstreams failed:', errors.join('; '));
  // 200 + empty states so the client quietly shows no aircraft.
  if (hit) return json(hit.body, corsHeaders, { 'X-Cache': 'STALE' });
  return json({ error: 'Aircraft feeds unreachable', states: [] }, corsHeaders, { 'X-Cache': 'ERROR' });
});

// ── Track history ─────────────────────────────────────────────────────────
const TRACE_CACHE_MS = 60_000;
const TRACE_CACHE_MAX = 200;
const traceCache = new Map<string, { body: string; ts: number }>();

async function handleTrace(params: URLSearchParams, corsHeaders: Record<string, string>): Promise<Response> {
  const hex = parseTraceParam(params);
  if (!hex) return json({ error: 'trace must be a 6-character ICAO hex', points: [] }, corsHeaders, {}, 400);
  const hit = traceCache.get(hex);
  if (hit && Date.now() - hit.ts < TRACE_CACHE_MS) return json(hit.body, corsHeaders, { 'X-Cache': 'HIT', 'Cache-Control': 'private, max-age=60' });
  let body: string;
  try {
    const res = await fetch(traceUrl(hex), {
      headers: { Accept: 'application/json', 'User-Agent': 'EvenfallOverwatch/1.0 (+https://www.evenfalladvantage.com)' },
      signal: AbortSignal.timeout(8_000),
    });
    const len = Number(res.headers.get('content-length') ?? 0);
    if (!res.ok || len > TRACE_MAX_BYTES) {
      body = JSON.stringify({ hex, points: [], source: 'adsb.lol', error: `history unavailable (${res.ok ? 'too large' : res.status})` });
    } else {
      const text = await res.text();
      const points = text.length > TRACE_MAX_BYTES ? [] : normalizeTrace(JSON.parse(text), Date.now());
      body = JSON.stringify({ hex, points, source: 'adsb.lol' });
    }
  } catch (err) {
    body = JSON.stringify({ hex, points: [], source: 'adsb.lol', error: `history unavailable (${err instanceof Error ? err.name : 'error'})` });
  }
  if (traceCache.size >= TRACE_CACHE_MAX) traceCache.delete(traceCache.keys().next().value as string);
  traceCache.set(hex, { body, ts: Date.now() });
  return json(body, corsHeaders, { 'X-Cache': 'MISS', 'Cache-Control': 'private, max-age=60' });
}
