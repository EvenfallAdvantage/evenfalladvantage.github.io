/**
 * Intel OSINT — Certificate Transparency lookup (crt.sh).
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited, getClientIp } from "../_shared/ssrf-guard.ts";

interface CrtShCert {
  id: number;
  issuer_name?: string;
  common_name?: string;
  name_value?: string;
  not_before?: string;
  not_after?: string;
  serial_number?: string;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const { searchParams } = new URL(req.url);
  const domain = searchParams.get("domain");
  if (!domain) {
    return new Response(JSON.stringify({ error: "Missing domain parameter" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const clientIp = getClientIp(req);
  if (isRateLimited(clientIp, 20, 60_000)) {
    return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
      status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!/^[a-zA-Z0-9][a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(domain)) {
    return new Response(JSON.stringify({ error: "Invalid domain format" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const res = await fetch(
      `https://crt.sh/?q=%25.${encodeURIComponent(domain)}&output=json`,
      {
        signal: AbortSignal.timeout(10_000),
        headers: { "User-Agent": "OverwatchIntel/1.0 (+evenfalladvantage.com)" },
      },
    );

    if (!res.ok) {
      return new Response(
        JSON.stringify({
          domain, certificates: [], subdomains: [],
          total_certs: 0, unique_subdomains: 0,
          timestamp: new Date().toISOString(),
          error: "crt.sh unavailable",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const certs = (await res.json()) as CrtShCert[];
    const seen = new Set<string>();
    const subdomains = new Set<string>();
    const uniqueCerts: Array<{
      id: number; issuer: string; common_name: string; name_value: string;
      not_before: string; not_after: string; serial: string;
    }> = [];

    for (const cert of certs.slice(0, 200)) {
      const key = `${cert.common_name}-${cert.serial_number}`;
      if (seen.has(key)) continue;
      seen.add(key);

      const name = cert.name_value ?? "";
      name.split("\n").forEach((n) => {
        const clean = n.trim().replace(/^\*\./, "");
        if (clean.endsWith(domain)) subdomains.add(clean);
      });

      uniqueCerts.push({
        id: cert.id,
        issuer: cert.issuer_name ?? "",
        common_name: cert.common_name ?? "",
        name_value: cert.name_value ?? "",
        not_before: cert.not_before ?? "",
        not_after: cert.not_after ?? "",
        serial: cert.serial_number ?? "",
      });
    }

    return new Response(
      JSON.stringify({
        domain,
        certificates: uniqueCerts.slice(0, 50),
        subdomains: Array.from(subdomains).sort(),
        total_certs: certs.length,
        unique_subdomains: subdomains.size,
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[intel-osint-certs]", err);
    return new Response(
      JSON.stringify({
        domain, certificates: [], subdomains: [],
        total_certs: 0, unique_subdomains: 0,
        timestamp: new Date().toISOString(),
        error: "Lookup failed",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
