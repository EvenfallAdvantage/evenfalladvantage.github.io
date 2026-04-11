// OpenSky Network Proxy — relays aircraft position requests to avoid CORS
// The OpenSky API does not include Access-Control-Allow-Origin headers,
// so browser-side requests are blocked. This proxy runs server-side.
//
// Usage: GET /opensky-proxy?lamin=38&lamax=42&lomin=-80&lomax=-75
// Returns: { states: [...] } — same format as OpenSky /states/all

import "jsr:@supabase/functions-js/edge-runtime.d.ts"
import { getCorsHeaders } from '../_shared/cors.ts'

const OPENSKY_BASE = "https://opensky-network.org/api/states/all";

// Simple in-memory cache to respect rate limits (~100 req / 10s on free tier)
let cache: { key: string; data: unknown; ts: number } | null = null;
const CACHE_TTL_MS = 15_000; // 15 seconds

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const lamin = url.searchParams.get('lamin');
    const lamax = url.searchParams.get('lamax');
    const lomin = url.searchParams.get('lomin');
    const lomax = url.searchParams.get('lomax');

    if (!lamin || !lamax || !lomin || !lomax) {
      return new Response(
        JSON.stringify({ error: 'Missing required params: lamin, lamax, lomin, lomax' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate params are reasonable numbers
    const bounds = [lamin, lamax, lomin, lomax].map(Number);
    if (bounds.some(isNaN)) {
      return new Response(
        JSON.stringify({ error: 'Parameters must be valid numbers' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Limit bounding box size to prevent abuse (max ~10 degrees per axis)
    if (Math.abs(bounds[1] - bounds[0]) > 10 || Math.abs(bounds[3] - bounds[2]) > 10) {
      return new Response(
        JSON.stringify({ error: 'Bounding box too large. Max 10 degrees per axis.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const cacheKey = `${lamin},${lamax},${lomin},${lomax}`;

    // Return cached result if fresh
    if (cache && cache.key === cacheKey && Date.now() - cache.ts < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify(cache.data),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'HIT' } }
      );
    }

    // Fetch from OpenSky
    const openskyUrl = `${OPENSKY_BASE}?lamin=${lamin}&lamax=${lamax}&lomin=${lomin}&lomax=${lomax}`;
    const res = await fetch(openskyUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });

    if (!res.ok) {
      const status = res.status;
      if (status === 429) {
        return new Response(
          JSON.stringify({ error: 'OpenSky rate limit exceeded. Try again in a few seconds.', states: [] }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      return new Response(
        JSON.stringify({ error: `OpenSky returned ${status}`, states: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Upstream-Status': String(status) } }
      );
    }

    const data = await res.json();

    // Cache the result
    cache = { key: cacheKey, data, ts: Date.now() };

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'MISS' } }
    );

  } catch (err) {
    console.error('[opensky-proxy] Error:', err);
    // Return 200 with empty states so the client gracefully shows no aircraft
    return new Response(
      JSON.stringify({ error: 'OpenSky unreachable', states: [] }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Cache': 'ERROR' } }
    );
  }
});
