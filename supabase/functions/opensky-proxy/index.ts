// Aircraft proxy (name kept as opensky-proxy so the client is unchanged).
//
// OpenSky blocks Supabase/cloud egress (every call timed out), so this now
// reads the free, keyless community ADS-B aggregators and returns OpenSky's
// /states/all shape: { time, states: [...], source }.
//   primary:  adsb.lol  (https://api.adsb.lol, ODbL)
//   fallback: adsb.fi   (https://opendata.adsb.fi)
// airplanes.live was evaluated but now requires registration (403).
//
// Usage: GET /opensky-proxy?lamin=38&lamax=42&lomin=-80&lomax=-75 (max 10° per axis)

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'
import { cacheKey, extractAircraft, parseBBox, toOpenSkyStates, upstreamUrls } from './lib.ts'

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

  const bbox = parseBBox(new URL(req.url).searchParams);
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
