/**
 * Intel OSINT — BGP / ASN lookups (bgpview.io).
 * Accepts IP or ASN.
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited, getClientIp } from "../_shared/ssrf-guard.ts";

interface BgpViewEnvelope<T> { status: "ok" | string; data?: T; }

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");
  if (!query) {
    return new Response(
      JSON.stringify({ error: "Missing query parameter (IP, ASN number, or prefix)" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const isIP = /^(\d{1,3}\.){3}\d{1,3}$/.test(query);
  const isASN = /^(AS)?\d+$/i.test(query);
  const asnNum = isASN ? query.replace(/^AS/i, "") : null;

  try {
    if (isIP) {
      const res = await fetch(`https://api.bgpview.io/ip/${query}`, {
        signal: AbortSignal.timeout(8_000),
        headers: { Accept: "application/json" },
      });
      if (res.ok) {
        const data = (await res.json()) as BgpViewEnvelope<unknown>;
        if (data.status === "ok") {
          return new Response(
            JSON.stringify({
              query, type: "ip", ip: data.data,
              timestamp: new Date().toISOString(),
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
      return new Response(
        JSON.stringify({
          query, type: "ip", error: "BGP lookup failed",
          timestamp: new Date().toISOString(),
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (asnNum) {
      const [asnRes, prefixRes, peersRes] = await Promise.allSettled([
        fetch(`https://api.bgpview.io/asn/${asnNum}`, { signal: AbortSignal.timeout(8_000) }),
        fetch(`https://api.bgpview.io/asn/${asnNum}/prefixes`, { signal: AbortSignal.timeout(8_000) }),
        fetch(`https://api.bgpview.io/asn/${asnNum}/peers`, { signal: AbortSignal.timeout(8_000) }),
      ]);

      const response: Record<string, unknown> = {
        query, type: "asn", timestamp: new Date().toISOString(),
      };

      if (asnRes.status === "fulfilled" && asnRes.value.ok) {
        const d = (await asnRes.value.json()) as BgpViewEnvelope<unknown>;
        if (d.status === "ok") response.asn = d.data;
      }
      if (prefixRes.status === "fulfilled" && prefixRes.value.ok) {
        const d = (await prefixRes.value.json()) as BgpViewEnvelope<{
          ipv4_prefixes?: unknown[]; ipv6_prefixes?: unknown[];
        }>;
        if (d.status === "ok" && d.data) {
          response.prefixes = {
            ipv4: (d.data.ipv4_prefixes ?? []).slice(0, 20),
            ipv6: (d.data.ipv6_prefixes ?? []).slice(0, 10),
            total_v4: d.data.ipv4_prefixes?.length ?? 0,
            total_v6: d.data.ipv6_prefixes?.length ?? 0,
          };
        }
      }
      if (peersRes.status === "fulfilled" && peersRes.value.ok) {
        const d = (await peersRes.value.json()) as BgpViewEnvelope<{ ipv4_peers?: unknown[] }>;
        if (d.status === "ok" && d.data) {
          response.peers = {
            upstream: (d.data.ipv4_peers ?? []).slice(0, 10),
            total: d.data.ipv4_peers?.length ?? 0,
          };
        }
      }

      return new Response(JSON.stringify(response), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({ error: "Unrecognized query format. Use IP address or AS number." }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[intel-osint-bgp]", err);
    return new Response(JSON.stringify({ error: "BGP lookup failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
