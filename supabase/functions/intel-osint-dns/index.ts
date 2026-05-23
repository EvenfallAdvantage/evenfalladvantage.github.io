/**
 * Intel OSINT — DNS lookup (Google DNS-over-HTTPS).
 * Adapted from Osiris (github.com/simplifaisoul/osiris, MIT).
 */

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { isRateLimited, getClientIp } from "../_shared/ssrf-guard.ts";

interface DohAnswer { name: string; type: number; TTL: number; data: string; }
interface DohResponse { Status?: number; Answer?: DohAnswer[]; }

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
    const types = ["A", "AAAA", "MX", "NS", "TXT", "CNAME", "SOA"];
    const records: Record<string, Array<{ name: string; type: number; ttl: number; data: string }>> = {};

    const lookups = await Promise.allSettled(
      types.map(async (type) => {
        const res = await fetch(
          `https://dns.google/resolve?name=${encodeURIComponent(domain)}&type=${type}`,
          { signal: AbortSignal.timeout(5_000), headers: { Accept: "application/json" } },
        );
        if (res.ok) {
          const data = (await res.json()) as DohResponse;
          return { type, answers: data.Answer ?? [] };
        }
        return { type, answers: [] as DohAnswer[] };
      }),
    );

    for (const r of lookups) {
      if (r.status === "fulfilled") {
        const { type, answers } = r.value;
        records[type] = answers.map((a) => ({
          name: a.name, type: a.type, ttl: a.TTL, data: a.data,
        }));
      }
    }

    const aRecords = records.A ?? [];
    const mxRecords = records.MX ?? [];
    const nsRecords = records.NS ?? [];

    return new Response(
      JSON.stringify({
        domain,
        records,
        summary: {
          ip_addresses: aRecords.map((r) => r.data),
          mail_servers: mxRecords.map((r) => r.data),
          nameservers: nsRecords.map((r) => r.data),
          total_records: Object.values(records).flat().length,
        },
        timestamp: new Date().toISOString(),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[intel-osint-dns]", err);
    return new Response(JSON.stringify({ error: "DNS lookup failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
