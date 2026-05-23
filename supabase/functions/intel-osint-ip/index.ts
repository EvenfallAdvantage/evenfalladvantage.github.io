/**
 * Intel OSINT — IP geolocation + reputation (ip-api.com).
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited, getClientIp } from "../_shared/ssrf-guard.ts";

interface IpApiResponse {
  status?: "success" | "fail";
  country?: string; countryCode?: string;
  regionName?: string; city?: string;
  lat?: number; lon?: number;
  timezone?: string; isp?: string; org?: string;
  as?: string; asname?: string;
  mobile?: boolean; proxy?: boolean; hosting?: boolean;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const ip = searchParams.get("ip");
  if (!ip) {
    return new Response(JSON.stringify({ error: "Missing ip parameter" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^[0-9a-fA-F:]+$/;
  if (!ipv4.test(ip) && !ipv6.test(ip)) {
    return new Response(JSON.stringify({ error: "Invalid IP format" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Record<string, unknown> = {
    ip,
    reputation: { is_proxy: false, is_hosting: false, is_mobile: false, risk_level: "LOW" },
    timestamp: new Date().toISOString(),
  };

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,message,continent,country,countryCode,region,regionName,city,zip,lat,lon,timezone,isp,org,as,asname,mobile,proxy,hosting,query`,
      { signal: AbortSignal.timeout(5_000) },
    );
    if (res.ok) {
      const geo = (await res.json()) as IpApiResponse;
      if (geo.status === "success") {
        results.geo = {
          country: geo.country ?? "", country_code: geo.countryCode ?? "",
          region: geo.regionName ?? "", city: geo.city ?? "",
          lat: geo.lat ?? 0, lon: geo.lon ?? 0,
          timezone: geo.timezone ?? "", isp: geo.isp ?? "", org: geo.org ?? "",
          as_number: geo.as ?? "", as_name: geo.asname ?? "",
          is_mobile: geo.mobile ?? false, is_proxy: geo.proxy ?? false,
          is_hosting: geo.hosting ?? false,
        };
        results.reputation = {
          is_proxy: geo.proxy ?? false,
          is_hosting: geo.hosting ?? false,
          is_mobile: geo.mobile ?? false,
          risk_level: geo.proxy ? "HIGH" : geo.hosting ? "MEDIUM" : "LOW",
        };
      }
    }
  } catch (e) {
    console.warn("[intel-osint-ip]", e);
  }

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
