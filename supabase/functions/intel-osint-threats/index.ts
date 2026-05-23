/**
 * Intel OSINT — Threat intel (AlienVault OTX + Tor exit-node list).
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited, getClientIp } from "../_shared/ssrf-guard.ts";

interface OtxPulse {
  name?: string; description?: string;
  created?: string; modified?: string;
  tags?: string[]; adversary?: string;
  targeted_countries?: string[]; indicator_count?: number;
}
interface OtxActivityResponse { results?: OtxPulse[]; }
interface OtxIndicatorGeneral {
  reputation?: number;
  pulse_info?: { count?: number };
  country_name?: string;
  asn?: string;
  whois?: { registrar?: string; creation_date?: string; expiration_date?: string };
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const query = searchParams.get("query");

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const results: Record<string, unknown> = {
    threat_level: "LOW",
    timestamp: new Date().toISOString(),
  };

  try {
    const actRes = await fetch(
      "https://otx.alienvault.com/api/v1/pulses/activity?limit=10",
      { signal: AbortSignal.timeout(8_000) },
    );
    if (actRes.ok) {
      const data = (await actRes.json()) as OtxActivityResponse;
      results.pulses = (data.results ?? []).slice(0, 10).map((p) => ({
        name: p.name ?? "",
        description: (p.description ?? "").slice(0, 200),
        created: p.created ?? "",
        modified: p.modified ?? "",
        tags: (p.tags ?? []).slice(0, 5),
        adversary: p.adversary ?? "",
        targeted_countries: p.targeted_countries ?? [],
        indicators_count: p.indicator_count ?? 0,
      }));
    }
  } catch (e) {
    console.warn("[intel-osint-threats] otx-activity error:", e);
  }

  if (query) {
    const isIPv4 = /^(\d{1,3}\.){3}\d{1,3}$/.test(query);

    if (isIPv4) {
      try {
        const torRes = await fetch("https://check.torproject.org/torbulkexitlist", {
          signal: AbortSignal.timeout(5_000),
        });
        if (torRes.ok) {
          const torList = await torRes.text();
          results.tor_exit_node = torList.includes(query);
        }
      } catch (e) {
        console.warn("[intel-osint-threats] tor error:", e);
        results.tor_exit_node = null;
      }

      try {
        const res = await fetch(
          `https://otx.alienvault.com/api/v1/indicators/IPv4/${query}/general`,
          { signal: AbortSignal.timeout(5_000) },
        );
        if (res.ok) {
          const data = (await res.json()) as OtxIndicatorGeneral;
          results.otx = {
            reputation: data.reputation,
            pulse_count: data.pulse_info?.count ?? 0,
            country: data.country_name,
            asn: data.asn,
          };
        }
      } catch (e) {
        console.warn("[intel-osint-threats] otx-ip error:", e);
      }
    } else {
      try {
        const res = await fetch(
          `https://otx.alienvault.com/api/v1/indicators/domain/${encodeURIComponent(query)}/general`,
          { signal: AbortSignal.timeout(5_000) },
        );
        if (res.ok) {
          const data = (await res.json()) as OtxIndicatorGeneral;
          results.otx = {
            pulse_count: data.pulse_info?.count ?? 0,
            whois: data.whois,
          };
        }
      } catch (e) {
        console.warn("[intel-osint-threats] otx-domain error:", e);
      }
    }
  }

  const otx = results.otx as { pulse_count?: number } | undefined;
  const pulseCount = otx?.pulse_count ?? 0;
  results.threat_level = pulseCount > 5 ? "HIGH" : pulseCount > 0 ? "MEDIUM" : "LOW";

  return new Response(JSON.stringify(results), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
