/**
 * Intel OSINT — IP ownership lookup via RDAP (registry data) + reverse DNS.
 *
 * Returns who holds the address block (network name, CIDR, org, country,
 * abuse contact) straight from the Regional Internet Registry, plus PTR names.
 * Replaces ip-api.com, whose free tier is non-commercial and HTTP-only.
 * No city-level geolocation: there is no free, keyless, commercially
 * licensed IP-geo API (MaxMind GeoLite2 would need a licence key).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { requireIntelUser } from "../_shared/intel-auth.ts";
import { rdapIp, reverseDns } from "../_shared/rdap.ts";

const IPV4 = /^(\d{1,3}\.){3}\d{1,3}$/;
const IPV6 = /^[0-9a-fA-F:]+$/;

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = await requireIntelUser(req, corsHeaders, { limit: 30 });
  if (denied) return denied;
  const jsonHeaders = { ...corsHeaders, "Content-Type": "application/json" };

  const ip = new URL(req.url).searchParams.get("ip")?.trim();
  if (!ip) return new Response(JSON.stringify({ error: "Missing ip parameter" }), { status: 400, headers: jsonHeaders });
  if (!IPV4.test(ip) && !(ip.includes(":") && IPV6.test(ip))) {
    return new Response(JSON.stringify({ error: "Invalid IP format" }), { status: 400, headers: jsonHeaders });
  }

  const [network, ptr] = await Promise.all([
    rdapIp(ip).catch((e) => { console.warn("[intel-osint-ip] rdap", e); return null; }),
    IPV4.test(ip) ? reverseDns(ip) : Promise.resolve([] as string[]),
  ]);

  return new Response(JSON.stringify({
    ip,
    source: "rdap",
    network: network ?? undefined,
    ptr,
    error: network ? undefined : "No registry record found",
    timestamp: new Date().toISOString(),
  }), { headers: jsonHeaders });
});
